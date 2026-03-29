import { useState, useEffect, useRef } from 'react'
import { WifiOff, AlertTriangle, X } from 'lucide-react'

export default function HealthBanner() {
  const [status, setStatus] = useState(null) // null | 'unreachable' | 'no_gemini'
  const [dismissed, setDismissed] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) })
        if (!res.ok) {
          setStatus('unreachable')
          return
        }
        const data = await res.json()
        if (data.gemini_configured === false) {
          setStatus('no_gemini')
        } else {
          setStatus(null)
          setDismissed(false)
        }
      } catch {
        setStatus('unreachable')
      }
    }

    checkHealth()
    intervalRef.current = setInterval(checkHealth, 10000)
    return () => clearInterval(intervalRef.current)
  }, [])

  if (!status || dismissed) return null

  const isUnreachable = status === 'unreachable'
  const bgClass = isUnreachable
    ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
  const textClass = isUnreachable
    ? 'text-red-700 dark:text-red-400'
    : 'text-amber-700 dark:text-amber-400'
  const Icon = isUnreachable ? WifiOff : AlertTriangle
  const message = isUnreachable
    ? 'Backend unavailable — start the server with: npm run backend'
    : 'GEMINI_API_KEY not set — clinical extraction will not work'

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${bgClass}`}>
      <Icon className={`w-4 h-4 shrink-0 ${textClass}`} />
      <p className={`text-sm font-medium flex-1 ${textClass}`}>{message}</p>
      <button
        onClick={() => setDismissed(true)}
        className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${textClass}`}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
