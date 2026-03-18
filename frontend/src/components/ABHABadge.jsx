import { useState, useCallback, useRef, useEffect } from 'react'
import { Shield, ChevronDown, ChevronUp, Check, X } from 'lucide-react'

export default function ABHABadge({ onAbhaIdChange }) {
  const [expanded, setExpanded] = useState(false)
  const [abhaId, setAbhaId] = useState('')
  const [saved, setSaved] = useState(false)
  const popoverRef = useRef(null)

  // Close popover on outside click
  useEffect(() => {
    if (!expanded) return
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  const handleSave = useCallback(() => {
    const cleaned = abhaId.replace(/\D/g, '').slice(0, 14)
    if (cleaned.length === 14) {
      setAbhaId(cleaned)
      setSaved(true)
      if (onAbhaIdChange) onAbhaIdChange(cleaned)
    }
  }, [abhaId, onAbhaIdChange])

  const handleClear = useCallback(() => {
    setAbhaId('')
    setSaved(false)
    if (onAbhaIdChange) onAbhaIdChange(null)
  }, [onAbhaIdChange])

  const formatAbhaDisplay = (id) => {
    if (!id) return ''
    // Format as XX-XXXX-XXXX-XXXX
    const d = id.replace(/\D/g, '')
    const parts = [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10), d.slice(10, 14)].filter(Boolean)
    return parts.join('-')
  }

  return (
    <div className="relative" ref={popoverRef}>
      {/* Badge button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
          saved
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
            : 'bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
        }`}
      >
        <Shield className="w-3.5 h-3.5" />
        <span>ABDM Ready</span>
        {saved && <Check className="w-3 h-3" />}
        {expanded ? (
          <ChevronUp className="w-3 h-3 opacity-60" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-60" />
        )}
      </button>

      {/* Popover */}
      {expanded && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-50 animate-slide-up overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Ayushman Bharat Digital Mission
                </h4>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
                  ABDM Compliant Health Records
                </p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="px-4 py-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                This consultation generates FHIR R4 compliant health records
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Compatible with Ayushman Bharat Digital Mission (ABDM)
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Patient records can be linked via ABHA Health ID
              </p>
            </div>
          </div>

          {/* ABHA ID input */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              ABHA Health ID (optional)
            </label>
            {saved ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatAbhaDisplay(abhaId)}
                </div>
                <button
                  onClick={handleClear}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Clear ABHA ID"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={abhaId}
                  onChange={(e) => setAbhaId(e.target.value.replace(/\D/g, '').slice(0, 14))}
                  placeholder="14-digit ABHA number"
                  maxLength={14}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:focus:ring-emerald-600 text-slate-900 dark:text-white"
                />
                <button
                  onClick={handleSave}
                  disabled={abhaId.replace(/\D/g, '').length !== 14}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                >
                  Link
                </button>
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              {saved
                ? 'ABHA ID will be included in FHIR Patient resource'
                : 'Enter the patient\'s 14-digit ABHA number to link records'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
