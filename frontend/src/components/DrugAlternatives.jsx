import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Pill, Loader2, AlertCircle, Leaf, ExternalLink } from 'lucide-react'

const JAN_AUSHADHI_KEYWORDS = ['jan aushadhi', 'generic', 'pmbjp', 'pradhan mantri']

function isJanAushadhi(brand) {
  const lower = (brand || '').toLowerCase()
  return JAN_AUSHADHI_KEYWORDS.some(k => lower.includes(k))
}

function ScheduleBadge({ schedule }) {
  if (!schedule) return null
  const styles = {
    OTC: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    H: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    H1: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${styles[schedule] || styles.OTC}`}>
      {schedule}
    </span>
  )
}

export default function DrugAlternatives({ drugName, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const backdropRef = useRef(null)

  const fetchAlternatives = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/drugs/${encodeURIComponent(drugName)}/alternatives`)
      if (!res.ok) {
        if (res.status === 404) {
          setError(`"${drugName}" not found in drug database`)
        } else {
          setError(`Failed to fetch alternatives (${res.status})`)
        }
        return
      }
      setData(await res.json())
    } catch (err) {
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [drugName])

  useEffect(() => {
    fetchAlternatives()
  }, [fetchAlternatives])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Drug alternatives for ${drugName}`}
    >
      <div className="bg-white dark:bg-slate-800 w-full sm:w-[520px] sm:max-w-[90vw] max-h-[85vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
              <Pill className="w-4 h-4 text-rose-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                {drugName}
              </h3>
              {data && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  {data.generic} {data.category ? `\u2022 ${data.category}` : ''}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-sm">Loading alternatives...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <AlertCircle className="w-6 h-6 mb-2 text-amber-500" />
              <span className="text-sm text-center">{error}</span>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Drug info card */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200/60 dark:border-slate-600/40 p-3.5 mb-4">
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px]">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] font-medium">Generic</span>
                    <p className="text-slate-700 dark:text-slate-200 font-medium mt-0.5">{data.generic || '\u2014'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] font-medium">RxNorm</span>
                    <p className="text-slate-700 dark:text-slate-200 font-mono mt-0.5">{data.rxnorm_cui || '\u2014'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] font-medium">Category</span>
                    <p className="text-slate-700 dark:text-slate-200 mt-0.5">{data.category || '\u2014'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] font-medium">Dosage</span>
                    <p className="text-slate-700 dark:text-slate-200 mt-0.5">{data.dosage || '\u2014'}</p>
                  </div>
                  {data.use && (
                    <div className="col-span-2">
                      <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] font-medium">Indication</span>
                      <p className="text-slate-700 dark:text-slate-200 mt-0.5">{data.use}</p>
                    </div>
                  )}
                  {data.schedule && (
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] font-medium">Schedule</span>
                      <div className="mt-1"><ScheduleBadge schedule={data.schedule} /></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Alternatives table */}
              {data.alternatives?.length > 0 ? (
                <>
                  <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Alternatives ({data.alternatives.length})
                  </h4>
                  <div className="rounded-xl border border-slate-200/60 dark:border-slate-600/40 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-700/40 text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                          <th className="text-left py-2 px-3">Brand</th>
                          <th className="text-left py-2 px-3 hidden sm:table-cell">Generic</th>
                          <th className="text-left py-2 px-3">Category</th>
                          <th className="text-left py-2 px-3 hidden sm:table-cell">Dosage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.alternatives.map((alt, i) => {
                          const janAushadhi = isJanAushadhi(alt.brand)
                          return (
                            <tr
                              key={i}
                              className={`border-t border-slate-100 dark:border-slate-700/40 ${
                                i % 2 === 0 ? 'bg-white dark:bg-slate-800/40' : 'bg-slate-50/50 dark:bg-slate-700/20'
                              }`}
                            >
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-slate-700 dark:text-slate-200 text-[13px]">
                                    {alt.brand}
                                  </span>
                                  {janAushadhi && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                                      <Leaf className="w-2.5 h-2.5" />
                                      Jan Aushadhi
                                    </span>
                                  )}
                                </div>
                                {/* Mobile: show generic below brand */}
                                <div className="sm:hidden text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  {alt.generic || '\u2014'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[12px] hidden sm:table-cell">
                                {alt.generic || '\u2014'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[12px]">
                                {alt.category || '\u2014'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[12px] hidden sm:table-cell">
                                {alt.dosage || '\u2014'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <Pill className="w-5 h-5 mx-auto mb-1.5 opacity-50" />
                  <p className="text-sm">No alternatives found in database</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
