import { supabase } from './supabase.js'

function toUser(user) {
  return user ? { id: user.id, email: user.email } : null
}

export async function signup(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return toUser(data.user)
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return toUser(data.user)
}

export async function logout() {
  await supabase.auth.signOut()
}
