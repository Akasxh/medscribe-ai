import { Search, X, Filter, Calendar, User, Stethoscope } from 'lucide-react'

export const DEFAULT_FILTERS = {
  search: '',
  doctor: '',
  dateFrom: '',
  dateTo: '',
  specialty: '',
  status: 'all',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export default function FilterBar({ filters, doctors, specialties, onChange, onClear }) {
  const set = (key, value) => onChange({ ...filters, [key]: value })
  const hasActive = Object.entries(filters).some(
    ([k, v]) => k !== 'status' ? v !== '' : v !== 'all'
  )

  return (
    <div className="card rounded-2xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Filter className="w-4 h-4" />
          Filters
          {hasActive && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">ON</span>
          )}
        </div>
        {hasActive && (
          <button onClick={onClear} className="text-xs text-slate-500 hover:text-red-500 dark:text-slate-400 flex items-center gap-1 transition-colors">
            <X className="w-3 h-3" /> Clear all
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient, complaint, ID..."
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5 shrink-0">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set('status', opt.value)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                filters.status === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select value={filters.doctor} onChange={e => set('doctor', e.target.value)}
            className="w-full pl-7 pr-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
            <option value="">All Doctors</option>
            {doctors.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="relative">
          <Stethoscope className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select value={filters.specialty} onChange={e => set('specialty', e.target.value)}
            className="w-full pl-7 pr-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
            <option value="">All Specialties</option>
            {specialties.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input type="date" value={filters.dateFrom} onChange={e => set('dateFrom', e.target.value)}
            className="w-full pl-7 pr-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input type="date" value={filters.dateTo} onChange={e => set('dateTo', e.target.value)}
            className="w-full pl-7 pr-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </div>
  )
}
