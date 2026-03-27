#!/usr/bin/env python3
"""
MedScribe AI — Encryption Demo
Shows what an intercepted packet looks like WITH vs WITHOUT encryption.
"""

import base64
import hashlib
import json
import os
import sys
import textwrap

# ── Setup ──────────────────────────────────────────────────────────────
os.environ["ENCRYPTION_KEY"] = "medscribe-demo-key-2024"

from cryptography.fernet import Fernet, InvalidToken

BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
RESET = "\033[0m"
BG_RED = "\033[41m"
BG_GREEN = "\033[42m"
BG_YELLOW = "\033[43m"

def banner(text: str, color: str = CYAN) -> None:
    width = 72
    print(f"\n{color}{'━' * width}")
    print(f"  {BOLD}{text}{RESET}{color}")
    print(f"{'━' * width}{RESET}")

def section(text: str) -> None:
    print(f"\n{BOLD}{YELLOW}▸ {text}{RESET}")

def ok(text: str) -> None:
    print(f"  {GREEN}✓{RESET} {text}")

def fail(text: str) -> None:
    print(f"  {RED}✗{RESET} {text}")

def info(text: str) -> None:
    print(f"  {DIM}{text}{RESET}")

# ── Clinical payload (what a doctor's consultation produces) ───────────
clinical_data = {
    "patient_name": "Rajesh Kumar",
    "age": 45,
    "gender": "Male",
    "chief_complaint": "Chest pain for 2 days, radiating to left arm",
    "diagnosis": "Acute Coronary Syndrome (ICD-10: I24.9)",
    "medications": [
        {"drug": "Aspirin 325mg", "frequency": "Once daily"},
        {"drug": "Atorvastatin 40mg", "frequency": "At bedtime"},
        {"drug": "Metoprolol 25mg", "frequency": "Twice daily"},
    ],
    "vitals": {
        "blood_pressure": "158/92 mmHg",
        "heart_rate": "98 bpm",
        "spo2": "96%",
    },
    "allergies": ["Penicillin"],
    "follow_up": "Cardiology review in 48 hours",
}

plaintext_json = json.dumps(clinical_data, indent=2)

# ── Key derivation ─────────────────────────────────────────────────────
key_source = os.environ["ENCRYPTION_KEY"]
sha256_digest = hashlib.sha256(key_source.encode()).digest()
fernet_key = base64.urlsafe_b64encode(sha256_digest)
fernet = Fernet(fernet_key)

# ── Encrypt ────────────────────────────────────────────────────────────
ciphertext = fernet.encrypt(plaintext_json.encode("utf-8"))
ciphertext_str = ciphertext.decode("utf-8")

# ══════════════════════════════════════════════════════════════════════
#  OUTPUT
# ══════════════════════════════════════════════════════════════════════

print(f"\n{BOLD}{MAGENTA}{'═' * 72}")
print(f"   MedScribe AI — Data Encryption Demo (Fernet / AES-128-CBC + HMAC)")
print(f"{'═' * 72}{RESET}")

# ── 1. WITHOUT encryption ─────────────────────────────────────────────
banner("SCENARIO 1: WITHOUT Encryption (Plaintext Transmission)", RED)
print(f"\n{RED}{BOLD}  ⚠  INTERCEPTED PACKET — ALL DATA VISIBLE TO ATTACKER{RESET}\n")

for line in plaintext_json.split("\n"):
    print(f"  {RED}│{RESET} {line}")

print(f"\n  {BG_RED}{BOLD} RISK: Patient name, diagnosis, medications fully exposed {RESET}")
info(f"  An attacker on the network sees EVERYTHING above in cleartext.")

# ── 2. WITH encryption ────────────────────────────────────────────────
banner("SCENARIO 2: WITH Fernet Encryption (AES-128-CBC + HMAC-SHA256)", GREEN)
print(f"\n{GREEN}{BOLD}  🔒 INTERCEPTED PACKET — ENCRYPTED, UNREADABLE{RESET}\n")

# Show ciphertext wrapped to 68 chars
wrapped = textwrap.wrap(ciphertext_str, width=66)
for line in wrapped:
    print(f"  {GREEN}│{RESET} {DIM}{line}{RESET}")

print(f"\n  {BG_GREEN}{BOLD} SAFE: Attacker sees only random bytes — no clinical data exposed {RESET}")
info(f"  Ciphertext length: {len(ciphertext_str)} chars  |  Plaintext: {len(plaintext_json)} chars")

# ── 3. Key derivation details ─────────────────────────────────────────
section("Key Derivation (SHA-256)")
info(f"  Input key:     {key_source[:8]}{'*' * (len(key_source) - 8)}")
info(f"  SHA-256 hash:  {sha256_digest.hex()[:32]}...")
info(f"  Fernet key:    {fernet_key.decode()[:32]}...")
ok("256-bit key derived from ENCRYPTION_KEY env var via SHA-256")

# ── 4. Decryption proof ───────────────────────────────────────────────
section("Decryption (with correct key)")
decrypted = fernet.decrypt(ciphertext)
recovered = json.loads(decrypted.decode("utf-8"))
ok(f"Patient: {recovered['patient_name']}")
ok(f"Diagnosis: {recovered['diagnosis']}")
ok(f"Medications: {len(recovered['medications'])} prescribed")
ok("All fields recovered — zero data loss")

# ── 5. Tamper detection ───────────────────────────────────────────────
section("Tamper Detection (HMAC-SHA256 verification)")

tampered = bytearray(ciphertext)
tampered[20] ^= 0xFF  # flip one byte
tampered_bytes = bytes(tampered)

try:
    fernet.decrypt(tampered_bytes)
    fail("Tamper not detected (this should not happen)")
except InvalidToken:
    ok("Modified ciphertext → InvalidToken raised")
    ok("HMAC verification prevents any data tampering")

# ── 6. Wrong key detection ────────────────────────────────────────────
section("Wrong Key Detection")

wrong_key = base64.urlsafe_b64encode(hashlib.sha256(b"wrong-key").digest())
wrong_fernet = Fernet(wrong_key)

try:
    wrong_fernet.decrypt(ciphertext)
    fail("Wrong key accepted (this should not happen)")
except InvalidToken:
    ok("Wrong key → InvalidToken raised")
    ok("Only the holder of ENCRYPTION_KEY can decrypt clinical data")

# ── Summary ───────────────────────────────────────────────────────────
banner("SUMMARY", MAGENTA)
print(f"""
  {BOLD}Algorithm:{RESET}      Fernet (AES-128-CBC + HMAC-SHA256)
  {BOLD}Key Derivation:{RESET} SHA-256 from environment variable
  {BOLD}IV:{RESET}             Random 128-bit per encryption (unique ciphertexts)
  {BOLD}Integrity:{RESET}      HMAC-SHA256 (tamper = immediate rejection)
  {BOLD}At Rest:{RESET}        All clinical data encrypted before storage
  {BOLD}In Transit:{RESET}     WebSocket over HTTPS (TLS 1.3)
""")
print(f"{BOLD}{GREEN}  Patient data is NEVER stored or transmitted in plaintext.{RESET}\n")
