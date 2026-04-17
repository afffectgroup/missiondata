/**
 * POST /api/icypeas/email-search
 * Reverse flow : trouve l'email d'une personne via firstname + lastname + domain
 * Proxy vers /api/sync/email-search d'Icypeas (synchrone, une seule requête)
 * La clé API reste côté serveur, jamais exposée au client.
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Auth : seulement pour les users connectés
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { firstname = '', lastname = '', domainOrCompany = '' } = req.body || {}

  if (!domainOrCompany.trim()) return res.status(400).json({ error: 'domainOrCompany requis' })
  if (!firstname.trim() && !lastname.trim()) {
    return res.status(400).json({ error: 'firstname ou lastname requis' })
  }

  try {
    const r = await fetch('https://app.icypeas.com/api/sync/email-search', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': process.env.ICYPEAS_API_KEY,
      },
      body: JSON.stringify({
        firstname: firstname.trim(),
        lastname:  lastname.trim(),
        domainOrCompany: domainOrCompany.trim(),
      }),
    })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch {}

    if (!r.ok) {
      return res.status(r.status).json({
        error:  json?.message || `HTTP ${r.status}`,
        detail: text.slice(0, 300),
      })
    }
    return res.status(200).json(json)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
