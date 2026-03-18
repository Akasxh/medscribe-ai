import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form

from models.schemas import Session, SessionStatus, ClinicalNote
from services.gemini_service import GeminiExtractionService
from services.fhir_service import FHIRBundleBuilder
from services.cds_service import check_clinical_alerts
from services.terminology_service import validate_clinical_data
from services.stt_service import transcribe_audio, get_stt_status

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory session store (shared with sessions router)
# Imported by sessions.py as well
sessions_store: dict[str, Session] = {}

# Minimum accumulated transcript length before auto-processing
MIN_TRANSCRIPT_LENGTH = 100

# Minimum transcript length worth sending to Gemini at all
MIN_PROCESSABLE_LENGTH = 20

# Lazy-initialized service (so app starts even without GEMINI_API_KEY)
_gemini_service = None


def _get_gemini_service() -> GeminiExtractionService:
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiExtractionService()
    return _gemini_service


@router.post("/api/transcribe")
async def transcribe_audio_endpoint(
    file: UploadFile = File(...),
    language: str = Form(default="hi-IN"),
):
    """Transcribe audio using Sarvam AI STT."""
    audio_bytes = await file.read()
    transcript = await transcribe_audio(audio_bytes, language)
    if transcript is not None:
        return {"transcript": transcript, "language": language}
    return {"error": "Transcription failed", "transcript": ""}


@router.get("/api/stt/status")
async def stt_status():
    """Return STT service status."""
    return get_stt_status()


@router.websocket("/ws/transcribe/{session_id}")
async def websocket_transcribe(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info("WebSocket connected for session %s", session_id)

    # Get or create session
    if session_id not in sessions_store:
        sessions_store[session_id] = Session(id=session_id)

    session = sessions_store[session_id]
    accumulated_text = ""
    specialty = "general"
    fhir_builder = FHIRBundleBuilder()
    processing_lock = asyncio.Lock()

    try:
        while True:
            raw = await websocket.receive_text()
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
                    accumulated_text += " " + text
                    session.transcript += " " + text

                    # Send acknowledgment
                    await websocket.send_json(
                        {
                            "type": "transcript_ack",
                            "text": text,
                            "total_length": len(session.transcript.strip()),
                        }
                    )

                    # Auto-process if enough text accumulated
                    if len(accumulated_text.strip()) >= MIN_TRANSCRIPT_LENGTH:
                        if processing_lock.locked():
                            logger.debug(
                                "Session %s: skipping auto-process, already processing",
                                session_id,
                            )
                        else:
                            async with processing_lock:
                                await _process_and_send(
                                    websocket,
                                    session,
                                    accumulated_text,
                                    fhir_builder,
                                    specialty=specialty,
                                )
                            accumulated_text = ""

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
                specialty = new_specialty
                await websocket.send_json(
                    {
                        "type": "specialty_ack",
                        "specialty": specialty,
                    }
                )

            elif msg_type == "process":
                # Force processing even if text is short
                async with processing_lock:
                    text_to_process = accumulated_text.strip()
                    if text_to_process and len(text_to_process) >= MIN_PROCESSABLE_LENGTH:
                        await _process_and_send(
                            websocket,
                            session,
                            accumulated_text,
                            fhir_builder,
                            specialty=specialty,
                        )
                        accumulated_text = ""
                    elif session.transcript.strip() and len(session.transcript.strip()) >= MIN_PROCESSABLE_LENGTH:
                        # Re-process entire transcript
                        await _process_and_send(
                            websocket,
                            session,
                            session.transcript,
                            fhir_builder,
                            specialty=specialty,
                        )
                    else:
                        logger.info(
                            "Session %s: 'process' requested but transcript too short (%d chars)",
                            session_id,
                            len((text_to_process or session.transcript or "").strip()),
                        )
                        await _send_error(
                            websocket,
                            "Transcript too short to process. Keep recording.",
                        )

            elif msg_type == "stop":
                # Process any remaining text
                async with processing_lock:
                    remaining = accumulated_text.strip()
                    if remaining and len(remaining) >= MIN_PROCESSABLE_LENGTH:
                        await _process_and_send(
                            websocket,
                            session,
                            accumulated_text,
                            fhir_builder,
                            specialty=specialty,
                        )
                    elif remaining:
                        logger.info(
                            "Session %s: stop with short remaining text (%d chars), skipping extraction",
                            session_id,
                            len(remaining),
                        )

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

        existing_note = (
            session.clinical_note.model_dump()
            if session.clinical_note
            else None
        )

        clinical_data = await gemini.extract_clinical_data(
            transcript=cleaned,
            existing_note=existing_note,
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
            # Still send the raw data to frontend

        # Run Clinical Decision Support checks (needed for DetectedIssue FHIR resources)
        try:
            cds_alerts = check_clinical_alerts(clinical_data)
        except Exception as e:
            logger.error("CDS check failed: %s", e, exc_info=True)
            cds_alerts = []

        # Build FHIR bundle (includes DetectedIssue from CDS alerts)
        try:
            fhir_bundle = fhir_builder.build_bundle(clinical_data, cds_alerts=cds_alerts)
        except Exception as e:
            logger.error("FHIR bundle build failed: %s", e, exc_info=True)
            fhir_bundle = {
                "resourceType": "Bundle",
                "type": "collection",
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

        # Terminology validation
        try:
            terminology = validate_clinical_data(clinical_data)
        except Exception as e:
            logger.error("Terminology validation failed: %s", e, exc_info=True)
            terminology = {
                "score_boost": 0,
                "valid_count": 0,
                "total_count": 0,
                "validation_ratio": 0,
            }

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

        await websocket.send_json(
            {
                "type": "fhir_bundle",
                "data": fhir_bundle,
                "quality_score": fhir_quality,
            }
        )

        # Send CDS alerts to frontend
        if cds_alerts:
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

    except Exception as e:
        logger.error("Processing error for session %s: %s", session.id, e, exc_info=True)
        await _send_error(websocket, f"Processing error: {str(e)}")
        await websocket.send_json({"type": "processing", "status": "completed"})
