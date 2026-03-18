from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.schemas import Session, SessionStatus
from routers.transcribe import sessions_store
from services.learning_service import store_correction, get_correction_stats

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
