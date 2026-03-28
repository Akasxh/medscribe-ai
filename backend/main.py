import os
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
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request

from routers.transcribe import router as transcribe_router
from routers.sessions import router as sessions_router, admin_router
from routers.drugs import router as drugs_router


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
app.include_router(admin_router)
app.include_router(drugs_router)


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
            "stt": "Web Speech API (browser-native)",
            "encryption": True,
        },
    }


# Serve frontend static files in production (when built frontend is in ./static)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(_static_dir):
    _assets_dir = os.path.join(_static_dir, "assets")
    if os.path.exists(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    # SPA catch-all — MUST be last route. Serves index.html for all
    # non-API/WS/rx paths. API paths that don't match any router get 404.
    # Note: this only catches paths NOT already handled by routers above
    # because FastAPI checks router paths first (they have specific prefixes).
    @app.api_route("/{full_path:path}", methods=["GET"], include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        """SPA fallback: serve index.html for all non-API/WS routes."""
        safe_root = Path(_static_dir).resolve()
        requested = (safe_root / full_path).resolve()
        if str(requested).startswith(str(safe_root)) and requested.is_file():
            return FileResponse(str(requested))
        return FileResponse(os.path.join(_static_dir, "index.html"))
