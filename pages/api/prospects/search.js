// pages/api/prospects/search.js — v2 with 3x scraping + auto email + advanced filters
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

  const { campaign_id, query, limit = 10 } = req.body;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id requis.' });

  const ICYPEAS_KEY = process.env.ICYPEAS_API_KEY;
  if (!ICYPEAS_KEY) return res.status(500).json({ error: 'Cle Icypeas manquante.' });

  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': ICYPEAS_KEY };
  const scrapeLimit = Math.min(limit * 3, 100); // 3x but cap at 100

  try {
    console.log('ICYPEAS BODY:', JSON.stringify({ query, pagination: { from: 0, size: scrapeLimit } }));

    const data = await safeFetch('https://app.icypeas.com/api/find-people', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ query, pagination: { from: 0, size: scrapeLimit } }),
    });

    console.log('ICYPEAS RESPONSE:', JSON.stringify(data)?.slice(0, 200));

    if (!data) return res.status(502).json({ error: 'Icypeas: reponse invalide.' });
    if (!data.success) return res.status(502).json({ error: 'Icypeas: ' + (data.message || 'erreur inconnue') });

    const leads = data.leads || [];
    const total = data.total || leads.length;

    if (!leads.length) return res.status(200).json({ saved: 0, total: 0, reserve: 0, emails_submitted: 0 });

    // Clear existing
    await supabaseAdmin.from('prospects').delete().eq('campaign_id', campaign_id);

    // First `limit` = visible, rest = reserve
    const rows = leads.map((p, i) => ({
      campaign_id,
      user_id:      profile.id,
      fullname:     p.fullname || ((p.firstname || '') + ' ' + (p.lastname || '')).trim(),
      job_title:    p.lastJobTitle || p.headline || '',
      company:      p.lastCompanyName || '',
      sector:       p.lastCompanyIndustry || '',
      email:        '',
      email_cert:   '',
      linkedin_url: p.profileUrl || '',
      location:     p.address || '',
      source:       'icypeas',
      reserve:      i >= limit,
    }));

    const { data: saved } = await supabaseAdmin.from('prospects').insert(rows).select();

    // Auto-submit email search for ALL prospects
    let emailsSubmitted = 0;
    for (const prospect of (saved || [])) {
      try {
        const parts = (prospect.fullname || '').trim().split(' ');
        const firstname = parts[0] || '';
        const lastname = parts.slice(1).join(' ') || '';
        if (!firstname || !prospect.company) continue;

        const d = await safeFetch('https://app.icypeas.com/api/email-search', {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ firstname, lastname, domainOrCompany: prospect.company }),
        });
        const searchId = d?.item?._id;
        if (searchId) {
          await supabaseAdmin.from('prospects').update({ icypeas_search_id: searchId }).eq('id', prospect.id);
          emailsSubmitted++;
        }
        await new Promise(r => setTimeout(r, 150));
      } catch(e) { /* continue */ }
    }

    const visibleCount = (saved || []).filter(p => !p.reserve).length;
    const reserveCount = (saved || []).filter(p => p.reserve).length;

    await supabaseAdmin.from('campaigns').update({
      prospects_count: visibleCount,
      updated_at: new Date().toISOString(),
    }).eq('id', campaign_id);

    return res.status(200).json({ saved: visibleCount, reserve: reserveCount, total, emails_submitted: emailsSubmitted });
  } catch(err) {
    console.error('SEARCH ERROR:', err);
    return res.status(502).json({ error: err.message });
  }
}
