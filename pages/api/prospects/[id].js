// pages/api/prospects/[id].js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { id } = req.query;

  if (req.method === 'DELETE') {
    const { data: prospect } = await supabaseAdmin.from('prospects').select('user_id').eq('id', id).single();
    if (!prospect) return res.status(404).json({ error: 'Prospect introuvable.' });
    if (prospect.user_id !== profile.id && profile.role !== 'admin') return res.status(403).json({ error: 'Accès refusé.' });
    await supabaseAdmin.from('prospects').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
