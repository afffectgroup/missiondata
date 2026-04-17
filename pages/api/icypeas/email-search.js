/**
 * POST /api/icypeas/email-search
 * Reverse flow : trouve l'email d'une personne via firstname + lastname + domain
 * Proxy vers /api/sync/email-search d'Icypeas (synchrone)
 * Sauvegarde chaque recherche dans email_searches pour l'historique utilisateur.
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { firstname = '', lastname = '', domainOrCompany = '' } = req.body || {}

  if (!domainOrCompany.trim()) return res.status(400).json({ error: 'domainOrCompany requis' })
  if (!firstname.trim() && !lastname.trim()) {
    return res.status(400).json({ error: 'firstname ou lastname requis' })
  }

  const admin = getSupabaseAdmin()
  const fn = firstname.trim()
  const ln = lastname.trim()
  const dom = domainOrCompany.trim()

  try {
    const r = await fetch('https://app.icypeas.com/api/sync/email-search', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': process.env.ICYPEAS_API_KEY,
      },
      body: JSON.stringify({ firstname: fn, lastname: ln, domainOrCompany: dom }),
    })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch {}

    if (!r.ok) {
      // Log error search
      await admin.from('email_searches').insert({
        user_id: session.user.id,
        firstname: fn, lastname: ln, domain_or_company: dom,
        status: 'ERROR',
      }).catch(() => {})
      return res.status(r.status).json({
        error:  json?.message || `HTTP ${r.status}`,
        detail: text.slice(0, 300),
      })
    }

    // Save to history
    const firstEmail = json?.emails?.[0]
    await admin.from('email_searches').insert({
      user_id:           session.user.id,
      firstname:         fn,
      lastname:          ln,
      domain_or_company: dom,
      email_found:       firstEmail?.email || null,
      certainty:         firstEmail?.certainty || null,
      mx_provider:       firstEmail?.mxProvider || null,
      status:            json?.status || (firstEmail ? 'FOUND' : 'NOT_FOUND'),
    }).catch(err => console.error('history save failed:', err.message))

    return res.status(200).json(json)
  } catch (e) {
    await admin.from('email_searches').insert({
      user_id: session.user.id,
      firstname: fn, lastname: ln, domain_or_company: dom,
      status: 'ERROR',
    }).catch(() => {})
    return res.status(500).json({ error: e.message })
  }
}
