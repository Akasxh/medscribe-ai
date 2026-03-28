"""Tests for the /api/drugs REST endpoints."""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestListDrugs:
    def test_returns_list(self):
        resp = client.get("/api/drugs")
        assert resp.status_code == 200
        body = resp.json()
        assert "drugs" in body
        assert "count" in body
        assert body["count"] > 0
        assert isinstance(body["drugs"], list)

    def test_each_drug_has_brand_and_generic(self):
        resp = client.get("/api/drugs")
        body = resp.json()
        for drug in body["drugs"][:5]:
            assert "brand" in drug
            assert "generic" in drug


class TestDrugAlternatives:
    def test_valid_drug_crocin(self):
        resp = client.get("/api/drugs/Crocin/alternatives")
        assert resp.status_code == 200
        body = resp.json()
        assert body["brand"] == "Crocin"
        assert body["generic"] == "Paracetamol"
        assert "alternatives" in body

    def test_unknown_drug_returns_404(self):
        resp = client.get("/api/drugs/NonExistentDrug99/alternatives")
        assert resp.status_code == 404

    def test_case_insensitive_lookup(self):
        resp_lower = client.get("/api/drugs/crocin/alternatives")
        resp_upper = client.get("/api/drugs/CROCIN/alternatives")
        assert resp_lower.status_code == 200
        assert resp_upper.status_code == 200
        assert resp_lower.json()["generic"] == resp_upper.json()["generic"]

    def test_generic_name_lookup(self):
        """Searching by generic name should also find the drug."""
        resp = client.get("/api/drugs/Paracetamol/alternatives")
        assert resp.status_code == 200
        body = resp.json()
        assert body["generic"] == "Paracetamol"
