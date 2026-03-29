import os
import pathlib
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (parent of backend/)
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Also try loading from backend/ itself
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request

from routers.transcribe import router as transcribe_router
from routers.sessions import router as sessions_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every HTTP response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "microphone=(self), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' ws: wss:; "
            "object-src 'none'; "
            "base-uri 'self'"
        )

        # HSTS for production (Railway is always HTTPS)
        if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Cache headers for static assets
        path = request.url.path
        if path.startswith("/assets/") or path.startswith("/icons/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path.endswith(".html") or path == "/":
            response.headers["Cache-Control"] = "no-cache, must-revalidate"

        return response

app = FastAPI(
    title="MedScribe AI",
    description="Mobile-First Ambient AI Scribe with Real-Time FHIR Conversion",
    version="1.0.0",
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# GZip compression for responses >= 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS — allow all origins for hackathon demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(transcribe_router)
app.include_router(sessions_router)


@app.on_event("startup")
async def startup_health_check():
    """Validate critical configuration at startup."""
    import logging
    logger = logging.getLogger("medscribe")
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key:
        logger.warning("⚠ GEMINI_API_KEY not set — clinical extraction will fail. Set it in .env")
    else:
        logger.info("✓ GEMINI_API_KEY configured")


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "MedScribe AI",
        "version": "1.0.0",
        "features": {
            "gemini": bool(os.getenv("GEMINI_API_KEY", "")),
            "stt": bool(os.getenv("SARVAM_API_KEY", "")),
            "encryption": True,
        },
    }


class UploadConsultationRequest(BaseModel):
    session_id: str
    doctor_name: str
    doctor_id: str = ""
    hospital: str = ""
    patient_name: str = ""
    specialty: str = "general"
    transcript: str = ""
    clinical_note: dict | None = None
    fhir_bundle: dict | None = None
    fhir_quality: dict | None = None
    cds_alerts: list | None = None


class AdminLoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/admin/login")
async def admin_login(req: AdminLoginRequest):
    """Simple admin login — checks against ADMIN_EMAIL/ADMIN_PASSWORD env vars."""
    admin_email = os.getenv("ADMIN_EMAIL", "admin@medscribe.ai")
    admin_password = os.getenv("ADMIN_PASSWORD", "medscribe2026")
    if req.email == admin_email and req.password == admin_password:
        return {"email": req.email, "role": "admin", "token": "admin-session"}
    raise HTTPException(status_code=401, detail="Invalid email or password")


@app.get("/api/admin/consultations")
async def list_consultations():
    """Fetch all consultations from Supabase for admin dashboard."""
    from services.supabase_service import get_client

    client = get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        import asyncio

        # Fetch all three tables in parallel
        cons_future = asyncio.to_thread(
            lambda: client.table("consultations")
            .select("*")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        notes_future = asyncio.to_thread(
            lambda: client.table("clinical_notes")
            .select("*")
            .execute()
        )
        fhir_future = asyncio.to_thread(
            lambda: client.table("fhir_bundles")
            .select("consultation_id,quality_score,quality_grade")
            .execute()
        )

        cons_res, notes_res, fhir_res = await asyncio.gather(
            cons_future, notes_future, fhir_future
        )

        # Index notes and fhir by consultation_id for fast lookup
        notes_map = {n["consultation_id"]: n for n in (notes_res.data or [])}
        fhir_map = {f["consultation_id"]: f for f in (fhir_res.data or [])}

        # Merge into single response
        results = []
        for c in (cons_res.data or []):
            cid = c["id"]
            note = notes_map.get(cid)
            fhir = fhir_map.get(cid)
            results.append({
                "id": cid,
                "doctor_name": c.get("doctor_name", ""),
                "patient_name": c.get("patient_name", ""),
                "specialty": c.get("specialty", "general"),
                "status": c.get("status", "completed"),
                "transcript": c.get("transcript", ""),
                "created_at": c.get("created_at"),
                "clinical_note": {
                    "chief_complaint": note.get("chief_complaint", "") if note else "",
                    "patient_info": note.get("patient_info", {}) if note else {},
                    "symptoms": note.get("symptoms", []) if note else [],
                    "diagnosis": note.get("diagnosis", []) if note else [],
                    "medications": note.get("medications", []) if note else [],
                    "vitals": note.get("vitals", {}) if note else {},
                    "allergies": note.get("allergies", []) if note else [],
                    "differential_diagnosis": note.get("differential_diagnosis", []) if note else [],
                    "risk_factors": note.get("risk_factors", []) if note else [],
                    "recommended_tests": note.get("recommended_tests", []) if note else [],
                    "follow_up": note.get("follow_up", "") if note else "",
                    "history_of_present_illness": note.get("history_of_present_illness", "") if note else "",
                    "clinical_notes": note.get("clinical_notes_text", "") if note else "",
                } if note else None,
                "fhir_quality": {
                    "score": fhir.get("quality_score"),
                    "grade": fhir.get("quality_grade"),
                } if fhir else None,
                "cds_alerts": c.get("cds_alerts", []),
            })

        return {"consultations": results, "total": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch consultations: {e}")


@app.post("/api/upload-consultation")
async def upload_consultation(req: UploadConsultationRequest):
    """Upload a completed consultation to Supabase."""
    import logging
    logger = logging.getLogger("medscribe")
    from services.supabase_service import save_consultation

    logger.info("Upload request for session %s, doctor=%s", req.session_id, req.doctor_name)
    ok = await save_consultation(
        session_id=req.session_id,
        doctor_name=req.doctor_name,
        specialty=req.specialty,
        transcript=req.transcript,
        clinical_data=req.clinical_note,
        fhir_bundle=req.fhir_bundle,
        fhir_quality=req.fhir_quality,
        cds_alerts=req.cds_alerts,
    )
    if not ok:
        logger.error("Upload failed for session %s", req.session_id)
        raise HTTPException(status_code=500, detail="Failed to save — Supabase may not be configured")
    return {"success": True, "session_id": req.session_id}


# Serve frontend static files in production (when built frontend is in ./static)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(_static_dir):
    _assets_dir = os.path.join(_static_dir, "assets")
    if os.path.exists(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        """SPA fallback: serve index.html for all non-API/WS routes."""
        if full_path.startswith(("api/", "ws/", "rx/")):
            raise HTTPException(status_code=404, detail="Not found")
        safe_root = pathlib.Path(_static_dir).resolve()
        requested = (safe_root / full_path).resolve()
        if str(requested).startswith(str(safe_root)) and requested.is_file():
            return FileResponse(str(requested))
        return FileResponse(os.path.join(_static_dir, "index.html"))
