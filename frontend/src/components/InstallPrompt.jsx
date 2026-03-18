import { useState, useEffect, useCallback } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

// Shared state so Header can trigger install too
let _deferredPrompt = null
let _listeners = []

function notifyListeners() {
  _listeners.forEach(fn => fn(_deferredPrompt))
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(_deferredPrompt)

  useEffect(() => {
    _listeners.push(setPrompt)
    return () => {
      _listeners = _listeners.filter(fn => fn !== setPrompt)
    }
  }, [])

  const install = useCallback(async () => {
    if (!_deferredPrompt) return false
    _deferredPrompt.prompt()
    const result = await _deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      _deferredPrompt = null
      notifyListeners()
    }
    return result.outcome === 'accepted'
  }, [])

  return { canInstall: !!prompt, install }
}

// Small inline install button — use in Header or anywhere
export function InstallButton({ className = '' }) {
  const { canInstall, install } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <button
      onClick={install}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors ${className}`}
      title="Install MedScribe AI as an app"
    >
      <Download className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Install App</span>
    </button>
  )
}

// Banner version — shown on landing page
export default function InstallPrompt() {
  const [dismissed, setDismissed] = useState(false)
  const { canInstall, install } = useInstallPrompt()

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      _deferredPrompt = e
      notifyListeners()
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Always show install guidance on mobile (even without beforeinstallprompt)
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone)

  // Don't show if already installed as PWA or dismissed
  if (isStandalone || dismissed) return null

  // Show native install if available
  if (canInstall) {
    return (
      <div className="w-full px-3 py-2">
        <div className="max-w-lg mx-auto rounded-lg px-3 py-2 flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
          <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-0">
            Install <span className="font-semibold">MedScribe AI</span> for quick access
          </p>
          <button
            onClick={install}
            className="px-3 py-2 min-h-[44px] bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex-shrink-0"
          >
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    )
  }

  // On mobile without native prompt (iOS Safari), show manual instructions
  if (isMobile) {
    return (
      <div className="w-full px-3 py-2">
        <div className="max-w-lg mx-auto rounded-lg px-3 py-2 flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
          <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-xs text-slate-600 dark:text-slate-400 flex-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Add to Home Screen</span> — tap Share → "Add to Home Screen"
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    )
  }

  return null
}
