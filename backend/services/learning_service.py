"""
Continuous Learning Service — stores doctor corrections as few-shot examples.

When a doctor edits the AI-generated clinical note, we store the (transcript,
original_output, corrected_output) tuple. On future extractions, we retrieve
relevant corrections and inject them as few-shot examples into the prompt.

This is a lightweight "learning" approach that works without model fine-tuning:
- No model retraining needed
- Works with any API (Gemini, Claude, etc.)
- Corrections improve accuracy for similar future cases
- All data stays local (HIPAA-friendly pattern)
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Store corrections in a local JSON file
CORRECTIONS_DIR = Path(__file__).parent.parent / "data"
CORRECTIONS_FILE = CORRECTIONS_DIR / "corrections.json"
MAX_CORRECTIONS = 50  # Keep most recent corrections to avoid prompt bloat
MAX_FEW_SHOT_EXAMPLES = 3  # Max examples to include in each prompt


def _load_corrections() -> list[dict]:
    """Load stored corrections from disk."""
    if not CORRECTIONS_FILE.exists():
        return []
    try:
        with open(CORRECTIONS_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def _save_corrections(corrections: list[dict]) -> None:
    """Save corrections to disk."""
    CORRECTIONS_DIR.mkdir(parents=True, exist_ok=True)
    # Keep only the most recent corrections
    corrections = corrections[-MAX_CORRECTIONS:]
    with open(CORRECTIONS_FILE, "w") as f:
        json.dump(corrections, f, indent=2, default=str)


def store_correction(
    session_id: str,
    transcript: str,
    original_note: dict,
    corrected_note: dict,
    field_path: str,
) -> dict:
    """Store a doctor's correction for future learning.

    Args:
        session_id: The session where the correction was made
        transcript: The original transcript text
        original_note: The AI-generated clinical note
        corrected_note: The doctor-corrected clinical note
        field_path: Which field was corrected (e.g. "diagnosis[0].condition")

    Returns:
        The stored correction record
    """
    correction = {
        "id": session_id + "-" + datetime.now().strftime("%Y%m%d%H%M%S"),
        "timestamp": datetime.now().isoformat(),
        "transcript_excerpt": transcript[:500],  # Store excerpt, not full transcript
        "field_corrected": field_path,
        "original_value": _extract_field(original_note, field_path),
        "corrected_value": _extract_field(corrected_note, field_path),
        "category": _categorize_correction(field_path),
    }

    corrections = _load_corrections()
    corrections.append(correction)
    _save_corrections(corrections)

    logger.info(
        f"Stored correction for session {session_id}: {field_path} "
        f"'{correction['original_value']}' -> '{correction['corrected_value']}'"
    )
    return correction


def get_learning_examples(transcript: str) -> str:
    """Get relevant few-shot correction examples for a transcript.

    Returns a formatted string to append to the extraction prompt,
    showing the AI common corrections it should learn from.
    """
    corrections = _load_corrections()
    if not corrections:
        return ""

    # Select most recent and relevant corrections
    # In a production system, we'd use embedding similarity here
    recent = corrections[-MAX_FEW_SHOT_EXAMPLES:]

    examples_text = "\n\n## Learning from Past Corrections\n\n"
    examples_text += (
        "The following are corrections made by doctors to previous AI extractions. "
        "Learn from these to improve accuracy:\n\n"
    )

    for i, corr in enumerate(recent, 1):
        examples_text += (
            f"**Correction {i}** ({corr['category']}):\n"
            f"- Field: `{corr['field_corrected']}`\n"
            f"- AI originally said: \"{corr['original_value']}\"\n"
            f"- Doctor corrected to: \"{corr['corrected_value']}\"\n"
            f"- Context: \"{corr['transcript_excerpt'][:200]}...\"\n\n"
        )

    return examples_text


def get_correction_stats() -> dict:
    """Get statistics about stored corrections for the metrics dashboard."""
    corrections = _load_corrections()
    if not corrections:
        return {"total": 0, "categories": {}, "recent": []}

    categories = {}
    for c in corrections:
        cat = c.get("category", "other")
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "total": len(corrections),
        "categories": categories,
        "recent": corrections[-5:],  # Last 5 corrections
    }


def _extract_field(data: dict, field_path: str) -> str:
    """Extract a value from a nested dict using a dot/bracket path."""
    try:
        # Simple extraction - handles "field" and "field[0].subfield"
        parts = field_path.replace("[", ".").replace("]", "").split(".")
        current = data
        for part in parts:
            if part.isdigit():
                current = current[int(part)]
            else:
                current = current.get(part, "") if isinstance(current, dict) else ""
        return str(current) if current else ""
    except (KeyError, IndexError, TypeError, AttributeError):
        return ""


def _categorize_correction(field_path: str) -> str:
    """Categorize a correction by field type."""
    if "diagnosis" in field_path or "icd10" in field_path:
        return "diagnosis"
    elif "medication" in field_path or "drug" in field_path:
        return "medication"
    elif "symptom" in field_path:
        return "symptom"
    elif "vital" in field_path:
        return "vitals"
    elif "allergy" in field_path:
        return "allergy"
    else:
        return "other"
