import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Strips surrounding whitespace and a leading byte order mark.
 *
 *  The BOM matters: a value that travels through a shell pipe on Windows can
 *  pick one up, and the build minifier folds String.trim() at compile time with
 *  a whitespace set that does not cover U+FEFF. The character then survives
 *  into the bundle and makes new URL() throw, which left the app stuck on the
 *  setup screen with no visible cause. */
function clean(value: string | undefined): string {
  return (value ?? '').replace(/^﻿/, '').trim()
}

function isHttpUrl(value: string): boolean {
  if (!value) return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

const configuredUrl = clean(import.meta.env.VITE_SUPABASE_URL)
const configuredKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

/** False when the build has no usable Supabase credentials. The check is on the
 *  shape of the URL, not just on it being non empty: createClient throws on a
 *  malformed one, which would blank the whole app instead of showing the setup
 *  screen. */
export const isConfigured = isHttpUrl(configuredUrl) && configuredKey.length > 0

const url = isConfigured ? configuredUrl : 'https://placeholder.supabase.co'
const anonKey = isConfigured ? configuredKey : 'placeholder'

/** Passed to the Android widget through the bridge so it can query on its own. */
export const credentials = { url, anonKey }

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false },
})
