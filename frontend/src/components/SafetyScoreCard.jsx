import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, ChevronDown, ChevronUp, TrendingDown, Minus } from 'lucide-react'

const LEVEL_CONFIG = {
  safe: {
    color: '#10B981',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'SAFE',
  },
  caution: {
    color: '#F59E0B',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'CAUTION',
  },
  warning: {
    color: '#F97316',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    text: 'text-orange-700 dark:text-orange-400',
    label: 'WARNING',
  },
  critical: {
    color: '#EF4444',
    bg: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-700 dark:text-red-400',
    label: 'CRITICAL',
  },
}

const CIRCUMFERENCE = 2 * Math.PI * 45 // ~282.74

export default function SafetyScoreCard({ score = 100, level = 'safe', breakdown = [] }) {
  const [expanded, setExpanded] = useState(false)
  const [animatedOffset, setAnimatedOffset] = useState(CIRCUMFERENCE)
  const mountedRef = useRef(false)

  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.safe

  // Animate the ring on mount and score changes
  useEffect(() => {
    const targetOffset = CIRCUMFERENCE - (CIRCUMFERENCE * score / 100)
    // Small delay to trigger CSS transition
    const timer = setTimeout(() => {
      setAnimatedOffset(targetOffset)
      mountedRef.current = true
    }, mountedRef.current ? 0 : 100)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Patient Safety Score</h3>
      </div>

      <div className="p-4 flex flex-col items-center gap-3">
        {/* SVG Ring */}
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-100 dark:text-slate-700"
            />
            {/* Score ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={config.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={animatedOffset}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          {/* Score text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-slate-900 dark:text-white leading-none">
              {score}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              / 100
            </span>
          </div>
        </div>

        {/* Level badge */}
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide ${config.bg} ${config.text}`}>
          {config.label}
        </span>

        {/* Breakdown toggle */}
        {breakdown.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            {expanded ? 'Hide' : 'Show'} breakdown
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}

        {/* Breakdown list */}
        {expanded && breakdown.length > 0 && (
          <div className="w-full space-y-1.5 animate-slide-up">
            {breakdown.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50"
              >
                {item.delta < 0 ? (
                  <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
                ) : (
                  <Minus className="w-3 h-3 text-slate-400 shrink-0" />
                )}
                <span className="flex-1 text-slate-600 dark:text-slate-400">{item.label}</span>
                <span className={`font-mono font-semibold ${item.delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                  {item.delta < 0 ? item.delta : '--'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
