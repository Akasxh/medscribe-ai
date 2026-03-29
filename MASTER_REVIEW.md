# MedScribe AI — 50-Agent Deep Review Report
## Generated: 2026-03-29

---

## CRITICAL BUGS (Must Fix for Demo)

### 1. ABHA ID never sent to backend
- `App.jsx` never calls `ws.sendAbhaId(abhaId)` — ABHA feature is completely dead
- Format mismatch: frontend sends raw 14 digits, backend expects XX-XXXX-XXXX-XXXX
- Fix: add useEffect to send abhaId on change + fix backend regex

### 2. Demo replay silently drops all transcript
- `seenFinalsRef` not cleared on demo replay — second run sends zero text
- Fix: clear seenFinalsRef at demo start

### 3. ConsentBanner claims "AES-256 at rest" — FALSE
- Encryption service exists but is NEVER called in production
- All Supabase writes and corrections.json are plaintext
- Fix: change text to "TLS in transit" until encryption is wired

### 4. `diabetology` specialty silently downgrades to `general`
- `diabetology` not in VALID_SPECIALTIES — HbA1c/complication fields never extracted
- Fix: add "diabetology" to VALID_SPECIALTIES

### 5. Sarvam STT errors completely silent to user
- No toast, no error state when transcription fails
- Doctor records in silence thinking everything works
- Fix: surface errors via toast

### 6. Success toast fires on Gemini FAILURE
- `processing:completed` triggers "Clinical note generated successfully" even when extraction returned None
- Fix: add success flag to distinguish completion from error

### 7. CDS crash shows green "All Clear" shield
- CDS failure sets cds_alerts=[] → green shield, contradicting the error message
- Fix: differentiate empty-result from error-state in CDSAlerts component

---

## HIGH PRIORITY ISSUES

### Data Persistence
- `completed_at` never written to Supabase
- `abha_id` never persisted despite schema column existing
- Prescription delete+insert non-atomic (data loss on crash between)
- Retry only covers consultations table, not clinical_notes/fhir_bundles/prescriptions
- Corrections stored in local file only — lost on every Railway deploy

### Frontend
- `sendTranscript` silently drops messages when WS is CONNECTING (no queue)
- 2s stop delay is fixed, not adaptive to Sarvam latency
- Sarvam fetch has no AbortController timeout — can hang indefinitely
- Mic disconnect mid-recording: UI stays in "recording" state forever
- No getUserMedia audio constraints (16kHz, mono, noise suppression)
- `recentFinalsRef` in useAudioRecorder is dead code

### Admin Dashboard
- Safety score coefficients diverge: KPICards uses -25/-10, useSafetyScore uses -30/-15
- FHIR Grade A% penalizes sessions without FHIR bundles in denominator
- Active Doctors counts "Unknown" as 1 doctor when name is missing
- PatientList has duplicate status filter (FilterBar + internal)
- AnalyticsPanel date sort uses fragile locale string parsing
- No "Back to list" button in admin detail view on mobile

### Medical Data
- Warfarin/Acenocoumarol completely missing from drug_reference.json (despite CDS rules)
- Zero insulin coverage — major gap for diabetic patients
- Missing corticosteroids (prednisolone, dexamethasone)
- Ranitidine in fhir_service.py DRUG_RXNORM — drug withdrawn globally in 2020
- 5 combo drug RxNorm CUIs wrong (Flexon, Benadryl, Grilinctus, Norflox TZ, Montair LC)
- Meftal Spas NSAID interaction missed — multi-word token "mefenamic acid" fragmented
- Cough duration nudge regex bug — fires on ALL cough cases, not just missing duration
- 4 specialties have no prompt addendum (pulmonology, gastro, neuro, derma)

### FHIR R4
- ICD-10-CM system URI used instead of ICD-10 WHO (ABDM expects WHO)
- Bundle missing `identifier` (required for type: document)
- `doseQuantity` missing `code` field (UCUM requirement)
- `birthDate` uses YYYY-01-01 approximation instead of year-only
- `suspected` maps to `unconfirmed` — should be `provisional`

### Security
- Live secrets committed to git (.env, frontend/.env.production)
- /api/admin/consultations has zero authentication
- WebSocket accepts connections without auth
- Admin role based entirely on mutable localStorage
- CORS allow_origins=["*"] in production
- CSP 'unsafe-inline' negates XSS protection

---

## MEDIUM PRIORITY

### Performance
- framer-motion loaded synchronously via LandingHero+ConsentBanner (~130KB gzip)
- backdrop-filter on sticky Header causes scroll repaint on low-end devices
- LiveTranscript forced reflow on every interim word

### PWA
- No PNG icons — Chrome/Android won't fire beforeinstallprompt
- apple-touch-icon is SVG — iOS home screen shows blank
- Google Fonts not precached — first offline visit has no fonts
- Vite JS chunks not in precache manifest — fresh install + offline = blank
- No SW update notification to user

### Accessibility
- Toast container has no aria-live — screen readers miss CDS alerts
- Recording state changes not announced
- Modal focus traps missing (PrescriptionQR, DrugAlternatives, ABHABadge)
- Tab widget missing arrow key navigation
- Multiple color contrast failures (text-slate-400 on white = 2.85:1)

### Clinical Note Editing
- Vitals can't be filled when missing (null guard blocks editing)
- medications.dosage/frequency/duration not editable
- diagnosis.icd10_code not editable
- allergies not editable in edit mode
- Array deletions untracked by findChanges

---

## COMPETITIVE ADVANTAGES (from competitor analysis)

MedScribe has 6 features NO competitor (Abridge, DAX, DeepCura, Suki) offers:
1. India-native Hindi-English code-mixing (Sarvam Saaras v3 + codemix)
2. ABDM-aligned FHIR profiles (nrces.in/ndhm)
3. Indian pharmacopeia (50+ brand→generic mappings)
4. Differential diagnosis engine (structured, per-diagnosis)
5. Continuous learning from doctor corrections (no retraining)
6. Real-time CDS with Indian drug names

### Hackathon Pitch Focus
- Lead with "Built for Bharat, not ported to India"
- Emphasize ABDM alignment (2026 certification deadline)
- Show CDS with Indian brands (Ecosprin, Combiflam, Glycomet)
- Differential diagnosis = "AI second opinion, not just fast typist"
- Demo telemedicine rural visit scenario

---

## STATS
- 50 research agents completed
- ~200 unique issues identified
- ~50 critical/high priority items
- 24 files already fixed in this session
- 65 backend tests passing
- Frontend builds clean
