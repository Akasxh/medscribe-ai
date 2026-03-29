"""Simple Supabase persistence for MedScribe AI consultations."""

import asyncio
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_client = None
_checked = False


def get_client():
    """Get Supabase client. Returns None if not configured."""
    global _client, _checked
    if _client is not None:
        return _client
    if _checked:
        return None
    _checked = True

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("Supabase not configured — persistence disabled")
        return None

    try:
        from supabase import create_client
        _client = create_client(url, key)
        logger.info("Supabase client ready")
        return _client
    except Exception as e:
        logger.error("Supabase init failed: %s", e)
        return None


def _plain(item):
    """Convert Pydantic model or dict to plain dict."""
    if hasattr(item, "model_dump"):
        return item.model_dump()
    return item


async def save_consultation(
    session_id: str,
    doctor_name: str,
    specialty: str,
    transcript: str,
    clinical_data: dict | None,
    fhir_bundle: dict | None,
    fhir_quality: dict | None,
    cds_alerts: list | None,
) -> bool:
    """Save a completed consultation to Supabase. Returns True on success."""
    client = get_client()
    if not client:
        return False

    try:
        # Extract patient name from clinical data
        patient_name = ""
        if clinical_data:
            pi = clinical_data.get("patient_info") or {}
            if isinstance(pi, dict):
                patient_name = pi.get("name", "") or ""

        # 1. Upsert consultation
        await asyncio.to_thread(
            lambda: client.table("consultations").upsert({
                "id": session_id,
                "status": "completed",
                "specialty": specialty,
                "transcript": transcript.strip() if transcript else "",
                "doctor_name": doctor_name,
                "patient_name": patient_name,
            }, on_conflict="id").execute()
        )

        # 2. Upsert clinical note
        if clinical_data:
            note = {
                "consultation_id": session_id,
                "chief_complaint": clinical_data.get("chief_complaint", ""),
                "history_of_present_illness": clinical_data.get("history_of_present_illness", ""),
                "patient_info": _plain(clinical_data.get("patient_info")) if clinical_data.get("patient_info") else {},
                "symptoms": [_plain(s) for s in (clinical_data.get("symptoms") or [])],
                "vitals": _plain(clinical_data.get("vitals")) if clinical_data.get("vitals") else {},
                "diagnosis": [_plain(d) for d in (clinical_data.get("diagnosis") or [])],
                "medications": [_plain(m) for m in (clinical_data.get("medications") or [])],
                "observations": list(clinical_data.get("observations") or []),
                "allergies": list(clinical_data.get("allergies") or []),
                "differential_diagnosis": [_plain(d) for d in (clinical_data.get("differential_diagnosis") or [])],
                "risk_factors": list(clinical_data.get("risk_factors") or []),
                "recommended_tests": list(clinical_data.get("recommended_tests") or []),
                "follow_up": clinical_data.get("follow_up", ""),
                "clinical_notes_text": clinical_data.get("clinical_notes", ""),
            }
            await asyncio.to_thread(
                lambda: client.table("clinical_notes").upsert(
                    note, on_conflict="consultation_id"
                ).execute()
            )

        # 3. Upsert FHIR bundle
        if fhir_bundle:
            bundle_row = {
                "consultation_id": session_id,
                "bundle": fhir_bundle if isinstance(fhir_bundle, dict) else _plain(fhir_bundle),
            }
            if fhir_quality:
                bundle_row["quality_score"] = fhir_quality.get("score")
                bundle_row["quality_grade"] = fhir_quality.get("grade")
            await asyncio.to_thread(
                lambda: client.table("fhir_bundles").upsert(
                    bundle_row, on_conflict="consultation_id"
                ).execute()
            )

        logger.info("Consultation %s saved to Supabase", session_id)
        return True

    except Exception as e:
        logger.error("Failed to save consultation %s: %s", session_id, e)
        return False
