"""
Clinical Decision Support (CDS) Service.

Checks for drug-drug interactions, drug-allergy contraindications,
and dosage alerts based on extracted clinical data. Returns a list of
severity-rated alerts intended for real-time display alongside the
clinical note.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------

class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class AlertType(str, Enum):
    DRUG_INTERACTION = "drug_interaction"
    ALLERGY_CONTRAINDICATION = "allergy_contraindication"
    DOSAGE_ALERT = "dosage_alert"


@dataclass(frozen=True)
class DrugInteraction:
    """A known interaction between two drug groups."""
    drug_a: frozenset[str]
    drug_b: frozenset[str]
    severity: AlertSeverity
    title: str
    description: str


@dataclass(frozen=True)
class AllergyRule:
    """A cross-reactivity rule mapping an allergy to contraindicated drugs."""
    allergy_keywords: frozenset[str]
    contraindicated_drugs: frozenset[str]
    severity: AlertSeverity
    title: str
    description: str


# ---------------------------------------------------------------------------
# Built-in interaction database
# ---------------------------------------------------------------------------

# Each set contains lowered generic names, brand names, and drug-class
# keywords so that matching works regardless of how the prescriber wrote it.

DRUG_INTERACTIONS: list[DrugInteraction] = [
    DrugInteraction(
        drug_a=frozenset({"aspirin", "ecosprin", "acetylsalicylic acid"}),
        drug_b=frozenset({"ibuprofen", "combiflam", "diclofenac", "naproxen",
                          "nsaid", "nsaids", "aceclofenac", "piroxicam",
                          "ketorolac", "nimesulide"}),
        severity=AlertSeverity.WARNING,
        title="Aspirin + NSAID: Increased bleeding risk",
        description=(
            "Concurrent use of Aspirin (Ecosprin) with NSAIDs such as "
            "Ibuprofen/Combiflam increases the risk of gastrointestinal "
            "bleeding and reduces the cardioprotective effect of Aspirin."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"warfarin", "acenocoumarol", "acitrom"}),
        drug_b=frozenset({"aspirin", "ecosprin", "acetylsalicylic acid"}),
        severity=AlertSeverity.CRITICAL,
        title="Warfarin + Aspirin: Serious bleeding risk",
        description=(
            "Combining Warfarin with Aspirin significantly increases the "
            "risk of major haemorrhage. Use only under close INR monitoring "
            "and specialist supervision."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"metformin", "glycomet", "glucophage"}),
        drug_b=frozenset({"alcohol", "ethanol"}),
        severity=AlertSeverity.CRITICAL,
        title="Metformin + Alcohol: Lactic acidosis risk",
        description=(
            "Alcohol consumption while taking Metformin (Glycomet) increases "
            "the risk of lactic acidosis, a rare but life-threatening "
            "condition. Advise the patient to avoid alcohol."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"enalapril", "ramipril", "lisinopril", "perindopril",
                          "ace inhibitor", "ace inhibitors"}),
        drug_b=frozenset({"potassium", "potassium chloride", "potassium supplement",
                          "potassium supplements", "k+", "kcl"}),
        severity=AlertSeverity.CRITICAL,
        title="ACE Inhibitor + Potassium: Hyperkalemia risk",
        description=(
            "ACE inhibitors reduce renal potassium excretion. Adding "
            "potassium supplements can cause dangerous hyperkalemia leading "
            "to cardiac arrhythmias. Monitor serum potassium closely."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"cefixime", "zifi", "cephalosporin"}),
        drug_b=frozenset({"warfarin", "acenocoumarol", "acitrom",
                          "heparin", "enoxaparin", "blood thinner",
                          "blood thinners", "anticoagulant"}),
        severity=AlertSeverity.WARNING,
        title="Cefixime + Blood thinners: Enhanced anticoagulation",
        description=(
            "Cefixime (Zifi) and other cephalosporins can potentiate the "
            "anticoagulant effect of Warfarin and similar agents by "
            "disrupting vitamin-K-producing gut flora. Monitor INR."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"azithromycin", "azithral", "zithromax"}),
        drug_b=frozenset({"antacid", "antacids", "aluminium hydroxide",
                          "magnesium hydroxide", "gelusil", "digene",
                          "mucaine"}),
        severity=AlertSeverity.INFO,
        title="Azithromycin + Antacids: Reduced absorption",
        description=(
            "Antacids containing aluminium or magnesium can reduce the "
            "absorption of Azithromycin (Azithral) by up to 24%. "
            "Administer Azithromycin at least 1 hour before or 2 hours "
            "after antacids."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"telmisartan", "telma", "telvas"}),
        drug_b=frozenset({"potassium", "potassium chloride", "potassium supplement",
                          "potassium supplements", "k+", "kcl"}),
        severity=AlertSeverity.CRITICAL,
        title="Telmisartan + Potassium: Hyperkalemia risk",
        description=(
            "Telmisartan (Telma), an ARB, reduces aldosterone-mediated "
            "potassium excretion. Concurrent potassium supplementation "
            "may cause life-threatening hyperkalemia."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"montelukast", "montair", "singulair"}),
        drug_b=frozenset({"theophylline", "deriphyllin", "etofylline",
                          "aminophylline"}),
        severity=AlertSeverity.WARNING,
        title="Montelukast + Theophylline: Increased theophylline levels",
        description=(
            "Montelukast (Montair) can inhibit theophylline metabolism, "
            "raising plasma theophylline levels and increasing the risk "
            "of toxicity (nausea, tremor, seizures). Monitor theophylline "
            "levels."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"pantoprazole", "pan-d", "pan d", "pantop",
                          "pantocid"}),
        drug_b=frozenset({"clopidogrel", "clopilet", "plavix"}),
        severity=AlertSeverity.WARNING,
        title="Pantoprazole + Clopidogrel: Reduced antiplatelet efficacy",
        description=(
            "Pantoprazole (Pan-D) can reduce the conversion of Clopidogrel "
            "to its active metabolite via CYP2C19 inhibition, diminishing "
            "its antiplatelet effect. Consider using a non-interacting PPI "
            "or an H2-blocker."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"metformin", "glycomet", "glucophage"}),
        drug_b=frozenset({"contrast dye", "iodinated contrast",
                          "contrast media", "contrast agent",
                          "iv contrast"}),
        severity=AlertSeverity.CRITICAL,
        title="Metformin + Contrast dye: Lactic acidosis risk",
        description=(
            "Iodinated contrast media can cause acute kidney injury, which "
            "impairs metformin clearance and may precipitate fatal lactic "
            "acidosis. Withhold Metformin 48 hours before and after "
            "contrast administration; recheck renal function before restarting."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"metformin", "glycomet", "glucophage"}),
        drug_b=frozenset({"enalapril", "ramipril", "lisinopril", "perindopril",
                          "ace inhibitor", "ace inhibitors"}),
        severity=AlertSeverity.INFO,
        title="Metformin + ACE Inhibitor: Monitor renal function",
        description=(
            "ACE inhibitors may decrease renal function in some patients. "
            "Since Metformin is renally cleared, impaired kidney function "
            "raises the risk of lactic acidosis. Monitor creatinine and eGFR "
            "regularly in patients on this combination."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"atorvastatin", "rosuvastatin", "simvastatin",
                          "statin", "statins", "lipitor", "crestor"}),
        drug_b=frozenset({"fenofibrate", "gemfibrozil", "fibrate", "fibrates",
                          "lopid"}),
        severity=AlertSeverity.WARNING,
        title="Statin + Fibrate: Rhabdomyolysis risk",
        description=(
            "Combining Statins with Fibrates (especially Gemfibrozil) "
            "significantly increases the risk of myopathy and rhabdomyolysis. "
            "If combination is necessary, prefer Fenofibrate over Gemfibrozil "
            "and use the lowest effective statin dose. Monitor CK levels."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"warfarin", "acenocoumarol", "acitrom"}),
        drug_b=frozenset({"ibuprofen", "combiflam", "diclofenac", "naproxen",
                          "nsaid", "nsaids", "aceclofenac", "piroxicam",
                          "ketorolac", "nimesulide"}),
        severity=AlertSeverity.CRITICAL,
        title="Warfarin + NSAID: Major bleeding risk",
        description=(
            "NSAIDs inhibit platelet function and damage the gastric mucosa. "
            "Combined with Warfarin's anticoagulant effect, the risk of "
            "gastrointestinal and other major bleeding is greatly increased. "
            "Avoid this combination; use Paracetamol for pain relief instead."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"ciprofloxacin", "cipro", "ciplox", "levofloxacin",
                          "levaquin", "fluoroquinolone"}),
        drug_b=frozenset({"theophylline", "deriphyllin", "aminophylline",
                          "etofylline"}),
        severity=AlertSeverity.WARNING,
        title="Fluoroquinolone + Theophylline: Toxicity risk",
        description=(
            "Ciprofloxacin and other fluoroquinolones inhibit CYP1A2, the "
            "primary enzyme metabolizing Theophylline. This can lead to "
            "dangerously elevated Theophylline levels causing seizures, "
            "arrhythmias, and nausea. Monitor levels or choose an alternative."
        ),
    ),
    DrugInteraction(
        drug_a=frozenset({"amlodipine", "amlopin", "stamlo", "calcium channel blocker"}),
        drug_b=frozenset({"simvastatin", "statin", "statins"}),
        severity=AlertSeverity.WARNING,
        title="Amlodipine + Simvastatin: Increased statin exposure",
        description=(
            "Amlodipine inhibits CYP3A4 and increases Simvastatin plasma "
            "levels, raising the risk of myopathy. Simvastatin dose should "
            "not exceed 20mg/day when used with Amlodipine. Consider "
            "switching to Atorvastatin or Rosuvastatin."
        ),
    ),
]


ALLERGY_RULES: list[AllergyRule] = [
    AllergyRule(
        allergy_keywords=frozenset({"penicillin", "amoxicillin", "ampicillin"}),
        contraindicated_drugs=frozenset({"amoxicillin", "augmentin",
                                         "amoxicillin + clavulanic acid",
                                         "ampicillin", "piperacillin",
                                         "piperacillin + tazobactam"}),
        severity=AlertSeverity.CRITICAL,
        title="Penicillin allergy: Cross-reactivity with Amoxicillin/Augmentin",
        description=(
            "The patient has a documented penicillin allergy. Amoxicillin "
            "and Augmentin (Amoxicillin + Clavulanic Acid) share the "
            "beta-lactam ring and carry a high cross-reactivity risk. "
            "Consider a macrolide or fluoroquinolone alternative."
        ),
    ),
    AllergyRule(
        allergy_keywords=frozenset({"nsaid", "nsaids", "ibuprofen", "diclofenac",
                                     "aspirin"}),
        contraindicated_drugs=frozenset({"aspirin", "ecosprin", "ibuprofen",
                                          "combiflam", "diclofenac", "naproxen",
                                          "ketorolac", "piroxicam",
                                          "nimesulide", "aceclofenac"}),
        severity=AlertSeverity.CRITICAL,
        title="NSAID allergy: Cross-reactivity with Aspirin / other NSAIDs",
        description=(
            "The patient reports an NSAID allergy. Aspirin and other "
            "NSAIDs share the COX-inhibition pathway and can trigger "
            "cross-reactive bronchospasm, urticaria, or anaphylaxis. "
            "Use Paracetamol (COX-3 selective) as a safer analgesic."
        ),
    ),
    AllergyRule(
        allergy_keywords=frozenset({"sulfa", "sulfonamide", "sulfamethoxazole",
                                     "cotrimoxazole", "septran"}),
        contraindicated_drugs=frozenset({"sulfamethoxazole", "cotrimoxazole",
                                          "septran", "bactrim", "dapsone",
                                          "sulfasalazine", "silver sulfadiazine",
                                          "furosemide", "hydrochlorothiazide",
                                          "thiazide", "celecoxib"}),
        severity=AlertSeverity.WARNING,
        title="Sulfa allergy: Potential cross-reactivity",
        description=(
            "The patient has a sulfonamide allergy. Certain medications "
            "containing a sulfonamide moiety (e.g., Cotrimoxazole, some "
            "diuretics, Celecoxib) may trigger a cross-reaction. Assess "
            "risk–benefit and monitor closely if any sulfa-containing "
            "drug is essential."
        ),
    ),
]


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _normalise(text: str) -> str:
    """Lower-case and strip a string for comparison."""
    return (text or "").strip().lower()


def _medication_tokens(medication: dict) -> set[str]:
    """Return a set of normalised tokens representing a single medication.

    Extracts from both the ``name`` (brand) and ``generic_name`` fields so
    that either representation can match the interaction database.
    """
    tokens: set[str] = set()
    for key in ("name", "generic_name"):
        value: Optional[str] = medication.get(key)
        if not value:
            continue
        normalised = _normalise(value)
        tokens.add(normalised)
        # Also add individual words so that "amoxicillin + clavulanic acid"
        # can match "amoxicillin" in an allergy rule.
        for word in normalised.replace("+", " ").split():
            tokens.add(word)
    return tokens


def _all_medication_tokens(medications: list[dict]) -> set[str]:
    """Aggregate tokens across all medications in the prescription."""
    tokens: set[str] = set()
    for med in medications:
        tokens |= _medication_tokens(med)
    return tokens


def _medication_display_name(medication: dict) -> str:
    """Human-readable label for a medication dict."""
    brand = medication.get("name") or ""
    generic = medication.get("generic_name") or ""
    if brand and generic and _normalise(brand) != _normalise(generic):
        return f"{brand} ({generic})"
    return brand or generic or "Unknown"


def _matches(tokens: set[str], reference: frozenset[str]) -> bool:
    """Return True if any token matches any reference keyword."""
    return bool(tokens & reference)


# ---------------------------------------------------------------------------
# Core alert checks
# ---------------------------------------------------------------------------

def _check_drug_interactions(medications: list[dict]) -> list[dict]:
    """Check all pairs of prescribed medications against the interaction DB."""
    alerts: list[dict] = []

    if len(medications) < 2:
        return alerts

    # Build per-medication token sets once
    med_token_sets: list[tuple[dict, set[str]]] = [
        (med, _medication_tokens(med)) for med in medications
    ]

    for interaction in DRUG_INTERACTIONS:
        involved_a: list[dict] = []
        involved_b: list[dict] = []

        for med, tokens in med_token_sets:
            if _matches(tokens, interaction.drug_a):
                involved_a.append(med)
            if _matches(tokens, interaction.drug_b):
                involved_b.append(med)

        if involved_a and involved_b:
            # Collect unique medications involved (a med could be in both sets
            # if the interaction is reflexive — deduplicate by name).
            seen_names: set[str] = set()
            meds_involved: list[str] = []
            for med in involved_a + involved_b:
                display = _medication_display_name(med)
                if display not in seen_names:
                    seen_names.add(display)
                    meds_involved.append(display)

            alerts.append({
                "id": str(uuid.uuid4()),
                "severity": interaction.severity.value,
                "type": AlertType.DRUG_INTERACTION.value,
                "title": interaction.title,
                "description": interaction.description,
                "medications_involved": meds_involved,
            })

    return alerts


def _check_allergy_contraindications(
    medications: list[dict],
    allergies: list[str],
) -> list[dict]:
    """Check prescribed medications against patient allergies."""
    alerts: list[dict] = []

    if not allergies or not medications:
        return alerts

    allergy_tokens: set[str] = set()
    for allergy in allergies:
        if not allergy:
            continue
        normalised = _normalise(allergy)
        allergy_tokens.add(normalised)
        for word in normalised.replace("+", " ").split():
            allergy_tokens.add(word)

    for rule in ALLERGY_RULES:
        if not _matches(allergy_tokens, rule.allergy_keywords):
            continue

        # Patient has this allergy — check if any prescribed med is
        # contraindicated.
        flagged_meds: list[str] = []
        for med in medications:
            med_tokens = _medication_tokens(med)
            if _matches(med_tokens, rule.contraindicated_drugs):
                flagged_meds.append(_medication_display_name(med))

        if flagged_meds:
            alerts.append({
                "id": str(uuid.uuid4()),
                "severity": rule.severity.value,
                "type": AlertType.ALLERGY_CONTRAINDICATION.value,
                "title": rule.title,
                "description": rule.description,
                "medications_involved": flagged_meds,
            })

    return alerts


def _check_dosage_alerts(medications: list[dict]) -> list[dict]:
    """Basic dosage-range sanity checks for commonly prescribed drugs.

    This is intentionally conservative — it flags only clearly out-of-range
    values that are very likely to be transcription or data-entry errors.
    """
    alerts: list[dict] = []

    # Map of generic name → (max single dose mg, max daily doses, unit label)
    MAX_SINGLE_DOSE: dict[str, tuple[float, str]] = {
        "paracetamol": (1000.0, "mg"),
        "ibuprofen": (800.0, "mg"),
        "metformin": (1000.0, "mg"),
        "azithromycin": (500.0, "mg"),
        "amoxicillin": (1000.0, "mg"),
        "cefixime": (400.0, "mg"),
        "pantoprazole": (80.0, "mg"),
        "telmisartan": (80.0, "mg"),
        "aspirin": (650.0, "mg"),
        "montelukast": (10.0, "mg"),
    }

    for med in medications:
        generic = _normalise(med.get("generic_name") or "")
        dosage_str = _normalise(med.get("dosage") or "")

        if not dosage_str or not generic:
            continue

        # Try to find a matching entry in our limits table. Handle
        # combination drugs (e.g. "ibuprofen + paracetamol") by checking
        # each component.
        for drug_name, (max_dose, unit) in MAX_SINGLE_DOSE.items():
            if drug_name not in generic:
                continue

            # Extract numeric value from dosage string
            numeric_part = ""
            for ch in dosage_str:
                if ch.isdigit() or ch == ".":
                    numeric_part += ch
                elif numeric_part:
                    break

            if not numeric_part:
                continue

            try:
                dose_value = float(numeric_part)
            except ValueError:
                continue

            if dose_value > max_dose:
                alerts.append({
                    "id": str(uuid.uuid4()),
                    "severity": AlertSeverity.WARNING.value,
                    "type": AlertType.DOSAGE_ALERT.value,
                    "title": (
                        f"High dose: {_medication_display_name(med)} "
                        f"{dosage_str}"
                    ),
                    "description": (
                        f"The prescribed dose of {drug_name.title()} "
                        f"({dose_value}{unit}) exceeds the typical maximum "
                        f"single dose of {max_dose}{unit}. Please verify "
                        f"the intended dosage."
                    ),
                    "medications_involved": [_medication_display_name(med)],
                })

    return alerts


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check_clinical_alerts(clinical_data: dict) -> list[dict]:
    """Run all CDS checks against extracted clinical data.

    Parameters
    ----------
    clinical_data:
        A dict matching the Gemini/Claude clinical extraction schema.
        Expected keys used by this function:
        - ``medications``: list of dicts with ``name``, ``generic_name``,
          ``dosage``, ``frequency``, ``duration``, ``route``.
        - ``allergies``: list of allergy description strings.

    Returns
    -------
    list[dict]
        Each dict contains:
        - ``id`` (str): Unique alert identifier.
        - ``severity`` (str): One of ``"critical"``, ``"warning"``, ``"info"``.
        - ``type`` (str): One of ``"drug_interaction"``,
          ``"allergy_contraindication"``, ``"dosage_alert"``.
        - ``title`` (str): Short human-readable alert heading.
        - ``description`` (str): Detailed explanation with clinical context.
        - ``medications_involved`` (list[str]): Display names of flagged meds.
    """
    if not clinical_data:
        return []

    medications: list[dict] = clinical_data.get("medications") or []
    allergies: list[str] = clinical_data.get("allergies") or []

    alerts: list[dict] = []
    alerts.extend(_check_drug_interactions(medications))
    alerts.extend(_check_allergy_contraindications(medications, allergies))
    alerts.extend(_check_dosage_alerts(medications))

    # Sort: critical first, then warning, then info
    severity_order = {
        AlertSeverity.CRITICAL.value: 0,
        AlertSeverity.WARNING.value: 1,
        AlertSeverity.INFO.value: 2,
    }
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 99))

    if alerts:
        logger.info(
            "CDS generated %d alert(s): %s",
            len(alerts),
            ", ".join(a["severity"] for a in alerts),
        )

    return alerts
