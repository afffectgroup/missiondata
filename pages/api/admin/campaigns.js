// pages/api/admin/campaigns.js
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try { await requireAdmin(req); } catch(e) { return res.status(403).json({ error: e.message }); }

  const { user_id, prospects, campaign_id } = req.query;

  // Download prospects for a campaign
  if (prospects && campaign_id) {
    const { data } = await supabaseAdmin
      .from('prospects').select('*').eq('campaign_id', campaign_id).order('email', { ascending: false, nullsFirst: false });
    return res.status(200).json({ prospects: data || [] });
  }

  // List all campaigns (optionally filtered by user)
  let query = supabaseAdmin
    .from('campaigns')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false });

  if (user_id) query = query.eq('user_id', user_id);

  const { data } = await query;
  return res.status(200).json({ campaigns: data || [] });
}
