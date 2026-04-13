import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/* ── Generate Icypeas query from campaign filters ── */
export async function generateProspectQuery(campaign) {
  const prompt = `Tu es un expert en prospection B2B pour freelances.
Un freelance a créé cette campagne :
- Type de client cible : ${campaign.client_type || ''}
- Secteur : ${campaign.client_sector || ''}
- Taille : ${campaign.client_size || ''}
- Localisation : ${campaign.client_location || ''}
- Besoin : ${campaign.client_need || ''}

Génère un objet JSON pour l'API Icypeas "Find People" avec ces champs :
{
  "currentJobTitle": { "include": ["<5 à 8 titres pertinents>"] },
  "location": { "include": ["FR"] },
  "keyword": { "include": ["<2-3 mots-clés du secteur>"] }
}
Réponds UNIQUEMENT avec le JSON valide, sans markdown, sans commentaire.`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const text = msg.content[0].text.replace(/```json|```/g, '').trim()
    return JSON.parse(text)
  } catch {
    // Fallback query if Claude returns unexpected format
    return {
      currentJobTitle: { include: ['Directeur', 'CEO', 'Responsable', 'Manager', 'DG'] },
      location: { include: ['FR'] },
    }
  }
}

/* ── Count prospects (free, no credits) ── */
export async function generateProspectQueryForCount(campaign) {
  return generateProspectQuery(campaign)
}

/* ── Generate email + LinkedIn sequences per prospect ── */
export async function generateSequence({ campaign, prospect }) {
  const prompt = `Tu es un expert en copywriting B2B pour freelances.

FREELANCE :
- Résultat client : ${campaign.freelance_result || ''}
- KPI / avant-après : ${campaign.freelance_kpi || ''}
- Angle différenciateur : ${campaign.freelance_angle || ''}
- Ton souhaité : ${campaign.freelance_tone || 'professionnel'}
- Besoin adressé : ${campaign.client_need || ''}

PROSPECT CIBLE :
- Nom : ${prospect.fullname || ''}
- Poste : ${prospect.job_title || ''}
- Entreprise : ${prospect.company || ''}
- Secteur : ${prospect.sector || campaign.client_sector || ''}

Génère une séquence en JSON :
{
  "email_1": "Premier email (objet en 1ère ligne 'Objet: ...', corps 150-200 mots)",
  "email_2": "Relance J+5 (100-130 mots)",
  "email_3": "Dernière relance J+10 (80 mots max, direct)",
  "linkedin_1": "Message LinkedIn (300 car. max, sans 'Bonjour' générique)",
  "linkedin_2": "Relance LinkedIn (250 car. max)"
}

Règles : personnaliser avec le nom/entreprise, mettre en avant le KPI, ton direct.
Réponds UNIQUEMENT avec le JSON valide, sans markdown.`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const text = msg.content[0].text.replace(/```json|```/g, '').trim()
    return JSON.parse(text)
  } catch {
    return { email_1: 'Erreur génération — relancer.', email_2: '', email_3: '', linkedin_1: '', linkedin_2: '' }
  }
}
