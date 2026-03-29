import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react'

const TOAST_DURATION = 4000

const typeConfig = {
  success: {
    icon: CheckCircle,
    accent: 'bg-emerald-500',
    iconColor: 'text-emerald-500',
  },
  warning: {
    icon: AlertTriangle,
    accent: 'bg-amber-500',
    iconColor: 'text-amber-500',
  },
  error: {
    icon: XCircle,
    accent: 'bg-red-500',
    iconColor: 'text-red-500',
  },
  critical: {
    icon: XCircle,
    accent: 'bg-red-500',
    iconColor: 'text-red-500',
  },
  info: {
    icon: Info,
    accent: 'bg-blue-500',
    iconColor: 'text-blue-500',
  },
}

let addToastGlobal = null

export function showToast(message, type = 'info') {
  if (addToastGlobal) addToastGlobal({ message, type, id: Date.now() })
}

function ToastItem({ toast, onDismiss }) {
  const config = typeConfig[toast.type] || typeConfig.info
  const Icon = config.icon
  const progressRef = useRef(null)

  useEffect(() => {
    // Animate the progress bar
    if (progressRef.current) {
      progressRef.current.style.transition = `width ${TOAST_DURATION}ms linear`
      // Force reflow then set to 0
      progressRef.current.getBoundingClientRect()
      progressRef.current.style.width = '0%'
    }
  }, [])

  return (
    <div className="animate-toast-in bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden max-w-sm w-full">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Left accent bar */}
        <div className={`w-1 self-stretch rounded-full ${config.accent} flex-shrink-0`} />
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
        <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 leading-snug">
          {toast.message}
        </p>
        <button
          onClick={() => onDismiss(toast.id)}
          className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-slate-100 dark:bg-slate-700">
        <div
          ref={progressRef}
          className={`h-full ${config.accent} opacity-40`}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  )
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    setToasts(prev => [...prev.slice(-3), toast]) // Keep max 4 toasts
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id))
    }, TOAST_DURATION)
  }, [])

  useEffect(() => {
    addToastGlobal = addToast
    return () => { addToastGlobal = null }
  }, [addToast])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-16 right-4 z-[60] space-y-2 flex flex-col items-end">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  )
}
