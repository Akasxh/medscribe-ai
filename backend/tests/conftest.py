import sys
from pathlib import Path

# Add backend to path so imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


@pytest.fixture
def sample_clinical_data():
    return {
        "patient_info": {"name": "Rajesh Kumar", "age": "45", "gender": "Male"},
        "chief_complaint": "Chest pain for 2 days",
        "history_of_present_illness": "Patient reports intermittent chest pain",
        "symptoms": [
            {"description": "Chest pain", "duration": "2 days", "severity": "moderate"},
            {"description": "Shortness of breath", "duration": "1 day", "severity": "mild"},
        ],
        "vitals": {"temperature": "98.6F", "bp": "140/90", "pulse": "88", "spo2": "96%"},
        "diagnosis": [
            {"condition": "Hypertension", "icd10_code": "I10", "certainty": "confirmed", "confidence": 0.9},
        ],
        "medications": [
            {"name": "Telma 40", "generic_name": "Telmisartan", "dosage": "40mg", "frequency": "OD", "duration": "30 days"},
            {"name": "Ecosprin 75", "generic_name": "Aspirin", "dosage": "75mg", "frequency": "OD", "duration": "30 days"},
        ],
        "allergies": ["Penicillin"],
        "follow_up": "Review in 2 weeks",
        "recommended_tests": ["ECG", "Lipid profile"],
        "differential_diagnosis": [],
        "risk_factors": ["Smoking", "Family history of CAD"],
        "observations": [],
    }
