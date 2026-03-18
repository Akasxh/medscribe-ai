# MedScribe AI — Setup & Run Instructions

## Prerequisites

- **Node.js** v18+ (with npm)
- **Python** 3.10+
- **Google Chrome** or **Microsoft Edge** (required for Web Speech API)
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

---

## 1. Clone & Navigate

```bash
git clone <your-repo-url>
cd medscribe-ai
```

---

## 2. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env   # or create manually
```

Edit `.env` and add your Gemini API key:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional (not needed — Web Speech API is used by default)
# DEEPGRAM_API_KEY=
```

---

## 3. Backend Setup

```bash
cd backend

# Create Python virtual environment
python3 -m venv venv

# Install dependencies
./venv/bin/pip install -r requirements.txt

# Start the backend server
./venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify it's running:
```bash
curl http://localhost:8000/api/health
# Expected: {"status":"healthy","service":"MedScribe AI Backend","version":"1.0.0"}
```

---

## 4. Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at **http://localhost:5173**

---

## 5. Run Both Together (Quick Start)

From the project root:

```bash
npm install      # one-time: installs concurrently
npm run dev      # starts both backend and frontend
```

This runs:
- Backend on `http://localhost:8000`
- Frontend on `http://localhost:5173` (proxies `/ws` and `/api` to backend)

---

## 6. Using the App

### Live Recording Mode

1. Open **http://localhost:5173** in **Chrome/Edge**
2. Click the blue **microphone button**
3. **Allow microphone access** when prompted
4. Speak in **Hindi, English, or Hindi-English mix** (e.g., "Patient ko 3 din se bukhar hai, temperature 101 degree hai")
5. The **Live Transcript** panel shows your speech in real-time
6. Click the **red stop button** when done
7. AI processes the transcript and generates:
   - **Clinical Note** — structured medical documentation
   - **FHIR R4 Bundle** — interoperable healthcare resources

### Demo Mode (Recommended for Presentations)

If live mic is unreliable (noisy room, network issues), use Demo Mode:

1. Scroll to the **Demo Mode** section (purple card)
2. Click one of the pre-recorded conversations:
   - **Viral Fever (Hindi-English)** — common OPD case
   - **Diabetes Follow-up** — chronic disease management
   - **Cardiac + Safety Alerts** — triggers CDS drug interaction alerts (best for demo!)
3. The transcript plays automatically and AI generates the clinical note + FHIR bundle

### Navigating the UI

- **Desktop**: Split-screen — transcript on left, clinical note + FHIR on right
- **Mobile**: Stacked layout with 3 tabs: **Note** / **FHIR** / **Safety**
- **Dark Mode**: Toggle via the moon/sun icon in the header
- **FHIR Cards**: Click any card to expand and see the raw JSON. Use the copy button to copy individual resources.
- **Raw Bundle**: Click "Raw JSON" in the FHIR section header to see the complete bundle
- **Safety Tab**: Auto-navigates here when critical CDS alerts are detected
- **Toast Notifications**: Real-time popups for extraction events, FHIR generation, and critical safety alerts
- **Consultation Summary**: Dark card at top showing one-glance overview with share/copy
- **Export Panel**: Print clinical note, download FHIR JSON, or copy to clipboard
- **Editable Clinical Note**: Click "Edit" on the clinical note to make corrections. Click "Save & Teach AI" to store corrections for continuous learning
- **PWA Install**: Banner appears offering to install the app to home screen

---

## 7. Project Structure

```
medscribe-ai/
├── .env                        # API keys (not committed)
├── package.json                # Root scripts (npm run dev)
├── CLAUDE.md                   # AI assistant instructions
├── INSTRUCTIONS.md             # This file
│
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── requirements.txt        # Python dependencies
│   ├── venv/                   # Python virtual environment
│   ├── routers/
│   │   ├── transcribe.py       # WebSocket endpoint + FHIR quality + CDS pipeline
│   │   └── sessions.py         # REST API for sessions + corrections endpoint
│   ├── services/
│   │   ├── gemini_service.py   # Gemini 2.5 Flash clinical extraction
│   │   ├── fhir_service.py     # FHIR R4 Bundle builder
│   │   ├── cds_service.py      # Clinical Decision Support (drug interactions, allergies, dosage)
│   │   ├── learning_service.py # Continuous learning from doctor corrections
│   │   ├── terminology_service.py # ICD-10 + drug name validation against reference data
│   │   └── stt_service.py      # STT stub (Web Speech API used in browser)
│   ├── prompts/
│   │   └── clinical_extraction.py  # System prompt with differential diagnosis support
│   ├── models/
│   │   ├── schemas.py          # Pydantic data models (incl. DifferentialDiagnosis)
│   │   └── fhir_models.py      # FHIR constants
│   └── data/
│       ├── drug_reference.json # Indian drug brand → generic mapping
│       ├── icd10_common.json   # Common ICD-10 codes
│       └── corrections.json    # Stored doctor corrections (auto-generated)
│
├── frontend/
│   ├── index.html              # Entry HTML (PWA meta tags)
│   ├── package.json            # React dependencies
│   ├── vite.config.js          # Vite config with proxy
│   ├── tailwind.config.js      # Tailwind theme (medical colors)
│   ├── public/
│   │   ├── manifest.json       # PWA manifest (SVG icons, categories)
│   │   ├── sw.js               # Service worker
│   │   └── icons/              # SVG app icons (192x192, 512x512)
│   └── src/
│       ├── App.jsx             # Main app (3-tab mobile, auto-safety switch)
│       ├── main.jsx            # React entry + PWA registration
│       ├── index.css           # Tailwind + custom animations
│       ├── components/
│       │   ├── RecordButton.jsx       # Mic button with pulse + waveform + ARIA
│       │   ├── LiveTranscript.jsx     # Streaming transcript display
│       │   ├── ClinicalNote.jsx       # Editable clinical note with "Save & Teach AI"
│       │   ├── FHIRViewer.jsx         # FHIR resource cards + raw JSON
│       │   ├── FHIRQualityBadge.jsx   # FHIR compliance score (Grade A-D)
│       │   ├── CDSAlerts.jsx          # Drug interaction + allergy alerts
│       │   ├── ExportPanel.jsx        # Print / Download FHIR / Copy to clipboard
│       │   ├── ConsultationSummary.jsx# One-glance summary card with share
│       │   ├── ToastNotification.jsx  # Real-time toast alerts
│       │   ├── InstallPrompt.jsx      # PWA install banner
│       │   ├── MetricsBar.jsx         # Efficiency metrics + time saved
│       │   ├── DemoMode.jsx           # 3 demo scenarios (incl. Cardiac + Safety)
│       │   └── Header.jsx             # Header with HACKMATRIX badge + dark mode
│       ├── hooks/
│       │   ├── useAudioRecorder.js    # Web Speech API integration
│       │   └── useWebSocket.js        # WebSocket + CDS alerts + FHIR quality + toasts
│       └── utils/
│           ├── fhirTemplates.js       # FHIR resource colors/summaries
│           └── formatters.js          # Time/date formatting
│
└── demo/
    └── sample_conversations/   # Demo audio files (optional)
```

---

## 8. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (includes `gemini_configured` status) |
| POST | `/api/sessions` | Create new session |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/{id}` | Get session by ID |
| POST | `/api/sessions/corrections` | Submit doctor correction for continuous learning |
| GET | `/api/sessions/corrections/stats` | Get correction statistics |
| WS | `/ws/transcribe/{session_id}` | WebSocket for real-time transcription pipeline |

### WebSocket Message Types

**Client → Server:**
| Type | Description |
|------|-------------|
| `transcript` | Send recognized speech text (`{type, text, is_final, timestamp}`) |
| `process` | Force AI extraction on accumulated text |
| `stop` | End session and process remaining text |

**Server → Client:**
| Type | Description |
|------|-------------|
| `transcript_ack` | Confirms received final transcript |
| `interim_transcript` | Echoes interim speech for display |
| `processing` | Extraction started/completed |
| `clinical_note` | Structured clinical data JSON (incl. differential_diagnosis, risk_factors, recommended_tests) |
| `fhir_bundle` | Complete FHIR R4 Bundle JSON with `quality_score` (grade, score, checks, terminology) |
| `cds_alerts` | Clinical Decision Support alerts (drug interactions, allergies, dosage) |
| `session_complete` | Session ended |
| `error` | Error message |

---

## 9. FHIR R4 Resources Generated

Each consultation produces a Bundle containing up to **8 resource types**:

| Resource | Color | Content |
|----------|-------|---------|
| **Patient** | Violet | Name, gender, age |
| **Encounter** | Blue | Consultation type, status |
| **Condition** | Amber | Diagnosis with ICD-10 code + confidence |
| **Observation** | Emerald | Vitals (temp, BP, pulse, SpO2) and symptoms |
| **MedicationRequest** | Pink | Prescriptions with generic names, dosage |
| **AllergyIntolerance** | Orange | Known allergies |
| **CarePlan** | Teal | Follow-up instructions + recommended test schedule |
| **ServiceRequest** | Cyan | Individual diagnostic test orders (CBC, Dengue NS1, etc.) |

All resources use standard coding systems: ICD-10, SNOMED CT, LOINC, RxNorm.
Resources are properly cross-referenced (Patient → Encounter → Condition/Observation/MedicationRequest).

---

## 10. Troubleshooting

| Issue | Fix |
|-------|-----|
| "Speech recognition not supported" | Use Chrome or Edge. Safari/Firefox don't support Web Speech API. |
| Mic permission denied | Click the lock icon in the address bar → Allow microphone |
| "WebSocket connection failed" | Ensure backend is running on port 8000 |
| "Clinical extraction failed" | Check your `GEMINI_API_KEY` in `.env` is valid |
| Blank clinical note | Speak at least 2-3 sentences before stopping — AI needs minimum context |
| Hindi not recognized | Set `recognition.lang` in `useAudioRecorder.js` to `hi-IN` (default) |
| Port 8000 already in use | `kill $(lsof -t -i:8000)` then restart |

---

## 11. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python FastAPI + WebSocket |
| Speech-to-Text | Web Speech API (browser-native, free) |
| AI Extraction | Google Gemini 2.5 Flash |
| Data Format | FHIR R4 (HL7 standard) |
| PWA | Service Worker + Web App Manifest |

---

## 12. For Judges / Demo

### Quick Start
1. Start both servers: `npm run dev`
2. Open Chrome at `http://localhost:5173`

### Recommended Demo Flow (5 minutes)

**Step 1 — First Impression (30s)**
- Show the landing page on mobile (resize browser to phone width)
- Toggle dark mode to show it works
- Point out: PWA install banner, HACKMATRIX 2.0 badge, mobile-first responsive tabs

**Step 2 — Cardiac + Safety Demo (2min) — THE MONEY SHOT**
- Click **Demo Mode** → **"Cardiac + Safety Alerts"**
- This triggers the most impressive pipeline:
  - Real-time transcript streaming
  - AI extracts structured clinical note with differential diagnosis
  - FHIR R4 bundle generated with quality grade
  - **CDS alerts fire**: Ecosprin + Combiflam (NSAID interaction) + Penicillin allergy + Augmentin (cross-reactivity)
  - **Auto-switches to Safety tab** on critical alerts
  - Toast notifications pop up for each event
- Click on the FHIR tab to show resource cards with ICD-10/SNOMED codes
- Show FHIR Quality Badge (Grade A-D with detailed checks)
- Show Consultation Summary card with **time-saved badge** (Nx faster)

**Step 3 — Edit & Continuous Learning (1min)**
- Click "Edit" on the clinical note
- Change a diagnosis or medication
- Click "Save & Teach AI" → system learns from corrections
- Explain: next extraction uses these corrections as few-shot examples

**Step 4 — Export Suite (30s)**
- Click Print → shows formatted clinical note in print dialog
- Click Download FHIR → saves JSON bundle
- Click Share on Consultation Summary → copies summary to clipboard

**Step 5 — Live Recording (1min)**
- Tap the mic button, speak in Hindi-English mix:
  "Patient ka naam Rahul hai, 28 years male, 3 din se bukhar hai, temperature 101 degree, sardi aur khansi bhi hai. Crocin 650 diya do, din mein do baar, 5 din ke liye."
- Stop recording → watch AI extract everything in real-time
- Show the transcript on left, clinical note on right

### Key Features to Highlight for Judges
| Feature | Why It's Special |
|---------|-----------------|
| Clinical Decision Support | 15 drug interactions, 3 allergy rules, 10+ dosage checks — real patient safety |
| Continuous Learning | Doctor corrections improve future extractions — no retraining needed |
| Differential Diagnosis | AI suggests alternatives with evidence + distinguishing tests |
| FHIR R4 Quality Scoring | Automated compliance grading with terminology validation |
| Confidence Scores | Each diagnosis has a 0-1.0 confidence score |
| Hindi-English Code-Mixing | Seamlessly handles "pet mein dard" → Abdominal pain |
| Indian Drug Mapping | Crocin → Paracetamol, Combiflam → Ibuprofen+Paracetamol (17+ brands) |
| Time Saved | Shows Nx faster vs manual 10-min documentation |
| Export Suite | Print + FHIR JSON download + clipboard copy + share |
| PWA | Installable on phone, works offline for UI |
