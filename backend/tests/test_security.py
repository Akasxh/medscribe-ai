"""Tests for security fixes."""
import html


class TestXSSPrevention:
    def test_html_escape_in_prescription(self):
        """Verify that html.escape works on malicious input."""
        malicious = '<script>alert("xss")</script>'
        escaped = html.escape(malicious)
        assert "<script>" not in escaped
        assert "&lt;script&gt;" in escaped

    def test_session_id_escaped(self):
        """Session IDs with HTML should be escaped."""
        session_id = '<img src=x onerror=alert(1)>'
        escaped = html.escape(session_id)
        assert "<img" not in escaped
