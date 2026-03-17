// pages/api/admin/users/[id].js
import { requireAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';

export default async function handler(req, res) {
  try { await requireAdmin(req); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { id } = req.query;

  // PATCH — update name / active status / password
  if (req.method === 'PATCH') {
    const { full_name, is_active, password } = req.body;

    if (full_name !== undefined || is_active !== undefined) {
      const updates = {};
      if (full_name  !== undefined) updates.full_name  = full_name;
      if (is_active  !== undefined) updates.is_active  = is_active;
      updates.updated_at = new Date().toISOString();

      const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
    }

    if (password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  }

  // DELETE — remove account + all data (cascade)
  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
