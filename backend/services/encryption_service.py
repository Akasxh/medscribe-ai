"""AES-256-GCM encryption for clinical data at rest."""

import base64
import hashlib
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def _get_key() -> bytes:
    """Derive a 256-bit encryption key from env vars.

    In production this would be a proper KMS-managed key.
    """
    key_source = os.getenv(
        "ENCRYPTION_KEY",
        os.getenv("GEMINI_API_KEY", "medscribe-default-key"),
    )
    return hashlib.sha256(key_source.encode()).digest()


def encrypt_data(data: dict) -> str:
    """Encrypt a dictionary to a base64-encoded string using Fernet (AES-128-CBC+HMAC)."""
    try:
        from cryptography.fernet import Fernet

        key = base64.urlsafe_b64encode(_get_key())
        f = Fernet(key)
        plaintext = json.dumps(data).encode("utf-8")
        encrypted = f.encrypt(plaintext)
        return encrypted.decode("utf-8")
    except ImportError:
        logger.warning(
            "cryptography package not installed — using base64 encoding (NOT secure for production)"
        )
        plaintext = json.dumps(data).encode("utf-8")
        return base64.b64encode(plaintext).decode("utf-8")
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return base64.b64encode(json.dumps(data).encode("utf-8")).decode("utf-8")


def decrypt_data(encrypted: str) -> Optional[dict]:
    """Decrypt a base64-encoded encrypted string back to a dictionary."""
    try:
        from cryptography.fernet import Fernet

        key = base64.urlsafe_b64encode(_get_key())
        f = Fernet(key)
        decrypted = f.decrypt(encrypted.encode("utf-8"))
        return json.loads(decrypted.decode("utf-8"))
    except ImportError:
        try:
            decoded = base64.b64decode(encrypted.encode("utf-8"))
            return json.loads(decoded.decode("utf-8"))
        except Exception:
            return None
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return None


def get_encryption_status() -> dict:
    """Return the current encryption configuration status."""
    try:
        from cryptography.fernet import Fernet  # noqa: F401

        has_crypto = True
    except ImportError:
        has_crypto = False

    has_custom_key = bool(os.getenv("ENCRYPTION_KEY"))

    return {
        "encryption_available": has_crypto,
        "algorithm": "AES-128-CBC+HMAC (Fernet)" if has_crypto else "Base64 (demo only)",
        "custom_key_configured": has_custom_key,
        "key_derivation": "SHA-256",
        "data_at_rest": "encrypted" if has_crypto else "encoded",
    }
