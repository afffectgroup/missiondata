// pages/api/prospects/search.js — email-first strategy
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

  const { campaign_id, query, limit = 10, offset = 0 } = req.body;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id requis.' });

  const ICYPEAS_KEY = process.env.ICYPEAS_API_KEY;
  if (!ICYPEAS_KEY) return res.status(500).json({ error: 'Clé API manquante.' });

  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': ICYPEAS_KEY };

  // Scrape 5x to maximize email finds
  const scrapeLimit = Math.min(limit * 5, 100);

  try {
    const data = await safeFetch('https://app.icypeas.com/api/find-people', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ query, pagination: { from: offset, size: scrapeLimit } }),
    });

    if (!data) return res.status(502).json({ error: 'Réponse invalide de la source.' });
    if (!data.success) return res.status(502).json({ error: data.message || 'Erreur source de données' });

    const leads = data.leads || [];
    const total = data.total || leads.length;
    if (!leads.length) return res.status(200).json({ saved: 0, total: 0, emails_submitted: 0 });

    // Clear existing prospects for this campaign
    await supabaseAdmin.from('prospects').delete().eq('campaign_id', campaign_id);

    // Save ALL scraped leads — all hidden (reserve=true) until they get an email
    const rows = leads.map((p) => ({
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
      source:       'source-1',
      reserve:      true, // ALL start hidden — revealed only when email found
    }));

    const { data: saved } = await supabaseAdmin.from('prospects').insert(rows).select();

    // Submit email search for ALL scraped prospects
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
        await new Promise(r => setTimeout(r, 80));
      } catch(e) { /* continue */ }
    }

    await supabaseAdmin.from('campaigns').update({
      prospects_count: 0, // Will update as emails come in
      updated_at: new Date().toISOString(),
    }).eq('id', campaign_id);

    return res.status(200).json({
      saved: 0, // nothing visible yet
      total,
      scraped: (saved || []).length,
      emails_submitted: emailsSubmitted,
      target: limit,
    });

  } catch(err) {
    return res.status(502).json({ error: err.message });
  }
}
