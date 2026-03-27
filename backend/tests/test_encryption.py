"""Tests for encryption service."""
import importlib
import os

import pytest


class TestEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        os.environ["ENCRYPTION_KEY"] = "test-key-for-unit-tests"
        # Re-import to pick up env
        import services.encryption_service as enc_mod
        importlib.reload(enc_mod)
        from services.encryption_service import decrypt_data, encrypt_data
        data = {"patient": "Test", "diagnosis": "Fever"}
        encrypted = encrypt_data(data)
        assert encrypted != str(data), "Encrypted data should differ from plaintext"
        decrypted = decrypt_data(encrypted)
        assert decrypted == data, f"Decrypted data should match original: {decrypted}"

    def test_no_key_raises_error(self):
        # Clear the key
        os.environ.pop("ENCRYPTION_KEY", None)
        import services.encryption_service as enc_mod
        importlib.reload(enc_mod)
        from services.encryption_service import _get_key
        with pytest.raises(ValueError, match="ENCRYPTION_KEY"):
            _get_key()

    def test_encrypt_does_not_silently_fallback_to_base64(self):
        os.environ["ENCRYPTION_KEY"] = "test-key"
        import services.encryption_service as enc_mod
        importlib.reload(enc_mod)
        from services.encryption_service import encrypt_data
        import base64
        import json
        data = {"test": "value"}
        encrypted = encrypt_data(data)
        # Should NOT be plain base64 of the data
        try:
            decoded = json.loads(base64.b64decode(encrypted))
            # If we can decode it as plain base64+json, encryption is not working
            if decoded == data:
                pytest.fail("encrypt_data returned plain base64 -- encryption is not active")
        except Exception:
            pass  # Expected -- the encrypted data should not be decodable as plain base64
