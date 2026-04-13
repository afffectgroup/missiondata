import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

async function assertAdmin(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') return null
  return { session, admin }
}

export default async function handler(req, res) {
  const auth = await assertAdmin(req, res)
  if (!auth) return res.status(403).json({ error: 'Accès refusé' })

  const { admin } = auth
  const { id } = req.query

  /* ── PATCH : update password or toggle active ── */
  if (req.method === 'PATCH') {
    const { is_active, password } = req.body

    if (typeof is_active === 'boolean') {
      await admin.from('profiles').update({ is_active }).eq('id', id)
      return res.status(200).json({ ok: true })
    }

    if (password) {
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Aucune mise à jour fournie' })
  }

  /* ── DELETE : remove user + all data (cascades via RLS) ── */
  if (req.method === 'DELETE') {
    // Delete auth user — cascades to profiles, campaigns, prospects, sequences via FK
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
