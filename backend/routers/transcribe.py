import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.schemas import Session, SessionStatus, ClinicalNote
from services.gemini_service import GeminiExtractionService
from services.fhir_service import FHIRBundleBuilder
from services.cds_service import check_clinical_alerts
from services.terminology_service import validate_clinical_data

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory session store (shared with sessions router)
# Imported by sessions.py as well
sessions_store: dict[str, Session] = {}

# Minimum accumulated transcript length before auto-processing
MIN_TRANSCRIPT_LENGTH = 100

# Lazy-initialized service (so app starts even without GEMINI_API_KEY)
_gemini_service = None


def _get_gemini_service() -> GeminiExtractionService:
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiExtractionService()
    return _gemini_service


@router.websocket("/ws/transcribe/{session_id}")
async def websocket_transcribe(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"WebSocket connected for session {session_id}")

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
                await websocket.send_json(
                    {"type": "error", "message": "Invalid JSON"}
                )
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
                    if accumulated_text.strip():
                        await _process_and_send(
                            websocket,
                            session,
                            accumulated_text,
                            fhir_builder,
                            specialty=specialty,
                        )
                        accumulated_text = ""
                    elif session.transcript.strip():
                        # Re-process entire transcript
                        await _process_and_send(
                            websocket,
                            session,
                            session.transcript,
                            fhir_builder,
                            specialty=specialty,
                        )

            elif msg_type == "stop":
                # Process any remaining text
                async with processing_lock:
                    if accumulated_text.strip():
                        await _process_and_send(
                            websocket,
                            session,
                            accumulated_text,
                            fhir_builder,
                            specialty=specialty,
                        )

                session.status = SessionStatus.COMPLETED
                sessions_store[session_id] = session

                await websocket.send_json(
                    {
                        "type": "session_complete",
                        "session_id": session_id,
                    }
                )
                logger.info(f"Session {session_id} completed")

            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": f"Unknown message type: {msg_type}",
                    }
                )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
        try:
            await websocket.send_json(
                {"type": "error", "message": str(e)}
            )
        except Exception:
            pass


def _calculate_fhir_quality(fhir_bundle: dict, clinical_data: dict) -> dict:
    """Calculate FHIR bundle completeness and quality score."""
    score = 0
    max_score = 0
    checks = []

    entries = fhir_bundle.get("entry", [])
    resource_types = [e.get("resource", {}).get("resourceType") for e in entries]

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
    optional = ["Observation", "MedicationRequest", "AllergyIntolerance", "CarePlan", "ServiceRequest", "DetectedIssue"]
    for rt in optional:
        max_score += 10
        if rt in resource_types:
            score += 10
            checks.append({"name": f"{rt} resource", "passed": True})
        else:
            checks.append({"name": f"{rt} resource", "passed": False})

    # Check coding systems (ICD-10, SNOMED, LOINC, RxNorm)
    coding_systems_found = set()
    for entry in entries:
        resource = entry.get("resource", {})
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
        if e.get("resource", {}).get("resourceType") != "Patient"
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
        "grade": "A" if percentage >= 90 else "B" if percentage >= 75 else "C" if percentage >= 60 else "D",
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
    await websocket.send_json({"type": "processing", "status": "started"})

    try:
        gemini = _get_gemini_service()

        existing_note = (
            session.clinical_note.model_dump()
            if session.clinical_note
            else None
        )

        clinical_data = await gemini.extract_clinical_data(
            transcript=transcript_text.strip(),
            existing_note=existing_note,
            specialty=specialty,
        )

        if clinical_data is None:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Clinical extraction failed",
                }
            )
            return

        # Update session with clinical note
        try:
            session.clinical_note = ClinicalNote(**clinical_data)
        except Exception as e:
            logger.warning(
                f"Could not parse clinical data into ClinicalNote model: {e}"
            )
            # Still send the raw data to frontend
            pass

        # Run Clinical Decision Support checks first (needed for DetectedIssue FHIR resources)
        cds_alerts = check_clinical_alerts(clinical_data)

        # Build FHIR bundle (includes DetectedIssue from CDS alerts)
        fhir_bundle = fhir_builder.build_bundle(clinical_data, cds_alerts=cds_alerts)
        session.fhir_bundle = fhir_bundle

        # Send clinical note
        await websocket.send_json(
            {
                "type": "clinical_note",
                "data": clinical_data,
            }
        )

        # Terminology validation
        terminology = validate_clinical_data(clinical_data)

        # Send FHIR bundle with quality score + terminology validation
        fhir_quality = _calculate_fhir_quality(fhir_bundle, clinical_data)
        # Boost quality score based on terminology validation
        if terminology["score_boost"] > 0:
            fhir_quality["score"] = min(100, fhir_quality["score"] + terminology["score_boost"])
            fhir_quality["terminology"] = {
                "validated": terminology["valid_count"],
                "total": terminology["total_count"],
                "ratio": terminology["validation_ratio"],
            }
            # Recalculate grade
            s = fhir_quality["score"]
            fhir_quality["grade"] = "A" if s >= 90 else "B" if s >= 75 else "C" if s >= 60 else "D"

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

    except Exception as e:
        logger.error(f"Processing error: {e}")
        await websocket.send_json(
            {"type": "error", "message": f"Processing error: {str(e)}"}
        )
