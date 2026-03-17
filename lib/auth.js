// lib/auth.js
import { supabaseAdmin } from './supabase';

/**
 * Verify the Bearer token from request headers.
 * Returns { user, profile } or throws.
 */
export async function requireAuth(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw new Error('Non authentifié.');

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error('Token invalide ou expiré.');

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile?.is_active) throw new Error('Compte désactivé.');

  return { user, profile };
}

/**
 * Same as requireAuth but also checks for admin role.
 */
export async function requireAdmin(req) {
  const { user, profile } = await requireAuth(req);
  if (profile.role !== 'admin') throw new Error('Accès admin requis.');
  return { user, profile };
}
