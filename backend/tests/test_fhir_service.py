"""Tests for FHIR R4 bundle generation."""
from services.fhir_service import FHIRBundleBuilder


class TestBundleStructure:
    def setup_method(self):
        self.builder = FHIRBundleBuilder()
        self.clinical_data = {
            "patient_info": {"name": "Test Patient", "age": "30", "gender": "Female"},
            "chief_complaint": "Fever",
            "diagnosis": [{"condition": "Viral Fever", "icd10_code": "B34.9", "certainty": "confirmed"}],
            "medications": [{"name": "Dolo 650", "generic_name": "Paracetamol", "dosage": "650mg", "frequency": "TID", "duration": "3 days"}],
            "symptoms": [{"description": "Fever", "duration": "3 days", "severity": "moderate"}],
            "vitals": {"temperature": "101F", "bp": "120/80"},
            "allergies": ["Sulfa drugs"],
            "follow_up": "Review in 3 days",
            "recommended_tests": ["CBC"],
        }

    def test_bundle_type_is_document(self):
        bundle = self.builder.build_bundle(self.clinical_data)
        assert bundle["type"] == "document"

    def test_composition_is_first_entry(self):
        bundle = self.builder.build_bundle(self.clinical_data)
        assert bundle["entry"][0]["resource"]["resourceType"] == "Composition"

    def test_all_entries_have_fullurl(self):
        bundle = self.builder.build_bundle(self.clinical_data)
        for i, entry in enumerate(bundle["entry"]):
            assert "fullUrl" in entry, f"Entry {i} ({entry['resource']['resourceType']}) missing fullUrl"
            assert entry["fullUrl"].startswith("urn:uuid:")

    def test_bundle_has_timestamp(self):
        bundle = self.builder.build_bundle(self.clinical_data)
        assert "timestamp" in bundle

    def test_patient_has_birthdate_not_extension(self):
        bundle = self.builder.build_bundle(self.clinical_data)
        patient = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Patient")
        assert "birthDate" in patient, "Patient should have birthDate computed from age"
        assert "extension" not in patient or not any(
            ext.get("url") == "http://hl7.org/fhir/StructureDefinition/patient-age"
            for ext in patient.get("extension", [])
        ), "Should not have fake patient-age extension"

    def test_allergy_has_category(self):
        bundle = self.builder.build_bundle(self.clinical_data)
        allergies = [e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "AllergyIntolerance"]
        for allergy in allergies:
            assert "category" in allergy, "AllergyIntolerance should have category"
            assert "medication" in allergy["category"]

    def test_abha_id_in_patient(self):
        bundle = self.builder.build_bundle(self.clinical_data, abha_id="12345678901234")
        patient = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Patient")
        assert "identifier" in patient
        abha_id = patient["identifier"][0]
        assert abha_id["system"] == "https://abha.abdm.gov.in"
        assert abha_id["value"] == "12345678901234"

    def test_medication_no_system_without_code(self):
        """MedicationRequest should not have system without code."""
        bundle = self.builder.build_bundle(self.clinical_data)
        med_requests = [e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "MedicationRequest"]
        for mr in med_requests:
            concept = mr.get("medicationCodeableConcept", {})
            for coding in concept.get("coding", []):
                if "system" in coding:
                    assert "code" in coding and coding["code"], f"Coding has system without code: {coding}"

    def test_empty_clinical_data(self):
        """Should handle minimal clinical data without crashing."""
        bundle = self.builder.build_bundle({
            "patient_info": {},
            "diagnosis": [],
            "medications": [],
            "symptoms": [],
            "vitals": {},
            "allergies": [],
            "recommended_tests": [],
        })
        assert bundle["type"] == "document"
        assert len(bundle["entry"]) >= 2  # At least Composition + Patient


class TestDataFiles:
    def test_icd10_diarrhea_code(self):
        import json
        from pathlib import Path
        icd10_path = Path(__file__).parent.parent / "data" / "icd10_common.json"
        with open(icd10_path) as f:
            codes = json.load(f)
        assert codes["Diarrhea"] == "A09", f"Diarrhea should be A09, got {codes['Diarrhea']}"

    def test_ranitidine_removed(self):
        import json
        from pathlib import Path
        drug_path = Path(__file__).parent.parent / "data" / "drug_reference.json"
        with open(drug_path) as f:
            drugs = json.load(f)
        assert "Rantac" not in drugs, "Rantac (Ranitidine) should be removed -- banned in India since 2020"
