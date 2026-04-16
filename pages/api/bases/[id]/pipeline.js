/**
 * Pipeline complet côté serveur
 * POST → SIRENE (si France) → Anthropic API + Icypeas MCP → save Supabase
 * Utilise SSE (Server-Sent Events) pour streamer les logs en temps réel
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

export const config = { api: { responseLimit: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const admin   = getSupabaseAdmin()

  const { data: base } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!base || base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  // ── SSE setup ──
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
  }

  const log = (msg, t = 'i') => send('log', { msg, t, ts: new Date().toLocaleTimeString('fr-FR') })
  const done = (data) => { send('done', data); res.end() }
  const fail = (msg) => { send('error', { msg }); res.end() }

  try {
    await admin.from('campaigns').update({ status: 'generating', generation_pct: 0 }).eq('id', id)
    await admin.from('prospects').delete().eq('campaign_id', id)

    const isFR    = (base.mode || 'france') !== 'international'
    const titles  = (base.job_titles || base.client_need || '').split(',').map(s => s.trim()).filter(Boolean)
    let companies = []

    // ── Étape 1 : SIRENE (serveur → pas de CORS) ──
    if (isFR) {
      log('↗ SIRENE — recherche sociétés…', 'i')
      const apeCodes  = (base.ape_code    || '').split(',').map(s => s.trim()).filter(Boolean)
      const deptCodes = (base.departement || '').split(',').map(s => s.trim()).filter(Boolean)
      const effCodes  = (base.effectif_code || '').split(',').map(s => s.trim()).filter(Boolean)
      const perApe    = Math.max(Math.ceil((base.n_companies || 10) / Math.max(apeCodes.length, 1)), 5)

      const calls = []
      for (const ape of (apeCodes.length ? apeCodes : [''])) {
        for (const dept of (deptCodes.length ? deptCodes : [''])) {
          const p = new URLSearchParams({ per_page: perApe, page: 1 })
          if (ape)  p.set('activite_principale', ape)
          if (dept) p.set('departement', dept)
          if (effCodes.length) p.set('tranche_effectif_salarie', effCodes[0])
          calls.push(
            fetch(`https://recherche-entreprises.api.gouv.fr/search?${p}`, {
              headers: { 'User-Agent': 'MissionData/1.0' }
            })
            .then(r => r.ok ? r.json() : { results: [] })
            .then(d => d.results || [])
            .catch(() => [])
          )
        }
      }

      const batches = await Promise.all(calls)
      const seen = new Set()
      for (const batch of batches) {
        for (const co of batch) {
          if (!seen.has(co.siren)) { seen.add(co.siren); companies.push(co) }
        }
      }

      if (!companies.length) {
        await admin.from('campaigns').update({ status: 'draft', generation_pct: 0 }).eq('id', id)
        return fail('Aucune société SIRENE trouvée. Essayez un code APE différent, sans filtre département, ou toutes tailles.')
      }
      log(`✓ ${companies.length} sociétés SIRENE trouvées`, 's')
      send('companies', { count: companies.length, names: companies.slice(0,5).map(c => c.nom_raison_sociale) })
    }

    // ── Étape 2 : Anthropic API + Icypeas MCP ──
    log('↗ Icypeas — recherche contacts…', 't')
    const compNames = companies.map(c => c.nom_raison_sociale).filter(Boolean)

    const system = `Tu es un assistant de prospection B2B. Utilise les outils Icypeas disponibles.
Retourne UNIQUEMENT un JSON valide sans aucun texte autour, ni markdown, ni explication.
Format exact : {"leads":[{"fullname":"","job_title":"","company":"","email":"","certainty":"","linkedin_url":"","location":"","domain":""}]}`

    const user = isFR
      ? `Trouve des contacts décisionnaires dans ces entreprises françaises :
${compNames.slice(0,20).map((n,i) => `${i+1}. ${n}`).join('\n')}
Postes cibles : ${titles.join(', ')}
1. Appelle find-people avec currentCompanyName.include:[${compNames.slice(0,15).map(n => JSON.stringify(n)).join(',')}], currentJobTitle.include:[${titles.map(t => JSON.stringify(t)).join(',')}], location.include:["FR"], maxResults:${base.n_companies || 20}
2. Appelle bulk-email-search pour enrichir les emails de tous les contacts trouvés
3. Retourne UNIQUEMENT {"leads":[...]} — rien d'autre, pas de markdown`
      : `Trouve ${base.n_companies || 20} contacts B2B :
Postes : ${titles.join(', ')}
Pays : ${base.country_label || base.country_code || 'FR'}${base.intl_city ? ` — ${base.intl_city}` : ''}${base.intl_sector ? ` — Secteur: ${base.intl_sector}` : ''}
1. Appelle find-people avec les filtres appropriés
2. Appelle bulk-email-search
3. Retourne UNIQUEMENT {"leads":[...]} — rien d'autre`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04',
      },
      body: JSON.stringify({
        model:       'claude-sonnet-4-20250514',
        max_tokens:  8192,
        system,
        mcp_servers: [{ type: 'url', url: 'https://mcp.icypeas.com/mcp', name: 'icypeas' }],
        messages:    [{ role: 'user', content: user }],
      }),
    })

    if (!anthropicRes.ok) {
      const e = await anthropicRes.json().catch(() => ({}))
      return fail(`Anthropic API: ${e.error?.message || anthropicRes.status}`)
    }

    const apiData = await anthropicRes.json()

    // Log tool calls
    for (const blk of (apiData.content || [])) {
      if (blk.type === 'tool_use' || blk.type === 'mcp_tool_use') log(`⚙ ${blk.name}`, 't')
    }

    // Extract JSON
    const rawText  = (apiData.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    const jsonMatch = rawText.match(/[{][\s\S]*[}]/)
    if (!jsonMatch) return fail('Réponse Icypeas invalide — réessayez')

    let leads = []
    try { leads = JSON.parse(jsonMatch[0]).leads || [] }
    catch { return fail('JSON invalide — réessayez') }

    log(`✓ ${leads.length} contacts (${leads.filter(l => l.email).length} avec email)`, 's')

    // ── Étape 3 : Sauvegarde ──
    log('Sauvegarde…', 'i')
    const sirenMap = Object.fromEntries(companies.map(c => [c.nom_raison_sociale?.toLowerCase(), c]))
    const records  = leads.map(l => {
      const co = sirenMap[l.company?.toLowerCase()] || {}
      return {
        campaign_id:  id,
        user_id:      session.user.id,
        fullname:     l.fullname || '',
        job_title:    l.job_title || '',
        company:      l.company || '',
        email:        l.email || null,
        email_cert:   l.certainty || null,
        linkedin_url: l.linkedin_url || null,
        location:     l.location || co.siege?.libelle_commune || null,
        sector:       base.ape_label || base.intl_sector || '',
        source:       'icypeas',
        raw_data:     l.domain ? JSON.stringify({ website: l.domain }) : null,
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
