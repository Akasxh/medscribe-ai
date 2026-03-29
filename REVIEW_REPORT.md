# 16-Agent Review Sweep — Complete Report (2026-03-29)

## Critical Fixes Needed (Priority Order)

### 1. Sarvam STT: Wrong model + missing codemix mode [BLOCKS TRANSCRIPTION]
- `stt_service.py:73` — `saaras:v2` doesn't exist, use `saaras:v3` + `mode: codemix`
- `transcribe.py:96-98` — returns HTTP 200 on STT failure, frontend retry is dead code
- `useAudioRecorder.js:168` — add mic constraints (16kHz, mono, noise suppression)
- `useAudioRecorder.js:195` — increase chunk interval 5s→8s

### 2. Datetime bug crashes session cleanup on EVERY WS connect
- `transcribe.py:63` — `datetime.now()` is naive, `session.created_at` is UTC-aware → TypeError
- Fix: `datetime.now(timezone.utc)` + import timezone

### 3. WebSocket processing_lock deadlock on stop
- `transcribe.py:216-265` — `stop` blocks up to 61s if `process` is mid-Gemini call
- `session_complete` never sent during deadlock

### 4. CDS: Pantoprazole+Clopidogrel rule is WRONG
- `cds_service.py:158-169` — pantoprazole is the SAFE PPI, rule should flag omeprazole/esomeprazole

### 5. ICD-10 codes are non-billable
- R05→R05.9, R51→R51.9, G43.9→G43.909, J44.1→J44.9

### 6. CDS dosage parser multiplier bug
- `cds_service.py:532-537` — `2x500mg` returns 1000mg, should return 500mg (single dose)

## Already Fixed This Session
- Admin auth bypass (Supabase Auth → backend endpoint)
- ProtectedRoute role hardcoding
- Sign-in default for doctors
- ExportPanel hooks after conditional return
- sendStop dropping when WS CONNECTING
- Sarvam MIME type mismatch (wav→webm)
- Stop delay 500ms→2000ms
- Firefox download fix
- Multi-consultation state reset
- Data persistence: doctor_name, patient_name, cds_alerts, fhir_quality
- Admin API: server-side filtering (doctor, specialty, date)
- Backend: thread safety, error leak, cleanup

## Remaining Issues by Agent

### Frontend Components
- FHIRViewer: nested button (copy inside expand)
- ClinicalNote: findChanges misses array appends
- InstallPrompt: beforeinstallprompt missed when banner unmounted
- MetricsBar: fractional seconds display

### React Hooks
- useWebSocket: reconnect uses stale sessionId closure
- useAudioRecorder: stopBrowserRecording skips setIsRecording when recognitionRef is null
- useSafetyScore: allergy cross-check always penalizes safe prescriptions

### Deployment
- Dockerfile: hardcoded Supabase keys in image layers
- sw.js: static CACHE_VERSION never bumped
- manifest.json: SVG screenshots, combined maskable purpose
- recharts not in manualChunks

### Security
- Plaintext admin password in GET query params
- Encryption fallback to base64 when crypto missing
- _send_error swallows all exceptions silently
- CDS silent failure shows "no alerts" when check crashed
- No rate limiting on WS messages

### Prompt Quality
- Citations (Rule 13) hallucination-prone
- Rule 14 field name mismatch for differentials
- Missing response_schema for strict JSON
- Allergy format instruction missing

### Medical Data
- Combo drug RxNorm CUIs wrong (Combiflam=ibuprofen only)
- Benadryl dosage wrong for Indian formulation
- Cephalosporin cross-reactivity overstated (1-10% → <2%)
- Duplicate ICD-10 K76.0 entries

### Test Coverage
- Zero frontend tests
- Zero WebSocket pipeline tests
- Zero Gemini service tests
- Security tests don't test actual endpoints
