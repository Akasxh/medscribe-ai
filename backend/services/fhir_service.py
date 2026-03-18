import uuid
from datetime import datetime, timezone
from typing import Optional

from models.fhir_models import (
    PROFILES,
    ICD10_SYSTEM,
    SNOMED_SYSTEM,
    RXNORM_SYSTEM,
    LOINC_SYSTEM,
)


import re as _re


def _parse_dosage_value(dosage: str) -> float:
    """Extract numeric value from dosage string like '500mg' or '650 mg'."""
    match = _re.search(r"(\d+\.?\d*)", dosage or "")
    return float(match.group(1)) if match else 0


def _parse_dosage_unit(dosage: str) -> str:
    """Extract unit from dosage string like '500mg' or '10ml'."""
    match = _re.search(r"\d+\.?\d*\s*([a-zA-Z]+)", dosage or "")
    return match.group(1) if match else "mg"


class FHIRBundleBuilder:
    """Builds a FHIR R4 Bundle from extracted clinical data."""

    def __init__(self):
        self._patient_id = None
        self._encounter_id = None

    def _make_id(self) -> str:
        return str(uuid.uuid4())

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def build_bundle(
        self,
        clinical_data: dict,
        cds_alerts: list = None,
        abha_id: Optional[str] = None,
    ) -> dict:
        """Build a complete FHIR R4 Bundle from clinical note data."""
        self._patient_id = self._make_id()
        self._encounter_id = self._make_id()

        entries = []

        # Patient resource
        patient = self._build_patient(
            clinical_data.get("patient_info", {}), abha_id=abha_id
        )
        entries.append({"resource": patient})

        # Encounter resource
        encounter = self._build_encounter()
        entries.append({"resource": encounter})

        # Condition resources (one per diagnosis)
        for dx in clinical_data.get("diagnosis", []):
            condition = self._build_condition(dx)
            entries.append({"resource": condition})

        # Observation resources for vitals
        vitals = clinical_data.get("vitals", {})
        if vitals:
            for vital_obs in self._build_vital_observations(vitals):
                entries.append({"resource": vital_obs})

        # Observation resources for symptoms
        for symptom in clinical_data.get("symptoms", []):
            obs = self._build_symptom_observation(symptom)
            entries.append({"resource": obs})

        # MedicationRequest resources
        for med in clinical_data.get("medications", []):
            med_req = self._build_medication_request(med)
            entries.append({"resource": med_req})

        # AllergyIntolerance resources
        for allergy in clinical_data.get("allergies", []):
            if allergy:
                allergy_res = self._build_allergy_intolerance(allergy)
                entries.append({"resource": allergy_res})

        # CarePlan for follow-up instructions
        follow_up = clinical_data.get("follow_up")
        recommended_tests = clinical_data.get("recommended_tests", [])
        if follow_up or recommended_tests:
            care_plan = self._build_care_plan(follow_up, recommended_tests)
            entries.append({"resource": care_plan})

        # ServiceRequest for recommended tests
        for test in recommended_tests:
            if test:
                service_req = self._build_service_request(test)
                entries.append({"resource": service_req})

        # DetectedIssue from CDS alerts (drug interactions, allergy contraindications)
        for alert in (cds_alerts or []):
            detected_issue = self._build_detected_issue(alert)
            entries.append({"resource": detected_issue})

        bundle = {
            "resourceType": "Bundle",
            "id": self._make_id(),
            "meta": {
                "lastUpdated": self._now_iso(),
            },
            "type": "collection",
            "entry": entries,
        }

        return bundle

    def _build_patient(
        self, patient_info: dict, abha_id: Optional[str] = None
    ) -> dict:
        name = patient_info.get("name")
        gender = patient_info.get("gender")
        age = patient_info.get("age")

        resource = {
            "resourceType": "Patient",
            "id": self._patient_id,
            "meta": {"profile": [PROFILES["Patient"]]},
        }

        # ABHA (Ayushman Bharat Health Account) identifier
        if abha_id:
            resource["identifier"] = [
                {
                    "system": "https://healthid.ndhm.gov.in",
                    "value": abha_id,
                    "type": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                "code": "MR",
                                "display": "Medical record number",
                            }
                        ]
                    },
                }
            ]

        if name:
            resource["name"] = [{"use": "official", "text": name}]

        if gender:
            gender_map = {
                "Male": "male",
                "Female": "female",
                "Other": "other",
                "male": "male",
                "female": "female",
                "other": "other",
            }
            resource["gender"] = gender_map.get(gender, "unknown")

        if age:
            resource["extension"] = [
                {
                    "url": "http://hl7.org/fhir/StructureDefinition/patient-age",
                    "valueString": age,
                }
            ]

        return resource

    def _build_encounter(self) -> dict:
        return {
            "resourceType": "Encounter",
            "id": self._encounter_id,
            "meta": {"profile": [PROFILES["Encounter"]]},
            "status": "finished",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory",
            },
            "subject": {"reference": f"Patient/{self._patient_id}"},
            "period": {
                "start": self._now_iso(),
            },
        }

    def _build_condition(self, diagnosis: dict) -> dict:
        condition_name = diagnosis.get("condition", "Unknown")
        icd10_code = diagnosis.get("icd10_code", "")
        certainty = diagnosis.get("certainty", "suspected")

        verification_map = {
            "confirmed": "confirmed",
            "suspected": "unconfirmed",
            "differential": "differential",
        }

        resource = {
            "resourceType": "Condition",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["Condition"]]},
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active",
                        "display": "Active",
                    }
                ]
            },
            "verificationStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                        "code": verification_map.get(certainty, "unconfirmed"),
                        "display": verification_map.get(
                            certainty, "unconfirmed"
                        ).capitalize(),
                    }
                ]
            },
            "code": {
                "coding": [
                    {
                        "system": ICD10_SYSTEM,
                        "code": icd10_code,
                        "display": condition_name,
                    }
                ],
                "text": condition_name,
            },
            "subject": {"reference": f"Patient/{self._patient_id}"},
            "encounter": {"reference": f"Encounter/{self._encounter_id}"},
            "recordedDate": self._now_iso(),
        }

        return resource

    def _build_vital_observations(self, vitals: dict) -> list:
        """Build Observation resources for each recorded vital sign."""
        observations = []

        vital_loinc = {
            "temperature": {
                "code": "8310-5",
                "display": "Body temperature",
            },
            "bp": {
                "code": "85354-9",
                "display": "Blood pressure panel",
            },
            "pulse": {"code": "8867-4", "display": "Heart rate"},
            "spo2": {
                "code": "2708-6",
                "display": "Oxygen saturation",
            },
            "weight": {"code": "29463-7", "display": "Body weight"},
        }

        for vital_key, loinc_info in vital_loinc.items():
            value = vitals.get(vital_key)
            if value:
                obs = {
                    "resourceType": "Observation",
                    "id": self._make_id(),
                    "meta": {"profile": [PROFILES["Observation"]]},
                    "status": "final",
                    "category": [
                        {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                    "code": "vital-signs",
                                    "display": "Vital Signs",
                                }
                            ]
                        }
                    ],
                    "code": {
                        "coding": [
                            {
                                "system": LOINC_SYSTEM,
                                "code": loinc_info["code"],
                                "display": loinc_info["display"],
                            }
                        ],
                        "text": loinc_info["display"],
                    },
                    "subject": {
                        "reference": f"Patient/{self._patient_id}"
                    },
                    "encounter": {
                        "reference": f"Encounter/{self._encounter_id}"
                    },
                    "effectiveDateTime": self._now_iso(),
                    "valueString": value,
                }
                observations.append(obs)

        return observations

    def _build_symptom_observation(self, symptom: dict) -> dict:
        description = symptom.get("description", "Unknown symptom")
        duration = symptom.get("duration")
        severity = symptom.get("severity")

        obs = {
            "resourceType": "Observation",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["Observation"]]},
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "exam",
                            "display": "Exam",
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": SNOMED_SYSTEM,
                        "code": "418799008",
                        "display": "Symptom",
                    }
                ],
                "text": description,
            },
            "subject": {"reference": f"Patient/{self._patient_id}"},
            "encounter": {
                "reference": f"Encounter/{self._encounter_id}"
            },
            "effectiveDateTime": self._now_iso(),
            "valueString": description,
        }

        if duration:
            obs["note"] = [{"text": f"Duration: {duration}"}]

        if severity:
            obs["interpretation"] = [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                            "display": severity,
                        }
                    ],
                    "text": severity,
                }
            ]

        return obs

    def _build_medication_request(self, medication: dict) -> dict:
        name = medication.get("name", "Unknown")
        generic_name = medication.get("generic_name", name)
        dosage = medication.get("dosage", "")
        frequency = medication.get("frequency", "")
        duration = medication.get("duration", "")
        route = medication.get("route", "oral")

        resource = {
            "resourceType": "MedicationRequest",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["MedicationRequest"]]},
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [
                    {
                        "system": RXNORM_SYSTEM,
                        "display": generic_name,
                    }
                ],
                "text": f"{name} ({generic_name})",
            },
            "subject": {"reference": f"Patient/{self._patient_id}"},
            "encounter": {
                "reference": f"Encounter/{self._encounter_id}"
            },
            "authoredOn": self._now_iso(),
            "dosageInstruction": [
                {
                    "text": f"{dosage} {frequency} for {duration}",
                    "route": {
                        "coding": [
                            {
                                "system": SNOMED_SYSTEM,
                                "display": route,
                            }
                        ]
                    },
                    "doseAndRate": [
                        {
                            "doseQuantity": {
                                "value": _parse_dosage_value(dosage),
                                "unit": _parse_dosage_unit(dosage),
                                "system": "http://unitsofmeasure.org",
                            }
                        }
                    ],
                }
            ],
        }

        if duration:
            resource["dosageInstruction"][0]["timing"] = {
                "repeat": {"boundsDuration": {"value": duration}}
            }

        return resource

    def _build_allergy_intolerance(self, allergy: str) -> dict:
        return {
            "resourceType": "AllergyIntolerance",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["AllergyIntolerance"]]},
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                        "code": "active",
                        "display": "Active",
                    }
                ]
            },
            "verificationStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                        "code": "unconfirmed",
                        "display": "Unconfirmed",
                    }
                ]
            },
            "type": "allergy",
            "patient": {"reference": f"Patient/{self._patient_id}"},
            "recordedDate": self._now_iso(),
            "code": {
                "text": allergy,
            },
        }

    def _build_care_plan(
        self, follow_up: Optional[str], recommended_tests: list
    ) -> dict:
        """Build a CarePlan resource for follow-up and test recommendations."""
        activities = []

        if follow_up:
            activities.append({
                "detail": {
                    "kind": "Appointment",
                    "status": "scheduled",
                    "description": follow_up,
                }
            })

        for test in recommended_tests:
            if test:
                activities.append({
                    "detail": {
                        "kind": "ServiceRequest",
                        "status": "scheduled",
                        "description": test,
                        "code": {
                            "text": test,
                        },
                    }
                })

        return {
            "resourceType": "CarePlan",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["CarePlan"]]},
            "status": "active",
            "intent": "plan",
            "title": "Follow-up Care Plan",
            "subject": {"reference": f"Patient/{self._patient_id}"},
            "encounter": {"reference": f"Encounter/{self._encounter_id}"},
            "created": self._now_iso(),
            "activity": activities,
        }

    def _build_detected_issue(self, alert: dict) -> dict:
        """Build a DetectedIssue resource from a CDS alert."""
        severity_map = {
            "critical": "high",
            "warning": "moderate",
            "info": "low",
        }
        code_map = {
            "drug_interaction": {"code": "DRG", "display": "Drug Interaction Alert"},
            "allergy_contraindication": {"code": "ALGY", "display": "Allergy Contraindication"},
            "dosage_alert": {"code": "DOSE", "display": "Dosage Issue"},
        }

        alert_type = alert.get("type", "drug_interaction")
        code_info = code_map.get(alert_type, code_map["drug_interaction"])

        resource = {
            "resourceType": "DetectedIssue",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["DetectedIssue"]]},
            "status": "final",
            "code": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": code_info["code"],
                        "display": code_info["display"],
                    }
                ],
                "text": alert.get("title", "Clinical alert"),
            },
            "severity": severity_map.get(alert.get("severity", "info"), "low"),
            "patient": {"reference": f"Patient/{self._patient_id}"},
            "identifiedDateTime": self._now_iso(),
            "detail": alert.get("description", ""),
        }

        # Add implicated medications
        meds = alert.get("medications_involved", [])
        if meds:
            resource["implicated"] = [
                {"display": med} for med in meds
            ]

        # Add suggested mitigation
        resource["mitigation"] = [
            {
                "action": {
                    "text": alert.get("description", "Review and adjust prescription"),
                },
                "date": self._now_iso(),
            }
        ]

        return resource

    def _build_service_request(self, test_name: str) -> dict:
        """Build a ServiceRequest for a recommended diagnostic test."""
        return {
            "resourceType": "ServiceRequest",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["ServiceRequest"]]},
            "status": "active",
            "intent": "order",
            "code": {
                "coding": [
                    {
                        "system": LOINC_SYSTEM,
                        "display": test_name,
                    }
                ],
                "text": test_name,
            },
            "subject": {"reference": f"Patient/{self._patient_id}"},
            "encounter": {"reference": f"Encounter/{self._encounter_id}"},
            "authoredOn": self._now_iso(),
        }
