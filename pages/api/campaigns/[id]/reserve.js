// pages/api/campaigns/[id]/reserve.js
import { requireAuth } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';

export default async function handler(req, res) {
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { id } = req.query;

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('prospects').select('id')
      .eq('campaign_id', id).eq('reserve', true)
      .not('email', 'is', null).neq('email', '');
    return res.status(200).json({ count: data?.length || 0 });
  }

  if (req.method === 'POST') {
    const { data: reserves } = await supabaseAdmin
      .from('prospects').select('id')
      .eq('campaign_id', id).eq('reserve', true)
      .not('email', 'is', null).neq('email', '');

    if (!reserves?.length) return res.status(200).json({ ok: true, revealed: 0 });

    const ids = reserves.map(p => p.id);
    await supabaseAdmin.from('prospects').update({ reserve: false }).in('id', ids);

    const { data: all } = await supabaseAdmin
      .from('prospects').select('id')
      .eq('campaign_id', id).eq('reserve', false);

    await supabaseAdmin.from('campaigns').update({
      prospects_count: all?.length || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    return res.status(200).json({ ok: true, revealed: ids.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
