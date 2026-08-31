import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants : compte et sauvegarde en ligne désactivés')
}

// createClient() throws synchronously on an invalid URL, which would crash the whole app at
// import time — fall back to a syntactically valid but unreachable placeholder so the app still
// boots (jouable en local uniquement) when Supabase isn't configured.
export const supabase = createClient(url || 'https://not-configured.supabase.co', anonKey || 'not-configured')
