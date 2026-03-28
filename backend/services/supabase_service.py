"""Supabase persistence layer for MedScribe AI.

Persists consultation sessions, clinical notes, FHIR bundles, and
prescriptions to Supabase (PostgreSQL).  Gracefully degrades to no-op
when SUPABASE_SERVICE_ROLE_KEY is not configured.
"""

from __future__ import annotations

import asyncio
import logging
import os
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------

_client: Any | None = None
_checked = False


def _is_configured() -> bool:
    return bool(
        os.environ.get("SUPABASE_URL")
        and os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )


def get_service_client() -> Any | None:
    """Return cached Supabase client using the service-role key.

    Returns ``None`` if env vars are missing (allowing the app to run
    without Supabase).
    """
    global _client, _checked

    if _client is not None:
        return _client

    if _checked:
        # Already tried and failed — don't retry every call
        return None

    _checked = True

    if not _is_configured():
        logger.warning(
            "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — "
            "Supabase persistence disabled"
        )
        return None

    try:
        from supabase import create_client

        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
        logger.info("Supabase service client initialised")
        return _client
    except Exception as exc:
        logger.error("Failed to create Supabase client: %s", exc, exc_info=True)
        return None


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


async def persist_session(
    session_id: str,
    doctor_id: str | None,
    transcript: str,
    clinical_data: dict | None,
    fhir_bundle: dict | None,
    fhir_quality: dict | None,
    cds_alerts: list | None,
    specialty: str = "general",
) -> bool:
    """Upsert consultation + related rows to Supabase.

    Designed to be called as ``asyncio.create_task(persist_session(...))``.
    Returns ``True`` on success, ``False`` on skip/failure.
    """
    client = get_service_client()
    if client is None:
        return False

    try:
        # 1. Upsert consultation
        consultation_row: dict[str, Any] = {
            "id": session_id,
            "status": "completed",
            "specialty": specialty,
            "transcript": transcript.strip() if transcript else "",
        }
        if doctor_id:
            consultation_row["doctor_id"] = doctor_id

        await asyncio.to_thread(
            lambda: client.table("consultations").upsert(
                consultation_row, on_conflict="id"
            ).execute()
        )

        # 2. Upsert clinical_notes
        if clinical_data:
            note_row: dict[str, Any] = {
                "consultation_id": session_id,
                "note_data": clinical_data,
            }
            if fhir_quality:
                note_row["fhir_score"] = fhir_quality.get("score")
                note_row["fhir_grade"] = fhir_quality.get("grade")
            if doctor_id:
                note_row["doctor_id"] = doctor_id

            await asyncio.to_thread(
                lambda: client.table("clinical_notes").upsert(
                    note_row, on_conflict="consultation_id"
                ).execute()
            )

        # 3. Upsert fhir_bundles
        if fhir_bundle:
            bundle_row: dict[str, Any] = {
                "consultation_id": session_id,
                "bundle": fhir_bundle,
            }
            if fhir_quality:
                bundle_row["quality_score"] = fhir_quality.get("score")
                bundle_row["quality_grade"] = fhir_quality.get("grade")
            if doctor_id:
                bundle_row["doctor_id"] = doctor_id

            await asyncio.to_thread(
                lambda: client.table("fhir_bundles").upsert(
                    bundle_row, on_conflict="consultation_id"
                ).execute()
            )

        # 4. Upsert prescriptions (medications + diagnosis + follow_up)
        if clinical_data:
            meds = clinical_data.get("medications", [])
            dx = clinical_data.get("diagnosis", [])
            follow_up = clinical_data.get("follow_up")

            # Serialise Pydantic models if needed
            def _to_dict(item: Any) -> Any:
                if hasattr(item, "model_dump"):
                    return item.model_dump()
                if hasattr(item, "dict"):
                    return item.dict()
                return item

            rx_row: dict[str, Any] = {
                "consultation_id": session_id,
                "medications": [_to_dict(m) for m in meds] if meds else [],
                "diagnosis": [_to_dict(d) for d in dx] if dx else [],
                "follow_up": follow_up or "",
            }
            if doctor_id:
                rx_row["doctor_id"] = doctor_id

            await asyncio.to_thread(
                lambda: client.table("prescriptions").upsert(
                    rx_row, on_conflict="consultation_id"
                ).execute()
            )

        logger.info("Session %s persisted to Supabase", session_id)
        return True

    except Exception as exc:
        logger.error(
            "Failed to persist session %s to Supabase: %s",
            session_id,
            exc,
            exc_info=True,
        )
        return False
