const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/* ── Generate prospects query from campaign ── */
export async function generateProspectQuery(campaign) {
  const prompt = `Tu es un expert en prospection B2B pour freelances.
Un freelance a créé cette campagne :
- Type de client cible : ${campaign.client_type}
- Secteur : ${campaign.client_sector}
- Taille : ${campaign.client_size}
- Localisation : ${campaign.client_location}
- Besoin : ${campaign.client_need}
- Budget estimé : ${campaign.client_budget}

Génère un objet JSON de requête pour l'API Icypeas "Find People" avec les champs :
currentJobTitle (include avec 5-8 titres pertinents), location (include avec code pays alpha-2), keyword (include avec 2-3 mots-clés du secteur).
Réponds UNIQUEMENT avec le JSON, sans markdown.`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    return JSON.parse(msg.content[0].text)
  } catch {
    return {
      currentJobTitle: { include: ['Directeur', 'CEO', 'Responsable', 'Manager'] },
      location: { include: ['FR'] },
    }
  }
}

/* ── Generate email + LinkedIn sequences ── */
export async function generateSequence({ campaign, prospect }) {
  const prompt = `Tu es un expert en copywriting B2B pour freelances.

FREELANCE :
- Résultat client : ${campaign.freelance_result}
- KPI / avant-après : ${campaign.freelance_kpi}
- Angle différenciateur : ${campaign.freelance_angle}
- Ton souhaité : ${campaign.freelance_tone || 'professionnel'}
- Besoin adressé : ${campaign.client_need}

PROSPECT CIBLE :
- Nom : ${prospect.fullname}
- Poste : ${prospect.job_title}
- Entreprise : ${prospect.company}
- Secteur : ${prospect.sector || campaign.client_sector}

Génère une séquence de prospection en JSON avec ces champs :
{
  "email_1": "Premier email de prise de contact (150-200 mots, objet inclus en première ligne avec 'Objet: ')",
  "email_2": "Relance J+5 (100-130 mots)",
  "email_3": "Dernière relance J+10 (80-100 mots, honnête et direct)",
  "linkedin_1": "Premier message LinkedIn (300 caractères max, sans 'Bonjour' générique)",
  "linkedin_2": "Message LinkedIn de relance (250 caractères max)"
}

Règles :
- Jamais de formules creuses ("Je me permets de...", "Notre solution innovante...")
- Personnaliser avec le nom et l'entreprise du prospect
- Mettre en avant le résultat concret du freelance
- Ton direct, professionnel, honnête
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
    return {
      email_1: 'Erreur de génération — réessayer.',
      email_2: '', email_3: '', linkedin_1: '', linkedin_2: '',
    }
  }
}
