from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class Symptom(BaseModel):
    description: Optional[str] = ""
    duration: Optional[str] = None
    severity: Optional[str] = None

    @field_validator("description", mode="before")
    @classmethod
    def coerce_none_str(cls, v):
        return v if v is not None else ""


class Vitals(BaseModel):
    temperature: Optional[str] = None
    bp: Optional[str] = None
    pulse: Optional[str] = None
    spo2: Optional[str] = None
    weight: Optional[str] = None
    respiratory_rate: Optional[str] = None


class Diagnosis(BaseModel):
    condition: Optional[str] = ""
    icd10_code: Optional[str] = ""
    certainty: Optional[str] = "suspected"
    confidence: Optional[float] = 0.0

    @field_validator("condition", "icd10_code", "certainty", mode="before")
    @classmethod
    def coerce_none_str(cls, v):
        return v if v is not None else ""

    @field_validator("confidence", mode="before")
    @classmethod
    def coerce_none_float(cls, v):
        if v is None:
            return 0.0
        try:
            return float(v)
        except (ValueError, TypeError):
            return 0.0


class Medication(BaseModel):
    name: Optional[str] = ""
    generic_name: Optional[str] = ""
    dosage: Optional[str] = ""
    frequency: Optional[str] = ""
    duration: Optional[str] = ""
    route: Optional[str] = "oral"

    @field_validator("name", "generic_name", "dosage", "frequency", "duration", "route", mode="before")
    @classmethod
    def coerce_none_str(cls, v):
        return v if v is not None else ""


class DifferentialDiagnosis(BaseModel):
    condition: Optional[str] = ""
    icd10_code: Optional[str] = ""
    likelihood: Optional[str] = "moderate"
    confidence: Optional[float] = 0.0
    supporting_evidence: Optional[str] = ""
    distinguishing_tests: Optional[str] = ""

    @field_validator("condition", "icd10_code", "likelihood", "supporting_evidence", "distinguishing_tests", mode="before")
    @classmethod
    def coerce_none_str(cls, v):
        return v if v is not None else ""

    @field_validator("confidence", mode="before")
    @classmethod
    def coerce_none_float(cls, v):
        if v is None:
            return 0.0
        try:
            return float(v)
        except (ValueError, TypeError):
            return 0.0


class ClinicalNote(BaseModel):
    patient_info: dict = Field(
        default_factory=lambda: {"name": None, "age": None, "gender": None}
    )
    chief_complaint: Optional[str] = ""
    history_of_present_illness: Optional[str] = ""
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
    clinical_notes: Optional[str] = ""

    @field_validator("chief_complaint", "history_of_present_illness", "clinical_notes", mode="before")
    @classmethod
    def coerce_none_str(cls, v):
        return v if v is not None else ""


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
