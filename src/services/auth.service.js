import { supabase } from '../lib/supabase.js'

export async function signInWithPassword({ email, password }) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUp({ email, password, fullName }) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function requestPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

export async function getSession() {
  return supabase.auth.getSession()
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
