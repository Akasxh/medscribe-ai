import { useMemo, useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { BarChart3 } from 'lucide-react'

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444']

function detectLanguage(text) {
  if (!text) return 'Unknown'
  const devanagariRe = /[\u0900-\u097F]/
  const hasHindi = devanagariRe.test(text)
  const hasEnglish = /[a-zA-Z]/.test(text)
  if (hasHindi && hasEnglish) return 'Hindi-English'
  if (hasHindi) return 'Hindi'
  if (hasEnglish) return 'English'
  return 'Other'
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

function tooltipStyle(isDark) {
  return {
    background: isDark ? '#1e293b' : '#ffffff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: isDark ? '#f1f5f9' : '#0f172a',
  }
}

export default function AnalyticsPanel({ sessions }) {
  const isDark = useDarkMode()
  const tickFill = isDark ? '#94a3b8' : '#64748b'

  // Consultations per day
  const perDay = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const day = new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      map[day] = (map[day] || 0) + 1
    })
    return Object.entries(map)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => {
        const parseDay = (d) => new Date(d + ', ' + new Date().getFullYear())
        return parseDay(a.day) - parseDay(b.day)
      })
      .slice(-7)
  }, [sessions])

  // Top diagnoses
  const topDx = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const dxList = s.clinical_note?.diagnosis || []
      dxList.forEach(d => {
        const name = d.condition || 'Unknown'
        if (name) map[name] = (map[name] || 0) + 1
      })
    })
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [sessions])

  // Language distribution
  const langDist = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const lang = detectLanguage(s.transcript)
      map[lang] = (map[lang] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [sessions])

  // Specialty distribution
  const specialtyDist = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const spec = s.specialty || s.clinical_note?.specialty || 'General'
      map[spec] = (map[spec] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [sessions])

  // Drug frequency (top 8)
  const drugFreq = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const meds = s.clinical_note?.medications || []
      meds.forEach(m => {
        const name = m.generic_name || m.name || m.drug || 'Unknown'
        if (name && name !== 'Unknown') map[name] = (map[name] || 0) + 1
      })
    })
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [sessions])

  if (sessions.length === 0) {
    return (
      <div className="card rounded-2xl p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
        <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No analytics data yet</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Complete some consultations to see charts</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Consultations per day + Top diagnoses + Language */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Consultations per day */}
        <div className="card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Consultations / Day</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDay}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: tickFill }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                <Tooltip contentStyle={tooltipStyle(isDark)} />
                <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top diagnoses */}
        <div className="card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Top Diagnoses</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDx} layout="vertical">
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: tickFill }} width={100} />
                <Tooltip contentStyle={tooltipStyle(isDark)} />
                <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Language distribution */}
        <div className="card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Language Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={langDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={({ name, percent, x, y, textAnchor }) => (
                    <text x={x} y={y} textAnchor={textAnchor} fill={tickFill} fontSize={10}>
                      {`${name} ${(percent * 100).toFixed(0)}%`}
                    </text>
                  )}
                  labelLine={false}
                >
                  {langDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle(isDark)} />
                <Legend wrapperStyle={{ fontSize: '11px', color: tickFill }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Specialty distribution + Drug frequency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Specialty distribution */}
        <div className="card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Specialty Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={specialtyDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={({ name, percent, x, y, textAnchor }) => (
                    <text x={x} y={y} textAnchor={textAnchor} fill={tickFill} fontSize={10}>
                      {`${name} ${(percent * 100).toFixed(0)}%`}
                    </text>
                  )}
                  labelLine={false}
                >
                  {specialtyDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle(isDark)} />
                <Legend wrapperStyle={{ fontSize: '11px', color: tickFill }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Drug frequency */}
        <div className="card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Most Prescribed Drugs</h3>
          <div className="h-48">
            {drugFreq.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={drugFreq} layout="vertical">
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: tickFill }} width={110} />
                  <Tooltip contentStyle={tooltipStyle(isDark)} />
                  <Bar dataKey="count" fill="#EC4899" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                No prescription data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
