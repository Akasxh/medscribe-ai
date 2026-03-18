import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  const handleInstall = async () => {
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  return (
    <div className="w-full px-4 py-2">
      <div className="max-w-lg mx-auto rounded-lg px-3 py-2 flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
        <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-0">
          Install <span className="font-semibold">MedScribe AI</span> for quick access
        </p>
        <button
          onClick={handleInstall}
          className="px-3 py-2 min-h-[44px] min-w-[44px] bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex-shrink-0"
        >
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex-shrink-0"
          aria-label="Dismiss install prompt"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  )
}
