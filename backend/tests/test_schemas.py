"""Tests for Pydantic schema models."""
from models.schemas import (
    DiagnosisCitation,
    Diagnosis,
    DifferentialDiagnosis,
    Session,
    ClinicalNote,
    Symptom,
)


class TestDiagnosisCitation:
    def test_basic_creation(self):
        citation = DiagnosisCitation(source="Harrison's", section="Ch.5", relevance="high")
        assert citation.source == "Harrison's"
        assert citation.section == "Ch.5"
        assert citation.relevance == "high"

    def test_defaults(self):
        citation = DiagnosisCitation()
        assert citation.source == ""
        assert citation.section is None
        assert citation.relevance == ""


class TestDiagnosisWithCitations:
    def test_diagnosis_with_citations(self):
        dx = Diagnosis(
            condition="Viral Fever",
            icd10_code="B34.9",
            confidence=0.85,
            evidence_basis="clinical presentation",
            clinical_reasoning="fever + body ache",
            citations=[
                DiagnosisCitation(source="Harrison's", relevance="high"),
            ],
        )
        assert dx.condition == "Viral Fever"
        assert len(dx.citations) == 1
        assert dx.citations[0].source == "Harrison's"
        assert dx.evidence_basis == "clinical presentation"
        assert dx.clinical_reasoning == "fever + body ache"

    def test_diagnosis_none_coercion(self):
        """None values for string fields should coerce to empty strings."""
        dx = Diagnosis(
            condition=None,
            icd10_code=None,
            confidence=None,
            evidence_basis=None,
            clinical_reasoning=None,
        )
        assert dx.condition == ""
        assert dx.icd10_code == ""
        assert dx.confidence == 0.0
        assert dx.evidence_basis == ""
        assert dx.clinical_reasoning == ""


class TestDifferentialDiagnosis:
    def test_with_evidence_strength(self):
        ddx = DifferentialDiagnosis(
            condition="Dengue",
            icd10_code="A90",
            likelihood="high",
            confidence=0.7,
            supporting_evidence="fever + thrombocytopenia",
            distinguishing_tests="NS1 antigen",
            evidence_strength="moderate",
            citations=[DiagnosisCitation(source="WHO guidelines")],
        )
        assert ddx.evidence_strength == "moderate"
        assert ddx.condition == "Dengue"
        assert ddx.confidence == 0.7
        assert len(ddx.citations) == 1

    def test_none_coercion(self):
        ddx = DifferentialDiagnosis(
            condition=None,
            evidence_strength=None,
            confidence=None,
        )
        assert ddx.condition == ""
        assert ddx.evidence_strength == ""
        assert ddx.confidence == 0.0


class TestSession:
    def test_session_has_required_fields(self):
        session = Session()
        assert session.id is not None
        assert session.clinical_note is None
        assert session.cds_alerts == []
        assert session.fhir_quality is None
        assert session.transcript == ""
        assert session.fhir_bundle is None

    def test_session_with_clinical_note(self):
        note = ClinicalNote(chief_complaint="Headache")
        session = Session(clinical_note=note)
        assert session.clinical_note.chief_complaint == "Headache"

    def test_session_with_cds_alerts(self):
        session = Session(cds_alerts=[{"type": "drug_interaction", "severity": "critical"}])
        assert len(session.cds_alerts) == 1

    def test_session_with_fhir_quality(self):
        session = Session(fhir_quality={"score": 85, "grade": "B"})
        assert session.fhir_quality["score"] == 85


class TestClinicalNote:
    def test_empty_values_coercion(self):
        """None values should coerce to empty strings."""
        note = ClinicalNote(
            chief_complaint=None,
            history_of_present_illness=None,
            clinical_notes=None,
        )
        assert note.chief_complaint == ""
        assert note.history_of_present_illness == ""
        assert note.clinical_notes == ""

    def test_default_values(self):
        note = ClinicalNote()
        assert note.symptoms == []
        assert note.medications == []
        assert note.allergies == []
        assert note.diagnosis == []
        assert note.differential_diagnosis == []
        assert note.risk_factors == []
        assert note.recommended_tests == []
        assert note.follow_up is None

    def test_symptom_none_description(self):
        """Symptom with None description should coerce to empty string."""
        symptom = Symptom(description=None)
        assert symptom.description == ""
