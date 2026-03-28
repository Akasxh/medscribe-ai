"""Tests for the /api/sessions REST endpoints."""
from fastapi.testclient import TestClient
from main import app
from routers.transcribe import sessions_store
from models.schemas import Session

client = TestClient(app)


class TestSessionsCRUD:
    def setup_method(self):
        """Clear session store before each test."""
        sessions_store.clear()

    def test_list_sessions_empty(self):
        resp = client.get("/api/sessions")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_sessions_returns_list(self):
        # Seed a session
        session = Session()
        sessions_store[session.id] = session
        resp = client.get("/api/sessions")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 1

    def test_delete_existing_session(self):
        session = Session()
        sessions_store[session.id] = session
        resp = client.delete(f"/api/sessions/{session.id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["deleted"] is True
        assert session.id not in sessions_store

    def test_delete_nonexistent_session_returns_404(self):
        resp = client.delete("/api/sessions/nonexistent-id-123")
        assert resp.status_code == 404

    def test_get_session_by_id(self):
        session = Session()
        sessions_store[session.id] = session
        resp = client.get(f"/api/sessions/{session.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == session.id

    def test_get_nonexistent_session_returns_404(self):
        resp = client.get("/api/sessions/does-not-exist")
        assert resp.status_code == 404
