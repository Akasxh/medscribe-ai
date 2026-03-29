import { useState, useEffect, useCallback } from 'react'
import { LogOut, RefreshCw, Activity } from 'lucide-react'
import KPICards from './admin/KPICards'
import PatientList from './admin/PatientList'
import ConsultationDetail from './admin/ConsultationDetail'

export default function AdminDashboard({ onLogout }) {
  const [sessions, setSessions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${base}/api/admin/consultations`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to fetch')
      }
      const data = await res.json()
      setSessions(data.consultations || [])
    } catch (e) {
      setError(e.message || 'Failed to load consultations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const selected = sessions.find(s => s.id === selectedId) || null

  const handleLogout = () => {
    localStorage.removeItem('medscribe_admin')
    onLogout()
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              MedScribe<span className="text-blue-600 dark:text-blue-400">AI</span>
              <span className="text-sm font-normal text-slate-500 ml-2">Admin Dashboard</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* KPIs */}
        <KPICards sessions={sessions} />

        {/* Main content: list + detail */}
        {loading && sessions.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading consultations...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-sm text-slate-500">No consultations found. Upload some from the doctor app first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <PatientList
                sessions={sessions}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <div className="lg:col-span-2">
              <ConsultationDetail session={selected} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
