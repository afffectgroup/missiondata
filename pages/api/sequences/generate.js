// pages/api/sequences/generate.js
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { campaign_id } = req.body;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id requis.' });

  const { data: campaign } = await supabaseAdmin
    .from('campaigns').select('*').eq('id', campaign_id).eq('user_id', profile.id).single();
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable.' });

  await supabaseAdmin.from('campaigns').update({ status: 'generating' }).eq('id', campaign_id);

  try {
    const seq = await generateSequence(campaign);

    await supabaseAdmin.from('sequences').delete().eq('campaign_id', campaign_id);

    const { data: saved } = await supabaseAdmin.from('sequences').insert({
      campaign_id,
      prospect_id: null,
      user_id:     profile.id,
      email_1:     seq.email_1,
      email_2:     seq.email_2,
      email_3:     seq.email_3,
      linkedin_1:  seq.linkedin_1,
      linkedin_2:  seq.linkedin_2,
    }).select().single();

    await supabaseAdmin.from('campaigns').update({
      status: 'done',
      sequences_count: 1,
      updated_at: new Date().toISOString(),
    }).eq('id', campaign_id);

    return res.status(200).json({ generated: 1, sequences: [saved] });

  } catch(err) {
    await supabaseAdmin.from('campaigns').update({ status: 'draft' }).eq('id', campaign_id);
    return res.status(500).json({ error: err.message });
  }
}

async function generateSequence(campaign) {
  const prompt = [
    'Tu es un expert en prospection B2B pour les freelances.',
    '',
    'CONTEXTE DU FREELANCE :',
    '- Résultat client : ' + (campaign.freelance_result || 'non renseigné'),
    '- KPI : ' + (campaign.freelance_kpi || 'non renseigné'),
    '- Angle : ' + (campaign.freelance_angle || 'non renseigné'),
    '- Ton : ' + (campaign.freelance_tone || 'professionnel'),
    '- Secteur ciblé : ' + (campaign.client_sector || 'non renseigné'),
    '- Besoin : ' + (campaign.client_need || 'non renseigné'),
    '- Localisation : ' + (campaign.client_location || 'France'),
    '- Type : ' + (campaign.client_type || 'PME'),
    '',
    'REGLE ABSOLUE : Génère UNE séquence générique pour tous les prospects.',
    'JAMAIS de nom ou prénom réel dans les messages.',
    'Utilise EXACTEMENT {{PRENOM}} et {{ENTREPRISE}} comme variables, sans les remplacer.',
    '',
    'Réponds UNIQUEMENT en JSON valide sans markdown :',
    '{',
    '  "email_1": "Objet: ...\\n\\nBonjour {{PRENOM}},\\n\\n[accroche, max 80 mots]",',
    '  "email_2": "Objet: ...\\n\\nBonjour {{PRENOM}},\\n\\n[cas client + KPI, max 100 mots]",',
    '  "email_3": "Objet: ...\\n\\nBonjour {{PRENOM}},\\n\\n[relance courte, max 50 mots]",',
    '  "linkedin_1": "Bonjour {{PRENOM}}, [connexion, max 280 caractères total]",',
    '  "linkedin_2": "Bonjour {{PRENOM}}, [suivi post-connexion, max 120 mots]"',
    '}',
  ].join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';

  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { email_1: text, email_2: '', email_3: '', linkedin_1: '', linkedin_2: '' };
  }
}
