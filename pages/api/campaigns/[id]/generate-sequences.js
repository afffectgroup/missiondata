import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { generateSequence } from '../../../../lib/claude'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const { prospect_ids } = req.body || {}   // optional: regenerate specific prospects only
  const admin = getSupabaseAdmin()

  const [{ data: campaign }, { data: allProspects }] = await Promise.all([
    admin.from('campaigns').select('*').eq('id', id).single(),
    admin.from('prospects').select('*').eq('campaign_id', id),
  ])

  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' })
  if (campaign.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  const prospects = prospect_ids?.length
    ? allProspects.filter(p => prospect_ids.includes(p.id))
    : allProspects

  if (!prospects?.length) return res.status(400).json({ error: 'Aucun prospect trouvé' })

  try {
    const results = []

    // Generate in batches of 3 to avoid Claude rate limits
    for (let i = 0; i < prospects.length; i += 3) {
      const batch = prospects.slice(i, i + 3)
      const generated = await Promise.all(
        batch.map(p => generateSequence({ campaign, prospect: p }))
      )

      for (let j = 0; j < batch.length; j++) {
        const { data } = await admin.from('sequences').upsert({
          campaign_id: id,
          prospect_id: batch[j].id,
          user_id: session.user.id,
          ...generated[j],
        }, { onConflict: 'campaign_id,prospect_id' }).select().single()
        if (data) results.push(data)
      }
    }

    // Update sequences count only for full generation (not partial)
    if (!prospect_ids?.length) {
      await admin.from('campaigns').update({ sequences_count: results.length }).eq('id', id)
    }

    res.status(200).json({ sequences: results, count: results.length })
  } catch (err) {
    console.error('generate-sequences:', err)
    res.status(500).json({ error: err.message })
  }
}
