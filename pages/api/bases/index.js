import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  if (req.method === 'GET') {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    return res.status(200).json(data)
  }
  if (req.method === 'POST') {
    const { data, error } = await supabase.from('campaigns').insert({ ...req.body, user_id: session.user.id }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }
  res.status(405).end()
}
