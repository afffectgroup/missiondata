/**
 * Debug endpoint — GET /api/debug/icypeas?mode=find|count|key
 * Retourne EXACTEMENT ce que renvoie l'API Icypeas
 */
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req, res) {
  const supabase = createPagesServerClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié - logue-toi d\'abord' })

  const { mode = 'find' } = req.query

  // Vérifier la présence de la clé
  if (mode === 'key') {
    const key = process.env.ICYPEAS_API_KEY || ''
    return res.status(200).json({
      hasKey:           !!key,
      keyLength:        key.length,
      keyFirstChars:    key.slice(0, 8),
      keyLastChars:     key.slice(-5),
      startsWithBearer: key.toLowerCase().startsWith('bearer'),
      hasSpaces:        key.includes(' '),
      hasNewlines:      key.includes('\n'),
    })
  }

  // Mode pipeline : reproduit exactement la Tentative 1 + 2 + 3 du pipeline
  // Pour les agences pub Paris / DG-CEO
  if (mode === 'pipeline') {
    const calls = []

    // Tentative 1 : avec entreprises + postes
    const q1 = {
      query: {
        currentJobTitle: { include: ['Directeur Général', 'CEO'] },
        currentCompanyName: { include: ['Publicis', 'Havas', 'BETC', 'Marcel', 'Fred & Farid'] },
        location: { include: ['FR'] },
      },
      pagination: { size: 10 },
    }
    calls.push({ name: 'T1 companies+titles', body: q1 })

    // Tentative 2 : avec keyword secteur
    const q2 = {
      query: {
        currentJobTitle: { include: ['Directeur Général', 'CEO'] },
        keyword: { include: ['Agences de publicité'] },
        location: { include: ['FR'] },
      },
      pagination: { size: 10 },
    }
    calls.push({ name: 'T2 keyword+titles', body: q2 })

    // Tentative 3 : postes + location seul
    const q3 = {
      query: {
        currentJobTitle: { include: ['Directeur Général', 'CEO'] },
        location: { include: ['FR'] },
      },
      pagination: { size: 10 },
    }
    calls.push({ name: 'T3 titles+FR', body: q3 })

    const results = []
    for (const c of calls) {
      try {
        const r = await fetch('https://app.icypeas.com/api/find-people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: process.env.ICYPEAS_API_KEY },
          body: JSON.stringify(c.body),
        })
        const text = await r.text()
        let parsed = null
        try { parsed = JSON.parse(text) } catch {}
        results.push({
          name:        c.name,
          status:      r.status,
          total:       parsed?.total,
          leadsCount:  parsed?.leads?.length || 0,
          firstLead:   parsed?.leads?.[0] ? `${parsed.leads[0].firstname} ${parsed.leads[0].lastname} @ ${parsed.leads[0].lastCompanyName}` : null,
          bodyPreview: !parsed ? text.slice(0, 300) : null,
          requestBody: c.body,
        })
      } catch (e) {
        results.push({ name: c.name, error: e.message })
      }
    }

    return res.status(200).json({ results })
  }

  const url = mode === 'count'
    ? 'https://app.icypeas.com/api/find-people/count'
    : 'https://app.icypeas.com/api/find-people'

  const body = {
    query: {
      currentJobTitle: { include: ['CEO'] },
      location: { include: ['FR'] },
    },
    pagination: { size: 5 },
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  process.env.ICYPEAS_API_KEY,
      },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch {}

    return res.status(200).json({
      request: { url, body },
      response: {
        httpStatus:   r.status,
        httpOk:       r.ok,
        bodyPreview:  text.slice(0, 1500),
        parsedKeys:   parsed ? Object.keys(parsed) : null,
        leadsCount:   parsed?.leads?.length || 0,
        total:        parsed?.total,
        firstLead:    parsed?.leads?.[0] || null,
      },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
