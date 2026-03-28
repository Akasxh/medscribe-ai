# MedScribe AI — Master Task List (HACKMATRIX 2.0)

**Last updated:** 2026-03-28
**Time remaining:** ~24 hours
**Strategy:** Polish PS-1 to hospital-ready, then add PS-2 (document upload) as bonus

---

## P0 — FHIR Compliance Fixes (Judges WILL check this)

These are blocking-level FHIR R4 violations that a technically literate judge will catch.

### T1: Fix broken cross-references in FHIR bundle
- **Files:** `backend/services/fhir_service.py`
- **Issue:** All internal refs use `Patient/{id}` but `fullUrl` uses `urn:uuid:{id}` — references don't resolve
- **Fix:** Change all cross-refs to `urn:uuid:{id}` format
- **Time:** 30min

### T2: Add Practitioner + Organization resources
- **Files:** `backend/services/fhir_service.py`, `backend/models/fhir_models.py`
- **Issue:** `MedicationRequest.requester`, `ServiceRequest.requester`, `Composition.author` are all required (1..1) but missing. No Practitioner/Organization in bundle
- **Fix:** Add `_build_practitioner()` and `_build_organization()`, wire doctor data from UserRegistration
- **Time:** 1.5h

### T3: Fix SpO2 LOINC + BP panel structure
- **Files:** `backend/services/fhir_service.py`
- **Issue:** SpO2 uses wrong code (`2708-6` → should be `59408-5`). BP uses `valueString` on panel code instead of `component` entries
- **Fix:** Correct SpO2 code, split BP into systolic/diastolic components
- **Time:** 45min

### T4: Add RxNorm coding to MedicationRequest
- **Files:** `backend/services/fhir_service.py`, `backend/data/drug_reference.json`
- **Issue:** `medicationCodeableConcept` has no `coding` array — RxNorm quality check always fails
- **Fix:** Add `rxnorm_cui` to drug_reference.json (top 30 drugs), populate `coding` in builder
- **Time:** 1h

### T5: Switch to ABDM FHIR profiles + fix ABHA URI
- **Files:** `backend/models/fhir_models.py`, `backend/services/fhir_service.py`
- **Issue:** Profile URLs point to base R4, not ABDM (`nrces.in`). ABHA system URI wrong. ICD-10-CM should be ICD-10 (WHO)
- **Fix:** Update profile URIs, fix ABHA system to `healthid.ndhm.gov.in`, change to WHO ICD-10
- **Time:** 30min

---

## P0 — Supabase Integration (Feedback requirement)

### T6: Create Supabase project + schema
- **Account:** jhmedvani2026@gmail.com, Mumbai (ap-south-1) region
- **Action:** Create project, run schema SQL (profiles, patients, consultations, clinical_notes, fhir_bundles, prescriptions, corrections)
- **Enable:** RLS policies, auth hook for role injection, realtime on consultations/clinical_notes/fhir_bundles
- **Time:** 1h

### T7: Backend Supabase service
- **Files:** `backend/services/supabase_service.py` (NEW), `backend/routers/transcribe.py`, `backend/requirements.txt`
- **Action:** `pip install supabase`, create service client, add `persist_session()` on session complete, migrate corrections from JSON file to Supabase
- **Time:** 2h

### T8: Frontend Supabase auth
- **Files:** `frontend/src/lib/supabase.js` (NEW), `frontend/src/hooks/useAuth.js` (NEW), `frontend/src/components/UserRegistration.jsx`
- **Action:** `npm install @supabase/supabase-js`, replace localStorage auth with Supabase email/password auth, add role field (doctor/admin)
- **Time:** 2h

---

## P0 — Admin Dashboard + Auth

### T9: Route-based role switching
- **Files:** `frontend/src/main.jsx`, `frontend/src/components/ProtectedRoute.jsx` (NEW)
- **Action:** `npm install react-router-dom`, add routes: `/login`, `/admin/*`, `/*` (doctor). ProtectedRoute checks auth + role
- **Time:** 1h

### T10: Admin dashboard page
- **Files:** `frontend/src/pages/AdminDashboard.jsx` (NEW), `frontend/src/components/admin/PatientList.jsx` (NEW), `frontend/src/components/admin/ConsultationDetail.jsx` (NEW), `frontend/src/components/admin/AnalyticsPanel.jsx` (NEW)
- **Action:** `npm install recharts`, build: KPI row (total consultations, avg safety score, FHIR grade A%, critical alert rate), patient list with search/sort/filter, consultation detail panel (reuse ClinicalNote/FHIRViewer/CDSAlerts), analytics charts (consultations/day, top diagnoses, language distribution)
- **Depends:** T8, T9
- **Time:** 4h

### T11: Persist CDS alerts + FHIR quality on Session model
- **Files:** `backend/models/schemas.py`, `backend/routers/transcribe.py`
- **Issue:** `cds_alerts` and `fhir_quality` sent over WS but never stored on Session — admin dashboard shows empty
- **Fix:** Add fields to Session model, set them alongside fhir_bundle
- **Time:** 30min

---

## P1 — LLM Citation + Evidence Grounding

### T12: Add citation fields to extraction schema
- **Files:** `backend/prompts/clinical_extraction.py`, `backend/models/schemas.py`
- **Action:** Add `evidence_basis`, `clinical_reasoning`, `citations[]` (source, section, relevance) to Diagnosis and DifferentialDiagnosis. Add prompt rules for citing ICMR STW, WHO, API, NHM guidelines
- **Time:** 1h

### T13: Citation UI in ClinicalNote
- **Files:** `frontend/src/components/ClinicalNote.jsx`
- **Action:** Add `CitationBadges` component — expandable citation cards below each diagnosis. Show evidence_basis, clinical_reasoning, source links. Add disclaimer "AI-generated citation — verify before clinical use"
- **Time:** 1.5h

### T14: Optional Gemini grounding enrichment (stretch)
- **Files:** `backend/services/gemini_service.py`, `backend/routers/transcribe.py`
- **Action:** Add `enrich_diagnoses_with_grounding()` using two-call architecture (grounding is incompatible with JSON mode). Fire concurrently with asyncio.gather. Non-blocking failure
- **Time:** 2h (stretch — skip if time-constrained)

---

## P1 — Indian Drug Database + Alternatives

### T15: Expand drug_reference.json
- **Files:** `backend/data/drug_reference.json`
- **Action:** Add 50 missing critical drugs (antihypertensives, antibiotics, antidiabetics, GI, pain, respiratory, vitamins, psych). Add `rxnorm_cui`, `alternatives[]` (brand, generic, manufacturer, price_inr), `form`, `schedule` fields
- **Time:** 2h

### T16: Drug alternatives popup in frontend
- **Files:** `frontend/src/components/DrugAlternatives.jsx` (NEW), `frontend/src/components/ClinicalNote.jsx`
- **Action:** Clickable medication names open a modal/drawer showing: generic name, RxNorm code, Indian alternatives with prices, Jan Aushadhi availability, manufacturer. Fetch from `/api/drugs/{name}/alternatives` endpoint
- **Time:** 2h

### T17: Drug alternatives API endpoint
- **Files:** `backend/routers/drugs.py` (NEW), `backend/main.py`
- **Action:** `GET /api/drugs/{name}/alternatives` — lookup in drug_reference.json, return alternatives sorted by price. Include generic name, brand options, schedule info
- **Time:** 1h

---

## P1 — Hospital-Ready Polish

### T18: Wire doctor identity to prescriptions
- **Files:** `backend/routers/transcribe.py` (prescription HTML page)
- **Issue:** `/rx/{session_id}` page shows no doctor name/registration number — legally invalid
- **Fix:** Pull doctor data from session, add to prescription header
- **Time:** 30min

### T19: Add DELETE session endpoint (DPDPA compliance)
- **Files:** `backend/routers/sessions.py`
- **Action:** `DELETE /api/sessions/{session_id}` — removes session data. Wire "Delete My Data" button in UI
- **Time:** 30min

### T20: Add FHIR AuditEvent resource
- **Files:** `backend/services/fhir_service.py`
- **Action:** Generate AuditEvent with agent (doctor), entity (patient), action (create), recorded timestamp. Adds to bundle, boosts quality score
- **Time:** 45min

---

## P2 — Tests

### T21: Backend critical path tests
- **Files:** `backend/tests/test_gemini_service.py` (NEW), `backend/tests/test_websocket.py` (NEW), `backend/tests/test_sessions.py` (NEW)
- **Action:** Mock Gemini API responses, test extraction pipeline. Test WebSocket session lifecycle, transcript dedup. Test REST CRUD + corrections
- **Time:** 3h

### T22: Frontend test setup + component tests
- **Files:** `frontend/vitest.config.js` (NEW), `frontend/src/components/__tests__/` (NEW)
- **Action:** `npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom`. Test RecordButton states, ClinicalNote editing, DemoMode playback
- **Time:** 2h

### T23: Existing backend tests — verify pass
- **Files:** `backend/tests/test_cds_service.py`, `backend/tests/test_fhir_service.py`, `backend/tests/test_encryption.py`
- **Action:** Run `pytest backend/tests/` — fix any failures from FHIR changes (T1-T5)
- **Depends:** T1-T5
- **Time:** 30min

---

## P2 — Multilingual Polish

### T24: Verify all 10 language STT actually works
- **Action:** Manual test each language in Chrome Web Speech API. Document which work, which fail
- **Time:** 30min

### T25: Add simple UI translation layer (stretch)
- **Files:** `frontend/src/locales/en.json` (NEW), `frontend/src/locales/hi.json` (NEW)
- **Action:** Cover ~50 key UI strings in Hindi. Simple context-based translation hook. No i18n library needed
- **Time:** 2h (stretch)

---

## P2 — PS-2: Document Upload (Bonus differentiator)

### T26: PDF/image upload → Gemini extraction → FHIR
- **Files:** `backend/routers/documents.py` (NEW), `backend/services/gemini_service.py`
- **Action:** `POST /api/documents/upload` — accept PDF/image, send to Gemini Vision for extraction, reuse same FHIR pipeline. New prompt for document extraction (discharge summary, lab report)
- **Time:** 3h

### T27: Document upload UI
- **Files:** `frontend/src/components/DocumentUpload.jsx` (NEW), `frontend/src/App.jsx`
- **Action:** Drag-and-drop or file picker, progress indicator, display extracted data in same ClinicalNote/FHIR views
- **Time:** 2h

---

## Priority Execution Order (24h plan)

| Block | Tasks | Time | Cumulative |
|-------|-------|------|------------|
| **Hour 1-3** | T1, T2, T3, T4, T5 (FHIR fixes) | 4h | 4h |
| **Hour 3-4** | T6 (Supabase project + schema) | 1h | 5h |
| **Hour 4-6** | T7, T8 (Supabase backend + frontend auth) | 4h | 9h |
| **Hour 6-7** | T9, T11 (routing + session model fix) | 1.5h | 10.5h |
| **Hour 7-11** | T10 (admin dashboard) | 4h | 14.5h |
| **Hour 11-12** | T12, T13 (citations schema + UI) | 2.5h | 17h |
| **Hour 12-14** | T15, T16, T17 (drug alternatives) | 5h | 22h* |
| **Hour 14-15** | T18, T19, T20 (hospital polish) | 1.75h | 23.75h |
| **Parallel** | T23 (verify tests) | 0.5h | — |

*Drug alternatives can be trimmed if behind schedule

**If ahead of schedule:** T21 (backend tests), T26+T27 (PS-2 document upload)
**If behind schedule:** Skip T14 (grounding), T25 (i18n), T26+T27 (PS-2)

---

## Done (Previous sessions)

- [x] App.jsx complete rewrite — hero/landing state, compact active session layout
- [x] LandingHero component — SaaS-quality landing page with CTA
- [x] ConsentBanner — patient consent recording
- [x] Encryption service — AES-256 at rest, security headers
- [x] Deployment config — Dockerfile, docker-compose, Railway, Render
- [x] CSS design system refinement — dark mode, backgrounds, mobile fixes
- [x] Mobile UI fixes — specialty pills, compact metrics, install prompt
- [x] Enhanced demo mode — telemedicine rural visit scenario
- [x] Remove dead Sarvam STT integration (~400 lines)
- [x] Fix 5 bugs from code review (parse failure, event loop, DemoMode closure, reconnect, button transition)
