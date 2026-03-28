import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Auth hook backed by Supabase.  Returns `null` helpers when Supabase is
 * not configured so the caller can fall back to localStorage.
 */
export default function useSupabaseAuth() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = useCallback(async ({ email, password, fullName, role, hospital }) => {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role || 'doctor',
          hospital: hospital || '',
        },
      },
    })
    if (error) throw error
    return data
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    // Also clear localStorage fallback
    localStorage.removeItem('medscribe_user')
  }, [])

  /** Extract role from user_metadata (simpler than JWT claims). */
  const role = user?.user_metadata?.role || 'doctor'

  return {
    user,
    session,
    loading,
    role,
    signUp,
    signIn,
    signOut,
    isSupabaseConfigured,
  }
}
