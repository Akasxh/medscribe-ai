import { useMemo, useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { BarChart3 } from 'lucide-react'

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444']

// Detect Hindi (Devanagari script) in transcript text
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

export default function AnalyticsPanel({ sessions }) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

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
        // Parse "Mon DD" back to comparable dates
        const parseDay = (d) => new Date(d + ', ' + new Date().getFullYear())
        return parseDay(a.day) - parseDay(b.day)
      })
      .slice(-7) // last 7 days
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Consultations per day */}
      <div className="card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Consultations / Day</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perDay}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
              <Tooltip
                contentStyle={{
                  background: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                }}
              />
              <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top diagnoses — horizontal bar */}
      <div className="card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Top Diagnoses</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topDx} layout="vertical">
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} width={100} />
              <Tooltip
                contentStyle={{
                  background: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                }}
              />
              <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Language distribution — pie */}
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
                  <text x={x} y={y} textAnchor={textAnchor} fill={isDark ? '#94a3b8' : '#64748b'} fontSize={10}>
                    {`${name} ${(percent * 100).toFixed(0)}%`}
                  </text>
                )}
                labelLine={false}
              >
                {langDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
