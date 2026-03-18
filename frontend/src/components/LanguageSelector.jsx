import { Languages, Mic, Server } from 'lucide-react'

const LANGUAGES = [
  { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { code: 'en-IN', label: 'English (IN)', native: 'English' },
  { code: 'en-US', label: 'English (US)', native: 'English' },
  { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
  { code: 'bn-IN', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr-IN', label: 'Marathi', native: 'मराठी' },
  { code: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം' },
]

export default function LanguageSelector({ value, onChange, useSarvam, onSarvamChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Languages className="w-4 h-4 text-slate-400 shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 min-h-[40px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer appearance-none"
        aria-label="Speech recognition language"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.native} — {lang.label}
          </option>
        ))}
      </select>

      {/* STT provider toggle */}
      <button
        onClick={() => onSarvamChange?.(!useSarvam)}
        className={`flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-all ${
          useSarvam
            ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
        }`}
        title={useSarvam ? 'Using Sarvam AI (server-side, all browsers)' : 'Using Browser STT (Chrome only)'}
        aria-label="Toggle STT provider"
      >
        {useSarvam ? (
          <>
            <Server className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sarvam AI</span>
            <span className="sm:hidden">AI</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Browser STT</span>
            <span className="sm:hidden">Browser</span>
          </>
        )}
      </button>
    </div>
  )
}

export { LANGUAGES }
