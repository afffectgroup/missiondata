import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const admin = getSupabaseAdmin()

  // Check admin role
  const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' })

  const [
    { count: total_freelances },
    { count: active_freelances },
    { count: total_campaigns },
    { count: completed_campaigns },
    { count: total_prospects },
    { count: total_sequences },
    { data: recent_campaigns },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'freelance'),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'freelance').eq('is_active', true),
    admin.from('campaigns').select('*', { count: 'exact', head: true }),
    admin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'done'),
    admin.from('prospects').select('*', { count: 'exact', head: true }),
    admin.from('sequences').select('*', { count: 'exact', head: true }),
    admin.from('campaigns')
      .select('id, name, status, prospects_count, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  res.status(200).json({
    total_freelances,
    active_freelances,
    total_campaigns,
    completed_campaigns,
    total_prospects,
    total_sequences,
    recent_campaigns: recent_campaigns || [],
  })
}
