import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { findPeople, bulkEmailSearch } from '../../../../lib/icypeas'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  // France mode: companies from SIRENE (sent by client)
  // International mode: no companies, direct Icypeas search
  const { companies = [] } = req.body || {}

  const admin = getSupabaseAdmin()
  const { data: base } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!base) return res.status(404).json({ error: 'Base introuvable' })
  if (base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  const isFrance = base.mode !== 'international'

  async function push(msg, type = 'i', pct = null) {
    const { data: cur } = await admin.from('campaigns').select('generation_logs,generation_pct').eq('id', id).single()
    const logs = [...(cur?.generation_logs || []), { msg, type, ts: new Date().toLocaleTimeString('fr-FR') }]
    await admin.from('campaigns').update({ generation_logs: logs, ...(pct !== null ? { generation_pct: pct } : {}) }).eq('id', id)
  }

  await admin.from('campaigns').update({ status: 'generating', generation_pct: 0, generation_logs: [] }).eq('id', id)
  await admin.from('prospects').delete().eq('campaign_id', id)

  try {
    const titles = (base.job_titles || base.client_need || '').split(',').map(s => s.trim()).filter(Boolean)

    let people = []

    if (isFrance) {
      // ── Mode France : Icypeas find-people par noms d'entreprises SIRENE ──
      const companyNames = companies.map(c => c.nom_raison_sociale).filter(Boolean)
      await push(`✓ ${companyNames.length} entreprises SIRENE · ${titles.join(', ')}`, 's', 10)
      await push('Icypeas find-people par entreprises…', 'i', 15)

      people = await findPeople({
        currentCompanyName: { include: companyNames.slice(0, 25) },
        currentJobTitle:    { include: titles },
        location:           { include: ['FR'] },
      }, base.n_companies || 50)

      await push(`✓ ${people.length} profils trouvés`, 's', 50)
    } else {
      // ── Mode International : Icypeas find-people direct ──
      const country = base.country_code || 'FR'
      const sector  = base.intl_sector  || ''
      const city    = base.intl_city    || ''

      await push(`Pays : ${base.country_label || country} · Secteur : ${sector}`, 'i', 5)
      await push(`Icypeas find-people worldwide…`, 'i', 15)

      const query = {
        currentJobTitle: { include: titles },
        location: { include: [city || country] },
      }
      if (sector) query.keyword = { include: [sector] }

      people = await findPeople(query, base.n_companies || 50)
      await push(`✓ ${people.length} profils trouvés`, 's', 50)
    }

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      await push('Aucun profil. Essayez avec des critères plus larges.', 'w', 100)
      return res.status(200).json({ contacts: [], count: 0 })
    }

    // ── Email enrichment (same for both modes) ──
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

    const emailMap = {}
    for (const r of emailResults) {
      const k = `${(r.results?.firstname||'').toLowerCase()}_${(r.results?.lastname||'').toLowerCase()}`
      if (r.results?.emails?.[0]) emailMap[k] = { email: r.results.emails[0].email, cert: r.results.emails[0].certainty }
    }

    const sirenMap = isFrance
      ? Object.fromEntries(companies.map(c => [c.nom_raison_sociale?.toLowerCase(), c]))
      : {}

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
        sector:       p.lastCompanyIndustry || base.ape_label || base.intl_sector || '',
        email:        em.email || null,
        email_cert:   em.cert  || null,
        linkedin_url: p.profileUrl || null,
        location:     p.address || sirene.siege?.libelle_commune || null,
        source:       'icypeas',
        ...(sirene.siren ? { notes: `SIREN:${sirene.siren}` } : {}),
      }
    })

    const { data: inserted } = await admin.from('prospects').insert(records).select()
    await admin.from('campaigns').update({ status:'done', generation_pct:100, prospects_count: inserted?.length || 0 }).eq('id', id)
    await push(`✓ Pipeline terminé · ${inserted?.length} contacts sauvegardés`, 's', 100)

    res.status(200).json({ contacts: inserted, count: inserted?.length })
  } catch (err) {
    await push(`✗ ${err.message}`, 'e')
    await admin.from('campaigns').update({ status:'done', generation_pct:0 }).eq('id', id)
    res.status(500).json({ error: err.message })
  }
}
