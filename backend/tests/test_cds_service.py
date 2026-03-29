"""Tests for Clinical Decision Support service."""
from services.cds_service import check_clinical_alerts


class TestDrugInteractions:
    def test_no_self_interaction_aspirin(self):
        """Single aspirin should NOT trigger NSAID interaction."""
        data = {
            "medications": [{"name": "Ecosprin", "generic_name": "Aspirin", "dosage": "75mg"}],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        drug_alerts = [a for a in alerts if a["type"] == "drug_interaction"]
        assert len(drug_alerts) == 0, f"Aspirin alone should not trigger drug interaction: {drug_alerts}"

    def test_aspirin_nsaid_interaction(self):
        """Aspirin + NSAID should trigger interaction."""
        data = {
            "medications": [
                {"name": "Ecosprin", "generic_name": "Aspirin", "dosage": "75mg"},
                {"name": "Combiflam", "generic_name": "Ibuprofen + Paracetamol", "dosage": "400mg"},
            ],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        nsaid_alerts = [a for a in alerts if "NSAID" in a.get("title", "")]
        assert len(nsaid_alerts) >= 1, "Aspirin + NSAID should fire interaction alert"

    def test_warfarin_nsaid_critical(self):
        """Warfarin + NSAID should fire CRITICAL alert."""
        data = {
            "medications": [
                {"name": "Acitrom", "generic_name": "Acenocoumarol", "dosage": "2mg"},
                {"name": "Combiflam", "generic_name": "Ibuprofen", "dosage": "400mg"},
            ],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        critical = [a for a in alerts if a.get("severity") == "critical" and "bleeding" in a.get("title", "").lower()]
        assert len(critical) >= 1, "Warfarin + NSAID should fire critical alert"

    def test_no_alerts_safe_prescription(self):
        """Safe prescription should not trigger drug interaction alerts."""
        data = {
            "medications": [
                {"name": "Dolo 650", "generic_name": "Paracetamol", "dosage": "650mg"},
                {"name": "Azithral", "generic_name": "Azithromycin", "dosage": "500mg"},
            ],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        drug_alerts = [a for a in alerts if a["type"] == "drug_interaction"]
        assert len(drug_alerts) == 0, f"Safe prescription should not trigger alerts: {drug_alerts}"

    def test_ssri_nsaid_interaction(self):
        """Escitalopram (SSRI) + Ibuprofen (NSAID) should fire GI bleeding warning."""
        data = {
            "medications": [
                {"name": "Nexito", "generic_name": "Escitalopram", "dosage": "10mg"},
                {"name": "Combiflam", "generic_name": "Ibuprofen", "dosage": "400mg"},
            ],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        gi_alerts = [
            a for a in alerts
            if a["type"] == "drug_interaction"
            and a.get("severity") == "warning"
            and "GI bleeding" in a.get("title", "")
        ]
        assert len(gi_alerts) >= 1, f"SSRI + NSAID should fire GI bleeding warning: {alerts}"

    def test_ace_arb_dual_blockade(self):
        """Enalapril (ACE-I) + Losartan (ARB) should fire critical dual RAAS blockade alert."""
        data = {
            "medications": [
                {"name": "Enam", "generic_name": "Enalapril", "dosage": "5mg"},
                {"name": "Losar", "generic_name": "Losartan", "dosage": "50mg"},
            ],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        raas_alerts = [
            a for a in alerts
            if a["type"] == "drug_interaction"
            and a.get("severity") == "critical"
            and ("RAAS" in a.get("title", "") or "hyperkalemia" in a.get("title", "").lower())
        ]
        assert len(raas_alerts) >= 1, f"ACE-I + ARB should fire critical RAAS/hyperkalemia alert: {alerts}"

    def test_metformin_contrast_interaction(self):
        """Metformin + contrast dye should fire an alert mentioning contrast or withhold."""
        data = {
            "medications": [
                {"name": "Glycomet", "generic_name": "Metformin", "dosage": "500mg"},
                {"name": "contrast dye", "generic_name": "contrast dye", "dosage": ""},
            ],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        contrast_alerts = [
            a for a in alerts
            if a["type"] == "drug_interaction"
            and ("contrast" in a.get("title", "").lower() or "withhold" in a.get("description", "").lower())
        ]
        assert len(contrast_alerts) >= 1, f"Metformin + contrast dye should fire alert: {alerts}"

    def test_no_false_positive_single_drug(self):
        """Single Paracetamol should produce zero interaction alerts (no self-interaction)."""
        data = {
            "medications": [
                {"name": "Crocin", "generic_name": "Paracetamol", "dosage": "500mg"},
            ],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        drug_alerts = [a for a in alerts if a["type"] == "drug_interaction"]
        assert len(drug_alerts) == 0, f"Single drug should not trigger interaction alerts: {drug_alerts}"


class TestAllergyRules:
    def test_penicillin_allergy_amoxicillin(self):
        """Penicillin allergy + Amoxicillin should fire alert."""
        data = {
            "medications": [{"name": "Augmentin", "generic_name": "Amoxicillin + Clavulanic Acid", "dosage": "625mg"}],
            "allergies": ["Penicillin"],
        }
        alerts = check_clinical_alerts(data)
        allergy_alerts = [a for a in alerts if a["type"] == "allergy_contraindication"]
        assert len(allergy_alerts) >= 1, "Penicillin allergy should flag Amoxicillin"

    def test_penicillin_cephalosporin_cross_reactivity(self):
        """Penicillin allergy + Cephalosporin should fire cross-reactivity alert."""
        data = {
            "medications": [{"name": "Zifi", "generic_name": "Cefixime", "dosage": "200mg"}],
            "allergies": ["Penicillin"],
        }
        alerts = check_clinical_alerts(data)
        ceph_alerts = [a for a in alerts if "ephalosporin" in a.get("title", "")]
        assert len(ceph_alerts) >= 1, "Penicillin allergy should flag Cephalosporin cross-reactivity"

    def test_no_allergy_no_alert(self):
        """No allergies should produce no allergy alerts."""
        data = {
            "medications": [{"name": "Zifi", "generic_name": "Cefixime", "dosage": "200mg"}],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        allergy_alerts = [a for a in alerts if a["type"] == "allergy_contraindication"]
        assert len(allergy_alerts) == 0


class TestDosageAlerts:
    def test_high_dose_paracetamol(self):
        """Very high paracetamol dose should trigger alert."""
        data = {
            "medications": [{"name": "Dolo", "generic_name": "Paracetamol", "dosage": "2000mg"}],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        dose_alerts = [a for a in alerts if a["type"] == "dosage_alert"]
        assert len(dose_alerts) >= 1, "2000mg paracetamol should trigger dosage alert"

    def test_normal_dose_no_alert(self):
        """Normal paracetamol dose should not trigger alert."""
        data = {
            "medications": [{"name": "Dolo 650", "generic_name": "Paracetamol", "dosage": "650mg"}],
            "allergies": [],
        }
        alerts = check_clinical_alerts(data)
        dose_alerts = [a for a in alerts if a["type"] == "dosage_alert"]
        assert len(dose_alerts) == 0, f"Normal dose should not trigger alert: {dose_alerts}"
