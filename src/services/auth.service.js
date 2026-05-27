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

export async function signOutLocal() {
  // Clears the in-memory + localStorage session without hitting the network.
  // Use before signUp so a persisted session from a prior signup can't conflict.
  return supabase.auth.signOut({ scope: 'local' })
}

export async function requestPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

export async function updatePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword })
}

export async function getSession() {
  return supabase.auth.getSession()
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
