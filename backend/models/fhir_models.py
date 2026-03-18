"""
FHIR R4 helper types.

We build FHIR resources as plain dicts for simplicity in this hackathon project.
These constants define the standard profile URLs and coding systems used.
"""

# FHIR R4 profile base URL
FHIR_R4_BASE = "http://hl7.org/fhir/StructureDefinition"

# Coding systems
ICD10_SYSTEM = "http://hl7.org/fhir/sid/icd-10"
SNOMED_SYSTEM = "http://snomed.info/sct"
RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm"
LOINC_SYSTEM = "http://loinc.org"

# Resource profile URLs
PROFILES = {
    "Patient": f"{FHIR_R4_BASE}/Patient",
    "Encounter": f"{FHIR_R4_BASE}/Encounter",
    "Condition": f"{FHIR_R4_BASE}/Condition",
    "Observation": f"{FHIR_R4_BASE}/Observation",
    "MedicationRequest": f"{FHIR_R4_BASE}/MedicationRequest",
    "AllergyIntolerance": f"{FHIR_R4_BASE}/AllergyIntolerance",
    "CarePlan": f"{FHIR_R4_BASE}/CarePlan",
    "ServiceRequest": f"{FHIR_R4_BASE}/ServiceRequest",
    "DetectedIssue": f"{FHIR_R4_BASE}/DetectedIssue",
}
