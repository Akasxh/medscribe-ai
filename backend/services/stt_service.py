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

# Map MIME types to file extensions for correct Sarvam API detection
MIME_TO_EXT = {
    "audio/webm": ".webm",
    "audio/webm;codecs=opus": ".webm",
    "audio/ogg": ".ogg",
    "audio/ogg;codecs=opus": ".ogg",
    "audio/mp3": ".mp3",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/flac": ".flac",
}


async def transcribe_audio(
    audio_bytes: bytes,
    language_code: str = "hi-IN",
    content_type: str = "audio/webm",
) -> str | None:
    """Transcribe audio using Sarvam AI STT API.

    Args:
        audio_bytes: Raw audio data (WebM, WAV, MP3, etc.)
        language_code: BCP-47 language code (e.g. hi-IN, en-IN, ta-IN)
        content_type: MIME type of the audio data

    Returns:
        Transcript string, or None on failure.
    """
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        logger.warning("SARVAM_API_KEY not set")
        return None

    # Determine correct file extension and MIME from actual content type
    ext = MIME_TO_EXT.get(content_type, ".webm")
    mime = content_type.split(";")[0].strip() if content_type else "audio/webm"
    filename = f"audio{ext}"

    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        async with httpx.AsyncClient(timeout=30.0) as client:
            with open(temp_path, "rb") as audio_file:
                response = await client.post(
                    SARVAM_API_URL,
                    headers={"api-subscription-key": api_key},
                    files={"file": (filename, audio_file, mime)},
                    data={
                        "language_code": language_code,
                        "model": "saaras:v3",
                        "mode": "codemix",
                        "with_timestamps": "false",
                    },
                )

            if response.status_code == 200:
                result = response.json()
                transcript = result.get("transcript", "")
                logger.info(
                    "Sarvam STT: '%s' (lang=%s, mime=%s)",
                    transcript[:80] if transcript else "",
                    language_code,
                    mime,
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
        "supported_languages": ["hi-IN", "en-IN", "ta-IN"],
    }
