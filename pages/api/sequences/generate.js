// pages/api/sequences/generate.js
// Calls Claude API to generate individualized email + LinkedIn sequences
import { requireAuth } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let profile;
  try { ({ profile } = await requireAuth(req)); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { campaign_id } = req.body;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id requis.' });

  // Load campaign + prospects
  const { data: campaign } = await supabaseAdmin
    .from('campaigns').select('*').eq('id', campaign_id).eq('user_id', profile.id).single();
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable.' });

  const { data: prospects } = await supabaseAdmin
    .from('prospects').select('*').eq('campaign_id', campaign_id);
  if (!prospects?.length) return res.status(400).json({ error: 'Aucun prospect dans cette campagne.' });

  // Update campaign status
  await supabaseAdmin.from('campaigns').update({ status: 'generating' }).eq('id', campaign_id);

  // Generate sequences for each prospect (batch to avoid timeout)
  const results = [];
  for (const prospect of prospects.slice(0, 75)) {
    try {
      const seq = await generateSequence(campaign, prospect);

      // Delete existing sequence for this prospect (regenerate)
      await supabaseAdmin.from('sequences').delete()
        .eq('prospect_id', prospect.id).eq('campaign_id', campaign_id);

      const { data: saved } = await supabaseAdmin.from('sequences').insert({
        campaign_id,
        prospect_id: prospect.id,
        user_id:     profile.id,
        email_1:     seq.email_1,
        email_2:     seq.email_2,
        email_3:     seq.email_3,
        linkedin_1:  seq.linkedin_1,
        linkedin_2:  seq.linkedin_2,
      }).select().single();

      results.push(saved);
    } catch(err) {
      console.error('Sequence error for prospect', prospect.id, err.message);
    }
  }

  // Update campaign status + counts
  await supabaseAdmin.from('campaigns').update({
    status: 'done',
    sequences_count: results.length,
    updated_at: new Date().toISOString(),
  }).eq('id', campaign_id);

  return res.status(200).json({ generated: results.length, sequences: results });
}

// ── Claude API call ──
async function generateSequence(campaign, prospect) {
  const prompt = `Tu es un expert en prospection B2B pour les freelances.

CONTEXTE DU FREELANCE :
- Résultat obtenu pour un client similaire : ${campaign.freelance_result || 'non renseigné'}
- Chiffre clé / KPI : ${campaign.freelance_kpi || 'non renseigné'}
- Angle différenciateur : ${campaign.freelance_angle || 'non renseigné'}
- Ton souhaité : ${campaign.freelance_tone || 'professionnel'}
- Besoin du client miroir : ${campaign.client_need || 'non renseigné'}
- Secteur du client miroir : ${campaign.client_sector || 'non renseigné'}

PROSPECT CIBLE :
- Nom : ${prospect.fullname || 'inconnu'}
- Prénom : ${(prospect.fullname || '').split(' ')[0] || 'Bonjour'}
- Poste : ${prospect.job_title || 'dirigeant'}
- Entreprise : ${prospect.company || 'votre entreprise'}
- Secteur : ${prospect.sector || campaign.client_sector || 'votre secteur'}
- Localisation : ${prospect.location || campaign.client_location || ''}

Génère une séquence de prospection INDIVIDUALISÉE pour ce prospect.
Chaque message doit inclure le prénom et/ou le nom de l'entreprise du prospect.
Les messages doivent être courts, percutants, et basés sur le cas client réel.

Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks :
{
  "email_1": "Objet: [objet]\\n\\n[corps du mail accroche, max 120 mots]",
  "email_2": "Objet: [objet]\\n\\n[corps du mail cas client, max 120 mots]",
  "email_3": "Objet: [objet]\\n\\n[corps du mail relance courte, max 80 mots]",
  "linkedin_1": "[note de connexion max 300 caractères]",
  "linkedin_2": "[message de suivi post-connexion, max 200 mots]"
}`;

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
    return {
      email_1: text,
      email_2: '',
      email_3: '',
      linkedin_1: '',
      linkedin_2: '',
    };
  }
}
