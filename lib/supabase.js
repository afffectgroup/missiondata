import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'

let client = null

export function getSupabase() {
  if (!client) client = createPagesBrowserClient()
  return client
}

export default getSupabase
