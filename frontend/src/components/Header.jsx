import { Activity, Moon, Sun, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Header() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    return false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <header className="sticky top-0 z-50" role="banner">
      {/* Accent gradient line */}
      <div className="h-0.5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} aria-hidden="true" />
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white hidden sm:block">
              MedScribe<span className="text-blue-600 dark:text-blue-400 ml-0.5">AI</span>
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* ABDM-Ready badge */}
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
              <ShieldCheck className="w-3 h-3" />
              ABDM-Ready
            </span>

            {/* Hackmatrix badge — subtle */}
            <span className="hidden md:inline-flex text-[9px] font-medium text-slate-400 dark:text-slate-500 tracking-wide uppercase px-1.5">
              HACKMATRIX 2.0
            </span>

            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(!dark)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
