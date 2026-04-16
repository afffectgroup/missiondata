/**
 * Pipeline direct — SIRENE REST + Icypeas REST
 * Pas de MCP, pas d'Anthropic API — appels directs serveur-to-serveur
 * SSE pour logs temps réel
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

export const config = { api: { responseLimit: false } }

const ICYPEAS_BASE = 'https://app.icypeas.com/api'

async function icypeas(path, body) {
  const r = await fetch(`${ICYPEAS_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.ICYPEAS_API_KEY },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  try { return JSON.parse(text) }
  catch { throw new Error(`Icypeas ${path}: ${text.slice(0, 150)}`) }
}

async function sireneSearch(apeCode, dept, effectif, perPage) {
  const p = new URLSearchParams({ per_page: perPage, page: 1 })
  // Format APE: remove dot (20.42Z → 2042Z)
  if (apeCode)  p.set('activite_principale', apeCode.replace(/\./g, ''))
  if (dept)     p.set('departement', dept)
  if (effectif) p.set('tranche_effectif_salarie', effectif)

  const url = `https://recherche-entreprises.api.gouv.fr/search?${p}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`SIRENE ${r.status}: ${t.slice(0, 100)}`)
  }
  const d = await r.json()
  return { results: d.results || [], total: d.total_results || 0 }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id }  = req.query
  const admin   = getSupabaseAdmin()
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

  try {
    await admin.from('campaigns').update({ status: 'generating', generation_pct: 0 }).eq('id', id)
    await admin.from('prospects').delete().eq('campaign_id', id)

    const isFR    = (base.mode || 'france') !== 'international'
    const titles  = (base.job_titles || base.client_need || '').split(',').map(s => s.trim()).filter(Boolean)
    const apeCodes  = (base.ape_code    || '').split(',').map(s => s.trim()).filter(Boolean)
    const deptCodes = (base.departement || '').split(',').map(s => s.trim()).filter(Boolean)
    const effCodes  = (base.effectif_code || '').split(',').map(s => s.trim()).filter(Boolean)
    const nCo = base.n_companies || 10

    let companies = []

    // ── Étape 1 : SIRENE ──
    if (isFR) {
      log('↗ SIRENE — recherche entreprises…', 'i')

      const apesToSearch  = apeCodes.length  ? apeCodes  : ['']
      const deptsToSearch = deptCodes.length ? deptCodes : ['']
      const perApe        = Math.max(Math.ceil(nCo / apesToSearch.length), 5)

      const calls = []
      for (const ape of apesToSearch) {
        for (const dept of deptsToSearch) {
          calls.push(
            sireneSearch(ape, dept, effCodes[0] || '', perApe)
              .catch(e => { log(`⚠ SIRENE erreur: ${e.message}`, 'w'); return { results: [], total: 0 } })
          )
        }
      }

      const batches = await Promise.all(calls)
      const seen    = new Set()
      let totalFound = 0
      for (const batch of batches) {
        totalFound += batch.total || 0
        for (const co of (batch.results || [])) {
          if (co.siren && !seen.has(co.siren)) {
            seen.add(co.siren)
            companies.push(co)
          }
        }
      }

      log(`SIRENE: ${companies.length} sociétés récupérées (${totalFound} total dispo)`, 'i')

      // Fallback : si 0 résultats avec effectif, réessayer sans
      if (!companies.length && effCodes.length) {
        log('⚠ 0 résultats avec filtre taille — on réessaie sans filtre effectif…', 'w')
        const fallbackCalls = apesToSearch.flatMap(ape =>
          deptsToSearch.map(dept =>
            sireneSearch(ape, dept, '', perApe)
              .catch(() => ({ results: [], total: 0 }))
          )
        )
        const fallbackBatches = await Promise.all(fallbackCalls)
        for (const batch of fallbackBatches) {
          for (const co of (batch.results || [])) {
            if (co.siren && !seen.has(co.siren)) {
              seen.add(co.siren)
              companies.push(co)
            }
          }
        }
        log(`Fallback SIRENE: ${companies.length} sociétés`, companies.length > 0 ? 's' : 'w')
      }

      if (!companies.length) {
        await admin.from('campaigns').update({ status: 'draft', generation_pct: 0 }).eq('id', id)
        return fail(`Aucune société trouvée dans SIRENE pour le code APE "${apeCodes.join(', ')}". Essayez un autre secteur ou sans filtre département.`)
      }

      log(`✓ ${companies.length} sociétés trouvées`, 's')
      send('companies', { count: companies.length, names: companies.slice(0, 5).map(c => c.nom_raison_sociale) })
    }

    // ── Étape 2 : Icypeas find-people ──
    log('↗ Icypeas — recherche contacts…', 't')

    const query = { currentJobTitle: { include: titles }, location: { include: ['FR'] } }
    if (isFR && companies.length) {
      query.currentCompanyName = { include: companies.slice(0, 20).map(c => c.nom_raison_sociale).filter(Boolean) }
    } else if (!isFR) {
      query.location = { include: [base.intl_city || base.country_code || 'FR'] }
      if (base.intl_sector) query.keyword = { include: [base.intl_sector] }
    }

    const fp = await icypeas('/find-people', { query, maxResults: nCo })
    const people = Array.isArray(fp) ? fp : (fp.items || fp.leads || [])

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      return fail('Aucun contact trouvé — essayez des postes différents ou des critères plus larges.')
    }

    log(`✓ ${people.length} contacts trouvés`, 's')

    // ── Étape 3 : Email bulk search ──
    log('↗ Icypeas — enrichissement emails…', 't')

    const emailInput = people
      .filter(p => p.firstname && p.lastname && (p.lastCompanyWebsite || p.lastCompanyName))
      .map(p => ({
        firstname:       p.firstname,
        lastname:        p.lastname,
        // Site web en priorité — beaucoup plus fiable que le nom d'entreprise
        domainOrCompany: p.lastCompanyWebsite || p.lastCompanyName,
      }))

    let emailMap = {}

    if (emailInput.length) {
      try {
        const bulk = await icypeas('/bulk-single-searchs', {
          name: `md-${id.slice(0, 8)}-${Date.now()}`,
          task: 'email-search',
          data: emailInput.map(e => [e.firstname, e.lastname, e.domainOrCompany]),
        })

        const batchId = bulk?.item?._id || bulk?._id
        if (batchId) {
          // Poll jusqu'à 45s
          for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 3000))
            const poll = await icypeas('/bulk-single-searchs/read', { id: batchId })
            const items = poll?.items || []
            for (const item of items) {
              if (item.results?.emails?.[0]) {
                const k = `${item.results.firstname?.toLowerCase()}_${item.results.lastname?.toLowerCase()}`
                emailMap[k] = { email: item.results.emails[0].email, certainty: item.results.emails[0].certainty }
              }
            }
            const status = poll?.item?.status || poll?.status || ''
            if (['DONE','PARTIALLY_DONE','FAILED'].some(s => status.includes(s))) break
          }
        }
      } catch (e) {
        log(`⚠ Email enrichment: ${e.message}`, 'w')
      }
    }

    const enriched = people.filter(p => emailMap[`${p.firstname?.toLowerCase()}_${p.lastname?.toLowerCase()}`]).length
    log(`✓ ${enriched}/${people.length} emails enrichis`, 's')

    // ── Étape 4 : Sauvegarde ──
    log('Sauvegarde…', 'i')
    const sirenMap = Object.fromEntries(companies.map(c => [(c.nom_raison_sociale || '').toLowerCase(), c]))

    const records = people.map(p => {
      const k  = `${p.firstname?.toLowerCase()}_${p.lastname?.toLowerCase()}`
      const em = emailMap[k] || {}
      const co = sirenMap[(p.lastCompanyName || '').toLowerCase()] || {}
      return {
        campaign_id:  id,
        user_id:      session.user.id,
        fullname:     [p.firstname, p.lastname].filter(Boolean).join(' '),
        job_title:    p.lastJobTitle || p.headline || '',
        company:      p.lastCompanyName || '',
        email:        em.email     || null,
        email_cert:   em.certainty || null,
        linkedin_url: p.profileUrl || null,
        location:     p.address || co.siege?.libelle_commune || null,
        sector:       p.lastCompanyIndustry || base.ape_label || base.intl_sector || '',
        source:       'icypeas',
        // Sauvegarder le site web pour l'enrichissement email ultérieur
        raw_data: JSON.stringify({
          website: p.lastCompanyWebsite || '',
          company: p.lastCompanyName    || '',
        }),
      }
    })

    const { data: inserted } = await admin.from('prospects').insert(records).select('id')
    const count = inserted?.length || 0

    await admin.from('campaigns').update({
      status: 'done', generation_pct: 100, prospects_count: count
    }).eq('id', id)

    log(`✓ ${count} contacts sauvegardés`, 's')
    done({ count })

  } catch (err) {
    await admin.from('campaigns').update({ status: 'draft', generation_pct: 0 }).eq('id', id).catch(() => {})
    fail(err.message)
  }
}
