import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const uid = session.user.id
  const admin = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('campaigns').select('*').eq('id', id).eq('user_id', uid).single()
    if (error) return res.status(404).json({ error: 'Campagne introuvable' })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { data, error } = await admin
      .from('campaigns')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', uid)
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await admin
      .from('campaigns').delete().eq('id', id).eq('user_id', uid)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.status(405).json({ error: 'Method not allowed' })
}
