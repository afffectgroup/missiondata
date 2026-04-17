/**
 * Email enrichment via Icypeas bulk-single-searchs
 * Un seul batch pour tous les contacts sans email
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

const ICYPEAS_BASE = 'https://app.icypeas.com/api'

async function icypeas(path, body) {
  const r = await fetch(`${ICYPEAS_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.ICYPEAS_API_KEY },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  try { return JSON.parse(text) }
  catch { throw new Error(`Icypeas ${path}: ${r.status} ${text.slice(0, 150)}`) }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const admin   = getSupabaseAdmin()

  const { data: base } = await admin.from('campaigns').select('id,user_id').eq('id', id).single()
  if (!base || base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  // Prospects sans email
  const { data: prospects } = await admin
    .from('prospects')
    .select('id, fullname, company, raw_data')
    .eq('campaign_id', id)
    .is('email', null)
    .limit(50)

  if (!prospects?.length) return res.status(200).json({ enriched: 0, total: 0 })

  // Build batch input — site web en priorité sur nom d'entreprise
  const input = prospects.map(p => {
    const parts     = (p.fullname || '').split(' ')
    const firstname = parts[0] || ''
    const lastname  = parts.slice(1).join(' ') || ''
    let website = ''
    let company = p.company || ''
    try {
      const rd = JSON.parse(p.raw_data || '{}')
      if (rd.website) website = rd.website
      if (rd.company) company = rd.company
    } catch {}
    // Icypeas : site web > nom d'entreprise
    const domainOrCompany = website || company
    return { id: p.id, firstname, lastname, domainOrCompany }
  }).filter(x => x.firstname && x.lastname && x.domainOrCompany)

  if (!input.length) return res.status(200).json({ enriched: 0, total: prospects.length })

  try {
    // 1. Soumettre bulk batch via /bulk-search
    const bulk = await icypeas('/bulk-search', {
      name: `md-enrich-${id.slice(0, 8)}-${Date.now()}`,
      task: 'email-search',
      data: input.map(x => [x.firstname, x.lastname, x.domainOrCompany]),
    })

    const fileId = bulk?.file || bulk?._id
    if (!fileId) return res.status(200).json({ enriched: 0, total: input.length, error: 'Pas de fileId' })

    // 2. Poll — max 2 minutes, 4s entre chaque poll (rate limit /bulk-single-searchs/read = 30/min)
    const results = []
    const seen = new Set()
    let batchDone = false

    for (let i = 0; i < 30 && !batchDone; i++) {
      await new Promise(r => setTimeout(r, 4000))

      const poll = await icypeas('/bulk-single-searchs/read', {
        mode: 'bulk',
        file: fileId,
        limit: 100,
      })

      const items = Array.isArray(poll?.items) ? poll.items : []
      for (const item of items) {
        if (item.results?.emails?.[0] && item.status !== 'NOT_FOUND') {
          const key = item._id || item.order
          if (!seen.has(key)) {
            seen.add(key)
            results.push({
              order:     item.order ?? 0,
              email:     item.results.emails[0].email,
              certainty: item.results.emails[0].certainty,
            })
          }
        }
      }

      // Vérifier si batch terminé
      try {
        const fileStatus = await icypeas('/search-files/read', { file: fileId })
        const status = fileStatus?.items?.[0]?.status || fileStatus?.file?.status || ''
        if (status === 'done' || status.includes('done') || status.includes('finished')) {
          batchDone = true
        }
      } catch {}
    }

    // Update prospects with emails
    let enriched = 0
    for (const r of results) {
      const prospect = input[r.order]
      if (!prospect) continue
      const { error } = await admin.from('prospects').update({
        email:      r.email,
        email_cert: r.certainty,
      }).eq('id', prospect.id)
      if (!error) enriched++
    }

    return res.status(200).json({ enriched, total: input.length, timedOut: !batchDone })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
