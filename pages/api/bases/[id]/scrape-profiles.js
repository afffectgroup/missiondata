/**
 * POST /api/bases/:id/scrape-profiles
 * Enrichit les prospects d'une base en scrapant leurs profils LinkedIn via Icypeas.
 * Retourne : skills, formation, mobile (si dispo), industry précise, etc.
 * Rate limit /scrape : 20 calls/sec avec max 50 rows par call → un seul batch suffit pour la plupart des bases.
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

const ICYPEAS = 'https://app.icypeas.com/api'

async function icy(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: process.env.ICYPEAS_API_KEY },
  }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${ICYPEAS}${path}`, opts)
  const text = await r.text()
  try { return JSON.parse(text) }
  catch { throw new Error(`Icypeas ${path} ${r.status}: ${text.slice(0, 160)}`) }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const admin = getSupabaseAdmin()

  const { data: base } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!base || base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  // Récupérer les prospects avec linkedin_url et PAS encore enrichis
  const { data: prospects } = await admin
    .from('prospects')
    .select('id, fullname, linkedin_url, raw_data')
    .eq('campaign_id', id)
    .not('linkedin_url', 'is', null)

  if (!prospects?.length) {
    return res.status(200).json({ enriched: 0, total: 0, message: 'Aucun profil LinkedIn à scraper' })
  }

  // Filtrer ceux qui n'ont pas encore été scrapés (pas de raw_data.linkedin_scraped)
  const toScrape = prospects.filter(p => !p.raw_data?.linkedin_scraped)
  if (!toScrape.length) {
    return res.status(200).json({ enriched: 0, total: prospects.length, message: 'Tous les profils sont déjà enrichis' })
  }

  // Max 50 URLs par batch Icypeas. Si plus, on découpe.
  const BATCH_SIZE = 50
  const batches = []
  for (let i = 0; i < toScrape.length; i += BATCH_SIZE) {
    batches.push(toScrape.slice(i, i + BATCH_SIZE))
  }

  let totalEnriched = 0
  const errors = []

  for (const batch of batches) {
    try {
      // 1. Soumettre le batch
      const urls = batch.map(p => p.linkedin_url)
      const bulk = await icy('POST', '/scrape', { type: 'profile', data: urls })
      const fileId = bulk?.file || bulk?._id
      if (!fileId) {
        errors.push('Pas de fileId retourné par /scrape')
        continue
      }

      // 2. Poll les résultats — max 60s par batch
      let batchResults = []
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 4000))

        const poll = await icy('POST', '/bulk-single-searchs/read', {
          mode: 'bulk', file: fileId, limit: 100,
        })

        const items = Array.isArray(poll?.items) ? poll.items : []
        batchResults = items

        // Fin du batch ?
        const statuses = items.map(it => it.status || '').filter(Boolean)
        const done     = statuses.length === urls.length &&
                         statuses.every(s => ['DEBITED','DONE','NOT_FOUND','FAILED'].some(x => s.includes(x)))
        if (done) break
      }

      // 3. Update chaque prospect avec les données scrapées
      for (let idx = 0; idx < batch.length; idx++) {
        const prospect = batch[idx]
        const result   = batchResults.find(r => r.order === idx || r.query?.url === prospect.linkedin_url)
        const data     = result?.results
        if (!data) continue

        const newRawData = {
          ...(prospect.raw_data || {}),
          linkedin_scraped: true,
          scraped_at:       new Date().toISOString(),
          headline:         data.headline || null,
          about:            data.about || data.description || null,
          skills:           Array.isArray(data.skills) ? data.skills.slice(0, 20) : [],
          education:        Array.isArray(data.education) ? data.education.map(e => ({
            school: e.school || e.schoolName, degree: e.degree, field: e.field,
          })) : [],
          experiences:      Array.isArray(data.experiences) ? data.experiences.slice(0, 5).map(e => ({
            company: e.company || e.companyName, title: e.title, start: e.startDate, end: e.endDate,
          })) : [],
          languages:        Array.isArray(data.languages) ? data.languages : [],
          location_exact:   data.location || data.address || null,
          followers_count:  data.followersCount || null,
          connections_count: data.connectionsCount || null,
        }

        // Update aussi le champ location si plus précis
        const updates = { raw_data: newRawData }
        if (data.location && !prospect.location) updates.location = data.location

        const { error } = await admin.from('prospects').update(updates).eq('id', prospect.id)
        if (!error) totalEnriched++
      }
    } catch (e) {
      errors.push(e.message)
    }
  }

  return res.status(200).json({
    enriched: totalEnriched,
    total:    toScrape.length,
    skipped:  prospects.length - toScrape.length,
    errors:   errors.length ? errors : undefined,
  })
}
