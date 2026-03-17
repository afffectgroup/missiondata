// pages/api/campaigns/[id].js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { id } = req.query;

  // Ownership check (admin can access all)
  const { data: campaign } = await supabaseAdmin
    .from('campaigns').select('*').eq('id', id).single();
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable.' });
  if (campaign.user_id !== profile.id && profile.role !== 'admin')
    return res.status(403).json({ error: 'Accès refusé.' });

  // GET — full campaign with prospects + sequences
  if (req.method === 'GET') {
    const [{ data: prospects }, { data: sequences }] = await Promise.all([
      supabaseAdmin.from('prospects').select('*').eq('campaign_id', id).order('created_at'),
      supabaseAdmin.from('sequences').select('*').eq('campaign_id', id),
    ]);
    return res.status(200).json({ campaign, prospects: prospects || [], sequences: sequences || [] });
  }

  // PATCH — update campaign fields
  if (req.method === 'PATCH') {
    const { data, error } = await supabaseAdmin
      .from('campaigns').update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ campaign: data });
  }

  // DELETE
  if (req.method === 'DELETE') {
    await supabaseAdmin.from('campaigns').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
