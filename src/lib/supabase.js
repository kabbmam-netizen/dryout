import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseReady = Boolean(url && anonKey)

export const supabase = supabaseReady
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

export function requireSupabase() {
  if (!supabase) throw new Error('尚未配置 Supabase：请在 .env 中填写 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY')
  return supabase
}
