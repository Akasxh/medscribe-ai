"""
Speech-to-Text service stub.

The frontend uses the Web Speech API (browser-native) for speech recognition.
This module is a placeholder for future Deepgram or Sarvam AI streaming
integration if needed.
"""

import logging

logger = logging.getLogger(__name__)


class STTService:
    """Stub STT service for potential future Deepgram/Sarvam integration."""

    def __init__(self):
        self.is_connected = False
        logger.info(
            "STT Service initialized (stub — frontend uses Web Speech API)"
        )

    async def connect(self, language: str = "hi-en"):
        """Placeholder: connect to a streaming STT provider."""
        logger.info(f"STT connect called with language={language} (stub)")
        self.is_connected = True

    async def send_audio(self, audio_chunk: bytes):
        """Placeholder: send audio chunk to STT provider."""
        pass

    async def disconnect(self):
        """Placeholder: disconnect from STT provider."""
        self.is_connected = False
        logger.info("STT disconnected (stub)")
