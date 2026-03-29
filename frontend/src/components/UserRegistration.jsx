import { useState } from 'react'
import { Activity, User, Building2, Hash, Mail, Lock, ArrowLeftRight, Stethoscope, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import useSupabaseAuth from '../hooks/useSupabaseAuth'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function checkAdminRole(userEmail, userPassword = '') {
  const params = new URLSearchParams({ email: userEmail, password: userPassword })
  const res = await fetch(`${API_BASE}/api/auth/check-admin?${params}`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid credentials')
    if (res.status === 403) throw new Error('Not authorized as admin')
    throw new Error('Authentication service unavailable')
  }
  const data = await res.json()
  if (data.is_admin !== true) throw new Error('Not authorized as admin')
  return true
}

export default function UserRegistration({ onRegister }) {
  const [selectedRole, setSelectedRole] = useState(null) // 'doctor' | 'admin'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [hospital, setHospital] = useState('')
  const [error, setError] = useState('')
  const [isSignIn, setIsSignIn] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { signUp, signIn } = useSupabaseAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!selectedRole) {
      setError('Please select your role above')
      return
    }

    // --- Admin flow: always requires email + password ---
    if (selectedRole === 'admin') {
      if (!email.trim() || !password) {
        setError('Email and password are required')
        return
      }
      setSubmitting(true)
      try {
        // Admin auth always goes through backend endpoint (admin_users table),
        // NOT Supabase Auth — admins don't need a Supabase auth account.
        await checkAdminRole(email.trim(), password)
        const localUser = {
          name: email.split('@')[0],
          email: email.trim(),
          role: 'admin',
          hospital: null,
          doctorId: null,
          patientName: null,
          registeredAt: new Date().toISOString(),
        }
        localStorage.setItem('medscribe_user', JSON.stringify(localUser))
        onRegister(localUser)
      } catch (err) {
        setError(err.message || 'Authentication failed')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // --- Doctor flow ---
    // Supabase sign-in mode
    if (isSupabaseConfigured && isSignIn) {
      if (!email.trim() || !password) {
        setError('Email and password are required')
        return
      }
      setSubmitting(true)
      try {
        const data = await signIn({ email: email.trim(), password })
        const user = data.user
        const localUser = {
          name: user.user_metadata?.full_name || email.split('@')[0],
          email: user.email,
          role: 'doctor',
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

    // Doctor sign-up / registration
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name')
      return
    }

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
          role: 'doctor',
          hospital: hospital.trim() || '',
        })

        const user = data.user
        const localUser = {
          name: trimmed,
          email: email.trim(),
          doctorId: doctorId.trim() || null,
          hospital: hospital.trim() || null,
          patientName: null,
          role: 'doctor',
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

    // localStorage-only fallback (no Supabase)
    const user = {
      name: trimmed,
      doctorId: doctorId.trim() || null,
      hospital: hospital.trim() || null,
      patientName: null,
      role: 'doctor',
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
              {selectedRole === 'admin' ? 'Admin Sign In' : selectedRole === 'doctor' ? (isSignIn ? 'Doctor Sign In' : 'Doctor Registration') : 'Welcome to MedScribe AI'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {!selectedRole ? 'Select your role to continue' : selectedRole === 'admin' ? 'Sign in with your admin credentials' : (isSignIn ? 'Sign in to your account' : 'Enter your details to begin')}
            </p>
          </div>

          {/* Role Selector — two prominent cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => { setSelectedRole('doctor'); setError(''); setIsSignIn(true) }}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                selectedRole === 'doctor'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30 shadow-md ring-1 ring-blue-600/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                selectedRole === 'doctor'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                <Stethoscope className="w-6 h-6" />
              </div>
              <span className={`text-sm font-semibold ${
                selectedRole === 'doctor'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300'
              }`}>
                I'm a Doctor
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">Clinical scribe</span>
              {selectedRole === 'doctor' && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setSelectedRole('admin'); setError(''); setIsSignIn(false) }}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                selectedRole === 'admin'
                  ? 'border-violet-600 bg-violet-50 dark:bg-violet-950/30 shadow-md ring-1 ring-violet-600/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                selectedRole === 'admin'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className={`text-sm font-semibold ${
                selectedRole === 'admin'
                  ? 'text-violet-700 dark:text-violet-300'
                  : 'text-slate-700 dark:text-slate-300'
              }`}>
                Hospital Admin
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">Management portal</span>
              {selectedRole === 'admin' && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </button>
          </div>

          {/* Form — only shown after role selection */}
          {selectedRole && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Admin: only email + password */}
              {selectedRole === 'admin' && (
                <>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Admin Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError('') }}
                        placeholder="admin@hospital.com"
                        autoFocus
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                  </div>
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
                        placeholder="Your password"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Doctor: full fields */}
              {selectedRole === 'doctor' && (
                <>
                  {/* Email + Password (Supabase only) */}
                  {isSupabaseConfigured && (
                    <>
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
                    </>
                  )}

                  {/* Doctor-specific fields (hidden when signing in) */}
                  {!isSignIn && (
                    <>
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
                    </>
                  )}
                </>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4.75a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zM8 11a1 1 0 100 2 1 1 0 000-2z"/></svg>
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 px-4 font-semibold text-sm rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedRole === 'admin'
                    ? 'bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white focus:ring-violet-500'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white focus:ring-blue-500'
                }`}
              >
                {submitting
                  ? 'Please wait...'
                  : selectedRole === 'admin'
                    ? 'Sign In as Admin'
                    : isSignIn
                      ? 'Sign In'
                      : 'Begin Consultation'
                }
              </button>
            </form>
          )}

          {/* Toggle sign-in / sign-up (Doctor + Supabase only) */}
          {selectedRole === 'doctor' && isSupabaseConfigured && (
            <button
              type="button"
              onClick={() => { setIsSignIn(!isSignIn); setError('') }}
              className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ArrowLeftRight className="w-3 h-3" />
              {isSignIn ? 'New here? Create an account' : 'Already have an account? Sign in'}
            </button>
          )}

          {/* Back to role selection */}
          {selectedRole && (
            <button
              type="button"
              onClick={() => { setSelectedRole(null); setError(''); setIsSignIn(false) }}
              className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Choose a different role
            </button>
          )}

          <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            {selectedRole === 'admin'
              ? 'Admin access requires authorized credentials.'
              : isSupabaseConfigured
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
