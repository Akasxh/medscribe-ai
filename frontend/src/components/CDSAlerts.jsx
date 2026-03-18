import { AlertOctagon, AlertTriangle, Info, ShieldCheck, ChevronRight, Pill } from 'lucide-react'
import { useState } from 'react'

const severityConfig = {
  critical: {
    icon: AlertOctagon,
    bg: 'bg-red-50/80 dark:bg-red-950/20',
    border: 'border-l-red-500',
    outerBorder: 'border-red-200/70 dark:border-red-800/50',
    text: 'text-red-800 dark:text-red-300',
    badgeBg: 'bg-red-500',
    label: 'CRITICAL',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50/80 dark:bg-amber-950/20',
    border: 'border-l-amber-500',
    outerBorder: 'border-amber-200/70 dark:border-amber-800/50',
    text: 'text-amber-800 dark:text-amber-300',
    badgeBg: 'bg-amber-500',
    label: 'WARNING',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50/80 dark:bg-blue-950/20',
    border: 'border-l-blue-500',
    outerBorder: 'border-blue-200/70 dark:border-blue-800/50',
    text: 'text-blue-800 dark:text-blue-300',
    badgeBg: 'bg-blue-500',
    label: 'INFO',
  },
}

function AlertCard({ alert }) {
  const isCritical = alert.severity === 'critical'
  const [expanded, setExpanded] = useState(isCritical)
  const config = severityConfig[alert.severity] || severityConfig.info
  const Icon = config.icon

  return (
    <div
      className={`border-l-[3px] ${config.border} border ${config.outerBorder} ${config.bg} rounded-r-lg rounded-l overflow-hidden transition-all animate-slide-up`}
    >
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => !isCritical && setExpanded(!expanded)}
      >
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-semibold ${config.text} leading-tight`}>
              {alert.title}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.badgeBg} text-white uppercase tracking-wider leading-none`}>
              {config.label}
            </span>
          </div>

          {expanded && (
            <div className="mt-2 space-y-2 animate-slide-up">
              <p className={`text-[12px] leading-relaxed ${config.text} opacity-85`}>
                {alert.description}
              </p>
              {alert.medications_involved?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {alert.medications_involved.map((med, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-600/30 font-medium text-slate-700 dark:text-slate-300"
                    >
                      <Pill className="w-3 h-3 text-slate-400" />
                      {med}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {!isCritical && (
          <ChevronRight
            className={`w-3.5 h-3.5 mt-0.5 ${config.text} opacity-50 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-90' : ''}`}
          />
        )}
      </div>
    </div>
  )
}

export default function CDSAlerts({ alerts = [] }) {
  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length
  const infoCount = alerts.filter(a => a.severity === 'info').length

  // No alerts: show all-clear state
  if (!alerts.length) {
    return (
      <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">All Clear</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">No clinical safety alerts detected</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Clinical Decision Support Alerts"
      className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        <h2 className="text-[13px] font-semibold text-slate-800 dark:text-white tracking-tight">Clinical Safety</h2>

        <div className="flex gap-1 ml-auto">
          {criticalCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white leading-none">
              {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white leading-none">
              {warningCount}
            </span>
          )}
          {infoCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500 text-white leading-none">
              {infoCount}
            </span>
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="p-3 space-y-2">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  )
}
