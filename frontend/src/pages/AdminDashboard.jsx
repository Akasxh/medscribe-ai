import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, RefreshCw, Download, Activity, UserCheck, Clock } from 'lucide-react'
import KPICards from '../components/admin/KPICards'
import PatientList from '../components/admin/PatientList'
import ConsultationDetail from '../components/admin/ConsultationDetail'
import AnalyticsPanel from '../components/admin/AnalyticsPanel'
import useSupabaseAuth from '../hooks/useSupabaseAuth'

const API_BASE = import.meta.env.VITE_API_URL || ''

function loadUser() {
  try {
    const raw = localStorage.getItem('medscribe_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function formatTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function exportCSV(sessions) {
  const headers = ['ID', 'Patient', 'Chief Complaint', 'Diagnosis', 'Medications', 'Doctor', 'Status', 'Created At', 'Safety Score', 'FHIR Grade']
  const rows = sessions.map(s => {
    const note = s.clinical_note || {}
    const diagnoses = (note.diagnosis || []).map(d => d.condition).join('; ')
    const meds = (note.medications || []).map(m => m.generic_name || m.name || m.drug).join('; ')
    const criticals = (s.cds_alerts || []).filter(a => a.severity === 'critical').length
    const warnings = (s.cds_alerts || []).filter(a => a.severity === 'warning').length
    const safety = Math.max(0, 100 - criticals * 25 - warnings * 10)
    return [
      s.id,
      note.patient_info?.name || 'Unknown',
      note.chief_complaint || '',
      diagnoses,
      meds,
      s.doctor_name || note.doctor_name || 'Unknown',
      s.status || '',
      s.created_at || '',
      safety,
      s.fhir_quality?.grade || '',
    ]
  })

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `medscribe-consultations-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportJSON(sessions) {
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `medscribe-consultations-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const user = loadUser()
  const { signOut } = useSupabaseAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let res = await fetch(`${API_BASE}/api/admin/consultations`)
      if (!res.ok) {
        res = await fetch(`${API_BASE}/api/sessions`)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSessions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleLogout = useCallback(async () => {
    await signOut().catch(() => {})
    localStorage.removeItem('medscribe_user')
    navigate('/login')
  }, [navigate, signOut])

  const selectedSession = sessions.find(s => s.id === selectedId) || null

  // Doctor activity table data
  const doctorActivity = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const name = s.doctor_name || s.clinical_note?.doctor_name || 'Unknown'
      if (!map[name]) {
        map[name] = { name, consultations: 0, lastActive: null }
      }
      map[name].consultations += 1
      const ts = s.created_at ? new Date(s.created_at) : null
      if (ts && (!map[name].lastActive || ts > map[name].lastActive)) {
        map[name].lastActive = ts
      }
    })
    return Object.values(map).sort((a, b) => b.consultations - a.consultations)
  }, [sessions])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-gradient-to-r from-violet-600 via-blue-600 to-indigo-600 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight tracking-tight">
                MedScribe<span className="opacity-80">AI</span> Admin Portal
              </h1>
              <p className="text-[11px] text-white/60">Hospital Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden sm:inline text-sm text-white/80">
                {user.name || user.email}
              </span>
            )}
            <button
              onClick={fetchSessions}
              disabled={loading}
              className="p-2 rounded-lg text-white/70 hover:bg-white/10 transition-colors"
              aria-label="Refresh sessions"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white/90 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50">
                    <button
                      onClick={() => { exportCSV(sessions); setExportOpen(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Download CSV
                    </button>
                    <button
                      onClick={() => { exportJSON(sessions); setExportOpen(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Download JSON
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white/90 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
            Failed to load sessions: {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && sessions.length === 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="card rounded-2xl p-5 animate-pulse">
                  <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))}
            </div>
            <div className="card rounded-2xl p-6 animate-pulse h-48" />
          </div>
        ) : sessions.length === 0 && !loading ? (
          /* Empty state */
          <div className="card rounded-2xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
            <LayoutDashboard className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">No consultations yet</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-md mx-auto">
              When doctors start recording consultations, their data will appear here with analytics, FHIR resources, and CDS alerts.
            </p>
            <button
              onClick={fetchSessions}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <KPICards sessions={sessions} />

            {/* Two-column: Patient list + Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <PatientList
                  sessions={sessions}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
              <div className="lg:col-span-3">
                <ConsultationDetail session={selectedSession} />
              </div>
            </div>

            {/* Analytics */}
            <div>
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Analytics</h2>
              <AnalyticsPanel sessions={sessions} />
            </div>

            {/* Doctor Activity */}
            {doctorActivity.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Doctor Activity</h2>
                <div className="card rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Doctor</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Consultations</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Last Active</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctorActivity.map((doc) => {
                          const isRecent = doc.lastActive && (Date.now() - doc.lastActive.getTime()) < 24 * 60 * 60 * 1000
                          return (
                            <tr key={doc.name} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                                  {doc.name}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                {doc.consultations}
                              </td>
                              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  {doc.lastActive ? formatTime(doc.lastActive.toISOString()) : '--'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${
                                  isRecent
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isRecent ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  {isRecent ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center py-3 text-[11px] text-slate-400 dark:text-slate-600">
        MedScribe AI Admin Portal — HACKMATRIX 2.0 (Jilo Health x NJACK IIT Patna)
      </footer>
    </div>
  )
}
