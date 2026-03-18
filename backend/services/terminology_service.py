"""
FHIR Terminology Validation Service.

Validates ICD-10 codes, drug names, and LOINC codes against reference data.
Returns validation results that enhance the FHIR quality score.
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"

# Load reference data once at module level
_icd10_codes: dict = {}
_drug_reference: dict = {}


def _load_references():
    global _icd10_codes, _drug_reference

    icd10_path = DATA_DIR / "icd10_common.json"
    if icd10_path.exists() and not _icd10_codes:
        with open(icd10_path) as f:
            raw = json.load(f)
            # Create reverse lookup: code -> condition name
            _icd10_codes = {v: k for k, v in raw.items()}
            # Also store condition -> code (lowercase for lookup)
            _icd10_codes.update({k.lower(): v for k, v in raw.items()})

    drug_path = DATA_DIR / "drug_reference.json"
    if drug_path.exists() and not _drug_reference:
        with open(drug_path) as f:
            _drug_reference = json.load(f)  # {"BrandName": {"generic": "...", "category": "..."}}


def validate_clinical_data(clinical_data: dict) -> dict:
    """Validate clinical data against reference terminology.

    Returns:
        dict with:
        - validated_codes: list of {field, code, display, status: "valid"|"unknown", source}
        - score_boost: additional points for FHIR quality (0-10)
        - suggestions: list of correction suggestions
    """
    _load_references()

    validated = []
    suggestions = []
    valid_count = 0
    total_count = 0

    # Validate ICD-10 codes in diagnoses
    for i, dx in enumerate(clinical_data.get("diagnosis", [])):
        code = dx.get("icd10_code", "")
        condition = dx.get("condition", "")
        total_count += 1

        if code in _icd10_codes:
            validated.append({
                "field": f"diagnosis[{i}]",
                "code": code,
                "display": condition,
                "status": "valid",
                "source": "ICD-10-CM",
                "reference_name": _icd10_codes[code],
            })
            valid_count += 1
        else:
            # Try to find correct code by condition name
            suggestion = _icd10_codes.get(condition.lower())
            entry = {
                "field": f"diagnosis[{i}]",
                "code": code,
                "display": condition,
                "status": "unknown",
                "source": "ICD-10-CM",
            }
            validated.append(entry)
            if suggestion:
                suggestions.append({
                    "field": f"diagnosis[{i}].icd10_code",
                    "current": code,
                    "suggested": suggestion,
                    "reason": f"Reference data maps '{condition}' to {suggestion}",
                })

    # Validate differential diagnoses
    for i, dd in enumerate(clinical_data.get("differential_diagnosis", [])):
        code = dd.get("icd10_code", "")
        total_count += 1
        if code in _icd10_codes:
            validated.append({
                "field": f"differential_diagnosis[{i}]",
                "code": code,
                "display": dd.get("condition", ""),
                "status": "valid",
                "source": "ICD-10-CM",
            })
            valid_count += 1

    # Validate drug names against reference
    # _drug_reference is {"BrandName": {"generic": "...", "category": "..."}}
    drug_brands_lower = {k.lower(): k for k in _drug_reference}
    drug_generics_lower = {v["generic"].lower(): k for k, v in _drug_reference.items()}

    for i, med in enumerate(clinical_data.get("medications", [])):
        name = med.get("name", "").lower()
        generic = med.get("generic_name", "").lower()
        total_count += 1

        matched = False
        # Check if brand name matches
        if name in drug_brands_lower:
            matched = True
        # Check if generic matches
        elif generic in drug_generics_lower:
            matched = True
        # Fuzzy: check if any brand is contained in the name or vice versa
        else:
            for brand_lower in drug_brands_lower:
                if brand_lower in name or name in brand_lower:
                    matched = True
                    break
            if not matched:
                for gen_lower in drug_generics_lower:
                    if gen_lower in generic or generic in gen_lower:
                        matched = True
                        break

        if matched:
            validated.append({
                "field": f"medications[{i}]",
                "code": med.get("name"),
                "display": f"{med.get('name')} ({med.get('generic_name')})",
                "status": "valid",
                "source": "Drug Reference (Indian Pharmacopeia)",
            })
            valid_count += 1
        else:
            validated.append({
                "field": f"medications[{i}]",
                "code": med.get("name"),
                "display": f"{med.get('name')} ({med.get('generic_name')})",
                "status": "unknown",
                "source": "Drug Reference",
            })

    # Calculate score boost (0-10 based on validation ratio)
    validation_ratio = valid_count / total_count if total_count > 0 else 0
    score_boost = round(validation_ratio * 10)

    return {
        "validated_codes": validated,
        "valid_count": valid_count,
        "total_count": total_count,
        "score_boost": score_boost,
        "validation_ratio": round(validation_ratio * 100),
        "suggestions": suggestions,
    }
