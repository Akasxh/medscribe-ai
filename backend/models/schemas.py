from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class Symptom(BaseModel):
    description: str
    duration: Optional[str] = None
    severity: Optional[str] = None


class Vitals(BaseModel):
    temperature: Optional[str] = None
    bp: Optional[str] = None
    pulse: Optional[str] = None
    spo2: Optional[str] = None
    weight: Optional[str] = None


class Diagnosis(BaseModel):
    condition: str
    icd10_code: str
    certainty: str = "suspected"  # confirmed, suspected, differential
    confidence: float = 0.0  # 0.0-1.0 confidence score


class Medication(BaseModel):
    name: str
    generic_name: str
    dosage: str
    frequency: str
    duration: str
    route: str = "oral"


class DifferentialDiagnosis(BaseModel):
    condition: str
    icd10_code: str
    likelihood: str = "moderate"  # high, moderate, low
    confidence: float = 0.0  # 0.0-1.0 probability estimate
    supporting_evidence: str = ""
    distinguishing_tests: str = ""


class ClinicalNote(BaseModel):
    patient_info: dict = Field(
        default_factory=lambda: {"name": None, "age": None, "gender": None}
    )
    chief_complaint: str = ""
    history_of_present_illness: str = ""
    symptoms: List[Symptom] = []
    vitals: Vitals = Field(default_factory=Vitals)
    diagnosis: List[Diagnosis] = []
    medications: List[Medication] = []
    observations: List[str] = []
    allergies: List[str] = []
    differential_diagnosis: List[DifferentialDiagnosis] = []
    risk_factors: List[str] = []
    recommended_tests: List[str] = []
    follow_up: Optional[str] = None
    clinical_notes: str = ""


class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.now)
    transcript: str = ""
    clinical_note: Optional[ClinicalNote] = None
    fhir_bundle: Optional[dict] = None


class TranscriptMessage(BaseModel):
    type: str = "transcript"
    text: str
    is_final: bool
    timestamp: str
