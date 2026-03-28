import { useState } from 'react'
import { Activity, User, Building2, Hash, ShieldCheck, Mail, Lock, ArrowLeftRight } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import useSupabaseAuth from '../hooks/useSupabaseAuth'

export default function UserRegistration({ onRegister }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [hospital, setHospital] = useState('')
  const [patientName, setPatientName] = useState('')
  const [role, setRole] = useState('doctor')
  const [error, setError] = useState('')
  const [isSignIn, setIsSignIn] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { signUp, signIn } = useSupabaseAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // --- Supabase sign-in mode ---
    if (isSupabaseConfigured && isSignIn) {
      if (!email.trim() || !password) {
        setError('Email and password are required')
        return
      }
      setSubmitting(true)
      try {
        const data = await signIn({ email: email.trim(), password })
        const user = data.user
        // Also store in localStorage for ProtectedRoute compat
        const localUser = {
          name: user.user_metadata?.full_name || email.split('@')[0],
          email: user.email,
          role: user.user_metadata?.role || 'doctor',
          hospital: user.user_metadata?.hospital || null,
          doctorId: null,
          patientName: null,
          registeredAt: new Date().toISOString(),
          supabaseId: user.id,
        }
        localStorage.setItem('medscribe_user', JSON.stringify(localUser))
        onRegister(localUser)
      } catch (err) {
        setError(err.message || 'Sign-in failed')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // --- Sign-up / registration ---
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name')
      return
    }

    // If Supabase is configured, require email + password for sign-up
    if (isSupabaseConfigured) {
      if (!email.trim()) {
        setError('Email is required')
        return
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }

      setSubmitting(true)
      try {
        const data = await signUp({
          email: email.trim(),
          password,
          fullName: trimmed,
          role,
          hospital: hospital.trim() || '',
        })

        const user = data.user
        // Store in localStorage for ProtectedRoute compat
        const localUser = {
          name: trimmed,
          email: email.trim(),
          doctorId: doctorId.trim() || null,
          hospital: hospital.trim() || null,
          patientName: patientName.trim() || null,
          role,
          registeredAt: new Date().toISOString(),
          supabaseId: user?.id || null,
        }
        localStorage.setItem('medscribe_user', JSON.stringify(localUser))
        onRegister(localUser)
      } catch (err) {
        setError(err.message || 'Sign-up failed')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // --- localStorage-only fallback (no Supabase) ---
    const user = {
      name: trimmed,
      doctorId: doctorId.trim() || null,
      hospital: hospital.trim() || null,
      patientName: patientName.trim() || null,
      role,
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isSignIn ? 'Sign In' : 'Welcome to MedScribe AI'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isSignIn ? 'Sign in to your account' : 'Enter your details to begin'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email (Supabase only) */}
            {isSupabaseConfigured && (
              <div>
                <label htmlFor="reg-email" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    placeholder="doctor@hospital.com"
                    autoFocus={isSignIn}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                </div>
              </div>
            )}

            {/* Password (Supabase only) */}
            {isSupabaseConfigured && (
              <div>
                <label htmlFor="reg-password" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    placeholder={isSignIn ? 'Your password' : 'Min 6 characters'}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                </div>
              </div>
            )}

            {/* Fields hidden when signing in */}
            {!isSignIn && (
              <>
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
                      autoFocus={!isSupabaseConfigured}
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

                {/* Patient Name */}
                <div>
                  <label htmlFor="reg-patient" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Patient Name
                    <span className="text-slate-400 font-normal ml-1">(for this consultation)</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="reg-patient"
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Patient's name (optional)"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                </div>

                {/* Role selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Login as
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('doctor')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-all ${
                        role === 'doctor'
                          ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                          : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Doctor
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-all ${
                        role === 'admin'
                          ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400'
                          : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Admin
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? 'Please wait...'
                : isSignIn
                  ? 'Sign In'
                  : 'Begin Consultation'
              }
            </button>
          </form>

          {/* Toggle sign-in / sign-up (Supabase only) */}
          {isSupabaseConfigured && (
            <button
              type="button"
              onClick={() => { setIsSignIn(!isSignIn); setError('') }}
              className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ArrowLeftRight className="w-3 h-3" />
              {isSignIn ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          )}

          <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            {isSupabaseConfigured
              ? 'Your data is securely stored in the cloud.'
              : 'Your data is stored locally on this device only.'
            }
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
