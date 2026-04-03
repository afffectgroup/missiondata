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

  // Count currently visible prospects (already have email)
  const { data: alreadyVisible } = await supabaseAdmin
    .from('prospects')
    .select('id')
    .eq('campaign_id', campaign_id)
    .eq('reserve', false);

  // Also count total scraped (for progress reporting)
  const { data: allProspects } = await supabaseAdmin
    .from('prospects')
    .select('id')
    .eq('campaign_id', campaign_id);

  const visibleCount = alreadyVisible?.length || 0;

  // Get all pending prospects (have search_id, no email yet)
  // Note: email can be null OR empty string "" — handle both
  const { data: pending } = await supabaseAdmin
    .from('prospects')
    .select('id, icypeas_search_id, fullname, company')
    .eq('campaign_id', campaign_id)
    .not('icypeas_search_id', 'is', null)
    .or('email.is.null,email.eq.');

  if (!pending?.length) {
    // No pending — check if we have enough visible
    return res.status(200).json({
      enriched: 0,
      visible: visibleCount,
      target,
      pending: 0,
      complete: visibleCount >= target,
    });
  }

  let newlyFound = 0;
  let stillPending = 0;

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
          await supabaseAdmin.from('prospects').update({
            email_cert: 'not_found',
            icypeas_search_id: null,
          }).eq('id', p.id);
        }
      } else if (status === 'NOT_FOUND') {
        await supabaseAdmin.from('prospects').update({
          email_cert: 'not_found',
          icypeas_search_id: null,
        }).eq('id', p.id);
      } else if (status === 'PENDING' || status === 'IN_PROGRESS' || !status) {
        stillPending++;
      } else {
        // Unknown status — mark done to unblock
        await supabaseAdmin.from('prospects').update({
          email_cert: 'not_found',
          icypeas_search_id: null,
        }).eq('id', p.id);
      }

      await new Promise(r => setTimeout(r, 50)); // small delay between calls
    } catch(e) {
      stillPending++;
    }
  }

  const finalVisible = visibleCount + newlyFound;
  if (newlyFound > 0) {
    await supabaseAdmin.from('campaigns').update({
      prospects_count: finalVisible,
    }).eq('id', campaign_id);
  }

  return res.status(200).json({
    enriched: newlyFound,
    visible: finalVisible,
    target,
    pending: stillPending,
    complete: finalVisible >= target || (stillPending === 0 && finalVisible > 0),
  });
}
