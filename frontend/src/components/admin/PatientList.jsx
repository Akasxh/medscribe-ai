import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, Clock, User, FileText } from 'lucide-react'

const STATUS_OPTIONS = ['all', 'active', 'completed']

function formatTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function PatientList({ sessions, selectedId, onSelect }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  const filtered = useMemo(() => {
    let list = sessions

    // Filter by status
    if (statusFilter !== 'all') {
      list = list.filter(s => s.status === statusFilter)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => {
        const name = s.clinical_note?.patient_info?.name || ''
        const complaint = s.clinical_note?.chief_complaint || ''
        return (
          name.toLowerCase().includes(q) ||
          complaint.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
        )
      })
    }

    // Sort
    list = [...list].sort((a, b) => {
      let valA, valB
      if (sortKey === 'created_at') {
        valA = new Date(a.created_at).getTime()
        valB = new Date(b.created_at).getTime()
      } else if (sortKey === 'patient') {
        valA = (a.clinical_note?.patient_info?.name || '').toLowerCase()
        valB = (b.clinical_note?.patient_info?.name || '').toLowerCase()
      } else if (sortKey === 'status') {
        valA = a.status
        valB = b.status
      }
      if (valA < valB) return sortAsc ? -1 : 1
      if (valA > valB) return sortAsc ? 1 : -1
      return 0
    })

    return list
  }, [sessions, search, statusFilter, sortKey, sortAsc])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  return (
    <div className="card rounded-2xl overflow-hidden">
      {/* Search + filter bar */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient, complaint, session ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === opt
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="hidden sm:grid sm:grid-cols-4 gap-2 px-3 py-2 text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800">
        <button onClick={() => toggleSort('patient')} className="flex items-center gap-1 hover:text-slate-600">
          Patient <ArrowUpDown className="w-3 h-3" />
        </button>
        <span>Complaint</span>
        <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-slate-600">
          Time <ArrowUpDown className="w-3 h-3" />
        </button>
        <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-600">
          Status <ArrowUpDown className="w-3 h-3" />
        </button>
      </div>

      {/* Rows */}
      <div className="max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl m-3">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No consultations found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {search ? 'Try a different search term' : 'Start a consultation to see data here'}
            </p>
          </div>
        ) : (
          filtered.map(session => {
            const name = session.clinical_note?.patient_info?.name || 'Unknown'
            const complaint = session.clinical_note?.chief_complaint || 'No complaint recorded'
            const isSelected = session.id === selectedId

            return (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={`w-full text-left px-3 py-3 border-b border-slate-50 dark:border-slate-800/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-950/20 border-l-2 border-l-blue-600' : ''
                }`}
              >
                {/* Mobile layout */}
                <div className="sm:hidden space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {name}
                    </span>
                    <StatusBadge status={session.status} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{complaint}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(session.created_at)}
                  </p>
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:grid sm:grid-cols-4 gap-2 items-center">
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {name}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{complaint}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(session.created_at)}
                  </span>
                  <StatusBadge status={session.status} />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const normalized = status || 'unknown'
  const isActive = normalized === 'active'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${
        isActive
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  )
}
