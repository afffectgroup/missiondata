/**
 * Pipeline Icypeas — reçoit les sociétés SIRENE du client, cherche les contacts
 * SIRENE est appelé côté navigateur (CORS OK), Icypeas côté serveur (clé sécurisée)
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { regionsFromDeptCodes, addressMatchesTerms } from '../../../../lib/france-regions'
import { countryDisplayNames } from '../../../../lib/country-names'

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
  // excludeProfileUrls = liste des profileUrl déjà en base (mode "+10 contacts")
  const { companies = [], excludeProfileUrls = [] } = req.body || {}
  const isDeltaMode = excludeProfileUrls.length > 0

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
  // En mode delta, on GARDE les prospects existants. Sinon on delete tout.
  if (!isDeltaMode) {
    await admin.from('prospects').delete().eq('campaign_id', id)
  } else {
    log(`Mode delta : on garde les ${excludeProfileUrls.length} contacts existants`, 'i')
  }

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

    // Termes géographiques pour location Icypeas ET post-filter par address
    let geoTerms = []

    if (isFR) {
      if (base.dept_label) {
        const depts = base.dept_label.split(',').map(s => s.trim()).filter(Boolean)
        geoTerms.push(...depts)
      }
      // Ajout automatique des régions correspondantes (meilleur matching LinkedIn)
      const regions = regionsFromDeptCodes(deptCodes)
      geoTerms.push(...regions)

      // Location Icypeas :
      // - Si départements précis → PAS de 'FR' fallback (trop large, ramène toute la France)
      // - Si aucun département → 'FR' par défaut
      baseQuery.location = {
        include: geoTerms.length ? geoTerms : ['FR'],
      }
      log(`  Géo: ${baseQuery.location.include.join(' · ')}`, 'i')
    } else {
      // INTERNATIONAL
      // Icypeas location filter : on passe le code alpha-2 (recommandé par la doc)
      const loc = base.intl_city || base.country_code || 'FR'
      baseQuery.location = { include: [loc] }

      // Post-filter : JAMAIS le code alpha-2 seul (trop générique)
      // Utiliser les noms du pays dans toutes les langues possibles
      // LinkedIn retourne l'adresse en langue locale (ex: "Hamburg, Deutschland")
      geoTerms = []
      if (base.intl_city) geoTerms.push(base.intl_city)
      const countryNames = countryDisplayNames(base.country_code)
      geoTerms.push(...countryNames)
      log(`  Géo international: ville=${base.intl_city || '—'}, pays=${countryNames.join(' / ')}`, 'i')
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
      // INTERNATIONAL : traduire le secteur FR → EN pour matcher les profils anglophones
      // Icypeas cherche dans tout le profil (headline, job titles, descriptions, skills)
      if (base.intl_sector) {
        const SECTOR_KEYWORDS = {
          'Cosmétique & Beauté':  ['cosmetics', 'beauty', 'skincare', 'makeup', 'cosmetic'],
          'Mode & Luxe':          ['fashion', 'luxury', 'apparel', 'couture'],
          'Tech & SaaS':          ['software', 'SaaS', 'technology', 'tech'],
          'Finance & Fintech':    ['finance', 'fintech', 'banking', 'investment'],
          'Santé & Biotech':      ['healthcare', 'biotech', 'pharma', 'medical'],
          'E-commerce & Retail':  ['ecommerce', 'retail', 'commerce'],
          'Marketing & Digital':  ['marketing', 'digital', 'advertising'],
          'Conseil & Stratégie':  ['consulting', 'strategy', 'advisory'],
          'Immobilier':           ['real estate', 'property', 'realty'],
          'Industrie & Manufacturing': ['manufacturing', 'industrial', 'industry'],
          'Énergie & Environnement':   ['energy', 'sustainability', 'renewable'],
          'Education & Formation':     ['education', 'training', 'edtech'],
          'Médias & Divertissement':   ['media', 'entertainment', 'publishing'],
          'Agroalimentaire':           ['food', 'beverage', 'agrifood'],
          'Transport & Logistique':    ['logistics', 'transport', 'supply chain'],
        }
        const kws = SECTOR_KEYWORDS[base.intl_sector] || [base.intl_sector]
        query1.keyword = { include: kws }
        log(`  Tentative 1 — ${base.country_label || base.country_code} · secteur "${base.intl_sector}" → [${kws.join(', ')}]`, 'i')
      } else {
        log(`  Tentative 1 — ${base.country_label || base.country_code} · tous secteurs`, 'i')
      }
    }

    try {
      people = await findPeople(query1, icyPageSize)
      log(`  → ${people.length} résultats T1`, people.length ? 's' : 'w')
    } catch (e) {
      log(`  ⚠ Tentative 1 échouée : ${e.message}`, 'w')
    }

    // Tentative 2 : élargir (France seulement — passe du filtre entreprise au keyword secteur)
    if (people.length < 3 && isFR && companies.length > 0) {
      // Utiliser TOUS les libellés APE (l'user peut en avoir coché 6)
      const kws = (base.ape_label || '').split(',').map(s => s.trim()).filter(Boolean)
      if (kws.length) {
        log(`  Tentative 2 — keywords [${kws.join(', ')}] + postes`, 'i')
        try {
          const moreResults = await findPeople({ ...baseQuery, keyword: { include: kws } }, icyPageSize)
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

    // Tentative 3 : postes + location seulement (SANS keyword secteur)
    // ⚠ Ne déclencher QUE si l'user n'a spécifié NI géo précise NI secteur
    // Sinon on retournerait des contacts random (mauvais secteur OU mauvaise géo)
    const hasGeoFilter = isFR ? deptCodes.length > 0 : !!base.intl_city
    const hasSectorFilter = isFR ? !!base.ape_code : !!base.intl_sector
    if (people.length < 3 && !hasGeoFilter && !hasSectorFilter) {
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
    } else if (people.length < 3 && (hasGeoFilter || hasSectorFilter)) {
      const maintained = []
      if (hasGeoFilter)    maintained.push(`géo ${base.dept_label || base.intl_city}`)
      if (hasSectorFilter) maintained.push(`secteur ${base.ape_label || base.intl_sector}`)
      log(`  ℹ Peu de résultats, filtres stricts maintenus (${maintained.join(' + ')})`, 'i')
    }

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      return fail('Aucun contact trouvé après 3 tentatives. Essayez : postes plus génériques (CEO au lieu de Directeur Général), secteur plus large, ou une autre localisation.')
    }

    // ── FILTRE MODE DELTA : exclure les profileUrl déjà en base ──
    if (isDeltaMode) {
      const excludeSet = new Set(excludeProfileUrls)
      const beforeDelta = people.length
      people = people.filter(p => p.profileUrl && !excludeSet.has(p.profileUrl))
      if (beforeDelta !== people.length) {
        log(`  Filtre delta: ${people.length}/${beforeDelta} nouveaux contacts (${beforeDelta - people.length} déjà en base)`, 'i')
      }
    }

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100 }).eq('id', id)
      return fail('Pas de nouveau contact — tous les résultats Icypeas sont déjà dans cette base.')
    }

    // Limiter au nombre demandé (nCo) en mode delta
    if (isDeltaMode) {
      people = people.slice(0, nCo)
    }

    // ── POST-FILTER GÉOGRAPHIQUE STRICT ──
    // Icypeas fait du fuzzy match sur location et peut retourner des profils hors zone.
    // On vérifie que l'adresse contient AU MOINS UN des termes géographiques demandés.
    if (geoTerms.length) {
      const before = people.length
      people = people.filter(p => addressMatchesTerms(p.address, geoTerms))
      if (before !== people.length) {
        log(`  Filtre géo strict: ${people.length}/${before} contacts (adresses contenant ${geoTerms.slice(0,3).join('/')}...)`, 'i')
      }
    }

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      return fail(`Aucun contact dans la zone demandée (${geoTerms.slice(0,3).join(', ')}). Essayez d'élargir les critères géographiques.`)
    }

    log(`✓ ${people.length} contacts trouvés (après dédup + filtre géo)`, 's')

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

    // En mode delta : ajouter au total existant. Sinon : remplacer.
    const totalCount = isDeltaMode
      ? (await admin.from('prospects').select('id', { count: 'exact', head: true }).eq('campaign_id', id)).count || count
      : count

    await admin.from('campaigns').update({ status: 'done', generation_pct: 90, prospects_count: totalCount }).eq('id', id)
    log(`✓ ${count} nouveaux contacts sauvegardés (total: ${totalCount})`, 's')

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
