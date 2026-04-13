import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { findPeople, bulkEmailSearch } from '../../../../lib/icypeas'
import { generateProspectQuery } from '../../../../lib/claude'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const admin  = getSupabaseAdmin()

  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' })
  if (campaign.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  async function push(msg, type = 'i', pct = null) {
    const { data: cur } = await admin.from('campaigns').select('generation_logs, generation_pct').eq('id', id).single()
    const logs = [...(cur?.generation_logs || []), { msg, type, ts: new Date().toLocaleTimeString('fr-FR') }]
    await admin.from('campaigns').update({
      generation_logs: logs,
      ...(pct !== null ? { generation_pct: pct } : {}),
    }).eq('id', id)
  }

  await admin.from('campaigns').update({ status: 'generating', generation_pct: 0, generation_logs: [] }).eq('id', id)
  await admin.from('prospects').delete().eq('campaign_id', id)

  try {
    await push('Claude analyse votre profil client...', 'i', 5)
    const query = await generateProspectQuery(campaign)
    await push(`Requête Icypeas générée — ${Object.keys(query).join(', ')}`, 'c', 15)

    await push('Recherche Icypeas Find People...', 'i', 20)
    const people = await findPeople(query, 20)
    await push(`✓ ${people.length} profil${people.length !== 1 ? 's' : ''} trouvé${people.length !== 1 ? 's' : ''}`, 's', 45)

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100 }).eq('id', id)
      return res.status(200).json({ prospects: [], count: 0 })
    }

    await push('Enrichissement emails Icypeas (bulk)...', 'i', 50)
    const emailInput = people
      .filter(p => p.lastCompanyWebsite || p.lastCompanyName)
      .map(p => ({ firstname: p.firstname, lastname: p.lastname, domainOrCompany: p.lastCompanyWebsite || p.lastCompanyName }))

    const emailResults = await bulkEmailSearch(emailInput)
    const found = emailResults.filter(r => r.results?.emails?.[0]).length
    await push(`✓ ${found}/${emailResults.length} emails enrichis`, 's', 80)

    const emailMap = {}
    for (const r of emailResults) {
      const k = `${(r.results?.firstname||'').toLowerCase()}_${(r.results?.lastname||'').toLowerCase()}`
      if (r.results?.emails?.[0]) emailMap[k] = { email: r.results.emails[0].email, cert: r.results.emails[0].certainty }
    }

    const records = people.map(p => {
      const k = `${(p.firstname||'').toLowerCase()}_${(p.lastname||'').toLowerCase()}`
      const em = emailMap[k] || {}
      return {
        campaign_id: id, user_id: session.user.id,
        fullname: `${p.firstname} ${p.lastname}`,
        job_title: p.lastJobTitle || p.headline,
        company: p.lastCompanyName || '',
        sector: p.lastCompanyIndustry || campaign.client_sector,
        email: em.email || null, email_cert: em.cert || null,
        linkedin_url: p.profileUrl || null, location: p.address || null,
        source: 'icypeas',
      }
    })

    const { data: inserted } = await admin.from('prospects').insert(records).select()
    await push(`✓ ${inserted?.length} prospects sauvegardés`, 's', 95)
    await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: inserted?.length || 0 }).eq('id', id)
    await push('Pipeline terminé.', 's', 100)
    res.status(200).json({ prospects: inserted, count: inserted?.length })
  } catch (err) {
    await push(`✗ ${err.message}`, 'e')
    await admin.from('campaigns').update({ status: 'done', generation_pct: 0 }).eq('id', id)
    res.status(500).json({ error: err.message })
  }
}
