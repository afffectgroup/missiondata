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
    const deptCodes = (base.departement || '').split(',').map(s => s.trim()).filter(Boolean)
    // IMPORTANT : on demande beaucoup plus de contacts que de sociétés
    // Plusieurs contacts par entreprise + marge de sécurité
    const icyPageSize = Math.max(nCo * 3, 30)

    // ── Icypeas find-people avec fallbacks robustes ──
    log('↗ Icypeas find-people…', 't')
    log(`  Demande: ${icyPageSize} contacts max, postes: ${titles.join(', ')}`, 'i')

    const titlesList = titles
    let people = []

    // Helper: appel find-people avec le bon format (pagination.size, pas maxResults)
    async function findPeople(query, size) {
      const body = { query, pagination: { size } }
      const res  = await icy('/find-people', body)
      // Format de réponse Icypeas : { success, total, leads: [...] }
      log(`    Icypeas total disponible: ${res?.total || 0}, retournés: ${res?.leads?.length || 0}`, 'i')
      return res.leads || []
    }

    // Build base query avec géographie précise — CRITIQUE : on garde la géo dans TOUTES les tentatives
    const baseQuery = { currentJobTitle: { include: titlesList } }
    if (isFR) {
      // France : on ajoute les noms de départements/régions au filtre location
      // Icypeas fait du fuzzy match sur "Ille-et-Vilaine", "Rennes, France", etc.
      const locationTerms = ['FR']
      if (base.dept_label) {
        // dept_label peut contenir plusieurs noms séparés par ", " (si multi-dept)
        const depts = base.dept_label.split(',').map(s => s.trim()).filter(Boolean)
        locationTerms.push(...depts)
      }
      baseQuery.location = { include: locationTerms }
      log(`  Géo: ${locationTerms.join(' · ')}`, 'i')
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
      people = await findPeople(query1, icyPageSize)
      log(`  → ${people.length} résultats T1`, people.length ? 's' : 'w')
    } catch (e) {
      log(`  ⚠ Tentative 1 échouée : ${e.message}`, 'w')
    }

    // Tentative 2 : élargir avec keyword secteur
    if (people.length < 3 && isFR && companies.length > 0) {
      const kw = base.ape_label || (base.ape_code || '').split(',')[0]?.trim()
      if (kw) {
        log(`  Tentative 2 — keyword "${kw}" + postes`, 'i')
        try {
          const moreResults = await findPeople({ ...baseQuery, keyword: { include: [kw] } }, icyPageSize)
          // Merge et dédupe par profileUrl
          const existingUrls = new Set(people.map(p => p.profileUrl).filter(Boolean))
          for (const p of moreResults) {
            if (!existingUrls.has(p.profileUrl)) {
              people.push(p)
              existingUrls.add(p.profileUrl)
            }
          }
          log(`  → ${people.length} résultats cumulés`, people.length ? 's' : 'w')
        } catch (e) {
          log(`  ⚠ Tentative 2 échouée : ${e.message}`, 'w')
        }
      }
    }

    // Tentative 3 : postes + location seulement
    // ⚠ Ne déclencher QUE si l'user n'a PAS spécifié de filtre géographique précis
    // Sinon on retournerait des contacts de n'importe où en France
    const hasGeoFilter = isFR ? deptCodes.length > 0 : !!base.intl_city
    if (people.length < 3 && !hasGeoFilter) {
      log(`  Tentative 3 — postes + location seulement`, 'i')
      try {
        const moreResults = await findPeople(baseQuery, icyPageSize)
        const existingUrls = new Set(people.map(p => p.profileUrl).filter(Boolean))
        for (const p of moreResults) {
          if (!existingUrls.has(p.profileUrl)) {
            people.push(p)
            existingUrls.add(p.profileUrl)
          }
        }
        log(`  → ${people.length} résultats cumulés`, people.length ? 's' : 'w')
      } catch (e) {
        log(`  ⚠ Tentative 3 échouée : ${e.message}`, 'w')
      }
    } else if (people.length < 3 && hasGeoFilter) {
      log(`  ℹ Peu de résultats, mais filtre géo strict maintenu (${base.dept_label || base.intl_city})`, 'i')
    }

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      return fail('Aucun contact trouvé après 3 tentatives. Essayez : postes plus génériques (CEO au lieu de Directeur Général), secteur plus large, ou une autre localisation.')
    }

    log(`✓ ${people.length} contacts trouvés (après dédup)`, 's')

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
        email:        null,
        email_cert:   null,
        linkedin_url: p.profileUrl || null,
        location:     p.address || co.siege?.libelle_commune || null,
        sector:       p.lastCompanyIndustry || base.ape_label || base.intl_sector || '',
        source:       'icypeas',
        // Site web stocké pour l'enrichissement email ultérieur
        raw_data: {
          website: p.lastCompanyWebsite || '',
          company: p.lastCompanyName    || '',
        },
      }
    })

    // Map firstname+lastname → website pour l'enrichissement email ensuite
    const websiteMap = {}
    people.forEach(p => {
      const k = `${(p.firstname||'').toLowerCase()}_${(p.lastname||'').toLowerCase()}`
      websiteMap[k] = p.lastCompanyWebsite || p.lastCompanyName || ''
    })

    log(`Préparation de ${records.length} records pour Supabase…`, 'i')
    const { data: inserted, error: insertError } = await admin.from('prospects').insert(records).select('id, fullname')
    if (insertError) {
      log(`⚠ Erreur sauvegarde: ${insertError.message}`, 'e')
      log(`  Détails: ${JSON.stringify(insertError).slice(0, 200)}`, 'e')
      return fail(`Sauvegarde échouée: ${insertError.message}`)
    }
    const count = inserted?.length || 0
    if (count < records.length) {
      log(`⚠ Seulement ${count}/${records.length} contacts insérés (contrainte unique ?)`, 'w')
    }
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
