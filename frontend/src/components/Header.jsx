import { Moon, Sun, ShieldCheck, LogOut, User } from 'lucide-react'
import { useState, useEffect } from 'react'
import { InstallButton } from './InstallPrompt'

export default function Header({ user, onLogout }) {
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
            <img src="/icons/logo.svg" alt="MedScribe AI" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              MedScribe<span className="text-blue-600 dark:text-blue-400 ml-0.5 hidden sm:inline">AI</span>
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Doctor info */}
            {user && (
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                    {user.name}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    aria-label="Change Doctor"
                    title="Change Doctor"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Install App button */}
            <InstallButton />

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
