// pages/api/prospects/enrich.js — collect emails + reveal prospects as they arrive
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

  const { campaign_id, target } = req.body;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id requis' });

  const ICYPEAS_KEY = process.env.ICYPEAS_API_KEY;
  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': ICYPEAS_KEY };

  // Get all pending prospects for this campaign
  const { data: pending } = await supabaseAdmin
    .from('prospects')
    .select('id, icypeas_search_id, email, email_cert, reserve')
    .eq('campaign_id', campaign_id)
    .not('icypeas_search_id', 'is', null);

  // Count already visible (email found)
  const { data: visible } = await supabaseAdmin
    .from('prospects')
    .select('id')
    .eq('campaign_id', campaign_id)
    .eq('reserve', false);

  const visibleCount = visible?.length || 0;
  const targetCount = target || 10;

  let newlyFound = 0;
  let stillPending = 0;

  for (const p of (pending || [])) {
    try {
      const d = await safeFetch('https://app.icypeas.com/api/bulk-single-searchs/read', {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ id: p.icypeas_search_id }),
      });

      const status = d?.item?.status || d?.status;
      const email = d?.item?.email || d?.item?.data?.email;

      if (status === 'DEBITED' || status === 'DONE') {
        if (email) {
          // Email found — reveal prospect if we haven't hit target yet
          const shouldReveal = (visibleCount + newlyFound) < targetCount;
          await supabaseAdmin.from('prospects').update({
            email,
            email_cert: d?.item?.emailStatus || 'found',
            icypeas_search_id: null,
            reserve: !shouldReveal, // reveal if under target
          }).eq('id', p.id);
          if (shouldReveal) newlyFound++;
        } else {
          // Debited but no email
          await supabaseAdmin.from('prospects').update({
            email_cert: 'not_found',
            icypeas_search_id: null,
            reserve: true, // stay hidden
          }).eq('id', p.id);
        }
      } else if (status === 'NOT_FOUND') {
        await supabaseAdmin.from('prospects').update({
          email_cert: 'not_found',
          icypeas_search_id: null,
          reserve: true,
        }).eq('id', p.id);
      } else if (status === 'PENDING' || status === 'IN_PROGRESS') {
        stillPending++;
      } else {
        // Unknown — mark done
        await supabaseAdmin.from('prospects').update({
          email_cert: 'not_found',
          icypeas_search_id: null,
          reserve: true,
        }).eq('id', p.id);
      }
    } catch(e) { stillPending++; }
  }

  // Update campaign prospects_count
  const finalVisible = visibleCount + newlyFound;
  if (newlyFound > 0) {
    await supabaseAdmin.from('campaigns').update({
      prospects_count: finalVisible,
      updated_at: new Date().toISOString(),
    }).eq('id', campaign_id);
  }

  return res.status(200).json({
    enriched: newlyFound,
    visible: finalVisible,
    target: targetCount,
    pending: stillPending,
    complete: finalVisible >= targetCount || stillPending === 0,
  });
}
