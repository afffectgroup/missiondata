// pages/api/prospects/search.js
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

  const { campaign_id, query, limit = 50 } = req.body;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id requis.' });

  const ICYPEAS_KEY = process.env.ICYPEAS_API_KEY;
  if (!ICYPEAS_KEY) return res.status(500).json({ error: 'Cle Icypeas manquante.' });

  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': ICYPEAS_KEY };

  try {
    const data = await safeFetch('https://app.icypeas.com/api/find-people', {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ query, pagination: { from: 0, size: Math.min(limit, 50) } }),
    });

    if (!data) return res.status(502).json({ error: 'Icypeas: reponse invalide.' });
    if (!data.success) return res.status(502).json({ error: 'Icypeas: ' + (data.message || 'erreur inconnue') });

    const leads = data.leads || [];
    const total = data.total || leads.length;

    if (!leads.length) return res.status(200).json({ saved: 0, total: 0 });

    // Clear existing prospects for this campaign
    await supabaseAdmin.from('prospects').delete().eq('campaign_id', campaign_id);

    // Save to DB
    const rows = leads.slice(0, limit).map(p => ({
      campaign_id,
      user_id:      profile.id,
      fullname:     p.fullname || `${p.firstname || ''} ${p.lastname || ''}`.trim(),
      job_title:    p.lastJobTitle || p.headline || '',
      company:      p.lastCompanyName || '',
      sector:       p.lastCompanyIndustry || '',
      email:        '',
      email_cert:   '',
      linkedin_url: p.profileUrl || '',
      location:     p.address || '',
      source:       'icypeas',
    }));

    const { data: saved } = await supabaseAdmin.from('prospects').insert(rows).select();

    await supabaseAdmin.from('campaigns').update({
      prospects_count: saved?.length || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', campaign_id);

    return res.status(200).json({ saved: saved?.length || 0, total, prospects: saved });
  } catch(err) {
    return res.status(502).json({ error: err.message });
  }
}
