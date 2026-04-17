import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  if (req.method === 'GET') {
    // Récupère les bases + on RECALCULE le count dynamiquement au lieu de se fier à prospects_count
    // (qui peut être obsolète si le pipeline SSE a été coupé par Railway avant l'update finale)
    const { data: bases } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (!bases?.length) return res.status(200).json([])

    // Fetch real counts en une seule query (admin pour voir tous les prospects)
    const admin = getSupabaseAdmin()
    const { data: counts } = await admin
      .from('prospects')
      .select('campaign_id')
      .in('campaign_id', bases.map(b => b.id))

    // Agréger les counts par campaign_id
    const countMap = {}
    for (const p of (counts || [])) {
      countMap[p.campaign_id] = (countMap[p.campaign_id] || 0) + 1
    }

    // Surcharge : le vrai count remplace prospects_count si différent
    const withRealCounts = bases.map(b => ({
      ...b,
      prospects_count: countMap[b.id] || 0,
    }))

    return res.status(200).json(withRealCounts)
  }

  if (req.method === 'POST') {
    const { data, error } = await supabase.from('campaigns').insert({ ...req.body, user_id: session.user.id }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }
  res.status(405).end()
}
