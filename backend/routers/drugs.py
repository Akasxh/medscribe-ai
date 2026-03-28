import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drugs", tags=["drugs"])

_DRUG_DATA: dict[str, dict] = {}


def _load_drug_data() -> dict[str, dict]:
    """Load drug reference data from JSON file (cached after first call)."""
    global _DRUG_DATA
    if _DRUG_DATA:
        return _DRUG_DATA
    path = Path(__file__).resolve().parent.parent / "data" / "drug_reference.json"
    try:
        with open(path, encoding="utf-8") as f:
            _DRUG_DATA = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error("Failed to load drug_reference.json: %s", e)
        _DRUG_DATA = {}
    return _DRUG_DATA


def _find_drug(name: str) -> Optional[tuple[str, dict]]:
    """Find a drug by brand or generic name (case-insensitive).

    Returns (matched_brand_name, drug_entry) or None.
    """
    data = _load_drug_data()
    name_lower = name.lower()

    # Exact brand match (case-insensitive)
    for brand, entry in data.items():
        if brand.lower() == name_lower:
            return brand, entry

    # Generic name match (case-insensitive)
    for brand, entry in data.items():
        generic = entry.get("generic", "")
        if generic.lower() == name_lower:
            return brand, entry

    # Partial match on brand or generic
    for brand, entry in data.items():
        generic = entry.get("generic", "")
        if name_lower in brand.lower() or name_lower in generic.lower():
            return brand, entry

    return None


@router.get("")
async def list_drugs():
    """List all drugs in the reference database (for autocomplete)."""
    data = _load_drug_data()
    drugs = []
    for brand, entry in data.items():
        drugs.append({
            "brand": brand,
            "generic": entry.get("generic", ""),
            "category": entry.get("category", ""),
            "rxnorm_cui": entry.get("rxnorm_cui"),
        })
    return {"count": len(drugs), "drugs": drugs}


@router.get("/{name}/alternatives")
async def get_drug_alternatives(name: str):
    """Lookup a drug by brand or generic name and return alternatives."""
    result = _find_drug(name)
    if not result:
        raise HTTPException(status_code=404, detail=f"Drug '{name}' not found")

    brand, entry = result
    data = _load_drug_data()

    # Collect alternative entries from the reference
    alt_names = entry.get("alternatives", [])
    alternatives = []
    for alt_name in alt_names:
        alt_result = _find_drug(alt_name)
        if alt_result:
            alt_brand, alt_entry = alt_result
            alternatives.append({
                "brand": alt_brand,
                "generic": alt_entry.get("generic", ""),
                "category": alt_entry.get("category", ""),
                "dosage": alt_entry.get("dosage", ""),
                "rxnorm_cui": alt_entry.get("rxnorm_cui"),
            })

    return {
        "brand": brand,
        "generic": entry.get("generic", ""),
        "category": entry.get("category", ""),
        "dosage": entry.get("dosage", ""),
        "use": entry.get("use", ""),
        "rxnorm_cui": entry.get("rxnorm_cui"),
        "alternatives": alternatives,
    }
