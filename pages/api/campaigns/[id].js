// pages/api/campaigns/[id].js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { id } = req.query;

  // GET
  if (req.method === 'GET') {
    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns').select('*').eq('id', id).single();
    if (error || !campaign) return res.status(404).json({ error: 'Not found' });

    const { data: prospects } = await supabaseAdmin
      .from('prospects').select('*').eq('campaign_id', id).order('created_at');
    const { data: sequences } = await supabaseAdmin
      .from('sequences').select('*').eq('campaign_id', id);

    return res.status(200).json({ campaign, prospects: prospects || [], sequences: sequences || [] });
  }

  // PATCH — all updatable fields explicitly allowed
  if (req.method === 'PATCH') {
    const body = req.body;
    const allowed = [
      'name',
      'status',
      'client_type',
      'client_sector',       // ← secteur
      'client_location',     // ← localisation
      'client_size',
      'client_need',
      'job_title_target',
      'prospect_limit',
      'selected_titles',
      'mirror_criteria',
      'freelance_offer',
      'freelance_icp',
      'freelance_problem',
      'freelance_result',
      'freelance_kpi',
      'freelance_angle',
      'freelance_tone',
    ];

    const update = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('campaigns').update(update).eq('id', id).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ campaign: data });
  }

  // DELETE
  if (req.method === 'DELETE') {
    await supabaseAdmin.from('prospects').delete().eq('campaign_id', id);
    await supabaseAdmin.from('sequences').delete().eq('campaign_id', id);
    await supabaseAdmin.from('campaigns').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
