/**
 * Endpoint POST /api/icypeas/count
 * Retourne des estimations du nombre de contacts disponibles.
 * GRATUIT : utilise /find-people/count qui ne consomme pas de crédits Icypeas.
 * Rate limit : 10 calls/sec → on peut faire 4 appels en parallèle facilement.
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { regionsFromDeptCodes } from '../../../lib/france-regions'

const ICYPEAS = 'https://app.icypeas.com/api'

// Même mapping que pipeline.js — à extraire en lib commune plus tard
const SECTOR_KEYWORDS = {
  'Cosmétique & Beauté':       ['cosmetics', 'beauty', 'skincare', 'makeup', 'cosmetic'],
  'Mode & Luxe':               ['fashion', 'luxury', 'apparel', 'couture'],
  'Tech & SaaS':               ['software', 'SaaS', 'technology', 'tech'],
  'Finance & Fintech':         ['finance', 'fintech', 'banking', 'investment'],
  'Santé & Biotech':           ['healthcare', 'biotech', 'pharma', 'medical'],
  'E-commerce & Retail':       ['ecommerce', 'retail', 'commerce'],
  'Marketing & Digital':       ['marketing', 'digital', 'advertising'],
  'Conseil & Stratégie':       ['consulting', 'strategy', 'advisory'],
  'Immobilier':                ['real estate', 'property', 'realty'],
  'Industrie & Manufacturing': ['manufacturing', 'industrial', 'industry'],
  'Énergie & Environnement':   ['energy', 'sustainability', 'renewable'],
  'Education & Formation':     ['education', 'training', 'edtech'],
  'Médias & Divertissement':   ['media', 'entertainment', 'publishing'],
  'Agroalimentaire':           ['food', 'beverage', 'agrifood'],
  'Transport & Logistique':    ['logistics', 'transport', 'supply chain'],
}

async function icyCount(query) {
  try {
    const r = await fetch(`${ICYPEAS}/find-people/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: process.env.ICYPEAS_API_KEY },
      body: JSON.stringify({ query }),
    })
    const json = await r.json()
    return typeof json.total === 'number' ? json.total : 0
  } catch {
    return 0
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const {
    mode = 'france',
    job_titles = '',
    dept_code = '',
    dept_label = '',
    ape_label = '',
    country_code = '',
    country_label = '',
    intl_sector = '',
    intl_city = '',
  } = req.body || {}

  const isFR   = mode !== 'international'
  const titles = job_titles.split(',').map(s => s.trim()).filter(Boolean)

  if (!titles.length) {
    return res.status(200).json({ strict: 0, noSector: 0, noGeo: 0, max: 0, warn: 'Aucun poste spécifié' })
  }

  // Construire les termes géo
  let geoTerms = []
  if (isFR) {
    const depts = dept_label.split(',').map(s => s.trim()).filter(Boolean)
    const deptCodes = dept_code.split(',').map(s => s.trim()).filter(Boolean)
    const regions = regionsFromDeptCodes(deptCodes)
    geoTerms = [...depts, ...regions]
  } else if (intl_city || country_code) {
    geoTerms = [intl_city || country_code].filter(Boolean)
  }

  // Construire les keywords secteur
  let sectorKws = []
  if (isFR && ape_label) {
    sectorKws = ape_label.split(',').map(s => s.trim()).filter(Boolean)
  } else if (!isFR && intl_sector) {
    sectorKws = SECTOR_KEYWORDS[intl_sector] || [intl_sector]
  }

  // 4 appels en parallèle — /find-people/count rate limit = 10/sec
  const baseQ = { currentJobTitle: { include: titles } }

  const queries = {
    // STRICT : postes + géo + secteur (ce que le pipeline va vraiment chercher)
    strict: {
      ...baseQ,
      ...(geoTerms.length   ? { location: { include: geoTerms } } : {}),
      ...(sectorKws.length  ? { keyword:  { include: sectorKws } } : {}),
    },
    // Sans secteur : postes + géo
    noSector: {
      ...baseQ,
      ...(geoTerms.length ? { location: { include: geoTerms } } : { location: { include: [isFR ? 'FR' : (country_code || 'FR')] } }),
    },
    // Sans géo : postes + secteur (ou juste postes + pays)
    noGeo: {
      ...baseQ,
      location: { include: [isFR ? 'FR' : (country_code || 'FR')] },
      ...(sectorKws.length ? { keyword: { include: sectorKws } } : {}),
    },
    // Max : postes + pays uniquement
    max: {
      ...baseQ,
      location: { include: [isFR ? 'FR' : (country_code || 'FR')] },
    },
  }

  const [strict, noSector, noGeo, max] = await Promise.all([
    icyCount(queries.strict),
    icyCount(queries.noSector),
    icyCount(queries.noGeo),
    icyCount(queries.max),
  ])

  return res.status(200).json({
    strict,
    noSector,
    noGeo,
    max,
    titles,
    geoTerms,
    sectorKws,
  })
}
