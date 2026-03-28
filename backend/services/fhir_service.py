import uuid
from datetime import datetime, timezone
from typing import Optional

from models.fhir_models import (
    FHIR_R4_BASE,
    PROFILES,
    ICD10_SYSTEM,
    SNOMED_SYSTEM,
    RXNORM_SYSTEM,
    LOINC_SYSTEM,
    ABHA_SYSTEM,
)


import re as _re


# T4: RxNorm CUI mapping for common generics (at least 20)
DRUG_RXNORM: dict[str, str] = {
    "paracetamol": "161",
    "acetaminophen": "161",
    "ibuprofen": "5640",
    "amoxicillin": "723",
    "azithromycin": "18631",
    "metformin": "6809",
    "atorvastatin": "83367",
    "amlodipine": "17767",
    "omeprazole": "7646",
    "pantoprazole": "40790",
    "cetirizine": "20610",
    "montelukast": "88249",
    "losartan": "52175",
    "metoprolol": "6918",
    "ciprofloxacin": "2551",
    "doxycycline": "3640",
    "prednisone": "8640",
    "salbutamol": "39108",
    "aspirin": "1191",
    "clopidogrel": "32968",
    "ranitidine": "9143",
    "enalapril": "3827",
    "furosemide": "4603",
    "insulin glargine": "274783",
    "levothyroxine": "10582",
    "diclofenac": "3355",
    "tramadol": "10689",
    "gabapentin": "25480",
    "ceftriaxone": "2193",
    "levofloxacin": "82122",
}


def _parse_dosage_value(dosage: str) -> float:
    """Extract numeric value from dosage string like '500mg' or '650 mg'."""
    match = _re.search(r"(\d+\.?\d*)", dosage or "")
    return float(match.group(1)) if match else 0


def _parse_dosage_unit(dosage: str) -> str:
    """Extract unit from dosage string like '500mg' or '10ml'."""
    match = _re.search(r"\d+\.?\d*\s*([a-zA-Z]+)", dosage or "")
    return match.group(1) if match else "mg"


def _try_parse_bp(value: str) -> tuple[float, float] | None:
    """Parse BP string like '120/80' into (systolic, diastolic)."""
    match = _re.match(r"(\d+\.?\d*)\s*/\s*(\d+\.?\d*)", str(value or "").strip())
    if match:
        return float(match.group(1)), float(match.group(2))
    return None


class FHIRBundleBuilder:
    """Builds a FHIR R4 Bundle from extracted clinical data."""

    def __init__(self) -> None:
        self._patient_id: str | None = None
        self._encounter_id: str | None = None
        self._practitioner_id: str | None = None
        self._organization_id: str | None = None

    def _make_id(self) -> str:
        return str(uuid.uuid4())

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # -- helpers for urn:uuid references (T1) --
    def _patient_ref(self) -> dict:
        return {"reference": f"urn:uuid:{self._patient_id}"}

    def _encounter_ref(self) -> dict:
        return {"reference": f"urn:uuid:{self._encounter_id}"}

    def _practitioner_ref(self) -> dict:
        return {"reference": f"urn:uuid:{self._practitioner_id}"}

    def _organization_ref(self) -> dict:
        return {"reference": f"urn:uuid:{self._organization_id}"}

    def build_bundle(
        self,
        clinical_data: dict,
        cds_alerts: list | None = None,
        abha_id: Optional[str] = None,
    ) -> dict:
        """Build a complete FHIR R4 Bundle from clinical note data."""
        self._bundle_timestamp = self._now_iso()
        self._patient_id = self._make_id()
        self._encounter_id = self._make_id()
        self._practitioner_id = self._make_id()
        self._organization_id = self._make_id()

        entries: list[dict] = []

        # T2: Practitioner + Organization
        practitioner = self._build_practitioner(clinical_data.get("doctor_name"))
        entries.append({"fullUrl": f"urn:uuid:{practitioner['id']}", "resource": practitioner})

        organization = self._build_organization()
        entries.append({"fullUrl": f"urn:uuid:{organization['id']}", "resource": organization})

        # Patient resource
        patient = self._build_patient(
            clinical_data.get("patient_info", {}), abha_id=abha_id
        )
        entries.append({"fullUrl": f"urn:uuid:{patient['id']}", "resource": patient})

        # Encounter resource
        encounter = self._build_encounter()
        entries.append({"fullUrl": f"urn:uuid:{encounter['id']}", "resource": encounter})

        # Condition resources (one per diagnosis)
        for dx in clinical_data.get("diagnosis", []):
            condition = self._build_condition(dx)
            entries.append({"fullUrl": f"urn:uuid:{condition['id']}", "resource": condition})

        # Observation resources for vitals
        vitals = clinical_data.get("vitals", {})
        if vitals:
            for vital_obs in self._build_vital_observations(vitals):
                entries.append({"fullUrl": f"urn:uuid:{vital_obs['id']}", "resource": vital_obs})

        # Observation resources for symptoms
        for symptom in clinical_data.get("symptoms", []):
            obs = self._build_symptom_observation(symptom)
            entries.append({"fullUrl": f"urn:uuid:{obs['id']}", "resource": obs})

        # MedicationRequest resources
        for med in clinical_data.get("medications", []):
            med_req = self._build_medication_request(med)
            entries.append({"fullUrl": f"urn:uuid:{med_req['id']}", "resource": med_req})

        # AllergyIntolerance resources
        for allergy in clinical_data.get("allergies", []):
            if allergy:
                allergy_res = self._build_allergy_intolerance(allergy)
                entries.append({"fullUrl": f"urn:uuid:{allergy_res['id']}", "resource": allergy_res})

        # CarePlan for follow-up instructions
        follow_up = clinical_data.get("follow_up")
        recommended_tests = clinical_data.get("recommended_tests", [])
        if follow_up or recommended_tests:
            care_plan = self._build_care_plan(follow_up, recommended_tests)
            entries.append({"fullUrl": f"urn:uuid:{care_plan['id']}", "resource": care_plan})

        # ServiceRequest for recommended tests
        for test in recommended_tests:
            if test:
                service_req = self._build_service_request(test)
                entries.append({"fullUrl": f"urn:uuid:{service_req['id']}", "resource": service_req})

        # DetectedIssue from CDS alerts
        for alert in (cds_alerts or []):
            detected_issue = self._build_detected_issue(alert)
            entries.append({"fullUrl": f"urn:uuid:{detected_issue['id']}", "resource": detected_issue})

        # AuditEvent tracking consultation creation
        audit_event = self._build_audit_event()
        entries.append({"fullUrl": f"urn:uuid:{audit_event['id']}", "resource": audit_event})

        # Collect references for Composition sections (use urn:uuid)
        entry_references: list[dict] = []
        for entry in entries:
            res = entry["resource"]
            rt = res.get("resourceType", "")
            if rt in ("Condition", "MedicationRequest", "Observation",
                       "AllergyIntolerance", "CarePlan", "ServiceRequest"):
                entry_references.append({"reference": f"urn:uuid:{res['id']}", "type": rt})

        # Build Composition as document entry point and insert as first entry
        composition = self._build_composition(clinical_data, entry_references)
        entries.insert(0, {
            "fullUrl": f"urn:uuid:{composition['id']}",
            "resource": composition,
        })

        bundle = {
            "resourceType": "Bundle",
            "id": self._make_id(),
            "meta": {
                "lastUpdated": self._bundle_timestamp,
            },
            "type": "document",
            "timestamp": self._bundle_timestamp,
            "entry": entries,
        }

        return bundle

    def _build_composition(self, clinical_data: dict, entry_references: list[dict]) -> dict:
        """Build a FHIR Composition resource (required for document bundles)."""
        sections: list[dict] = []
        if clinical_data.get("chief_complaint"):
            sections.append({
                "title": "Chief Complaint",
                "code": {"coding": [{"system": LOINC_SYSTEM, "code": "10154-3", "display": "Chief complaint"}]},
                "text": {"status": "generated", "div": f"<div>{clinical_data['chief_complaint']}</div>"},
            })
        if clinical_data.get("diagnosis"):
            sections.append({
                "title": "Diagnoses",
                "code": {"coding": [{"system": LOINC_SYSTEM, "code": "29308-4", "display": "Diagnosis"}]},
                "entry": [ref for ref in entry_references if ref.get("type") == "Condition"],
            })
        if clinical_data.get("medications"):
            sections.append({
                "title": "Medications",
                "code": {"coding": [{"system": LOINC_SYSTEM, "code": "10160-0", "display": "Medications"}]},
                "entry": [ref for ref in entry_references if ref.get("type") == "MedicationRequest"],
            })

        comp_id = self._make_id()
        return {
            "resourceType": "Composition",
            "id": comp_id,
            "meta": {"profile": [PROFILES["Composition"]]},
            "status": "final",
            "type": {"coding": [{"system": LOINC_SYSTEM, "code": "11488-4", "display": "Consult note"}]},
            "subject": self._patient_ref(),
            "encounter": self._encounter_ref(),
            "date": self._bundle_timestamp,
            "author": [self._practitioner_ref()],           # T2
            "custodian": self._organization_ref(),           # T2
            "title": "Clinical Consultation Note",
            "section": sections,
        }

    # T2: Practitioner resource
    def _build_practitioner(self, doctor_name: str | None = None) -> dict:
        name = doctor_name or "Attending Physician"
        return {
            "resourceType": "Practitioner",
            "id": self._practitioner_id,
            "meta": {"profile": [PROFILES["Practitioner"]]},
            "active": True,
            "name": [{"use": "official", "text": name}],
        }

    # T2: Organization resource
    def _build_organization(self) -> dict:
        return {
            "resourceType": "Organization",
            "id": self._organization_id,
            "meta": {"profile": [PROFILES["Organization"]]},
            "active": True,
            "name": "MedScribe AI Clinic",
        }

    def _build_patient(
        self, patient_info: dict, abha_id: Optional[str] = None
    ) -> dict:
        name = patient_info.get("name")
        gender = patient_info.get("gender")
        age = patient_info.get("age")

        resource: dict = {
            "resourceType": "Patient",
            "id": self._patient_id,
            "meta": {"profile": [PROFILES["Patient"]]},
        }

        # T5: ABHA identifier with correct system URI
        if abha_id:
            resource["identifier"] = [
                {
                    "system": ABHA_SYSTEM,
                    "value": abha_id,
                    "type": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                "code": "MR",
                                "display": "Medical Record Number",
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
            try:
                age_int = int(''.join(c for c in str(age) if c.isdigit()) or '0')
                if age_int > 0:
                    birth_year = datetime.now().year - age_int
                    resource["birthDate"] = f"{birth_year}-01-01"
            except (ValueError, TypeError):
                pass

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
            "subject": self._patient_ref(),
            "period": {
                "start": self._bundle_timestamp,
                "end": self._bundle_timestamp,
            },
        }

    def _build_condition(self, diagnosis: dict) -> dict:
        condition_name = diagnosis.get("condition") or "Unknown"
        icd10_code = diagnosis.get("icd10_code") or ""
        certainty = diagnosis.get("certainty") or "suspected"

        verification_map = {
            "confirmed": "confirmed",
            "suspected": "unconfirmed",
            "differential": "differential",
        }

        return {
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
            "subject": self._patient_ref(),
            "encounter": self._encounter_ref(),
            "recordedDate": self._bundle_timestamp,
        }

    def _build_vital_observations(self, vitals: dict) -> list:
        """Build Observation resources for each recorded vital sign."""
        observations: list[dict] = []

        # T3: Fixed LOINC codes — SpO2 corrected to 59408-5
        vital_loinc = {
            "temperature": {
                "code": "8310-5",
                "display": "Body temperature",
                "unit": "°F",
                "ucum": "[degF]",
            },
            "pulse": {
                "code": "8867-4",
                "display": "Heart rate",
                "unit": "/min",
                "ucum": "/min",
            },
            "spo2": {
                "code": "59408-5",
                "display": "Oxygen saturation by pulse oximetry",
                "unit": "%",
                "ucum": "%",
            },
            "weight": {
                "code": "29463-7",
                "display": "Body weight",
                "unit": "kg",
                "ucum": "kg",
            },
            "respiratory_rate": {
                "code": "9279-1",
                "display": "Respiratory rate",
                "unit": "/min",
                "ucum": "/min",
            },
        }

        # Process non-BP vitals with valueQuantity where possible
        for vital_key, loinc_info in vital_loinc.items():
            value = vitals.get(vital_key)
            if not value:
                continue

            obs: dict = {
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
                "subject": self._patient_ref(),
                "encounter": self._encounter_ref(),
                "effectiveDateTime": self._bundle_timestamp,
            }

            # Try to extract numeric value for valueQuantity
            numeric = _re.search(r"(\d+\.?\d*)", str(value))
            if numeric:
                obs["valueQuantity"] = {
                    "value": float(numeric.group(1)),
                    "unit": loinc_info["unit"],
                    "system": "http://unitsofmeasure.org",
                    "code": loinc_info["ucum"],
                }
            else:
                obs["valueString"] = str(value)

            observations.append(obs)

        # T3: BP as component structure
        bp_value = vitals.get("bp")
        if bp_value:
            bp_parsed = _try_parse_bp(bp_value)
            bp_obs: dict = {
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
                            "code": "85354-9",
                            "display": "Blood pressure panel",
                        }
                    ],
                    "text": "Blood pressure panel",
                },
                "subject": self._patient_ref(),
                "encounter": self._encounter_ref(),
                "effectiveDateTime": self._bundle_timestamp,
            }

            if bp_parsed:
                systolic, diastolic = bp_parsed
                bp_obs["component"] = [
                    {
                        "code": {
                            "coding": [{"system": LOINC_SYSTEM, "code": "8480-6", "display": "Systolic blood pressure"}],
                        },
                        "valueQuantity": {
                            "value": systolic,
                            "unit": "mmHg",
                            "system": "http://unitsofmeasure.org",
                            "code": "mm[Hg]",
                        },
                    },
                    {
                        "code": {
                            "coding": [{"system": LOINC_SYSTEM, "code": "8462-4", "display": "Diastolic blood pressure"}],
                        },
                        "valueQuantity": {
                            "value": diastolic,
                            "unit": "mmHg",
                            "system": "http://unitsofmeasure.org",
                            "code": "mm[Hg]",
                        },
                    },
                ]
            else:
                # Fallback: unparseable BP string
                bp_obs["valueString"] = str(bp_value)

            observations.append(bp_obs)

        return observations

    def _build_symptom_observation(self, symptom: dict) -> dict:
        description = symptom.get("description") or "Unknown symptom"
        duration = symptom.get("duration")
        severity = symptom.get("severity")

        obs: dict = {
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
                "text": description,
            },
            "subject": self._patient_ref(),
            "encounter": self._encounter_ref(),
            "effectiveDateTime": self._bundle_timestamp,
            "valueString": description,
        }

        if duration:
            obs["note"] = [{"text": f"Duration: {duration}"}]

        if severity:
            # Map severity to HL7 interpretation codes
            severity_code_map = {
                "severe": "H",
                "high": "H",
                "moderate": "N",
                "mild": "L",
                "low": "L",
            }
            code = severity_code_map.get(severity.lower(), "N") if severity else "N"
            obs["interpretation"] = [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                            "code": code,
                            "display": severity,
                        }
                    ],
                    "text": severity,
                }
            ]

        return obs

    def _build_medication_request(self, medication: dict) -> dict:
        name = medication.get("name") or "Unknown"
        generic_name = medication.get("generic_name") or name
        dosage = medication.get("dosage") or ""
        frequency = medication.get("frequency") or ""
        duration = medication.get("duration") or ""
        route = medication.get("route") or "oral"

        # T4: Build medicationCodeableConcept with RxNorm coding
        med_concept: dict = {"text": generic_name or name}
        rxcui = DRUG_RXNORM.get((generic_name or name).lower())
        if rxcui:
            med_concept["coding"] = [
                {
                    "system": RXNORM_SYSTEM,
                    "code": rxcui,
                    "display": generic_name or name,
                }
            ]

        resource: dict = {
            "resourceType": "MedicationRequest",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["MedicationRequest"]]},
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": med_concept,
            "subject": self._patient_ref(),
            "encounter": self._encounter_ref(),
            "requester": self._practitioner_ref(),          # T2
            "authoredOn": self._bundle_timestamp,
            "dosageInstruction": [
                {
                    "text": " ".join(
                        p for p in [dosage, frequency, f"for {duration}" if duration else None] if p
                    ),
                    "route": self._build_route_coding(route),
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
            # Parse numeric value and unit from duration string (e.g. "5 days" → 5, "d")
            import re
            dur_match = re.match(r"(\d+)\s*(\w+)?", str(duration))
            dur_val = int(dur_match.group(1)) if dur_match else 1
            dur_unit_raw = (dur_match.group(2) or "d") if dur_match else "d"
            ucum_map = {"day": "d", "days": "d", "week": "wk", "weeks": "wk", "month": "mo", "months": "mo"}
            dur_unit = ucum_map.get(dur_unit_raw.lower(), "d")
            resource["dosageInstruction"][0]["timing"] = {
                "repeat": {"boundsDuration": {
                    "value": dur_val,
                    "unit": dur_unit,
                    "system": "http://unitsofmeasure.org",
                    "code": dur_unit,
                }}
            }

        return resource

    @staticmethod
    def _build_route_coding(route: str) -> dict:
        """Build route CodeableConcept with SNOMED code when available."""
        route_codes = {
            "oral": "26643006",
            "iv": "47625008",
            "im": "78421000",
            "topical": "6064005",
            "inhalation": "18679011000001101",
        }
        route_lower = (route or "").lower()
        code = route_codes.get(route_lower)
        if code:
            return {
                "coding": [
                    {
                        "system": SNOMED_SYSTEM,
                        "code": code,
                        "display": route,
                    }
                ]
            }
        return {"text": route}

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
            "category": ["medication"],
            "patient": self._patient_ref(),
            "recordedDate": self._bundle_timestamp,
            "code": {
                "text": allergy,
            },
        }

    def _build_care_plan(
        self, follow_up: Optional[str], recommended_tests: list
    ) -> dict:
        """Build a CarePlan resource for follow-up and test recommendations."""
        activities: list[dict] = []

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
            "subject": self._patient_ref(),
            "encounter": self._encounter_ref(),
            "created": self._bundle_timestamp,
            "activity": activities,
        }

    def _build_detected_issue(self, alert: dict) -> dict:
        """Build a DetectedIssue resource from a CDS alert."""
        severity_map = {
            "critical": "high",
            "warning": "moderate",
            "info": "low",
        }
        # T5: Fix DetectedIssue codes — DRG→DINT, ALGY→ALG, DOSE→DOSEIVL
        code_map = {
            "drug_interaction": {"code": "DINT", "display": "Drug Interaction Alert"},
            "allergy_contraindication": {"code": "ALG", "display": "Allergy Alert"},
            "dosage_alert": {"code": "DOSEIVL", "display": "Dosage Interval Issue"},
        }

        alert_type = alert.get("type", "drug_interaction")
        code_info = code_map.get(alert_type, code_map["drug_interaction"])

        resource: dict = {
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
            "patient": self._patient_ref(),
            "identifiedDateTime": self._bundle_timestamp,
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
                "date": self._bundle_timestamp,
            }
        ]

        return resource

    def _build_audit_event(self) -> dict:
        """Build a FHIR R4 AuditEvent recording this consultation creation."""
        return {
            "resourceType": "AuditEvent",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["AuditEvent"]]},
            "type": {
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": "110110",
                "display": "Patient Record",
            },
            "action": "C",
            "recorded": self._bundle_timestamp,
            "outcome": "0",
            "agent": [
                {
                    "who": self._practitioner_ref(),
                    "requestor": True,
                }
            ],
            "source": {
                "observer": self._organization_ref(),
                "type": [{"system": "http://terminology.hl7.org/CodeSystem/security-source-type", "code": "4", "display": "Application Server"}],
            },
            "entity": [
                {
                    "what": self._patient_ref(),
                    "type": {
                        "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
                        "code": "1",
                        "display": "Person",
                    },
                }
            ],
        }

    def _build_service_request(self, test_name: str) -> dict:
        """Build a ServiceRequest for a recommended diagnostic test."""
        return {
            "resourceType": "ServiceRequest",
            "id": self._make_id(),
            "meta": {"profile": [PROFILES["ServiceRequest"]]},
            "status": "active",
            "intent": "order",
            "code": {
                "text": test_name,
            },
            "subject": self._patient_ref(),
            "encounter": self._encounter_ref(),
            "requester": self._practitioner_ref(),           # T2
            "authoredOn": self._bundle_timestamp,
        }
