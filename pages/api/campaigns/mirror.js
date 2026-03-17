import { requireAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try { await requireAuth(req); } catch(e) { return res.status(401).json({ error: e.message }); }

  const { client_sector, client_type, client_location, client_need } = req.body;

  const prompt = `Tu es un expert en prospection B2B.

Un freelance a un client dans le secteur LinkedIn "${client_sector}", type "${client_type}", ville "${client_location}", besoin "${client_need}".

Genere les criteres pour trouver des prospects DANS CE SECTEUR PRECIS.

REGLE CRITIQUE sur les job_titles : tu dois generer des intitules de poste SPECIFIQUES AU METIER du secteur "${client_sector}". 
PAS de titres generiques comme "Directeur General", "PDG", "CEO", "Gerant" seuls.
Ces titres doivent qualifier UNIQUEMENT des personnes travaillant dans ce secteur.

Exemples par secteur :
- Accounting : "Expert-comptable", "Commissaire aux comptes", "Chef comptable", "Directeur administratif et financier", "DAF", "Responsable comptabilite"
- Insurance : "Courtier en assurance", "Agent general d assurance", "Directeur agence assurance", "Responsable sinistres", "Charge de clientele assurance"
- Real Estate : "Agent immobilier", "Directeur agence immobiliere", "Negociateur immobilier", "Promoteur immobilier", "Gestionnaire de biens"
- Construction : "Chef de chantier", "Conducteur de travaux", "Directeur travaux", "Maitre d oeuvre", "Architecte"
- Marketing and Advertising : "Directeur artistique", "Responsable marketing", "Chef de projet digital", "Directeur agence communication", "Consultant SEO"
- Restaurants : "Restaurateur", "Gerant restaurant", "Chef cuisinier", "Directeur restauration", "Responsable etablissement"
- Health, Wellness and Fitness : "Medecin generaliste", "Directeur clinique", "Responsable centre sante", "Kinesitherapeute", "Directeur EHPAD"

Reponds UNIQUEMENT en JSON valide, sans markdown :
{
  "job_titles": ["5-7 intitules SPECIFIQUES AU SECTEUR ${client_sector}"],
  "direct_sectors": ["${client_sector}"],
  "indirect_sectors": [],
  "locations": ["${client_location}"],
  "rationale": "explication courte"
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
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    parsed.direct_sectors = [client_sector];
    parsed.indirect_sectors = [];
    parsed.locations = [client_location];
    return res.status(200).json(parsed);
  } catch {
    return res.status(200).json({
      job_titles: ['Directeur', 'Responsable', 'Gerant'],
      direct_sectors: [client_sector],
      indirect_sectors: [],
      locations: [client_location],
      rationale: 'Criteres par defaut.',
    });
  }
}