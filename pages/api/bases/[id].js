import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })
  const { id } = req.query
  const admin = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await admin.from('campaigns').select('*').eq('id', id).eq('user_id', session.user.id).single()
    return data ? res.status(200).json(data) : res.status(404).json({ error: 'Introuvable' })
  }
  if (req.method === 'DELETE') {
    await admin.from('campaigns').delete().eq('id', id).eq('user_id', session.user.id)
    return res.status(204).end()
  }
  res.status(405).end()
}
