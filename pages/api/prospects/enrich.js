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

  const { prospect_ids, action } = req.body;
  const ICYPEAS_KEY = process.env.ICYPEAS_API_KEY;
  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': ICYPEAS_KEY };

  // COLLECT — retrieve pending email searches
  if (action === 'collect') {
    const { data: prospects } = await supabaseAdmin
      .from('prospects')
      .select('id, icypeas_search_id, email')
      .in('id', prospect_ids)
      .not('icypeas_search_id', 'is', null);

    let enriched = 0, pending = 0;

    for (const p of (prospects || [])) {
      try {
        const d = await safeFetch('https://app.icypeas.com/api/bulk-single-searchs/read', {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ id: p.icypeas_search_id }),
        });

        const status = d?.item?.status || d?.status;
        const email = d?.item?.email || d?.item?.data?.email;

        if (status === 'DEBITED' || status === 'DONE') {
          if (email) {
            await supabaseAdmin.from('prospects').update({
              email,
              email_cert: d?.item?.emailStatus || 'found',
              icypeas_search_id: null,
            }).eq('id', p.id);
            enriched++;
          } else {
            // Debited but no email found
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
        } else if (status === 'PENDING' || status === 'IN_PROGRESS') {
          pending++;
        } else {
          // Unknown status — mark as not_found to unblock UI
          await supabaseAdmin.from('prospects').update({
            email_cert: 'not_found',
            icypeas_search_id: null,
          }).eq('id', p.id);
        }
      } catch(e) { pending++; }
    }

    return res.status(200).json({ enriched, pending });
  }

  return res.status(400).json({ error: 'Action invalide' });
}
