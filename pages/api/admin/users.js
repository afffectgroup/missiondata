// pages/api/admin/users.js
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  try { await requireAdmin(req); } catch(e) { return res.status(401).json({ error: e.message }); }

  // GET — list all freelances
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .eq('role', 'freelance')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ users: data });
  }

  // POST — create a freelance account
  if (req.method === 'POST') {
    const { email, password, full_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,       // no confirmation email needed — admin creates it
      user_metadata: { full_name, role: 'freelance' }
    });
    if (authError) return res.status(400).json({ error: authError.message });
    return res.status(201).json({ user: authData.user });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
