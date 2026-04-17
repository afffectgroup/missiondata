/**
 * Pipeline Icypeas — reçoit les sociétés SIRENE du client, cherche les contacts
 * SIRENE est appelé côté navigateur (CORS OK), Icypeas côté serveur (clé sécurisée)
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

export const config = { api: { responseLimit: false } }

const ICYPEAS = 'https://app.icypeas.com/api'

async function icy(path, body) {
  const r = await fetch(`${ICYPEAS}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.ICYPEAS_API_KEY },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  try { return JSON.parse(text) }
  catch { throw new Error(`Icypeas ${path} ${r.status}: ${text.slice(0, 120)}`) }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  // companies = tableau des sociétés SIRENE envoyées par le client (peut être vide)
  const { companies = [] } = req.body || {}

  const admin = getSupabaseAdmin()
  const { data: base } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!base || base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  // ── SSE ──
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const send = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
  const log  = (msg, t = 'i') => send('log', { msg, t, ts: new Date().toLocaleTimeString('fr-FR') })
  const done = (data) => { send('done', data); res.end() }
  const fail = (msg)  => { send('error', { msg }); res.end() }

  await admin.from('campaigns').update({ status: 'generating', generation_pct: 0 }).eq('id', id)
  await admin.from('prospects').delete().eq('campaign_id', id)

  try {
    const isFR   = (base.mode || 'france') !== 'international'
    const titles = (base.job_titles || base.client_need || '').split(',').map(s => s.trim()).filter(Boolean)
    const nCo    = base.n_companies || 10

    // ── Icypeas find-people avec fallbacks robustes ──
    log('↗ Icypeas find-people…', 't')

    const titlesList = titles
    let people = []

    // Helper: appel find-people avec le bon format (pagination.size, pas maxResults)
    async function findPeople(query, size) {
      const body = { query, pagination: { size } }
      const res  = await icy('/find-people', body)
      // Format de réponse Icypeas : { success, total, leads: [...] }
      return res.leads || []
    }

    // Build base query
    const baseQuery = { currentJobTitle: { include: titlesList } }
    if (isFR) {
      baseQuery.location = { include: ['FR'] }
    } else {
      const loc = base.intl_city || base.country_code || 'FR'
      baseQuery.location = { include: [loc] }
    }

    // Tentative 1 : ciblage précis
    let query1 = { ...baseQuery }
    if (isFR && companies.length > 0) {
      query1.currentCompanyName = { include: companies.slice(0, 20).map(c => c.nom_raison_sociale).filter(Boolean) }
      log(`  Tentative 1 — ${query1.currentCompanyName.include.length} entreprises + postes`, 'i')
    } else if (isFR) {
      const kw = base.ape_label || (base.ape_code || '').split(',')[0]?.trim()
      if (kw) query1.keyword = { include: [kw] }
      log(`  Tentative 1 — keyword "${kw}" + postes`, 'i')
    } else {
      if (base.intl_sector) query1.keyword = { include: [base.intl_sector] }
      log(`  Tentative 1 — ${base.country_label || base.country_code} · ${base.intl_sector || 'tous secteurs'}`, 'i')
    }

    try {
      people = await findPeople(query1, nCo)
      log(`  → ${people.length} résultats`, people.length ? 's' : 'w')
    } catch (e) {
      log(`  ⚠ Tentative 1 échouée : ${e.message}`, 'w')
    }

    // Tentative 2 : élargir avec keyword secteur
    if (!people.length && isFR && companies.length > 0) {
      const kw = base.ape_label || (base.ape_code || '').split(',')[0]?.trim()
      if (kw) {
        log(`  Tentative 2 — sans filtre entreprise, keyword "${kw}"`, 'i')
        try {
          people = await findPeople({ ...baseQuery, keyword: { include: [kw] } }, nCo)
          log(`  → ${people.length} résultats`, people.length ? 's' : 'w')
        } catch (e) {
          log(`  ⚠ Tentative 2 échouée : ${e.message}`, 'w')
        }
      }
    }

    // Tentative 3 : postes + location seulement
    if (!people.length) {
      log(`  Tentative 3 — postes + location seulement`, 'i')
      try {
        people = await findPeople(baseQuery, nCo)
        log(`  → ${people.length} résultats`, people.length ? 's' : 'w')
      } catch (e) {
        log(`  ⚠ Tentative 3 échouée : ${e.message}`, 'w')
      }
    }

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      return fail('Aucun contact trouvé après 3 tentatives. Essayez : postes plus génériques (CEO au lieu de Directeur Général), secteur plus large, ou une autre localisation.')
    }

    log(`✓ ${people.length} contacts trouvés`, 's')

    // ── SAUVEGARDE IMMÉDIATE des contacts (sans emails) ──
    // Important : on sauvegarde TOUT DE SUITE pour éviter les timeouts Railway
    log('Sauvegarde des contacts…', 'i')
    const sirenMap = Object.fromEntries(companies.map(c => [(c.nom_raison_sociale||'').toLowerCase(), c]))

    const records = people.map(p => {
      const co = sirenMap[(p.lastCompanyName||'').toLowerCase()] || {}
      return {
        campaign_id:  id,
        user_id:      session.user.id,
        fullname:     [p.firstname, p.lastname].filter(Boolean).join(' '),
        job_title:    p.lastJobTitle || p.headline || '',
        company:      p.lastCompanyName || '',
        email:        null,   // enrichi ensuite
        email_cert:   null,
        linkedin_url: p.profileUrl || null,
        location:     p.address || co.siege?.libelle_commune || null,
        sector:       p.lastCompanyIndustry || base.ape_label || base.intl_sector || '',
        source:       'icypeas',
        raw_data:     JSON.stringify({ website: p.lastCompanyWebsite||'', company: p.lastCompanyName||'' }),
      }
    })

    const { data: inserted, error: insertError } = await admin.from('prospects').insert(records).select('id, fullname')
    if (insertError) {
      log(`⚠ Erreur sauvegarde: ${insertError.message}`, 'e')
      return fail(`Sauvegarde échouée: ${insertError.message}`)
    }
    const count = inserted?.length || 0
    await admin.from('campaigns').update({ status: 'done', generation_pct: 90, prospects_count: count }).eq('id', id)
    log(`✓ ${count} contacts sauvegardés`, 's')

    // ── Email bulk search — timeout court pour éviter Railway timeout ──
    log('↗ Icypeas email enrichment (25s max)…', 't')

    const emailInput = people
      .filter(p => p.firstname && p.lastname && (p.lastCompanyWebsite || p.lastCompanyName))
      .map((p, idx) => ({
        firstname:       p.firstname,
        lastname:        p.lastname,
        domainOrCompany: p.lastCompanyWebsite || p.lastCompanyName,
        idx,
      }))

    if (emailInput.length) {
      try {
        // Soumettre le bulk — rapide (< 2s)
        const bulk = await icy('/bulk-search', {
          name: `md-${id.slice(0,8)}-${Date.now()}`,
          task: 'email-search',
          data: emailInput.map(e => [e.firstname, e.lastname, e.domainOrCompany]),
        })
        const fileId = bulk?.file || bulk?._id
        if (!fileId) throw new Error('Pas de fileId')
        log(`  Batch ${fileId.slice(0,8)}… soumis`, 'i')

        // Poll seulement 5 fois × 4s = 20s max (Railway timeout = 30-60s)
        let emailCount = 0
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 4000))

          const poll = await icy('/bulk-single-searchs/read', {
            mode: 'bulk', file: fileId, limit: 100,
          })

          const items = Array.isArray(poll?.items) ? poll.items : []
          // Update chaque prospect avec son email dès qu'il arrive
          for (const item of items) {
            if (item.results?.emails?.[0] && typeof item.order === 'number') {
              const prospect = inserted[item.order]
              if (prospect) {
                await admin.from('prospects').update({
                  email:      item.results.emails[0].email,
                  email_cert: item.results.emails[0].certainty,
                }).eq('id', prospect.id)
                emailCount++
              }
            }
          }
        }

        log(`✓ ${emailCount} emails enrichis`, 's')
      } catch(e) {
        log(`⚠ Email enrichment incomplet: ${e.message}`, 'w')
      }
    }

    await admin.from('campaigns').update({ status: 'done', generation_pct: 100 }).eq('id', id)
    done({ count })

  } catch (err) {
    await admin.from('campaigns').update({ status: 'draft', generation_pct: 0 }).eq('id', id).catch(() => {})
    fail(err.message)
  }
}
