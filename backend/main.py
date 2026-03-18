import os
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
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from routers.transcribe import router as transcribe_router
from routers.sessions import router as sessions_router
from services.encryption_service import get_encryption_status
from services.stt_service import get_stt_status


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every HTTP response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "microphone=(self), camera=()"
        # In production: add Strict-Transport-Security for HTTPS
        return response

app = FastAPI(
    title="MedScribe AI",
    description="Mobile-First Ambient AI Scribe with Real-Time FHIR Conversion",
    version="1.0.0",
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS — allow all origins for hackathon demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
    gemini_configured = bool(os.getenv("GEMINI_API_KEY", ""))
    return {
        "status": "healthy",
        "service": "MedScribe AI Backend",
        "version": "1.0.0",
        "gemini_configured": gemini_configured,
        "security": get_encryption_status(),
        "stt": get_stt_status(),
    }


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
            # Let FastAPI handle API/WS/Rx routes normally
            raise HTTPException(status_code=404, detail="Not found")
        file_path = os.path.join(_static_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_static_dir, "index.html"))
