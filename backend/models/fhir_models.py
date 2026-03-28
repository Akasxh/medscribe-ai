"""
FHIR R4 helper types.

We build FHIR resources as plain dicts for simplicity in this hackathon project.
These constants define the standard profile URLs and coding systems used.
"""

# FHIR R4 profile base URL (base HL7)
FHIR_R4_BASE = "http://hl7.org/fhir/StructureDefinition"

# ABDM / NRCES FHIR profile base URL (India-specific)
ABDM_PROFILE_BASE = "https://nrces.in/ndhm/fhir/r4/StructureDefinition"

# Coding systems
ICD10_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm"  # ICD-10-CM (codes like R50.9, E11.9, I10)
SNOMED_SYSTEM = "http://snomed.info/sct"
RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm"
LOINC_SYSTEM = "http://loinc.org"

# ABDM-aligned resource profile URLs
PROFILES = {
    "Patient": f"{ABDM_PROFILE_BASE}/Patient",
    "Encounter": f"{ABDM_PROFILE_BASE}/Encounter",
    "Condition": f"{ABDM_PROFILE_BASE}/Condition",
    "Observation": f"{ABDM_PROFILE_BASE}/Observation",
    "MedicationRequest": f"{ABDM_PROFILE_BASE}/MedicationRequest",
    "AllergyIntolerance": f"{ABDM_PROFILE_BASE}/AllergyIntolerance",
    "CarePlan": f"{FHIR_R4_BASE}/CarePlan",
    "ServiceRequest": f"{FHIR_R4_BASE}/ServiceRequest",
    "DetectedIssue": f"{FHIR_R4_BASE}/DetectedIssue",
    "Composition": f"{ABDM_PROFILE_BASE}/OPConsultRecord",
    "Practitioner": f"{ABDM_PROFILE_BASE}/Practitioner",
    "Organization": f"{ABDM_PROFILE_BASE}/Organization",
    "AuditEvent": f"{FHIR_R4_BASE}/AuditEvent",
}

# ABHA identifier system URI
ABHA_SYSTEM = "https://healthid.ndhm.gov.in"
