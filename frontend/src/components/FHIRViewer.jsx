import { useState, useCallback } from 'react'
import {
  FileJson, ChevronRight, Copy, Check, Database, Download,
  User, Stethoscope, AlertTriangle, Activity, Pill, ShieldAlert,
  CalendarCheck, FlaskConical
} from 'lucide-react'
import { RESOURCE_COLORS, getResourceSummary, getResourceIcon } from '../utils/fhirTemplates'
import FHIRQualityBadge from './FHIRQualityBadge'

const ICON_MAP = {
  User, Stethoscope, AlertTriangle, Activity, Pill, ShieldAlert,
  CalendarCheck, FlaskConical, FileJson
}

// ─── Syntax-highlighted JSON (safe, no innerHTML) ───
function SyntaxJSON({ data }) {
  const json = JSON.stringify(data, null, 2)

  // Tokenize and render with React elements instead of dangerouslySetInnerHTML
  const tokens = []
  const regex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false)|(null)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(json)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      tokens.push(json.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined) {
      // Key
      tokens.push(<span key={match.index} className="text-blue-600 dark:text-blue-400">{match[1]}</span>)
      tokens.push(':')
    } else if (match[2] !== undefined) {
      // String value
      tokens.push(<span key={match.index} className="text-emerald-600 dark:text-emerald-400">{match[2]}</span>)
    } else if (match[3] !== undefined) {
      // Number
      tokens.push(<span key={match.index} className="text-amber-600 dark:text-amber-400">{match[3]}</span>)
    } else if (match[4] !== undefined) {
      // Boolean
      tokens.push(<span key={match.index} className="text-purple-600 dark:text-purple-400">{match[4]}</span>)
    } else if (match[5] !== undefined) {
      // Null
      tokens.push(<span key={match.index} className="text-slate-400 dark:text-slate-500">{match[5]}</span>)
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < json.length) {
    tokens.push(json.slice(lastIndex))
  }

  return (
    <pre className="fhir-json text-[12px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
      {tokens}
    </pre>
  )
}

function ResourceCard({ resource, index }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const type = resource.resourceType
  const colors = RESOURCE_COLORS[type] || RESOURCE_COLORS.Patient
  const iconName = getResourceIcon(type)
  const IconComponent = ICON_MAP[iconName] || FileJson
  const summary = getResourceSummary(resource)

  const handleCopy = useCallback((e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(JSON.stringify(resource, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [resource])

  return (
    <div
      className={`border-l-[3px] ${colors.accent} border border-slate-200/70 dark:border-slate-700/50 rounded-r-lg rounded-l overflow-hidden transition-all duration-200 animate-slide-up bg-white dark:bg-slate-800/50`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors"
      >
        <IconComponent className={`w-4 h-4 ${colors.text} ${colors.dark?.text} shrink-0`} />
        <div className="flex-1 min-w-0">
          <span className={`text-[12px] font-semibold ${colors.text} ${colors.dark?.text}`}>{type}</span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{summary}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600/50 transition-colors"
            title="Copy JSON"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
          </button>
          <ChevronRight
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/40 p-3">
          <SyntaxJSON data={resource} />
        </div>
      )}
    </div>
  )
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function FHIRViewer({ bundle, quality }) {
  const [showRawBundle, setShowRawBundle] = useState(false)

  if (!bundle) {
    return (
      <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
          <Database className="w-10 h-10 mb-3 opacity-40 stroke-[1.5]" />
          <p className="text-sm font-medium">FHIR R4 resources will appear here</p>
          <p className="text-xs mt-1.5 text-slate-400/70 dark:text-slate-600">
            Interoperable healthcare data in real-time
          </p>
        </div>
      </div>
    )
  }

  const entries = bundle.entry || []
  const resourceTypes = [...new Set(entries.map(e => e.resource?.resourceType))]

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
        <FileJson className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-[13px] font-semibold text-slate-800 dark:text-white tracking-tight">FHIR R4 Bundle</h2>
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
          {entries.length}
        </span>

        {quality && <FHIRQualityBadge quality={quality} inline />}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => downloadJSON(bundle, `fhir-bundle-${new Date().toISOString().slice(0, 10)}.json`)}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors px-1.5 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/30"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={() => setShowRawBundle(!showRawBundle)}
            className="text-[11px] text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors px-1.5 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/30"
          >
            {showRawBundle ? 'Cards' : 'Raw JSON'}
          </button>
        </div>
      </div>

      {/* Resource type pills */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-slate-100/80 dark:border-slate-700/40">
        {resourceTypes.map(type => {
          const colors = RESOURCE_COLORS[type]
          const count = entries.filter(e => e.resource?.resourceType === type).length
          return (
            <span key={type} className={`text-[10px] px-2 py-0.5 rounded font-medium ${colors?.badge || 'bg-slate-100 text-slate-600'}`}>
              {type} {count > 1 ? `(${count})` : ''}
            </span>
          )
        })}
      </div>

      {/* Content */}
      <div className="p-3">
        {showRawBundle ? (
          <div className="bg-slate-50/50 dark:bg-slate-900/40 rounded-lg p-3 max-h-[500px] overflow-y-auto">
            <SyntaxJSON data={bundle} />
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <ResourceCard key={entry.resource?.id || i} resource={entry.resource} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
