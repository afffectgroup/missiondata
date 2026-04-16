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

    // ── Icypeas find-people ──
    log('↗ Icypeas find-people…', 't')

    const query = { currentJobTitle: { include: titles } }

    if (isFR) {
      if (companies.length > 0) {
        // SIRENE a retourné des sociétés → cibler exactement ces entreprises
        const names = companies.slice(0, 20).map(c => c.nom_raison_sociale).filter(Boolean)
        query.currentCompanyName = { include: names }
        query.location = { include: ['FR'] }
        log(`  Ciblage de ${names.length} sociétés SIRENE`, 'i')
      } else {
        // 0 sociétés SIRENE → recherche par secteur APE comme keyword
        query.location = { include: ['FR'] }
        const keyword = base.ape_label || (base.ape_code || '').split(',')[0]?.trim()
        if (keyword) {
          query.keyword = { include: [keyword] }
          log(`  Recherche directe par secteur: ${keyword}`, 'i')
        }
      }
    } else {
      // International
      const loc = base.intl_city || base.country_code || 'FR'
      query.location = { include: [loc] }
      if (base.intl_sector) query.keyword = { include: [base.intl_sector] }
    }

    const fp   = await icy('/find-people', { query, maxResults: nCo })
    const people = Array.isArray(fp) ? fp : (fp.items || fp.leads || [])

    if (!people.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      return fail('Aucun contact trouvé — essayez des critères différents.')
    }

    log(`✓ ${people.length} contacts trouvés`, 's')

    // ── Email bulk search ──
    log('↗ Icypeas email enrichment…', 't')

    const emailInput = people
      .filter(p => p.firstname && p.lastname && (p.lastCompanyWebsite || p.lastCompanyName))
      .map(p => ({
        firstname:       p.firstname,
        lastname:        p.lastname,
        domainOrCompany: p.lastCompanyWebsite || p.lastCompanyName,
      }))

    let emailMap = {}
    if (emailInput.length) {
      try {
        const bulk = await icy('/bulk-single-searchs', {
          name: `md-${id.slice(0,8)}-${Date.now()}`,
          task: 'email-search',
          data: emailInput.map(e => [e.firstname, e.lastname, e.domainOrCompany]),
        })
        const batchId = bulk?.item?._id || bulk?._id
        if (batchId) {
          for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 3000))
            const poll = await icy('/bulk-single-searchs/read', { id: batchId })
            const items = Array.isArray(poll?.items) ? poll.items : []
            for (const item of items) {
              if (item.results?.emails?.[0]) {
                const k = `${(item.results.firstname||'').toLowerCase()}_${(item.results.lastname||'').toLowerCase()}`
                emailMap[k] = { email: item.results.emails[0].email, certainty: item.results.emails[0].certainty }
              }
            }
            const status = poll?.item?.status || ''
            if (['DONE','PARTIALLY_DONE','FAILED'].some(s => status.includes(s))) break
          }
        }
      } catch(e) {
        log(`⚠ Email enrichment: ${e.message}`, 'w')
      }
    }

    const emailCount = Object.keys(emailMap).length
    log(`✓ ${emailCount}/${people.length} emails trouvés`, 's')

    // ── Sauvegarde ──
    log('Sauvegarde…', 'i')
    const sirenMap = Object.fromEntries(companies.map(c => [(c.nom_raison_sociale||'').toLowerCase(), c]))

    const records = people.map(p => {
      const k  = `${(p.firstname||'').toLowerCase()}_${(p.lastname||'').toLowerCase()}`
      const em = emailMap[k] || {}
      const co = sirenMap[(p.lastCompanyName||'').toLowerCase()] || {}
      return {
        campaign_id:  id,
        user_id:      session.user.id,
        fullname:     [p.firstname, p.lastname].filter(Boolean).join(' '),
        job_title:    p.lastJobTitle || p.headline || '',
        company:      p.lastCompanyName || '',
        email:        em.email || null,
        email_cert:   em.certainty || null,
        linkedin_url: p.profileUrl || null,
        location:     p.address || co.siege?.libelle_commune || null,
        sector:       p.lastCompanyIndustry || base.ape_label || base.intl_sector || '',
        source:       'icypeas',
        raw_data:     JSON.stringify({ website: p.lastCompanyWebsite||'', company: p.lastCompanyName||'' }),
      }
    })

    const { data: inserted } = await admin.from('prospects').insert(records).select('id')
    const count = inserted?.length || 0

    await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: count }).eq('id', id)
    log(`✓ ${count} contacts sauvegardés`, 's')
    done({ count })

  } catch (err) {
    await admin.from('campaigns').update({ status: 'draft', generation_pct: 0 }).eq('id', id).catch(() => {})
    fail(err.message)
  }
}
