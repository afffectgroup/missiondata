import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

// Champs modifiables depuis le modal "Modifier les critères"
const EDITABLE_FIELDS = [
  'name',
  'job_titles', 'n_companies',
  // France
  'ape_code', 'ape_label',
  'departement', 'dept_label',
  'effectif_code', 'effectif_label',
  // International
  'country_code', 'country_label',
  'intl_sector', 'intl_city',
  // Legacy mais supporté
  'client_sector', 'client_location', 'client_size', 'client_need',
]

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

  if (req.method === 'PATCH') {
    // Whitelist des champs : on ne laisse pas modifier user_id, id, status, prospects_count, etc.
    const updates = {}
    for (const k of EDITABLE_FIELDS) {
      if (req.body?.[k] !== undefined) updates[k] = req.body[k]
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucun champ valide à modifier' })
    }
    const { data, error } = await admin
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    await admin.from('campaigns').delete().eq('id', id).eq('user_id', session.user.id)
    return res.status(204).end()
  }

  res.status(405).end()
}
