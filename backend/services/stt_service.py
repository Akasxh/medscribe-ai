"""
Speech-to-Text service using Sarvam AI (Saaras v2).

Provides server-side STT for Indian languages with code-mixing support.
Falls back gracefully when API key is not configured.
"""

import logging
import os
import tempfile

import httpx

logger = logging.getLogger(__name__)

SARVAM_API_URL = "https://api.sarvam.ai/speech-to-text"


async def transcribe_audio(
    audio_bytes: bytes, language_code: str = "hi-IN"
) -> str | None:
    """Transcribe audio using Sarvam AI STT API.

    Args:
        audio_bytes: Raw audio data (WAV, MP3, WebM, etc.)
        language_code: BCP-47 language code (e.g. hi-IN, en-IN, unknown for auto)

    Returns:
        Transcript string, or None on failure.
    """
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        logger.warning("SARVAM_API_KEY not set")
        return None

    temp_path: str | None = None
    try:
        # Write audio to temp file (Sarvam expects file upload)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        async with httpx.AsyncClient(timeout=30.0) as client:
            with open(temp_path, "rb") as audio_file:
                response = await client.post(
                    SARVAM_API_URL,
                    headers={"api-subscription-key": api_key},
                    files={"file": ("audio.wav", audio_file, "audio/wav")},
                    data={
                        "language_code": language_code,
                        "model": "saaras:v2",
                        "with_timestamps": "false",
                    },
                )

            if response.status_code == 200:
                result = response.json()
                transcript = result.get("transcript", "")
                logger.info(
                    "Sarvam STT: '%s' (lang=%s)",
                    transcript[:80] if transcript else "",
                    language_code,
                )
                return transcript
            else:
                logger.error(
                    "Sarvam STT error: %d - %s",
                    response.status_code,
                    response.text[:200],
                )
                return None

    except Exception as e:
        logger.error("Sarvam STT exception: %s", e)
        return None
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass


def get_stt_status() -> dict:
    """Return STT configuration status."""
    return {
        "provider": "Sarvam AI (Saaras v2)",
        "api_configured": bool(os.getenv("SARVAM_API_KEY")),
        "supported_languages": [
            "hi-IN",
            "en-IN",
            "ta-IN",
            "te-IN",
            "bn-IN",
            "mr-IN",
            "gu-IN",
            "kn-IN",
            "ml-IN",
            "pa-IN",
            "or-IN",
            "as-IN",
        ],
        "features": [
            "22 Indian languages",
            "Code-mixed support",
            "Hinglish",
            "Tanglish",
        ],
    }
