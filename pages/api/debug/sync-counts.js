/**
 * POST /api/debug/sync-counts
 * Reconstruit prospects_count de TOUTES les bases de l'user depuis la vraie table prospects.
 * Utile quand le pipeline a été interrompu et n'a pas pu update le count.
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const admin = getSupabaseAdmin()

  // Toutes les bases de l'user
  const { data: bases } = await admin
    .from('campaigns')
    .select('id, name, prospects_count, status')
    .eq('user_id', session.user.id)

  if (!bases?.length) return res.status(200).json({ bases: [], updated: 0 })

  // Count réel de prospects par base
  const { data: prospects } = await admin
    .from('prospects')
    .select('campaign_id')
    .in('campaign_id', bases.map(b => b.id))

  const countMap = {}
  for (const p of (prospects || [])) {
    countMap[p.campaign_id] = (countMap[p.campaign_id] || 0) + 1
  }

  // Update chaque base dont le count est désynchro
  const results = []
  let updated = 0
  for (const base of bases) {
    const realCount = countMap[base.id] || 0
    const needsUpdate = base.prospects_count !== realCount
    // Si on a des prospects et status != 'done', on corrige aussi le status
    const needsStatusFix = realCount > 0 && base.status !== 'done'

    if (needsUpdate || needsStatusFix) {
      const updates = { prospects_count: realCount }
      if (needsStatusFix) {
        updates.status = 'done'
        updates.generation_pct = 100
      }
      await admin.from('campaigns').update(updates).eq('id', base.id)
      updated++
    }

    results.push({
      name:   base.name,
      before: base.prospects_count,
      after:  realCount,
      status_before: base.status,
      status_after:  (needsStatusFix ? 'done' : base.status),
      fixed:  needsUpdate || needsStatusFix,
    })
  }

  return res.status(200).json({ bases: results, updated })
}
