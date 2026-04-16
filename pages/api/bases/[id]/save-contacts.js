// Simple save route — reçoit les contacts déjà enrichis par Icypeas MCP (client-side)
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const { id } = req.query
  const { contacts = [] } = req.body || {}

  const admin = getSupabaseAdmin()
  const { data: base } = await admin.from('campaigns').select('id,user_id').eq('id', id).single()
  if (!base || base.user_id !== session.user.id) return res.status(403).json({ error: 'Accès refusé' })

  // Vider les anciens contacts + insérer les nouveaux
  await admin.from('prospects').delete().eq('campaign_id', id)

  if (!contacts.length) {
    await admin.from('campaigns').update({ status:'done', generation_pct:100, prospects_count:0 }).eq('id', id)
    return res.status(200).json({ count: 0 })
  }

  const records = contacts.map(c => ({
    campaign_id:  id,
    user_id:      session.user.id,
    fullname:     c.fullname || '',
    job_title:    c.job_title || '',
    company:      c.company || '',
    email:        c.email || null,
    email_cert:   c.certainty || c.email_cert || null,
    linkedin_url: c.linkedin_url || null,
    location:     c.location || null,
    sector:       c.sector || '',
    source:       'icypeas',
    raw_data:     c.domain ? JSON.stringify({ website: c.domain }) : null,
  }))

  const { data: inserted, error } = await admin.from('prospects').insert(records).select('id')
  if (error) return res.status(500).json({ error: error.message })

  await admin.from('campaigns').update({
    status: 'done', generation_pct: 100, prospects_count: inserted?.length || 0
  }).eq('id', id)

  res.status(200).json({ count: inserted?.length || 0 })
}
