// pages/api/prospects/fullenrich.js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

const FE_KEY = process.env.FULLENRICH_API_KEY;
const FE_BASE = 'https://app.fullenrich.com/api/v1';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  if (!FE_KEY) return res.status(500).json({ error: 'Clé Source 2 manquante' });

  const { prospect_id, action, field } = req.body;
  if (!prospect_id) return res.status(400).json({ error: 'prospect_id requis' });

  const { data: prospect } = await supabaseAdmin
    .from('prospects').select('*').eq('id', prospect_id).single();
  if (!prospect) return res.status(404).json({ error: 'Prospect introuvable' });

  // ── SUBMIT ────────────────────────────────────────────────────────────────
  if (action === 'submit') {
    const parts = (prospect.fullname || '').trim().split(' ');
    const firstname = parts[0] || '';
    const lastname = parts.slice(1).join(' ') || '';

    // enrich_fields based on choice
    const enrich_fields = field === 'email'
      ? ['contact.emails']
      : field === 'phone'
        ? ['contact.phones']
        : ['contact.emails', 'contact.phones'];

    const contact = {
      firstname,
      lastname,
      company_name: prospect.company || '',
      enrich_fields,
      custom: { prospect_id: String(prospect_id) }, // must be string
    };
    if (prospect.linkedin_url) contact.linkedin_url = prospect.linkedin_url;

    const r = await fetch(`${FE_BASE}/contact/enrich/bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${prospect.fullname} — ${prospect.company}`,
        datas: [contact],
      }),
    });

    const d = await r.json();
    console.log('Fullenrich submit response:', JSON.stringify(d));

    // API v2 returns enrichment_id
    const enrichmentId = d?.enrichment_id;
    if (!enrichmentId) {
      return res.status(502).json({ error: 'Source 2 : ' + (d?.message || d?.error || JSON.stringify(d)) });
    }

    await supabaseAdmin.from('prospects')
      .update({ fullenrich_id: enrichmentId })
      .eq('id', prospect_id);

    return res.status(200).json({ submitted: true, fullenrich_id: enrichmentId });
  }

  // ── COLLECT ───────────────────────────────────────────────────────────────
  if (action === 'collect') {
    const enrichmentId = prospect.fullenrich_id;
    if (!enrichmentId) return res.status(400).json({ error: 'Pas de recherche en cours' });

    // GET request to retrieve result
    const r = await fetch(`${FE_BASE}/contact/enrich/bulk/${enrichmentId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${FE_KEY}` },
    });

    const d = await r.json();
    console.log('Fullenrich collect status:', d?.status);

    const status = d?.status;

    if (status === 'CREATED' || status === 'IN_PROGRESS') {
      return res.status(200).json({ pending: true });
    }

    if (status === 'CREDITS_INSUFFICIENT') {
      return res.status(402).json({ error: 'Crédits Source 2 insuffisants' });
    }

    if (status === 'RATE_LIMIT') {
      return res.status(200).json({ pending: true }); // retry later
    }

    if (status === 'FINISHED' || status === 'CANCELED' || status === 'UNKNOWN') {
      const contact = d?.datas?.[0]?.contact;
      const email = contact?.most_probable_email || contact?.emails?.[0]?.email || null;
      const mobile = contact?.most_probable_phone || contact?.phones?.[0]?.number || null;

      const update = { fullenrich_id: null };
      if (email) { update.email = email; update.email_cert = 'source-2'; }
      if (mobile) update.mobile = mobile;

      if (!email && !mobile) {
        await supabaseAdmin.from('prospects')
          .update({ fullenrich_id: null, email_cert: prospect.email ? prospect.email_cert : 'not_found' })
          .eq('id', prospect_id);
        return res.status(200).json({ not_found: true });
      }

      await supabaseAdmin.from('prospects').update(update).eq('id', prospect_id);
      return res.status(200).json({ found: true, email, mobile });
    }

    return res.status(200).json({ pending: true });
  }

  return res.status(400).json({ error: 'Action invalide' });
}
