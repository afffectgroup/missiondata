import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { generateSequence } from '../../../../lib/claude'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const admin = getSupabaseAdmin()

  // Fetch campaign + prospects
  const [{ data: campaign }, { data: prospects }] = await Promise.all([
    admin.from('campaigns').select('*').eq('id', id).single(),
    admin.from('prospects').select('*').eq('campaign_id', id),
  ])

  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' })
  if (campaign.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })
  if (!prospects?.length) return res.status(400).json({ error: 'Aucun prospect — lancez d\'abord la recherche' })

  try {
    const results = []

    // Generate sequences in parallel (batches of 3 to avoid rate limits)
    for (let i = 0; i < prospects.length; i += 3) {
      const batch = prospects.slice(i, i + 3)
      const generated = await Promise.all(
        batch.map(p => generateSequence({ campaign, prospect: p }))
      )

      for (let j = 0; j < batch.length; j++) {
        const p = batch[j]
        const seq = generated[j]

        // Upsert sequence
        const { data } = await admin.from('sequences').upsert({
          campaign_id: id,
          prospect_id: p.id,
          user_id: session.user.id,
          email_1: seq.email_1,
          email_2: seq.email_2,
          email_3: seq.email_3,
          linkedin_1: seq.linkedin_1,
          linkedin_2: seq.linkedin_2,
        }, { onConflict: 'campaign_id,prospect_id' }).select().single()

        results.push(data)
      }
    }

    // Update campaign sequence count
    await admin.from('campaigns').update({ sequences_count: results.length }).eq('id', id)

    res.status(200).json({ sequences: results, count: results.length })
  } catch (error) {
    console.error('generate-sequences error:', error)
    res.status(500).json({ error: error.message })
  }
}
