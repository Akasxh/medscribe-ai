import { Languages, Server, ChevronDown } from 'lucide-react'

const LANGUAGES = [
  { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { code: 'en-IN', label: 'English', native: 'English' },
  { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
]

export default function LanguageSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <Languages className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-2 min-h-[40px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer appearance-none"
          aria-label="Speech recognition language"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.native} — {lang.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 rounded-md border border-violet-200 dark:border-violet-800">
        <Server className="w-3 h-3" />
        Sarvam AI
      </span>
    </div>
  )
}

export { LANGUAGES }
