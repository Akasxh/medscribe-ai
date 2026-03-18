import { useState } from 'react'
import { Activity, User, Building2, Hash } from 'lucide-react'

export default function UserRegistration({ onRegister }) {
  const [name, setName] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [hospital, setHospital] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name')
      return
    }

    const user = {
      name: trimmed,
      doctorId: doctorId.trim() || null,
      hospital: hospital.trim() || null,
      registeredAt: new Date().toISOString(),
    }

    localStorage.setItem('medscribe_user', JSON.stringify(user))
    onRegister(user)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              MedScribe<span className="text-blue-600 dark:text-blue-400">AI</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">Ambient AI Scribe</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Welcome to MedScribe AI</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enter your details to begin</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Doctor's Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Doctor's Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  placeholder="Dr. Sharma"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Doctor ID */}
            <div>
              <label htmlFor="reg-id" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Doctor ID / Registration Number
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="reg-id"
                  type="text"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  placeholder="MCI-12345"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Hospital / Clinic */}
            <div>
              <label htmlFor="reg-hospital" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Hospital / Clinic Name
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="reg-hospital"
                  type="text"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  placeholder="City General Hospital"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              Start
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Your data is stored locally on this device only.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-[10px] text-slate-400 dark:text-slate-600">
          HACKMATRIX 2.0 — Jilo Health x NJACK IIT Patna
        </p>
      </div>
    </div>
  )
}
