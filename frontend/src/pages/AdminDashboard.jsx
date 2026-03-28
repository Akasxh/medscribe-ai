import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, RefreshCw } from 'lucide-react'
import KPICards from '../components/admin/KPICards'
import PatientList from '../components/admin/PatientList'
import ConsultationDetail from '../components/admin/ConsultationDetail'
import AnalyticsPanel from '../components/admin/AnalyticsPanel'
import useSupabaseAuth from '../hooks/useSupabaseAuth'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function loadUser() {
  try {
    const raw = localStorage.getItem('medscribe_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const user = loadUser()
  const { signOut } = useSupabaseAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/sessions`)
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Admin Dashboard</h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">MedScribe AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden sm:inline text-sm text-slate-600 dark:text-slate-400">
                Dr. {user.name}
              </span>
            )}
            <button
              onClick={fetchSessions}
              disabled={loading}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Refresh sessions"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card rounded-2xl p-5 animate-pulse">
                  <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))}
            </div>
            <div className="card rounded-2xl p-6 animate-pulse h-48" />
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
          </>
        )}
      </main>

      <footer className="text-center py-3 text-[11px] text-slate-400 dark:text-slate-600">
        MedScribe AI — HACKMATRIX 2.0 (Jilo Health x NJACK IIT Patna)
      </footer>
    </div>
  )
}
