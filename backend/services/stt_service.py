"""
Speech-to-Text service using Sarvam AI.

Uses saarika:v2.5 for Hindi/English and saaras:v3 for Tamil.
Optimized for medical consultation transcription quality.
"""

import logging
import os
import tempfile

import httpx

logger = logging.getLogger(__name__)

SARVAM_API_URL = "https://api.sarvam.ai/speech-to-text"

# saarika:v2.5 supports these; saaras:v3 adds Tamil and more
SAARIKA_LANGUAGES = {"hi-IN", "en-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "gu-IN"}
SAARAS_LANGUAGES = {"ta-IN"}  # Tamil needs saaras:v3


def _pick_model(language_code: str) -> str:
    """Pick best model for the language."""
    if language_code in SAARAS_LANGUAGES:
        return "saaras:v3"
    return "saarika:v2.5"


async def transcribe_audio(
    audio_bytes: bytes, language_code: str = "hi-IN"
) -> str | None:
    """Transcribe audio using Sarvam AI STT API.

    Args:
        audio_bytes: Raw audio data (WebM, WAV, MP3, etc.)
        language_code: BCP-47 language code (hi-IN, en-IN, ta-IN)

    Returns:
        Transcript string, or None on failure.
    """
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        logger.warning("SARVAM_API_KEY not set — cannot transcribe")
        return None

    if len(audio_bytes) < 500:
        logger.debug("Audio too small (%d bytes), skipping", len(audio_bytes))
        return None

    model = _pick_model(language_code)

    temp_path: str | None = None
    try:
        # Write with correct extension so Sarvam auto-detects codec
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        async with httpx.AsyncClient(timeout=30.0) as client:
            with open(temp_path, "rb") as audio_file:
                data = {
                    "language_code": language_code,
                    "model": model,
                }
                # saaras:v3 supports mode parameter for better formatting
                if model == "saaras:v3":
                    data["mode"] = "formal"

                response = await client.post(
                    SARVAM_API_URL,
                    headers={"api-subscription-key": api_key},
                    files={"file": ("audio.webm", audio_file, "audio/webm")},
                    data=data,
                )

            if response.status_code == 200:
                result = response.json()
                transcript = result.get("transcript", "")
                lang_prob = result.get("language_probability")
                logger.info(
                    "Sarvam STT [%s]: '%s' (lang=%s, prob=%s)",
                    model,
                    transcript[:80] if transcript else "",
                    language_code,
                    f"{lang_prob:.2f}" if lang_prob else "n/a",
                )
                return transcript

            logger.error(
                "Sarvam STT error [%s]: %d - %s",
                model,
                response.status_code,
                response.text[:200],
            )
            return None

    except httpx.TimeoutException:
        logger.error("Sarvam STT timeout (30s) for %s", language_code)
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
        "provider": "Sarvam AI",
        "api_configured": bool(os.getenv("SARVAM_API_KEY")),
        "supported_languages": ["hi-IN", "en-IN", "ta-IN"],
        "models": {
            "hi-IN": "saarika:v2.5",
            "en-IN": "saarika:v2.5",
            "ta-IN": "saaras:v3",
        },
        "features": [
            "Hindi-English code-mixing",
            "Tamil support",
            "Medical terminology",
        ],
    }
