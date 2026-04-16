/**
 * Pipeline complet — Anthropic API avec Datagouv MCP + Icypeas MCP
 * 1. Claude appelle Datagouv MCP → entreprises SIRENE par code APE
 * 2. Claude appelle Icypeas MCP → contacts dans ces entreprises + emails
 * 3. Save Supabase
 * SSE pour logs en temps réel
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

    const isFR   = (base.mode || 'france') !== 'international'
    const titles = (base.job_titles || base.client_need || '').split(',').map(s => s.trim()).filter(Boolean)
    const apeCodes  = (base.ape_code    || '').split(',').map(s => s.trim()).filter(Boolean)
    const deptCodes = (base.departement || '').split(',').map(s => s.trim()).filter(Boolean)
    const effCodes  = (base.effectif_code || '').split(',').map(s => s.trim()).filter(Boolean)
    const nCo       = base.n_companies || 10

    log('Connexion Anthropic + MCPs…', 'i')

    // ── Prompt selon mode ──
    const system = `Tu es un assistant expert en prospection B2B.
Tu as accès aux outils Datagouv (SIRENE) et Icypeas.
Retourne UNIQUEMENT un JSON valide sans texte autour.
Format exact :
{"companies":[{"name":"","siren":"","ville":""}],"leads":[{"fullname":"","job_title":"","company":"","email":"","certainty":"","linkedin_url":"","location":""}]}`

    let user
    if (isFR) {
      const apeList    = apeCodes.map(c => c.replace('.', '')).join(', ') || '7311Z'
      const deptFilter = deptCodes.length ? `département(s) : ${deptCodes.join(', ')}` : 'toute la France'
      const effFilter  = effCodes.length  ? `taille : ${effCodes.join(', ')} (code tranche effectif)` : 'toutes tailles'

      user = `Effectue une recherche de prospection B2B en France :

**Étape 1 — Recherche SIRENE via l'API Recherche d'Entreprises**
Appelle l'outil dataservices ou search avec :
- URL : https://recherche-entreprises.api.gouv.fr/search
- Paramètre activite_principale : ${apeList}
- ${deptFilter}
- ${effFilter}
- per_page : ${nCo}

**Étape 2 — Recherche contacts via Icypeas**
Utilise find-people avec :
- currentJobTitle.include : [${titles.map(t => JSON.stringify(t)).join(',')}]
- currentCompanyName.include : [noms des sociétés trouvées à l'étape 1, max 20]
- location.include : ["FR"]
- maxResults : ${nCo}

**Étape 3 — Enrichissement emails**
Appelle bulk-email-search sur tous les contacts trouvés.

Retourne UNIQUEMENT {"companies":[...],"leads":[...]} — rien d'autre.`
    } else {
      user = `Effectue une recherche de prospection B2B internationale :

**Étape 1 — Icypeas find-people**
- currentJobTitle.include : [${titles.map(t => JSON.stringify(t)).join(',')}]
- location.include : [${JSON.stringify(base.intl_city || base.country_code || 'FR')}]
${base.intl_sector ? `- keyword.include : [${JSON.stringify(base.intl_sector)}]` : ''}
- maxResults : ${nCo}

**Étape 2 — bulk-email-search**
Enrichis tous les contacts.

Retourne UNIQUEMENT {"companies":[],"leads":[...]} — rien d'autre.`
    }

    const mcpServers = [
      { type: 'url', url: 'https://mcp.icypeas.com/mcp',  name: 'icypeas',  authorization_token: process.env.ICYPEAS_API_KEY },
      { type: 'url', url: 'https://mcp.data.gouv.fr/mcp', name: 'datagouv' },
    ]

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'mcp-client-2025-04-04',
      },
      body: JSON.stringify({
        model:       'claude-sonnet-4-20250514',
        max_tokens:  8192,
        system,
        mcp_servers: mcpServers,
        messages:    [{ role: 'user', content: user }],
      }),
    })

    if (!anthropicRes.ok) {
      const e = await anthropicRes.json().catch(() => ({}))
      return fail(`Erreur API : ${e.error?.message || anthropicRes.status}`)
    }

    const apiData = await anthropicRes.json()

    // Log tool calls
    for (const blk of (apiData.content || [])) {
      if (blk.type === 'tool_use' || blk.type === 'mcp_tool_use') {
        log(`⚙ ${blk.name}`, 't')
      }
    }

    // Extract JSON
    const rawText = (apiData.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    const m = rawText.match(/[{][\s\S]*[}]/)
    if (!m) return fail('Réponse invalide — réessayez')

    let result
    try { result = JSON.parse(m[0]) }
    catch { return fail('JSON invalide — réessayez') }

    const companies = result.companies || []
    const leads     = result.leads     || []

    log(`✓ ${companies.length} sociétés · ${leads.length} contacts (${leads.filter(l => l.email).length} emails)`, 's')

    if (!leads.length) {
      await admin.from('campaigns').update({ status: 'done', generation_pct: 100, prospects_count: 0 }).eq('id', id)
      return fail('Aucun contact trouvé — essayez avec des critères plus larges')
    }

    // Save
    log('Sauvegarde…', 'i')
    const sirenMap = Object.fromEntries(companies.map(c => [(c.name || '').toLowerCase(), c]))
    const records  = leads.map(l => {
      const co = sirenMap[(l.company || '').toLowerCase()] || {}
      return {
        campaign_id:  id,
        user_id:      session.user.id,
        fullname:     l.fullname  || '',
        job_title:    l.job_title || '',
        company:      l.company   || '',
        email:        l.email     || null,
        email_cert:   l.certainty || null,
        linkedin_url: l.linkedin_url || null,
        location:     l.location  || co.ville || null,
        sector:       base.ape_label || base.intl_sector || '',
        source:       'icypeas',
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
