import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const { kanban_status, kanban_notes } = req.body

  const VALID = ['applied', 'followed_up', 'in_progress', 'signed', null]
  if (!VALID.includes(kanban_status)) return res.status(400).json({ error: 'Statut invalide' })

  const { data, error } = await supabase
    .from('prospects')
    .update({ kanban_status, kanban_notes, kanban_updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json(data)
}
