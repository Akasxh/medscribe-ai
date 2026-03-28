from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from models.schemas import Session, SessionStatus
from routers.transcribe import sessions_store
from services.learning_service import store_correction, get_correction_stats

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class CorrectionRequest(BaseModel):
    session_id: str
    transcript: str = ""
    original_note: dict
    corrected_note: dict
    field_path: str


@router.post("", response_model=Session)
async def create_session():
    """Create a new consultation session."""
    session = Session()
    sessions_store[session.id] = session
    return session


@router.get("", response_model=list[Session])
async def list_sessions():
    """List all sessions, newest first."""
    sessions = sorted(
        sessions_store.values(),
        key=lambda s: s.created_at,
        reverse=True,
    )
    return sessions


# Static paths MUST come before the dynamic /{session_id} path
@router.post("/corrections")
async def submit_correction(req: CorrectionRequest):
    """Store a doctor's correction for continuous learning."""
    try:
        correction = store_correction(
            session_id=req.session_id,
            transcript=req.transcript,
            original_note=req.original_note,
            corrected_note=req.corrected_note,
            field_path=req.field_path,
        )
    except Exception as e:
        logger.error("Failed to save correction: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save correction. Please try again.")
    return {"status": "stored", "correction": correction}


@router.get("/corrections/stats")
async def correction_stats():
    """Get learning statistics."""
    return get_correction_stats()


@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: str):
    """Get a specific session by ID."""
    session = sessions_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session by ID."""
    if session_id in sessions_store:
        del sessions_store[session_id]
        return {"deleted": True, "session_id": session_id}
    raise HTTPException(status_code=404, detail="Session not found")


# ---------------------------------------------------------------------------
# Admin + Auth routes (separate router so prefix doesn't collide)
# ---------------------------------------------------------------------------

admin_router = APIRouter(prefix="/api", tags=["admin"])


@admin_router.get("/admin/consultations")
async def list_all_consultations() -> list[dict[str, Any]]:
    """Admin endpoint: fetch all consultations from Supabase with joined data."""
    from services.supabase_service import get_service_client

    client = get_service_client()
    if not client:
        # Fallback to in-memory sessions
        return [
            s.model_dump()
            for s in sorted(
                sessions_store.values(),
                key=lambda x: x.created_at,
                reverse=True,
            )
        ]

    try:
        result = await asyncio.to_thread(
            lambda: client.table("consultations")
            .select("*, clinical_notes(*), fhir_bundles(*)")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        # Supabase returns arrays for joined tables — normalize to single objects
        for row in result.data:
            notes = row.pop("clinical_notes", [])
            row["clinical_note"] = notes[0] if notes else None
            bundles = row.pop("fhir_bundles", [])
            row["fhir_bundle"] = bundles[0] if bundles else None
            row.setdefault("cds_alerts", [])
            row.setdefault("fhir_quality", None)
        return result.data  # type: ignore[return-value]
    except Exception as exc:
        logger.error("Failed to fetch consultations from Supabase: %s", exc)
        # Fallback to in-memory
        return [
            s.model_dump()
            for s in sorted(
                sessions_store.values(),
                key=lambda x: x.created_at,
                reverse=True,
            )
        ]


@admin_router.get("/auth/check-admin")
async def check_admin(
    email: str = Query(..., description="Email to check"),
    password: str = Query("", description="Admin password"),
) -> dict[str, bool]:
    """Check whether the given email + password belongs to an admin user."""
    from services.supabase_service import get_service_client

    client = get_service_client()
    if not client:
        return {"is_admin": False}

    try:
        result = await asyncio.to_thread(
            lambda: client.table("admin_users")
            .select("email, password")
            .eq("email", email.strip().lower())
            .execute()
        )
        if not result.data:
            return {"is_admin": False}
        # Verify password matches
        stored_password = result.data[0].get("password", "")
        return {"is_admin": password == stored_password}
    except Exception as exc:
        logger.error("Failed to check admin status: %s", exc)
        return {"is_admin": False}
