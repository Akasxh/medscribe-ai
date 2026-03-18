import { useState } from 'react'
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react'

const gradeConfig = {
  A: { bg: 'bg-emerald-500', text: 'text-white', label: 'A' },
  B: { bg: 'bg-blue-500', text: 'text-white', label: 'B' },
  C: { bg: 'bg-amber-500', text: 'text-white', label: 'C' },
  D: { bg: 'bg-red-500', text: 'text-white', label: 'D' },
}

const gradeExpandedColors = {
  A: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20',
  B: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20',
  C: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20',
  D: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20',
}

export default function FHIRQualityBadge({ quality, inline = false }) {
  const [expanded, setExpanded] = useState(false)

  if (!quality) return null

  const { score, grade, total_resources, checks = [] } = quality
  const config = gradeConfig[grade] || gradeConfig.C
  const expandedColor = gradeExpandedColors[grade] || gradeExpandedColors.C

  // Inline mode: compact badge for embedding in headers
  if (inline) {
    return (
      <div className="relative">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 transition-colors"
        >
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">FHIR</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.bg} ${config.text} leading-none`}>
            {config.label}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{score}%</span>
        </button>

        {expanded && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
            <div className={`absolute right-0 top-full mt-1 z-50 w-64 border rounded-lg p-3 shadow-lg ${expandedColor}`}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                  Grade {config.label}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {score}% — {total_resources} resources
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {checks.map((check, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    {check.passed ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <span className={`${check.passed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                      {check.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // Full card mode
  return (
    <div className={`border rounded-xl overflow-hidden ${expandedColor}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center gap-3 text-left"
      >
        <span className={`text-lg font-bold px-2.5 py-0.5 rounded-lg ${config.bg} ${config.text}`}>
          {config.label}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{score}%</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">FHIR R4 Compliance</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{total_resources} resources</p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-200/50 dark:border-slate-700/50">
          <div className="grid grid-cols-2 gap-1 mt-2">
            {checks.map((check, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                {check.passed ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                )}
                <span className={`${check.passed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                  {check.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
