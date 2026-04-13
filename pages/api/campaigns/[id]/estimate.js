import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { countPeople } from '../../../../lib/icypeas'
import { generateProspectQuery } from '../../../../lib/claude'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const admin  = getSupabaseAdmin()

  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!campaign) return res.status(404).json({ error: 'Introuvable' })
  if (campaign.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  try {
    const query = await generateProspectQuery(campaign)
    const total = await countPeople(query)
    res.status(200).json({ total, query })
  } catch (err) {
    console.error('estimate error:', err)
    res.status(500).json({ error: err.message })
  }
}
