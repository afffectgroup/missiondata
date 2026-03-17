// pages/api/prospects/enrich.js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

const ICYPEAS_KEY = process.env.ICYPEAS_API_KEY;
const HEADERS = { 'Content-Type': 'application/json', 'Authorization': ICYPEAS_KEY };

async function safeFetch(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  try { return JSON.parse(text); } catch(e) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { prospect_ids, action = 'submit' } = req.body;
  if (!prospect_ids?.length) return res.status(400).json({ error: 'prospect_ids requis.' });
  if (!ICYPEAS_KEY) return res.status(500).json({ error: 'Cle Icypeas manquante.' });

  const { data: prospects } = await supabaseAdmin
    .from('prospects')
    .select('*')
    .in('id', prospect_ids)
    .eq('user_id', profile.id);

  if (!prospects?.length) return res.status(404).json({ error: 'Prospects introuvables.' });

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  if (action === 'submit') {
    const submitted = [];
    for (const prospect of prospects) {
      if (prospect.email || prospect.icypeas_search_id) {
        submitted.push({ id: prospect.id, status: 'skip' });
        continue;
      }
      const nameParts = (prospect.fullname || '').trim().split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';
      const company = prospect.company || '';
      if (!firstname || !company) { submitted.push({ id: prospect.id, status: 'skip' }); continue; }

      try {
        const d = await safeFetch('https://app.icypeas.com/api/email-search', {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ firstname, lastname, domainOrCompany: company }),
        });
        const searchId = d?.item?._id;
        if (searchId) {
          await supabaseAdmin.from('prospects').update({ icypeas_search_id: searchId }).eq('id', prospect.id);
          submitted.push({ id: prospect.id, status: 'submitted', searchId });
        } else {
          submitted.push({ id: prospect.id, status: 'error', detail: JSON.stringify(d) });
        }
      } catch(e) {
        submitted.push({ id: prospect.id, status: 'error', error: e.message });
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return res.status(200).json({
      submitted: submitted.filter(s => s.status === 'submitted').length,
      results: submitted,
    });
  }

  // ── COLLECT ────────────────────────────────────────────────────────────────
  if (action === 'collect') {
    const toCollect = prospects.filter(p => p.icypeas_search_id && !p.email);
    const collected = [];

    for (const prospect of toCollect) {
      try {
        const d = await safeFetch('https://app.icypeas.com/api/bulk-single-searchs/read', {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ id: prospect.icypeas_search_id }),
        });

        if (!d) {
          await supabaseAdmin.from('prospects').update({ icypeas_search_id: null }).eq('id', prospect.id);
          collected.push({ id: prospect.id, status: 'not_found' });
          continue;
        }

        const item = d.items?.[0];
        if (!item) { collected.push({ id: prospect.id, status: 'pending' }); continue; }

        if (item.status === 'DEBITED' || item.status === 'DONE' || item.status === 'NOT_FOUND') {
          const emails = item.results?.emails || [];
          if (emails.length > 0) {
            const { email, certainty } = emails[0];
            await supabaseAdmin.from('prospects')
              .update({ email, email_cert: certainty || '', icypeas_search_id: null })
              .eq('id', prospect.id);
            collected.push({ id: prospect.id, status: 'found', email });
          } else {
            await supabaseAdmin.from('prospects')
              .update({ email_cert: 'not_found', icypeas_search_id: null })
              .eq('id', prospect.id);
            collected.push({ id: prospect.id, status: 'not_found' });
          }
        } else {
          collected.push({ id: prospect.id, status: 'pending' });
        }
      } catch(e) {
        collected.push({ id: prospect.id, status: 'error', error: e.message });
      }
    }

    return res.status(200).json({
      enriched: collected.filter(c => c.status === 'found').length,
      pending: collected.filter(c => c.status === 'pending').length,
      results: collected,
    });
  }

  return res.status(400).json({ error: 'action invalide (submit|collect)' });
}
