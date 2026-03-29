import { ShieldCheck, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ConsentBanner({ onConsent, consented }) {
  const [showDetails, setShowDetails] = useState(false)

  // Persist consent in sessionStorage
  useEffect(() => {
    if (consented) {
      sessionStorage.setItem('medscribe_consent', 'true')
    }
  }, [consented])

  if (consented) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/50"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Consent Recorded
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 border-l-4 border-l-blue-600 dark:border-l-blue-400 overflow-hidden"
      role="alert"
      aria-live="polite"
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="font-medium text-slate-900 dark:text-white">Patient consent:&nbsp;</span>
            This session records and processes the conversation using AI. No audio is stored.
          </p>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2"
              >
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
                  <li>Speech is processed in real-time and not persisted as audio</li>
                  <li>Clinical notes are generated on-device and can be exported as FHIR R4</li>
                  <li>All data is encrypted in transit (TLS) and at rest (AES-256)</li>
                  <li>Session data is cleared when the browser tab is closed</li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-2.5 flex items-center gap-3">
            <button
              onClick={onConsent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 active:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              I Consent
            </button>
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors focus:outline-none focus:underline"
            >
              {showDetails ? 'Hide Details' : 'Learn More'}
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
