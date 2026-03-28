import asyncio
import hashlib
import html
import json
import logging
import re
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

from models.schemas import Session, SessionStatus, ClinicalNote
from services.gemini_service import GeminiExtractionService
from services.fhir_service import FHIRBundleBuilder
from services.cds_service import check_clinical_alerts
from services.terminology_service import validate_clinical_data
from services.supabase_service import persist_session as _persist_to_supabase

logger = logging.getLogger(__name__)

router = APIRouter()

# prevent fire-and-forget tasks from being GC'd before completion
_background_tasks: set = set()

# In-memory session store (shared with sessions router)
# Imported by sessions.py as well
sessions_store: dict[str, Session] = {}

SESSION_TTL_HOURS = 24
MAX_SESSIONS = 100

VALID_SPECIALTIES = {
    "general", "cardiology", "endocrinology", "pulmonology",
    "gastroenterology", "orthopedics", "neurology", "pediatrics",
    "dermatology", "psychiatry",
}

UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)

# Minimum transcript length worth sending to Gemini at all
MIN_PROCESSABLE_LENGTH = 20


def _segment_hash(text: str) -> str:
    """Return a stable hash for a normalised transcript segment.

    Normalisation: collapse runs of whitespace, lowercase, strip leading/
    trailing whitespace.  This makes the dedup robust against minor
    punctuation-level differences that the Web Speech API sometimes introduces
    across restarts for the same spoken words.
    """
    normalised = " ".join(text.lower().split())
    return hashlib.sha256(normalised.encode()).hexdigest()


def _cleanup_sessions() -> None:
    """Remove expired sessions to prevent unbounded memory growth."""
    now = datetime.now()
    expired = [
        sid for sid, session in sessions_store.items()
        if (now - session.created_at).total_seconds() > SESSION_TTL_HOURS * 3600
    ]
    for sid in expired:
        del sessions_store[sid]
    # If still over limit, remove oldest
    if len(sessions_store) > MAX_SESSIONS:
        sorted_sessions = sorted(sessions_store.items(), key=lambda x: x[1].created_at)
        for sid, _ in sorted_sessions[:len(sessions_store) - MAX_SESSIONS]:
            del sessions_store[sid]

# Lazy-initialized service (so app starts even without GEMINI_API_KEY)
_gemini_service = None


def _get_gemini_service() -> GeminiExtractionService:
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiExtractionService()
    return _gemini_service



@router.websocket("/ws/transcribe/{session_id}")
async def websocket_transcribe(websocket: WebSocket, session_id: str):
    if not UUID_PATTERN.match(session_id):
        await websocket.close(code=4000, reason="Invalid session ID format")
        return

    await websocket.accept()
    await asyncio.to_thread(_cleanup_sessions)
    logger.info("WebSocket connected for session %s", session_id)

    # Get or create session
    if session_id not in sessions_store:
        sessions_store[session_id] = Session(id=session_id)

    session = sessions_store[session_id]
    specialty = "general"
    abha_id = None
    fhir_builder = FHIRBundleBuilder()
    processing_lock = asyncio.Lock()

    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw) > 65536:
                await _send_error(websocket, "Message too large")
                continue
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await _send_error(websocket, "Invalid JSON")
                continue

            msg_type = message.get("type", "")

            if msg_type == "transcript":
                text = message.get("text", "")
                is_final = message.get("is_final", False)

                if is_final and text:
                    if len(session.transcript) > 100_000:
                        await _send_error(websocket, "Transcript limit reached (100KB)")
                        continue

                    seg_hash = _segment_hash(text)
                    if seg_hash in session.seen_transcript_hashes:
                        # Duplicate segment — frontend re-sent due to WS reconnect
                        # or Web Speech API restart.  Acknowledge with current
                        # length so the frontend stays in sync; do not append.
                        logger.debug(
                            "Session %s: duplicate transcript segment ignored (hash=%s)",
                            session_id,
                            seg_hash[:12],
                        )
                        await websocket.send_json(
                            {
                                "type": "transcript_ack",
                                "text": text,
                                "total_length": len(session.transcript.strip()),
                                "duplicate": True,
                            }
                        )
                        continue

                    session.seen_transcript_hashes.add(seg_hash)
                    session.transcript += " " + text

                    # Send acknowledgment (no auto-processing — extraction
                    # happens only on explicit "process" or "stop")
                    await websocket.send_json(
                        {
                            "type": "transcript_ack",
                            "text": text,
                            "total_length": len(session.transcript.strip()),
                        }
                    )

                elif not is_final and text:
                    # Interim result — forward to frontend for live display
                    await websocket.send_json(
                        {
                            "type": "interim_transcript",
                            "text": text,
                        }
                    )

            elif msg_type == "specialty":
                # Update the specialty for this session
                new_specialty = message.get("specialty", "general")
                if new_specialty not in VALID_SPECIALTIES:
                    new_specialty = "general"
                specialty = new_specialty
                await websocket.send_json(
                    {
                        "type": "specialty_ack",
                        "specialty": specialty,
                    }
                )

            elif msg_type == "abha_id":
                abha_id = message.get("abha_id")
                if abha_id and not re.match(r'^\d{2}-\d{4}-\d{4}-\d{4}$', str(abha_id)):
                    await _send_error(websocket, "Invalid ABHA ID format")
                    continue
                await websocket.send_json({"type": "abha_id_ack", "abha_id": abha_id})

            elif msg_type == "process":
                # Process the full accumulated transcript
                async with processing_lock:
                    full_text = session.transcript.strip()
                    if full_text and len(full_text) >= MIN_PROCESSABLE_LENGTH:
                        await _process_and_send(
                            websocket,
                            session,
                            session.transcript,
                            fhir_builder,
                            specialty=specialty,
                            abha_id=abha_id,
                        )
                    else:
                        logger.info(
                            "Session %s: 'process' requested but transcript too short (%d chars)",
                            session_id,
                            len(full_text),
                        )
                        await _send_error(
                            websocket,
                            "Transcript too short to process. Keep recording.",
                        )

            elif msg_type == "stop":
                # Process the FULL transcript at end of session
                async with processing_lock:
                    full_text = session.transcript.strip()
                    if full_text and len(full_text) >= MIN_PROCESSABLE_LENGTH:
                        await _process_and_send(
                            websocket,
                            session,
                            session.transcript,
                            fhir_builder,
                            specialty=specialty,
                            abha_id=abha_id,
                        )
                    elif full_text:
                        logger.info(
                            "Session %s: stop with short transcript (%d chars), skipping extraction",
                            session_id,
                            len(full_text),
                        )

                session.completed_at = datetime.now()
                session.status = SessionStatus.COMPLETED
                sessions_store[session_id] = session

                await websocket.send_json(
                    {
                        "type": "session_complete",
                        "session_id": session_id,
                    }
                )
                logger.info("Session %s completed", session_id)

            else:
                await _send_error(
                    websocket, f"Unknown message type: {msg_type}"
                )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as e:
        logger.error("WebSocket error for session %s: %s", session_id, e, exc_info=True)
        await _send_error(websocket, str(e))


async def _send_error(websocket: WebSocket, message: str) -> None:
    """Send an error message to the frontend, swallowing send failures."""
    try:
        await websocket.send_json({"type": "error", "message": message})
    except Exception:
        pass


def _calculate_fhir_quality(fhir_bundle: dict, clinical_data: dict) -> dict:
    """Calculate FHIR bundle completeness and quality score."""
    if not fhir_bundle or not isinstance(fhir_bundle, dict):
        return {"score": 0, "total_resources": 0, "checks": [], "grade": "D"}

    score = 0
    max_score = 0
    checks = []

    entries = fhir_bundle.get("entry", []) or []
    resource_types = [
        e.get("resource", {}).get("resourceType")
        for e in entries
        if isinstance(e, dict)
    ]

    # Check for required resource types
    required = ["Patient", "Encounter", "Condition"]
    for rt in required:
        max_score += 15
        if rt in resource_types:
            score += 15
            checks.append({"name": f"{rt} resource", "passed": True})
        else:
            checks.append({"name": f"{rt} resource", "passed": False})

    # Check for optional but valuable resource types
    optional = [
        "Observation",
        "MedicationRequest",
        "AllergyIntolerance",
        "CarePlan",
        "ServiceRequest",
        "DetectedIssue",
    ]
    for rt in optional:
        max_score += 10
        if rt in resource_types:
            score += 10
            checks.append({"name": f"{rt} resource", "passed": True})
        else:
            checks.append({"name": f"{rt} resource", "passed": False})

    # Check coding systems (ICD-10, SNOMED, LOINC, RxNorm)
    coding_systems_found: set[str] = set()
    for entry in entries:
        resource = entry.get("resource", {}) if isinstance(entry, dict) else {}
        _extract_coding_systems(resource, coding_systems_found)

    for system_name in ["ICD-10", "SNOMED", "LOINC", "RxNorm"]:
        max_score += 5
        if any(system_name.lower() in s.lower() for s in coding_systems_found):
            score += 5
            checks.append({"name": f"{system_name} coding", "passed": True})
        else:
            checks.append({"name": f"{system_name} coding", "passed": False})

    # Check for proper references between resources
    max_score += 5
    has_references = any(
        "subject" in e.get("resource", {}) or "patient" in e.get("resource", {})
        for e in entries
        if isinstance(e, dict) and e.get("resource", {}).get("resourceType") != "Patient"
    )
    if has_references:
        score += 5
        checks.append({"name": "Resource references", "passed": True})
    else:
        checks.append({"name": "Resource references", "passed": False})

    percentage = round((score / max_score * 100)) if max_score > 0 else 0

    return {
        "score": percentage,
        "total_resources": len(entries),
        "checks": checks,
        "grade": (
            "A" if percentage >= 90
            else "B" if percentage >= 75
            else "C" if percentage >= 60
            else "D"
        ),
    }


def _extract_coding_systems(obj: dict, systems: set):
    """Recursively find coding systems in a FHIR resource."""
    if isinstance(obj, dict):
        if "system" in obj:
            systems.add(obj["system"])
        for v in obj.values():
            _extract_coding_systems(v, systems)
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, (dict, list)):
                _extract_coding_systems(item, systems)


async def _process_and_send(
    websocket: WebSocket,
    session: Session,
    transcript_text: str,
    fhir_builder: FHIRBundleBuilder,
    specialty: str = "general",
    abha_id: str | None = None,
):
    """Run Gemini extraction and FHIR bundle generation, send results."""
    cleaned = transcript_text.strip()

    # --- Guard: don't process empty/tiny transcripts ---
    if not cleaned or len(cleaned) < MIN_PROCESSABLE_LENGTH:
        logger.warning(
            "Skipping _process_and_send: transcript too short (%d chars)",
            len(cleaned),
        )
        await _send_error(websocket, "Transcript too short to process.")
        return

    await websocket.send_json({"type": "processing", "status": "started"})
    logger.info(
        "Processing transcript (%d chars) for session %s",
        len(cleaned),
        session.id,
    )

    try:
        gemini = _get_gemini_service()

        clinical_data = await gemini.extract_clinical_data(
            transcript=cleaned,
            specialty=specialty,
        )

        if clinical_data is None:
            logger.error("Gemini extraction returned None for session %s", session.id)
            await _send_error(
                websocket,
                "Clinical extraction failed — the AI could not parse the transcript. "
                "Try speaking more clearly or recording a longer segment.",
            )
            await websocket.send_json({"type": "processing", "status": "completed"})
            return

        # --- Null-safe: ensure expected keys exist with safe defaults ---
        clinical_data.setdefault("patient_info", {})
        clinical_data.setdefault("chief_complaint", None)
        clinical_data.setdefault("history_of_present_illness", None)
        clinical_data.setdefault("symptoms", [])
        clinical_data.setdefault("vitals", {})
        clinical_data.setdefault("diagnosis", [])
        clinical_data.setdefault("medications", [])
        clinical_data.setdefault("observations", [])
        clinical_data.setdefault("allergies", [])
        clinical_data.setdefault("differential_diagnosis", [])
        clinical_data.setdefault("risk_factors", [])
        clinical_data.setdefault("recommended_tests", [])
        clinical_data.setdefault("follow_up", None)
        clinical_data.setdefault("clinical_notes", None)

        # Coerce None lists to empty lists (Gemini sometimes returns null for arrays)
        for list_key in (
            "symptoms", "diagnosis", "medications", "observations",
            "allergies", "differential_diagnosis", "risk_factors",
            "recommended_tests",
        ):
            if clinical_data.get(list_key) is None:
                clinical_data[list_key] = []

        if clinical_data.get("vitals") is None:
            clinical_data["vitals"] = {}
        if clinical_data.get("patient_info") is None:
            clinical_data["patient_info"] = {}

        # Update session with clinical note
        try:
            session.clinical_note = ClinicalNote(**clinical_data)
        except Exception as e:
            logger.warning(
                "Could not parse clinical data into ClinicalNote model: %s", e
            )
            # Fallback: coerce None values and retry with all fields
            try:
                for key, val in clinical_data.items():
                    if isinstance(val, list):
                        # Coerce None items in lists and None field values within dicts
                        clinical_data[key] = [
                            {k: (v if v is not None else "") for k, v in item.items()}
                            if isinstance(item, dict) else (item or "")
                            for item in val if item is not None
                        ]
                    elif val is None and key not in ("follow_up",):
                        if key in ("vitals", "patient_info"):
                            clinical_data[key] = {}
                        else:
                            clinical_data[key] = ""
                session.clinical_note = ClinicalNote(**clinical_data)
            except Exception as e2:
                logger.error("Fallback ClinicalNote creation also failed: %s", e2)
                await _send_error(websocket, "Failed to parse clinical data.")
                await websocket.send_json({"type": "processing", "status": "completed"})
                return

        # Run CDS checks and terminology validation concurrently (both
        # operate on clinical_data independently).  CDS results feed into
        # the FHIR bundle build, so we await both before building.
        try:
            cds_alerts, terminology = await asyncio.gather(
                asyncio.to_thread(check_clinical_alerts, clinical_data),
                asyncio.to_thread(validate_clinical_data, clinical_data),
            )
        except Exception as e:
            logger.error("CDS/terminology concurrent check failed: %s", e, exc_info=True)
            cds_alerts = []
            terminology = {
                "score_boost": 0,
                "valid_count": 0,
                "total_count": 0,
                "validation_ratio": 0,
            }

        # Build FHIR bundle (includes DetectedIssue from CDS alerts)
        try:
            fhir_bundle = fhir_builder.build_bundle(clinical_data, cds_alerts=cds_alerts, abha_id=abha_id)
        except Exception as e:
            logger.error("FHIR bundle build failed: %s", e, exc_info=True)
            fhir_bundle = {
                "resourceType": "Bundle",
                "type": "document",
                "entry": [],
            }
        session.fhir_bundle = fhir_bundle

        # Send clinical note
        await websocket.send_json(
            {
                "type": "clinical_note",
                "data": clinical_data,
            }
        )

        # Send FHIR bundle with quality score + terminology validation
        fhir_quality = _calculate_fhir_quality(fhir_bundle, clinical_data)
        # Boost quality score based on terminology validation
        if terminology.get("score_boost", 0) > 0:
            fhir_quality["score"] = min(
                100, fhir_quality["score"] + terminology["score_boost"]
            )
            fhir_quality["terminology"] = {
                "validated": terminology["valid_count"],
                "total": terminology["total_count"],
                "ratio": terminology["validation_ratio"],
            }
            # Recalculate grade
            s = fhir_quality["score"]
            fhir_quality["grade"] = (
                "A" if s >= 90
                else "B" if s >= 75
                else "C" if s >= 60
                else "D"
            )

        # Persist CDS alerts and FHIR quality on session
        session.cds_alerts = cds_alerts
        session.fhir_quality = fhir_quality

        await websocket.send_json(
            {
                "type": "fhir_bundle",
                "data": fhir_bundle,
                "quality_score": fhir_quality,
            }
        )

        # Send CDS alerts to frontend (always send, even if empty, to clear stale alerts)
        await websocket.send_json(
            {
                "type": "cds_alerts",
                "data": cds_alerts,
            }
        )

        await websocket.send_json(
            {"type": "processing", "status": "completed"}
        )
        logger.info(
            "Processing completed for session %s — %d FHIR resources, %d CDS alerts",
            session.id,
            len(fhir_bundle.get("entry", [])),
            len(cds_alerts),
        )

        # Fire-and-forget: persist to Supabase (failure won't break WS)
        try:
            task = asyncio.create_task(
                _persist_to_supabase(
                    session_id=session.id,
                    doctor_id=None,  # TODO: wire doctor_id from auth
                    transcript=session.transcript,
                    clinical_data=clinical_data,
                    fhir_bundle=fhir_bundle,
                    fhir_quality=fhir_quality,
                    cds_alerts=cds_alerts,
                    specialty=specialty,
                )
            )
            _background_tasks.add(task)
            task.add_done_callback(_background_tasks.discard)
        except Exception as persist_exc:
            logger.warning("Supabase persist_session task failed to start: %s", persist_exc)

    except Exception as e:
        logger.error("Processing error for session %s: %s", session.id, e, exc_info=True)
        await _send_error(websocket, "An error occurred during processing. Please try again.")
        await websocket.send_json({"type": "processing", "status": "completed"})


@router.get("/api/rx/{session_id}")
async def get_prescription(session_id: str):
    """Get prescription data for a session (for QR code scanning)."""
    session = sessions_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "clinical_note": session.clinical_note.model_dump() if session.clinical_note else None,
        "fhir_bundle": session.fhir_bundle,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("/rx/{session_id}", response_class=HTMLResponse)
async def view_prescription_page(
    session_id: str,
    doctor: str = Query(default="", description="Doctor name"),
    reg: str = Query(default="", description="Registration number"),
    clinic: str = Query(default="", description="Clinic name"),
):
    """Serve a human-readable prescription page for QR code scans."""
    session = sessions_store.get(session_id)

    if not session or not session.clinical_note:
        return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Prescription Not Found - MedScribe AI</title>
  <style>
    body {{ font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; color: #0f172a; display: flex; justify-content: center; }}
    .card {{ max-width: 480px; width: 100%; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }}
    h1 {{ font-size: 1.25rem; margin: 0 0 0.5rem; }}
    p {{ color: #64748b; font-size: 0.875rem; }}
    code {{ background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Prescription Not Found</h1>
    <p>No prescription data found for session <code>{html.escape(session_id)}</code>.</p>
    <p>The session may have expired or the consultation has not been processed yet.</p>
  </div>
</body>
</html>""", status_code=404)

    note = session.clinical_note
    patient = note.patient_info or {}
    patient_name = html.escape(patient.get("name") or "Patient")
    patient_age = html.escape(str(patient.get("age") or ""))
    patient_gender = html.escape(patient.get("gender") or "")
    date_str = html.escape(session.created_at.strftime("%d %b %Y, %I:%M %p") if session.created_at else "N/A")

    # Doctor identity: prefer query params, fall back to clinical_data
    clinical_raw = note.model_dump() if note else {}
    doctor_name = html.escape(doctor or clinical_raw.get("doctor_name", "") or "")
    reg_number = html.escape(reg or clinical_raw.get("registration_number", "") or "")
    clinic_name = html.escape(clinic or clinical_raw.get("clinic_name", "") or "MedScribe AI Clinic")

    # Build medications HTML
    meds_html = ""
    if note.medications:
        rows = ""
        for i, m in enumerate(note.medications, 1):
            med_name = html.escape(m.name or "Unknown")
            med_generic = html.escape(m.generic_name or "")
            med_dosage = html.escape(m.dosage or "-")
            med_freq = html.escape(m.frequency or "-")
            med_dur = html.escape(m.duration or "-")
            rows += f"""<tr>
              <td>{i}</td>
              <td><a href="#" class="med-link" data-drug="{med_name}" onclick="showAlternatives(this);return false"><strong>{med_name}</strong></a><br><span class="generic">{med_generic}</span></td>
              <td>{med_dosage}</td>
              <td>{med_freq}</td>
              <td>{med_dur}</td>
            </tr>"""
        meds_html = f"""<table>
          <thead><tr><th>#</th><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
          <tbody>{rows}</tbody>
        </table>"""
    else:
        meds_html = "<p class='empty'>No medications prescribed.</p>"

    # Diagnosis
    dx_html = ""
    if note.diagnosis:
        items = "".join(
            f"<li><strong>{html.escape(d.condition or 'Unknown')}</strong> <span class='code'>{html.escape(d.icd10_code or '')}</span></li>"
            for d in note.diagnosis
        )
        dx_html = f"<div class='section'><h3>Diagnosis</h3><ul>{items}</ul></div>"

    # Follow up
    fu_html = ""
    if note.follow_up:
        fu_html = f"<div class='section followup'><h3>Follow-up</h3><p>{html.escape(note.follow_up)}</p></div>"

    # Allergies
    allergy_html = ""
    if note.allergies:
        items = "".join(f"<li>{html.escape(str(a))}</li>" for a in note.allergies)
        allergy_html = f"<div class='section allergy'><h3>Allergies</h3><ul>{items}</ul></div>"

    return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Prescription - {patient_name} - MedScribe AI</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background: #f0f4f8; color: #1e293b; padding: 1rem; }}
    .rx {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }}
    .header {{ background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 1.5rem; }}
    .header h1 {{ font-size: 1.25rem; font-weight: 700; }}
    .header p {{ opacity: 0.85; font-size: 0.8rem; margin-top: 0.25rem; }}
    .badge {{ display: inline-block; background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: 999px; font-size: 0.7rem; margin-top: 0.5rem; }}
    .patient {{ padding: 1rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }}
    .patient .name {{ font-weight: 600; font-size: 1rem; }}
    .patient .meta {{ font-size: 0.8rem; color: #64748b; }}
    .body {{ padding: 1.5rem; }}
    .section {{ margin-bottom: 1.25rem; }}
    .section h3 {{ font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; }}
    .section ul {{ list-style: none; }}
    .section ul li {{ padding: 0.4rem 0; font-size: 0.875rem; border-bottom: 1px solid #f1f5f9; }}
    .section ul li:last-child {{ border: none; }}
    .code {{ background: #eff6ff; color: #2563eb; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 500; margin-left: 0.5rem; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 0.8rem; }}
    th {{ text-align: left; padding: 0.5rem; background: #f8fafc; color: #64748b; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e2e8f0; }}
    td {{ padding: 0.6rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }}
    .generic {{ color: #94a3b8; font-size: 0.75rem; }}
    .followup {{ background: #eff6ff; padding: 0.75rem 1rem; border-radius: 8px; }}
    .followup p {{ font-size: 0.875rem; color: #1e40af; }}
    .allergy {{ background: #fef2f2; padding: 0.75rem 1rem; border-radius: 8px; }}
    .allergy h3 {{ color: #dc2626; }}
    .allergy li {{ color: #991b1b; font-size: 0.875rem; }}
    .empty {{ color: #94a3b8; font-size: 0.875rem; font-style: italic; }}
    .doctor-info {{ padding: 0.75rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.8rem; color: #334155; }}
    .doctor-info .doc-name {{ font-weight: 600; font-size: 0.9rem; }}
    .doctor-info .doc-meta {{ color: #64748b; font-size: 0.75rem; margin-top: 0.15rem; }}
    .disclaimer {{ padding: 0.75rem 1.5rem; background: #fefce8; border-top: 1px solid #fde68a; text-align: center; font-size: 0.7rem; color: #92400e; font-weight: 500; }}
    .footer {{ padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.7rem; color: #94a3b8; }}
    .med-link {{ color: #2563eb; text-decoration: underline dotted; text-underline-offset: 2px; cursor: pointer; -webkit-tap-highlight-color: transparent; }}
    .med-link:hover {{ color: #1d4ed8; text-decoration: underline solid; }}
    .alt-overlay {{ position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn .15s ease; }}
    @media (min-width: 480px) {{ .alt-overlay {{ align-items: center; }} }}
    .alt-popup {{ background: white; border-radius: 16px 16px 0 0; width: 100%; max-width: 480px; max-height: 70vh; overflow-y: auto; box-shadow: 0 -4px 24px rgba(0,0,0,0.12); animation: slideUp .2s ease; }}
    @media (min-width: 480px) {{ .alt-popup {{ border-radius: 16px; }} }}
    .alt-popup .popup-hdr {{ padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; }}
    .alt-popup .popup-hdr h2 {{ font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0; }}
    .alt-popup .popup-hdr .popup-sub {{ font-size: 0.75rem; color: #64748b; margin-top: 2px; }}
    .alt-popup .popup-close {{ background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #94a3b8; padding: 4px 8px; border-radius: 8px; }}
    .alt-popup .popup-close:hover {{ background: #f1f5f9; color: #475569; }}
    .alt-popup .popup-body {{ padding: 0.75rem 1.25rem 1.25rem; }}
    .alt-popup .alt-item {{ padding: 0.6rem 0; border-bottom: 1px solid #f1f5f9; }}
    .alt-popup .alt-item:last-child {{ border: none; }}
    .alt-popup .alt-brand {{ font-weight: 600; font-size: 0.875rem; color: #1e293b; }}
    .alt-popup .alt-generic {{ font-size: 0.75rem; color: #64748b; margin-top: 1px; }}
    .alt-popup .alt-cat {{ display: inline-block; font-size: 0.65rem; background: #eff6ff; color: #2563eb; padding: 1px 6px; border-radius: 4px; margin-top: 3px; font-weight: 500; }}
    .alt-popup .popup-loading {{ padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.875rem; }}
    .alt-popup .popup-empty {{ padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.875rem; }}
    .alt-popup .popup-err {{ padding: 1.5rem; text-align: center; color: #dc2626; font-size: 0.875rem; }}
    .alt-popup .drug-info {{ margin-bottom: 0.75rem; padding: 0.75rem; background: #f8fafc; border-radius: 8px; }}
    .alt-popup .drug-info .di-label {{ font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; font-weight: 600; }}
    .alt-popup .drug-info .di-val {{ font-size: 0.8rem; color: #334155; margin-top: 1px; }}
    @keyframes fadeIn {{ from {{ opacity: 0; }} to {{ opacity: 1; }} }}
    @keyframes slideUp {{ from {{ transform: translateY(40px); opacity: 0; }} to {{ transform: translateY(0); opacity: 1; }} }}
    @media print {{ .alt-overlay {{ display: none !important; }} body {{ background: white; padding: 0; }} .rx {{ box-shadow: none; border-radius: 0; }} }}
  </style>
</head>
<body>
  <div class="rx">
    <div class="header">
      <h1>MedScribe AI</h1>
      <p>Digital Prescription</p>
      <span class="badge">FHIR R4 Compliant</span>
    </div>
    {'<div class="doctor-info">' + ('<div class="doc-name">' + doctor_name + '</div>' if doctor_name else '') + ('<div class="doc-meta">' + ' &bull; '.join(filter(None, [("Reg: " + reg_number) if reg_number else "", clinic_name])) + '</div>' if reg_number or clinic_name else '') + '</div>' if doctor_name or reg_number or clinic_name else ''}
    <div class="patient">
      <div>
        <div class="name">{patient_name}</div>
        <div class="meta">{', '.join(filter(None, [patient_age, patient_gender]))}</div>
      </div>
      <div class="meta">{date_str}</div>
    </div>
    <div class="body">
      {allergy_html}
      {dx_html}
      <div class="section">
        <h3>Medications</h3>
        {meds_html}
      </div>
      {fu_html}
    </div>
    <div class="disclaimer">
      Digitally Generated &mdash; Not a substitute for physical prescription
    </div>
    <div class="footer">
      Generated by MedScribe AI &mdash; Session {html.escape(session_id[:20])}...
    </div>
  </div>
  <script>
  function mk(tag, cls, text) {{ var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }}
  function showAlternatives(el) {{
    var drug = el.getAttribute('data-drug');
    if (!drug) return;
    var overlay = mk('div', 'alt-overlay');
    var popup = mk('div', 'alt-popup');
    var hdr = mk('div', 'popup-hdr');
    var hdrLeft = mk('div');
    hdrLeft.appendChild(mk('h2', '', drug));
    var sub = mk('div', 'popup-sub', 'Looking up alternatives\u2026');
    hdrLeft.appendChild(sub);
    var closeBtn = mk('button', 'popup-close', '\u00d7');
    closeBtn.onclick = function() {{ overlay.remove(); }};
    hdr.appendChild(hdrLeft); hdr.appendChild(closeBtn);
    popup.appendChild(hdr);
    var body = mk('div', 'popup-body');
    body.appendChild(mk('div', 'popup-loading', 'Loading\u2026'));
    popup.appendChild(body);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {{ if (e.target === overlay) overlay.remove(); }});
    fetch('/api/drugs/' + encodeURIComponent(drug) + '/alternatives')
      .then(function(r) {{
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }})
      .then(function(d) {{
        sub.textContent = d.generic ? d.generic + (d.category ? ' \u2022 ' + d.category : '') : (d.category || 'Drug details');
        body.replaceChildren();
        if (d.dosage || d.use) {{
          var info = mk('div', 'drug-info');
          if (d.dosage) {{
            var dg = mk('div');
            dg.appendChild(mk('span', 'di-label', 'Dosage'));
            dg.appendChild(mk('div', 'di-val', d.dosage));
            info.appendChild(dg);
          }}
          if (d.use) {{
            var us = mk('div');
            us.style.marginTop = '6px';
            us.appendChild(mk('span', 'di-label', 'Common Use'));
            us.appendChild(mk('div', 'di-val', d.use));
            info.appendChild(us);
          }}
          body.appendChild(info);
        }}
        if (d.alternatives && d.alternatives.length > 0) {{
          var altHdr = mk('div', '', 'Alternative Brands');
          altHdr.style.cssText = 'margin-bottom:6px;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em;color:#94a3b8;font-weight:600';
          body.appendChild(altHdr);
          d.alternatives.forEach(function(a) {{
            var item = mk('div', 'alt-item');
            item.appendChild(mk('div', 'alt-brand', a.brand));
            if (a.generic) item.appendChild(mk('div', 'alt-generic', a.generic + (a.dosage ? ' \u2022 ' + a.dosage : '')));
            if (a.category) item.appendChild(mk('span', 'alt-cat', a.category));
            body.appendChild(item);
          }});
        }} else {{
          body.appendChild(mk('div', 'popup-empty', 'No alternative brands found in database.'));
        }}
      }})
      .catch(function(err) {{
        body.replaceChildren();
        if (err.message === '404') {{
          body.appendChild(mk('div', 'popup-empty', 'Drug not found in reference database.'));
        }} else {{
          body.appendChild(mk('div', 'popup-err', 'Could not load alternatives. Try again.'));
        }}
      }});
  }}
  </script>
</body>
</html>""")

