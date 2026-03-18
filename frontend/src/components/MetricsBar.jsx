import { Clock, TrendingUp, Brain, Zap, ShieldCheck } from 'lucide-react'

export default function MetricsBar({ elapsed, wordCount, resourceCount, processing, visible = true }) {
  const manualTimeMin = 10
  const aiTimeSec = elapsed

  const formatTime = (sec) => {
    if (sec <= 0) return '--'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const pills = [
    {
      icon: Clock,
      value: aiTimeSec > 0 ? formatTime(aiTimeSec) : '--',
      label: 'Time',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: Brain,
      value: wordCount > 0 ? String(wordCount) : '--',
      label: 'Words',
      color: 'text-violet-600 dark:text-violet-400',
    },
    {
      icon: TrendingUp,
      value: resourceCount > 0 ? String(resourceCount) : '--',
      label: 'FHIR',
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: processing ? Zap : ShieldCheck,
      value: processing ? 'Live' : (resourceCount > 0 ? 'Pass' : '--'),
      label: 'Status',
      color: processing ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400',
    },
  ]

  // Don't render if explicitly hidden or all values are placeholder
  if (!visible) return null
  const allEmpty = pills.every((p) => p.value === '--')
  if (allEmpty) return null

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1"
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {pills.map(({ icon: Icon, value, label, color }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 min-w-fit flex-shrink-0"
        >
          <Icon className={`w-3 h-3 ${color} flex-shrink-0`} />
          <span className={`text-xs sm:text-sm font-semibold ${color} leading-none`}>{value}</span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-none">{label}</span>
        </div>
      ))}
    </div>
  )
}
