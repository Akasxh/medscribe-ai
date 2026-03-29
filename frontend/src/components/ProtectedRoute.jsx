import { Navigate } from 'react-router-dom'
import useSupabaseAuth from '../hooks/useSupabaseAuth'

function loadLocalUser() {
  try {
    const raw = localStorage.getItem('medscribe_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function ProtectedRoute({ role, children }) {
  const { user: supabaseUser, loading, role: supabaseRole, isSupabaseConfigured } = useSupabaseAuth()

  // While Supabase is checking the initial session, show nothing
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Determine effective user and role
  let effectiveUser = null
  let effectiveRole = null

  if (isSupabaseConfigured && supabaseUser) {
    effectiveUser = supabaseUser
    effectiveRole = supabaseRole
  } else {
    // Fallback to localStorage — role comes from backend-verified login
    const localUser = loadLocalUser()
    if (localUser) {
      effectiveUser = localUser
      effectiveRole = localUser.role || 'doctor'
    }
  }

  if (!effectiveUser) {
    return <Navigate to="/login" replace />
  }

  if (role && effectiveRole !== role) {
    // Wrong role — redirect to their home
    return <Navigate to={effectiveRole === 'admin' ? '/admin' : '/'} replace />
  }

  return children
}
