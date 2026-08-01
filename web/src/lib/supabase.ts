import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** False when the build has no usable Supabase credentials. The check is on the
 *  shape of the URL, not just on it being non empty: createClient throws on a
 *  malformed one, which would blank the whole app instead of showing the setup
 *  screen. */
export const isConfigured = isHttpUrl(rawUrl) && Boolean(rawKey)

const url = isConfigured ? rawUrl : 'https://placeholder.supabase.co'
const anonKey = isConfigured ? rawKey! : 'placeholder'

/** Passed to the Android widget through the bridge so it can query on its own. */
export const credentials = { url, anonKey }

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false },
})
