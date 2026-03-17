// pages/api/sequences/[id].js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const { data: seq } = await supabaseAdmin.from('sequences').select('user_id').eq('id', id).single();
    if (!seq) return res.status(404).json({ error: 'Séquence introuvable.' });
    if (seq.user_id !== profile.id && profile.role !== 'admin') return res.status(403).json({ error: 'Accès refusé.' });

    const allowed = ['email_1','email_2','email_3','linkedin_1','linkedin_2','edited'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from('sequences').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ sequence: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
