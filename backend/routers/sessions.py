import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from models.schemas import Session, SessionStatus
from routers.transcribe import sessions_store
from services.learning_service import store_correction, get_correction_stats
from services.supabase_service import get_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
admin_router = APIRouter(prefix="/api", tags=["admin"])


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
    correction = store_correction(
        session_id=req.session_id,
        transcript=req.transcript,
        original_note=req.original_note,
        corrected_note=req.corrected_note,
        field_path=req.field_path,
    )
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


# ── Admin endpoints ──────────────────────────────────────────

@admin_router.get("/auth/check-admin")
async def check_admin(
    email: str = Query(..., description="Admin email"),
    password: str = Query("", description="Admin password"),
):
    """Check admin credentials against Supabase admin_users table."""
    client = get_client()
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
        stored_password = result.data[0].get("password", "")
        return {"is_admin": password == stored_password}
    except Exception as e:
        logger.error("Admin check failed: %s", e)
        return {"is_admin": False}


@admin_router.get("/admin/consultations")
async def list_all_consultations():
    """Fetch all consultations from Supabase for admin dashboard."""
    client = get_client()
    if not client:
        # Fallback to in-memory
        return [
            s.model_dump()
            for s in sorted(sessions_store.values(), key=lambda x: x.created_at, reverse=True)
        ]

    try:
        result = await asyncio.to_thread(
            lambda: client.table("consultations")
            .select("*, clinical_notes(*), fhir_bundles(*)")
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
        # Normalize joined arrays to single objects
        for row in result.data:
            notes = row.pop("clinical_notes", [])
            row["clinical_note"] = notes[0] if notes else None
            bundles = row.pop("fhir_bundles", [])
            row["fhir_bundle"] = bundles[0].get("bundle") if bundles else None
        return result.data
    except Exception as e:
        logger.error("Failed to fetch consultations: %s", e)
        return [
            s.model_dump()
            for s in sorted(sessions_store.values(), key=lambda x: x.created_at, reverse=True)
        ]
