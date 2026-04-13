import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

async function assertAdmin(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') return null
  return { session, admin }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const auth = await assertAdmin(req, res)
  if (!auth) return res.status(403).json({ error: 'Accès refusé' })

  const { admin } = auth
  const { user_id, prospects, campaign_id } = req.query

  /* ── Download prospects for a specific campaign ── */
  if (prospects === '1' && campaign_id) {
    const { data } = await admin
      .from('prospects')
      .select('fullname, job_title, company, sector, email, email_cert, location, linkedin_url')
      .eq('campaign_id', campaign_id)
      .order('created_at')
    return res.status(200).json({ prospects: data || [] })
  }

  /* ── List all campaigns (optionally filtered by user) ── */
  let query = admin
    .from('campaigns')
    .select('id, name, status, client_sector, client_location, prospects_count, sequences_count, created_at, user_id, profiles(full_name, email)')
    .order('created_at', { ascending: false })

  if (user_id) query = query.eq('user_id', user_id)

  const { data } = await query
  res.status(200).json({ campaigns: data || [] })
}
