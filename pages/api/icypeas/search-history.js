/**
 * GET  /api/icypeas/search-history        → liste les 50 dernières recherches
 * DELETE /api/icypeas/search-history?id=X → supprime une recherche (ou toutes si id=all)
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const admin = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('email_searches')
      .select('id, firstname, lastname, domain_or_company, email_found, certainty, mx_provider, status, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ searches: data || [] })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id requis' })

    if (id === 'all') {
      const { error } = await admin.from('email_searches').delete().eq('user_id', session.user.id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, deleted: 'all' })
    }

    const { error } = await admin.from('email_searches').delete().eq('id', id).eq('user_id', session.user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, deleted: id })
  }

  return res.status(405).end()
}
