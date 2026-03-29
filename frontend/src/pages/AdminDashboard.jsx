import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, RefreshCw, Activity } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem('medscribe_admin')
    if (!stored) {
      navigate('/admin/login')
      return
    }
    setAdmin(JSON.parse(stored))
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/consultations`)
      if (res.ok) {
        setSessions(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('medscribe_admin')
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-violet-700 to-violet-600 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">MedScribeAI Admin</h1>
              <p className="text-xs text-violet-200">Hospital Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-violet-200">{admin?.email}</span>
            <button onClick={fetchSessions} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <LayoutDashboard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700">No consultations yet</h2>
            <p className="text-sm text-slate-500 mt-2">
              When doctors complete consultations, they will appear here.
            </p>
            <button onClick={fetchSessions} className="mt-4 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors">
              Refresh
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Consultations ({sessions.length})
            </h2>
            <div className="space-y-3">
              {sessions.map((s) => {
                const note = s.clinical_note || s.clinical_notes?.[0] || {}
                const patient = note.patient_info?.name || s.patient_name || 'Unknown Patient'
                const complaint = note.chief_complaint || 'No complaint recorded'
                const meds = note.medications?.length || 0
                const dx = note.diagnosis?.length || 0
                const date = s.created_at ? new Date(s.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '--'

                return (
                  <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800 truncate">{patient}</h3>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            s.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {s.status || 'completed'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 truncate">{complaint}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          <span>{date}</span>
                          {s.doctor_name && <span>Dr. {s.doctor_name}</span>}
                          {s.specialty && s.specialty !== 'general' && (
                            <span className="capitalize">{s.specialty}</span>
                          )}
                          <span>{dx} diagnosis</span>
                          <span>{meds} medications</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-[11px] text-slate-400">
        MedScribe AI Admin — HACKMATRIX 2.0 (Jilo Health x NJACK IIT Patna)
      </footer>
    </div>
  )
}
