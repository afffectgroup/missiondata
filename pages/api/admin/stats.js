// pages/api/admin/stats.js
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try { await requireAdmin(req); } catch(e) { return res.status(401).json({ error: e.message }); }

  const [freelances, campaigns, prospects, sequences, recent] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, is_active').eq('role', 'freelance'),
    supabaseAdmin.from('campaigns').select('id, status, created_at'),
    supabaseAdmin.from('prospects').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('sequences').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns')
      .select('id, name, status, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  return res.status(200).json({
    total_freelances:     freelances.data?.length || 0,
    active_freelances:    freelances.data?.filter(f => f.is_active).length || 0,
    total_campaigns:      campaigns.data?.length || 0,
    completed_campaigns:  campaigns.data?.filter(c => c.status === 'done').length || 0,
    total_prospects:      prospects.count || 0,
    total_sequences:      sequences.count || 0,
    recent_campaigns:     recent.data || [],
  });
}
