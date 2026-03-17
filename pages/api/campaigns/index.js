// pages/api/campaigns/index.js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  // GET — list user's campaigns
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ campaigns: data });
  }

  // POST — create new campaign (dossier)
  if (req.method === 'POST') {
    const body = req.body;
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        user_id:           profile.id,
        name:              body.name,
        client_type:       body.client_type,
        client_sector:     body.client_sector,
        client_location:   body.client_location,
        client_need:       body.client_need,
        job_title_target:  body.job_title_target,
        prospect_limit:    body.prospect_limit || 10,
        freelance_result:  body.freelance_result,
        freelance_kpi:     body.freelance_kpi,
        freelance_angle:   body.freelance_angle,
        freelance_tone:    body.freelance_tone || 'professionnel',
        status:            'draft',
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ campaign: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
