import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { searchEmail } from '../../../../lib/icypeas'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const admin = getSupabaseAdmin()

  const { data: base } = await admin.from('campaigns').select('id,user_id').eq('id', id).single()
  if (!base || base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  // Get prospects without email
  const { data: prospects } = await admin
    .from('prospects')
    .select('id, fullname, company, raw_data')
    .eq('campaign_id', id)
    .is('email', null)

  if (!prospects?.length) return res.status(200).json({ enriched: 0 })

  let enriched = 0
  const results = []

  // Enrich one by one with a short timeout each — avoids one slow call killing all
  for (const p of prospects) {
    try {
      const parts = (p.fullname || '').split(' ')
      const firstname = parts[0] || ''
      const lastname  = parts.slice(1).join(' ') || ''
      let domain = ''
      try { domain = JSON.parse(p.raw_data || '{}').website || p.company } catch { domain = p.company }

      if (!firstname || !lastname || !domain) continue

      const emailData = await Promise.race([
        searchEmail(firstname, lastname, domain),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))
      ])

      if (emailData?.email) {
        await admin.from('prospects').update({
          email: emailData.email,
          email_cert: emailData.certainty || null
        }).eq('id', p.id)
        enriched++
        results.push({ id: p.id, email: emailData.email, cert: emailData.certainty })
      }
    } catch (e) {
      // Skip failed enrichments silently — continue with next
    }
  }

  // Update email count on campaign
  const { data: updated } = await admin
    .from('prospects')
    .select('id', { count: 'exact' })
    .eq('campaign_id', id)
    .not('email', 'is', null)
  
  await admin.from('campaigns').update({ emails_count: enriched }).eq('id', id).catch(() => {})

  res.status(200).json({ enriched, total: prospects.length, results })
}
