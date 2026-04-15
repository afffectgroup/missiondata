import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { findPeople } from '../../../../lib/icypeas'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const { companies = [] } = req.body || {}

  const admin = getSupabaseAdmin()
  const { data: base } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!base) return res.status(404).json({ error: 'Base introuvable' })
  if (base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  const isFrance = base.mode !== 'international'

  // ── Logs kept in memory → single Supabase write per update ──
  let logs = []
  async function push(msg, type = 'i', pct = null) {
    logs.push({ msg, type, ts: new Date().toLocaleTimeString('fr-FR') })
    const update = { generation_logs: logs }
    if (pct !== null) update.generation_pct = pct
    await admin.from('campaigns').update(update).eq('id', id)
  }

  await admin.from('campaigns').update({
    status: 'generating', generation_pct: 0, generation_logs: []
  }).eq('id', id)
  await admin.from('prospects').delete().eq('campaign_id', id)

  try {
    const titles = (base.job_titles || base.client_need || '').split(',').map(s => s.trim()).filter(Boolean)
    let people = []

    if (isFrance) {
      const companyNames = companies.map(c => c.nom_raison_sociale).filter(Boolean)
      await push(`✓ ${companyNames.length} sociétés SIRENE reçues`, 's', 10)
      await push(`Icypeas find-people — ${titles.slice(0,2).join(', ')}…`, 'i', 20)

      people = await findPeople({
        currentCompanyName: { include: companyNames.slice(0, 25) },
        currentJobTitle:    { include: titles },
        location:           { include: ['FR'] },
      }, base.n_companies || 30)

    } else {
      const city   = base.intl_city    || ''
      const sector = base.intl_sector  || ''
      await push(`${base.country_label} · ${sector}`, 'i', 10)
      await push(`Icypeas find-people worldwide…`, 'i', 20)

      const query = { currentJobTitle: { include: titles }, location: { include: [city || base.country_code || 'FR'] } }
      if (sector) query.keyword = { include: [sector] }
      people = await findPeople(query, base.n_companies || 30)
    }

    await push(`✓ ${people.length} profil${people.length !== 1 ? 's' : ''} trouvé${people.length !== 1 ? 's' : ''}`, 's', 70)

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      await push('Aucun profil. Essayez avec des critères plus larges.', 'w', 100)
      return res.status(200).json({ contacts: [], count: 0 })
    }

    // Save contacts immediately — no email enrichment here (done separately)
    const sirenMap = isFrance
      ? Object.fromEntries(companies.map(c => [c.nom_raison_sociale?.toLowerCase(), c]))
      : {}

    const records = people.map(p => {
      const sirene = sirenMap[p.lastCompanyName?.toLowerCase()] || {}
      return {
        campaign_id:  id,
        user_id:      session.user.id,
        fullname:     [p.firstname, p.lastname].filter(Boolean).join(' '),
        job_title:    p.lastJobTitle || p.headline || '',
        company:      p.lastCompanyName || '',
        sector:       p.lastCompanyIndustry || base.ape_label || base.intl_sector || '',
        email:        null,
        email_cert:   null,
        linkedin_url: p.profileUrl || null,
        location:     p.address || sirene.siege?.libelle_commune || null,
        source:       'icypeas',
        raw_data:     JSON.stringify({ website: p.lastCompanyWebsite || p.lastCompanyName }),
      }
    })

    await push('Sauvegarde des contacts…', 'i', 80)
    const { data: inserted } = await admin.from('prospects').insert(records).select()
    const count = inserted?.length || 0

    await admin.from('campaigns').update({
      status: 'done', generation_pct: 100, prospects_count: count
    }).eq('id', id)
    await push(`✓ ${count} contacts sauvegardés · Enrichissement email disponible`, 's', 100)

    res.status(200).json({ contacts: inserted, count })
  } catch (err) {
    logs.push({ msg: `✗ ${err.message}`, type: 'e', ts: new Date().toLocaleTimeString('fr-FR') })
    await admin.from('campaigns').update({
      status: 'done', generation_pct: 0, generation_logs: logs
    }).eq('id', id)
    res.status(500).json({ error: err.message })
  }
}
