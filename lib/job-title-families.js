/**
 * Familles de titres de poste — pour suggérer automatiquement des synonymes
 * et augmenter le match rate Icypeas (français + anglais mélangés car LinkedIn est multilingue)
 */

export const JOB_TITLE_FAMILIES = {
  exec: {
    label:  'Direction générale',
    emoji:  '👑',
    titles: [
      'CEO', 'Directeur Général', 'Président', 'Gérant',
      'Dirigeant', 'Fondateur', 'Co-fondateur', 'Founder',
      'Co-Founder', 'Associé', 'Managing Director',
    ],
  },
  ops: {
    label:  'Opérations',
    emoji:  '⚙️',
    titles: [
      'COO', 'Directeur des Opérations', 'Head of Operations',
      'VP Operations', 'Chief Operating Officer', 'Directeur Général Adjoint',
    ],
  },
  sales: {
    label:  'Commercial',
    emoji:  '💼',
    titles: [
      'CRO', 'VP Sales', 'Directeur Commercial', 'Head of Sales',
      'Sales Director', 'Responsable Commercial', 'Business Developer',
      'Chief Revenue Officer', 'Directeur des Ventes',
    ],
  },
  marketing: {
    label:  'Marketing',
    emoji:  '📣',
    titles: [
      'CMO', 'Directeur Marketing', 'Head of Marketing',
      'VP Marketing', 'Chief Marketing Officer', 'Responsable Marketing',
      'Growth Manager', 'Head of Growth',
    ],
  },
  tech: {
    label:  'Tech & Engineering',
    emoji:  '💻',
    titles: [
      'CTO', 'Directeur Technique', 'VP Engineering',
      'Head of Engineering', 'Tech Lead', 'Chief Technology Officer',
      'Head of Tech', 'Engineering Director',
    ],
  },
  product: {
    label:  'Produit',
    emoji:  '🎯',
    titles: [
      'CPO', 'Chief Product Officer', 'Head of Product',
      'VP Product', 'Product Director', 'Directeur Produit',
      'Product Manager', 'Senior Product Manager',
    ],
  },
  finance: {
    label:  'Finance',
    emoji:  '💰',
    titles: [
      'CFO', 'Directeur Financier', 'Head of Finance',
      'Finance Director', 'Chief Financial Officer', 'Responsable Financier',
      'Directeur Administratif et Financier', 'DAF',
    ],
  },
  rh: {
    label:  'RH',
    emoji:  '👥',
    titles: [
      'DRH', 'CHRO', 'Directeur RH', 'Head of HR',
      'HR Director', 'People Manager', 'Chief People Officer',
      'Directeur des Ressources Humaines', 'Responsable RH',
    ],
  },
}

/**
 * Détecte la famille la plus probable à partir d'un titre saisi
 */
export function detectFamily(title) {
  if (!title) return null
  const t = title.toLowerCase().trim()
  let bestMatch = null
  let bestScore = 0

  for (const [key, fam] of Object.entries(JOB_TITLE_FAMILIES)) {
    for (const x of fam.titles) {
      const xl = x.toLowerCase()
      if (t === xl) return key // match exact
      if (t.includes(xl) || xl.includes(t)) {
        const score = Math.min(t.length, xl.length)
        if (score > bestScore) {
          bestScore = score
          bestMatch = key
        }
      }
    }
  }
  return bestMatch
}

/**
 * Détecte les familles à partir d'une liste de titres déjà saisis
 */
export function detectFamiliesFromTitles(titles) {
  const families = new Set()
  for (const t of titles) {
    const f = detectFamily(t)
    if (f) families.add(f)
  }
  return [...families]
}

/**
 * Suggère des titres à ajouter pour une famille — exclut ceux déjà présents
 */
export function suggestTitles(currentTitles, family, limit = 6) {
  const fam = JOB_TITLE_FAMILIES[family]
  if (!fam) return []
  const currentLower = currentTitles.map(t => t.toLowerCase().trim())
  return fam.titles
    .filter(t => !currentLower.includes(t.toLowerCase()))
    .slice(0, limit)
}
