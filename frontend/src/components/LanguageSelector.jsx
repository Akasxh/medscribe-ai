import { Languages } from 'lucide-react'

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

export default function LanguageSelector({ value, onChange }) {
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
    </div>
  )
}

export { LANGUAGES }
