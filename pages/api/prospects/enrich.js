// pages/api/prospects/enrich.js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

async function safeFetch(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  try { return JSON.parse(text); } catch(e) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { campaign_id, target = 10 } = req.body;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id requis' });

  const ICYPEAS_KEY = process.env.ICYPEAS_API_KEY;
  if (!ICYPEAS_KEY) return res.status(500).json({ error: 'Clé API manquante' });
  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': ICYPEAS_KEY };

  // Count visible prospects
  const { data: visible } = await supabaseAdmin
    .from('prospects')
    .select('id', { count: 'exact' })
    .eq('campaign_id', campaign_id)
    .eq('reserve', false);
  const visibleCount = visible?.length || 0;

  // Get pending — LIMIT to 10 per call to avoid timeout
  const { data: pending } = await supabaseAdmin
    .from('prospects')
    .select('id, icypeas_search_id')
    .eq('campaign_id', campaign_id)
    .not('icypeas_search_id', 'is', null)
    .or('email.is.null,email.eq.')
    .limit(10); // process 10 at a time

  // Count total pending (for progress)
  const { data: allPending } = await supabaseAdmin
    .from('prospects')
    .select('id', { count: 'exact' })
    .eq('campaign_id', campaign_id)
    .not('icypeas_search_id', 'is', null)
    .or('email.is.null,email.eq.');
  const totalPending = allPending?.length || 0;

  if (!pending?.length) {
    return res.status(200).json({ enriched: 0, visible: visibleCount, target, pending: totalPending, complete: visibleCount >= target || totalPending === 0 });
  }

  let newlyFound = 0;

  for (const p of pending) {
    try {
      const d = await safeFetch('https://app.icypeas.com/api/bulk-single-searchs/read', {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ id: p.icypeas_search_id }),
      });

      const item = d?.item || d;
      const status = item?.status;
      const email = item?.email || item?.data?.email;

      if (status === 'DEBITED' || status === 'DONE') {
        if (email) {
          const shouldReveal = (visibleCount + newlyFound) < target;
          await supabaseAdmin.from('prospects').update({
            email,
            email_cert: item?.emailStatus || 'found',
            icypeas_search_id: null,
            reserve: !shouldReveal,
          }).eq('id', p.id);
          if (shouldReveal) newlyFound++;
        } else {
          await supabaseAdmin.from('prospects').update({ email_cert: 'not_found', icypeas_search_id: null }).eq('id', p.id);
        }
      } else if (status === 'NOT_FOUND') {
        await supabaseAdmin.from('prospects').update({ email_cert: 'not_found', icypeas_search_id: null }).eq('id', p.id);
      } else if (status === 'PENDING' || status === 'IN_PROGRESS' || !status) {
        // still waiting
      } else {
        await supabaseAdmin.from('prospects').update({ email_cert: 'not_found', icypeas_search_id: null }).eq('id', p.id);
      }
    } catch(e) { /* continue */ }
  }

  const finalVisible = visibleCount + newlyFound;
  if (newlyFound > 0) {
    await supabaseAdmin.from('campaigns').update({ prospects_count: finalVisible }).eq('id', campaign_id);
  }

  const remainingPending = totalPending - pending.length + (pending.filter(p => {/* was pending */}).length);

  return res.status(200).json({
    enriched: newlyFound,
    visible: finalVisible,
    target,
    pending: totalPending,
    complete: finalVisible >= target || totalPending === 0,
  });
}
