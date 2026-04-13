import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { findPeople, bulkEmailSearch } from '../../../../lib/icypeas'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  // companies: array passed from client (already fetched from SIRENE)
  const { companies = [] } = req.body || {}

  const admin = getSupabaseAdmin()
  const { data: base } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!base) return res.status(404).json({ error: 'Base introuvable' })
  if (base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  async function push(msg, type = 'i', pct = null) {
    const { data: cur } = await admin.from('campaigns').select('generation_logs, generation_pct').eq('id', id).single()
    const logs = [...(cur?.generation_logs || []), { msg, type, ts: new Date().toLocaleTimeString('fr-FR') }]
    await admin.from('campaigns').update({ generation_logs: logs, ...(pct !== null ? { generation_pct: pct } : {}) }).eq('id', id)
  }

  await admin.from('campaigns').update({ status: 'generating', generation_pct: 0, generation_logs: [] }).eq('id', id)
  await admin.from('prospects').delete().eq('campaign_id', id)

  try {
    const companyNames = companies.map(c => c.nom_raison_sociale).filter(Boolean)
    const titles = (base.job_titles || base.client_need || '').split(',').map(s => s.trim()).filter(Boolean)

    await push(`✓ ${companyNames.length} entreprises SIRENE reçues`, 's', 10)
    await push(`Icypeas find-people — ${titles.join(', ')}`, 'i', 15)

    // Icypeas find-people by company names + job titles
    const people = await findPeople({
      currentCompanyName: { include: companyNames.slice(0, 25) },
      currentJobTitle:    { include: titles },
      location:           { include: ['FR'] },
    }, 50)

    await push(`✓ ${people.length} profils trouvés via Icypeas`, 's', 50)

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      await push('Aucun profil correspondant. Essayez avec des critères plus larges.', 'w', 100)
      return res.status(200).json({ contacts: [], count: 0 })
    }

    // Build email search input
    await push('Enrichissement emails Icypeas (bulk)…', 'i', 55)
    const emailInput = people
      .filter(p => p.lastCompanyWebsite || p.lastCompanyName)
      .map(p => ({
        firstname: p.firstname,
        lastname:  p.lastname,
        domainOrCompany: p.lastCompanyWebsite || p.lastCompanyName,
      }))

    const emailResults = await bulkEmailSearch(emailInput)
    const found = emailResults.filter(r => r.results?.emails?.[0]).length
    await push(`✓ ${found}/${emailResults.length} emails enrichis`, 's', 85)

    // Build email map
    const emailMap = {}
    for (const r of emailResults) {
      const k = `${(r.results?.firstname||'').toLowerCase()}_${(r.results?.lastname||'').toLowerCase()}`
      if (r.results?.emails?.[0]) emailMap[k] = { email: r.results.emails[0].email, cert: r.results.emails[0].certainty }
    }

    // Build SIRENE enrichment map
    const sirenMap = Object.fromEntries(companies.map(c => [c.nom_raison_sociale?.toLowerCase(), c]))

    // Assemble records
    const records = people.map(p => {
      const k = `${(p.firstname||'').toLowerCase()}_${(p.lastname||'').toLowerCase()}`
      const em = emailMap[k] || {}
      const sirene = sirenMap[p.lastCompanyName?.toLowerCase()] || {}
      return {
        campaign_id:  id,
        user_id:      session.user.id,
        fullname:     `${p.firstname} ${p.lastname}`,
        job_title:    p.lastJobTitle || p.headline || '',
        company:      p.lastCompanyName || '',
        sector:       p.lastCompanyIndustry || base.ape_label || '',
        email:        em.email || null,
        email_cert:   em.cert  || null,
        linkedin_url: p.profileUrl || null,
        location:     p.address || sirene.siege?.libelle_commune || null,
        source:       'icypeas',
        // SIRENE enrichment
        ...(sirene.siren ? { notes: `SIREN:${sirene.siren}` } : {}),
      }
    })

    const { data: inserted } = await admin.from('prospects').insert(records).select()
    await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: inserted?.length || 0 }).eq('id', id)
    await push(`Pipeline terminé · ${inserted?.length} contacts sauvegardés`, 's', 100)

    res.status(200).json({ contacts: inserted, count: inserted?.length })
  } catch (err) {
    await push(`✗ ${err.message}`, 'e')
    await admin.from('campaigns').update({ status: 'done', generation_pct: 0 }).eq('id', id)
    res.status(500).json({ error: err.message })
  }
}
