import { useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import HealthBanner from './components/HealthBanner'
import Header from './components/Header'
import RecordButton from './components/RecordButton'
import LiveTranscript from './components/LiveTranscript'
import ClinicalNote from './components/ClinicalNote'
import FHIRQualityBadge from './components/FHIRQualityBadge'
import MetricsBar from './components/MetricsBar'
import InstallPrompt from './components/InstallPrompt'
import ConsultationPhase from './components/ConsultationPhase'
import SpecialtySelector from './components/SpecialtySelector'
import SafetyScoreCard from './components/SafetyScoreCard'
import useSafetyScore from './hooks/useSafetyScore'
import ConsentBanner from './components/ConsentBanner'
import ABHABadge from './components/ABHABadge'
import UserRegistration from './components/UserRegistration'
import ErrorBoundary from './components/ErrorBoundary'
import useWebSocket from './hooks/useWebSocket'
import useAudioRecorder from './hooks/useAudioRecorder'
import LanguageSelector from './components/LanguageSelector'
import ToastContainer from './components/ToastNotification'
import LandingHero from './components/LandingHero'
import AdminLogin from './components/AdminLogin'
import { FileJson, ClipboardList, Shield, RotateCcw } from 'lucide-react'

// Lazy-loaded components (not needed on initial render)
const FHIRViewer = lazy(() => import('./components/FHIRViewer'))
const CDSAlerts = lazy(() => import('./components/CDSAlerts'))
const ConsultationSummary = lazy(() => import('./components/ConsultationSummary'))
const PrescriptionQR = lazy(() => import('./components/PrescriptionQR'))
const DemoMode = lazy(() => import('./components/DemoMode'))
const ExportPanel = lazy(() => import('./components/ExportPanel'))
const ClinicalNudges = lazy(() => import('./components/ClinicalNudges'))

function LazyFallback() {
  return (
    <div className="card p-6 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const SESSION_STORAGE_KEY = 'medscribe_session_id'

function generateSessionId() {
  return crypto.randomUUID()
}

function getOrCreateSessionId() {
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (stored) return stored
  const id = generateSessionId()
  sessionStorage.setItem(SESSION_STORAGE_KEY, id)
  return id
}

function loadUser() {
  try {
    const raw = localStorage.getItem('medscribe_user')
    if (!raw) return null
    const user = JSON.parse(raw)
    // Force re-registration if required fields are missing
    if (!user.name || !user.doctorId || !user.hospital || !user.patientName) {
      localStorage.removeItem('medscribe_user')
      return null
    }
    return user
  } catch {
    return null
  }
}

export default function App() {
  const [page, setPage] = useState(() => window.location.hash === '#admin-login' ? 'admin-login' : 'app')
  const [user, setUser] = useState(loadUser)
  const [sessionId, setSessionId] = useState(getOrCreateSessionId)
  const [transcriptLines, setTranscriptLines] = useState([])
  const [activeTab, setActiveTab] = useState('note')
  const [specialty, setSpecialty] = useState('general')
  const [abhaId, setAbhaId] = useState(null)
  const [consented, setConsented] = useState(() => sessionStorage.getItem('medscribe_consent') === 'true')
  const [patientName, setPatientName] = useState('')
  const [speechLang, setSpeechLang] = useState('hi-IN')
  const [useSarvam, setUseSarvam] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const hasStartedRef = useRef(false)

  // Set-based dedup for all final transcripts (live + demo) — catches non-consecutive duplicates
  const seenFinalsRef = useRef(new Set())

  const handleRegister = useCallback((newUser) => {
    setUser(newUser)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('medscribe_user')
    setUser(null)
  }, [])

  const ws = useWebSocket(sessionId)

  const handleNewConsultation = useCallback(() => {
    ws.disconnect()
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
    const newId = generateSessionId()
    sessionStorage.setItem(SESSION_STORAGE_KEY, newId)
    setSessionId(newId)
    setTranscriptLines([])
    setActiveTab('note')
    setSpecialty('general')
    setPatientName('')
    hasStartedRef.current = false
    setSessionActive(false)
    seenFinalsRef.current = new Set()
  }, [ws])

  // Safety score hook
  const safetyScore = useSafetyScore(ws.cdsAlerts, ws.fhirQuality, ws.clinicalNote)

  const handleTranscript = useCallback((text, isFinal) => {
    if (isFinal) {
      const key = text.trim().toLowerCase()
      if (!key || seenFinalsRef.current.has(key)) return
      seenFinalsRef.current.add(key)
      setTranscriptLines(prev => [...prev, text])
    }
    ws.sendTranscript(text, isFinal)
  }, [ws])

  const handleVoiceCommand = useCallback((action) => {
    if (action === 'tab:fhir') setActiveTab('fhir')
    else if (action === 'tab:cds') setActiveTab('cds')
    else if (action === 'tab:note') setActiveTab('note')
    else if (action === 'process') ws.sendProcess()
  }, [ws])

  const recorder = useAudioRecorder(handleTranscript, handleVoiceCommand, speechLang, useSarvam)

  const handleSpeechLangChange = useCallback((lang) => {
    setSpeechLang(lang)
    // If currently recording, restart with new language
    if (recorder.isRecording) {
      recorder.stopRecording()
      setTimeout(() => recorder.startRecording(), 200)
    }
  }, [recorder])

  const handleSpecialtyChange = useCallback((value) => {
    setSpecialty(value)
    ws.sendSpecialty(value)
  }, [ws])

  // Transition from hero to active session view
  const handleHeroStart = useCallback(() => {
    hasStartedRef.current = true
    setSessionActive(true)  // forces re-render to show active view
  }, [])

  const handleStart = useCallback(() => {
    if (!consented) {
      document.getElementById('consent-section')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    // Guard against double-tap: if already recording, don't start a second instance
    if (recorder.isRecording) return
    ws.connect()
    hasStartedRef.current = true
    recorder.startRecording()
  }, [ws, recorder, consented])

  const handleStop = useCallback(() => {
    recorder.stopRecording()
    setTimeout(() => ws.sendStop(), 500)
  }, [recorder, ws])

  // Demo mode handler
  const handleDemoTranscript = useCallback((text, isFinal) => {
    const needsDelay = !hasStartedRef.current
    if (!hasStartedRef.current) {
      ws.connect()
      hasStartedRef.current = true
    }
    setTimeout(() => {
      if (isFinal) {
        const key = text.trim().toLowerCase()
        if (!key || seenFinalsRef.current.has(key)) return
        seenFinalsRef.current.add(key)
        setTranscriptLines(prev => [...prev, text])
      }
      ws.sendTranscript(text, isFinal)
    }, needsDelay ? 800 : 0)
  }, [ws])

  // Toast notification for critical alerts is sufficient — no auto-tab-switch

  const wordCount = useMemo(() => transcriptLines.join(' ').split(/\s+/).filter(Boolean).length, [transcriptLines])
  const resourceCount = ws.fhirBundle?.entry?.length || 0

  const hasSession = sessionActive || hasStartedRef.current || transcriptLines.length > 0 || ws.clinicalNote
  const showHero = !hasSession

  // Show admin login page
  if (page === 'admin-login') {
    return <AdminLogin onBack={() => { window.location.hash = ''; setPage('app') }} />
  }

  // Show registration screen if no user is logged in
  if (!user) {
    return <UserRegistration onRegister={handleRegister} onAdminLogin={() => setPage('admin-login')} />
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <HealthBanner />
      <ToastContainer />
      <Header user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-3 space-y-3">
        <ErrorBoundary>
        {/* Install Prompt — rendered above content, not floating */}
        <InstallPrompt />

        {showHero ? (
          <>
            {/* Landing state: hero + compact demo */}
            <LandingHero onStart={handleHeroStart} supported={recorder.supported} />
          </>
        ) : (
          <>
            {/* Active session: specialty selector gets its own row on mobile */}
            <div className="space-y-3 sm:space-y-0">
              {/* Specialty selector — full width on mobile */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <SpecialtySelector value={specialty} onChange={handleSpecialtyChange} />
                </div>
                <button
                  onClick={handleNewConsultation}
                  disabled={recorder.isRecording}
                  aria-label="New consultation"
                  className="flex items-center gap-1.5 px-3 py-2.5 min-h-[48px] text-sm sm:text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <RotateCcw className="w-4 h-4 sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">New</span>
                </button>
              </div>
              {/* Consultation phase + desktop metrics — second row */}
              <div className="flex items-center justify-between gap-2 sm:mt-2">
                <ConsultationPhase
                  clinicalNote={ws.clinicalNote}
                  isRecording={recorder.isRecording}
                  processing={ws.processing}
                />
                <div className="hidden sm:block">
                  <MetricsBar
                    elapsed={recorder.elapsed}
                    wordCount={wordCount}
                    resourceCount={resourceCount}
                    processing={ws.processing}
                  />
                </div>
              </div>
            </div>

            {/* Mobile-only compact metrics strip — visible only after recording starts */}
            {(recorder.isRecording || recorder.elapsed > 0) && (
              <div className="sm:hidden">
                <MetricsBar
                  elapsed={recorder.elapsed}
                  wordCount={wordCount}
                  resourceCount={resourceCount}
                  processing={ws.processing}
                />
              </div>
            )}

            {/* Consent banner */}
            <div id="consent-section">
              <ConsentBanner onConsent={() => setConsented(true)} consented={consented} />
            </div>

            {/* Patient info — compact inline */}
            {consented && (
              <div className="card p-3 flex items-center gap-3">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Patient
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Patient name (optional)"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <ABHABadge onAbhaIdChange={setAbhaId} />
              </div>
            )}

            {/* Recording card — compact with inline demo toggle */}
            <div className="card p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <LanguageSelector value={speechLang} onChange={handleSpeechLangChange} useSarvam={useSarvam} onSarvamChange={setUseSarvam} />
              </div>
              <RecordButton
                isRecording={recorder.isRecording}
                elapsed={recorder.elapsed}
                supported={recorder.supported}
                processing={ws.processing}
                onStart={handleStart}
                onStop={handleStop}
              />
            </div>

            {/* Error display */}
            {ws.error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
                {ws.error}
              </div>
            )}

            {/* Two-column layout — immediately after recording card */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
              {/* Left: Transcript + Nudges */}
              <div className="space-y-3">
                <LiveTranscript
                  transcript={transcriptLines}
                  interimText={ws.interimText}
                  isRecording={recorder.isRecording}
                />
                {ws.clinicalNote && (
                  <Suspense fallback={<LazyFallback />}>
                    <ClinicalNudges clinicalNote={ws.clinicalNote} />
                  </Suspense>
                )}
              </div>

              {/* Right: Tabbed content (Note / FHIR / Safety) */}
              <div className="space-y-3">
                {/* Tab switcher — mobile only */}
                <div className="flex gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl lg:hidden" role="tablist">
                  <button
                    id="tab-note"
                    role="tab"
                    aria-selected={activeTab === 'note'}
                    aria-controls="panel-note"
                    onClick={() => setActiveTab('note')}
                    className={`flex-1 flex items-center justify-center gap-2 min-h-[48px] px-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'note'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4" />
                    Note
                  </button>
                  <button
                    id="tab-fhir"
                    role="tab"
                    aria-selected={activeTab === 'fhir'}
                    aria-controls="panel-fhir"
                    onClick={() => setActiveTab('fhir')}
                    className={`flex-1 flex items-center justify-center gap-2 min-h-[48px] px-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'fhir'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <FileJson className="w-4 h-4" />
                    FHIR
                    {resourceCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
                        {resourceCount}
                      </span>
                    )}
                  </button>
                  <button
                    id="tab-cds"
                    role="tab"
                    aria-selected={activeTab === 'cds'}
                    aria-controls="panel-cds"
                    onClick={() => setActiveTab('cds')}
                    className={`flex-1 flex items-center justify-center gap-2 min-h-[48px] px-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'cds'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Safety
                    {ws.cdsAlerts.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                        {ws.cdsAlerts.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Note tab */}
                <div id="panel-note" role="tabpanel" aria-labelledby="tab-note" className={`${activeTab === 'note' ? 'animate-fadeIn' : 'hidden'} lg:block`}>
                  <ClinicalNote
                    data={ws.clinicalNote}
                    processing={ws.processing}
                    sessionId={sessionId}
                    transcript={transcriptLines.join(' ')}
                  />
                </div>

                {/* FHIR tab */}
                <div id="panel-fhir" role="tabpanel" aria-labelledby="tab-fhir" className={`${activeTab === 'fhir' ? 'animate-fadeIn' : 'hidden'} lg:block`}>
                  {ws.fhirBundle ? (
                    <>
                      <FHIRQualityBadge quality={ws.fhirQuality} />
                      <div className="mt-2">
                        <Suspense fallback={<LazyFallback />}>
                          <FHIRViewer bundle={ws.fhirBundle} />
                        </Suspense>
                      </div>
                    </>
                  ) : (
                    <div className="card p-6 text-center border-dashed border-2 border-slate-200 dark:border-slate-700">
                      <FileJson className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        {ws.processing ? 'Generating FHIR resources...' : 'FHIR R4 bundle will appear here'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Safety tab — SafetyScoreCard inside, then CDSAlerts */}
                <div id="panel-cds" role="tabpanel" aria-labelledby="tab-cds" className={`${activeTab === 'cds' ? 'animate-fadeIn' : 'hidden'} lg:block`}>
                  <SafetyScoreCard {...safetyScore} />
                  {ws.cdsAlerts.length > 0 ? (
                    <div className="mt-2">
                      <Suspense fallback={<LazyFallback />}>
                        <CDSAlerts alerts={ws.cdsAlerts} />
                      </Suspense>
                    </div>
                  ) : (
                    <div className="card p-6 text-center mt-2 border-dashed border-2 border-slate-200 dark:border-slate-700">
                      <Shield className="w-8 h-8 text-emerald-300 dark:text-emerald-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        {ws.processing ? 'Running safety checks...' : 'No safety alerts — checks appear here'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Export + QR — side by side */}
            {ws.clinicalNote && (
              <Suspense fallback={<LazyFallback />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ExportPanel clinicalNote={ws.clinicalNote} fhirBundle={ws.fhirBundle} />
                  <PrescriptionQR
                    medications={ws.clinicalNote?.medications || []}
                    patientInfo={ws.clinicalNote?.patient_info || {}}
                    sessionId={sessionId}
                    doctorName={user?.name}
                  />
                </div>
              </Suspense>
            )}

            {/* Consultation Summary */}
            <Suspense fallback={<LazyFallback />}>
              <ConsultationSummary
                clinicalNote={ws.clinicalNote}
                fhirQuality={ws.fhirQuality}
                cdsAlerts={ws.cdsAlerts}
                elapsed={recorder.elapsed}
              />
            </Suspense>
          </>
        )}

        {/* Demo mode — single instance across hero and active views */}
        <Suspense fallback={<LazyFallback />}>
          <DemoMode
            onTranscript={handleDemoTranscript}
            isRecording={recorder.isRecording}
          />
        </Suspense>

        </ErrorBoundary>
      </main>

      {/* Footer — compact */}
      <footer className="text-center py-3 text-[11px] text-slate-400 dark:text-slate-600">
        MedScribe AI — HACKMATRIX 2.0 (Jilo Health x NJACK IIT Patna)
      </footer>
    </div>
  )
}
