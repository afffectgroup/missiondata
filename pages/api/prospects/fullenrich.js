// pages/api/prospects/fullenrich.js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

const FE_KEY = process.env.FULLENRICH_API_KEY;
const FE_BASE = 'https://app.fullenrich.com/api/v1';

async function fePost(path, body) {
  const r = await fetch(`${FE_BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${FE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function feGet(path) {
  const r = await fetch(`${FE_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${FE_KEY}` },
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { prospect_id, action, field } = req.body;
  // field = 'email' | 'phone' | 'both'

  if (!prospect_id) return res.status(400).json({ error: 'prospect_id requis' });

  const { data: prospect } = await supabaseAdmin
    .from('prospects').select('*').eq('id', prospect_id).single();

  if (!prospect) return res.status(404).json({ error: 'Prospect introuvable' });

  // ── SUBMIT ────────────────────────────────────────────────────────────────
  if (action === 'submit') {
    const parts = (prospect.fullname || '').trim().split(' ');
    const firstname = parts[0] || '';
    const lastname = parts.slice(1).join(' ') || '';

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
      custom: { prospect_id },
    };

    // Add LinkedIn URL if available — improves results
    if (prospect.linkedin_url) contact.linkedin_url = prospect.linkedin_url;

    const d = await fePost('/contact/enrich/bulk', {
      name: `${prospect.fullname} — ${prospect.company}`,
      datas: [contact],
    });

    if (!d?.id) return res.status(502).json({ error: 'Fullenrich: ' + (d?.message || 'erreur inconnue') });

    await supabaseAdmin.from('prospects').update({ fullenrich_id: d.id }).eq('id', prospect_id);

    return res.status(200).json({ submitted: true, fullenrich_id: d.id });
  }

  // ── COLLECT ───────────────────────────────────────────────────────────────
  if (action === 'collect') {
    const enrichmentId = prospect.fullenrich_id;
    if (!enrichmentId) return res.status(400).json({ error: 'Pas de recherche en cours' });

    const d = await feGet(`/contact/enrich/bulk/${enrichmentId}`);

    const status = d?.status; // pending | completed | failed | lacks_credits
    if (status === 'pending') return res.status(200).json({ pending: true });
    if (status === 'lacks_credits') return res.status(402).json({ error: 'Crédits Fullenrich insuffisants' });
    if (status === 'failed') return res.status(200).json({ not_found: true });

    if (status === 'completed') {
      const contact = d?.datas?.[0];
      const email = contact?.emails?.[0]?.email || null;
      const mobile = contact?.phones?.[0]?.phone || null;

      const update = { fullenrich_id: null };
      if (email) { update.email = email; update.email_cert = 'fullenrich'; }
      if (mobile) update.mobile = mobile;

      if (!email && !mobile) return res.status(200).json({ not_found: true });

      await supabaseAdmin.from('prospects').update(update).eq('id', prospect_id);
      return res.status(200).json({ found: true, email, mobile });
    }

    return res.status(200).json({ pending: true });
  }

  return res.status(400).json({ error: 'Action invalide' });
}
