import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

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

  /* ── GET : list all freelance users with campaign count ── */
  if (req.method === 'GET') {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .eq('role', 'freelance')
      .order('created_at', { ascending: false })

    // Add campaign count per user
    const { data: campaignCounts } = await admin
      .from('campaigns')
      .select('user_id')

    const countMap = {}
    for (const c of (campaignCounts || [])) {
      countMap[c.user_id] = (countMap[c.user_id] || 0) + 1
    }

    const users = (profiles || []).map(p => ({
      ...p,
      campaigns_count: countMap[p.id] || 0,
    }))

    return res.status(200).json({ users })
  }

  /* ── POST : create new freelance account ── */
  if (req.method === 'POST') {
    const { email, password, full_name } = req.body

    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe obligatoires' })

    // Create auth user
    const { data: user, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) return res.status(400).json({ error: error.message })

    // Upsert profile (trigger might have already created it)
    await admin.from('profiles').upsert({
      id: user.user.id,
      email,
      full_name: full_name || '',
      role: 'freelance',
      is_active: true,
    })

    return res.status(201).json({ user: user.user })
  }

  res.status(405).end()
}
