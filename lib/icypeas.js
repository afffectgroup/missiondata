// Icypeas REST API — https://app.icypeas.com/api
// Formats validés live via MCP le 15/04/2026

const BASE = 'https://app.icypeas.com/api'

async function safeFetch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.ICYPEAS_API_KEY },
    body:    JSON.stringify(body),
  })
  // Icypeas peut répondre en texte sur certaines erreurs
  const text = await res.text()
  try { return JSON.parse(text) }
  catch { throw new Error(`Icypeas ${path} → ${res.status}: ${text.slice(0, 200)}`) }
}

/* ── find-people (avec crédits) ───────────────────────────────
   Query filters : currentJobTitle, currentCompanyName,
   currentCompanyWebsite, location, keyword, skills, languages…
   Retourne un tableau de profils.
─────────────────────────────────────────────────────────────── */
export async function findPeople(query, maxResults = 30) {
  const data = await safeFetch('/find-people', { query, maxResults })
  // L'API retourne { items: [...], total: N } ou directement un tableau
  if (Array.isArray(data))        return data
  if (Array.isArray(data.items))  return data.items
  if (Array.isArray(data.leads))  return data.leads
  return []
}

/* ── find-people-count (GRATUIT, 0 crédit) ───────────────────── */
export async function countPeople(query) {
  const data = await safeFetch('/find-people/count', { query })
  return data?.total ?? data?.count ?? 0
}

/* ── email-search (1 personne) ───────────────────────────────────
   Async : POST → obtenir _id → poll jusqu'à FOUND/NOT_FOUND
─────────────────────────────────────────────────────────────── */
export async function searchEmail(firstname, lastname, domainOrCompany) {
  const init = await safeFetch('/email-search', { firstname, lastname, domainOrCompany })
  const searchId = init?.item?._id || init?._id
  if (!searchId) return null

  // Poll jusqu'à 25s
  const DONE = ['FOUND', 'NOT_FOUND', 'DEBITED', 'DONE']
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2500))
    const poll = await safeFetch('/bulk-single-searchs/read', { id: searchId })
    const item = Array.isArray(poll?.items) ? poll.items[0] : poll?.item
    if (item && DONE.some(s => item.status?.includes(s))) {
      const email = item.results?.emails?.[0]
      return email ? { email: email.email, certainty: email.certainty } : null
    }
  }
  return null
}

/* ── bulk-email-search (N personnes) ─────────────────────────────
   Format entrée : [{ firstname, lastname, domainOrCompany }]
   Format sortie : [{ firstname, lastname, email, certainty }]
─────────────────────────────────────────────────────────────── */
export async function bulkEmailSearch(prospects) {
  if (!prospects.length) return []

  const CHUNK = 50
  const allResults = []

  for (let i = 0; i < prospects.length; i += CHUNK) {
    const batch = prospects.slice(i, i + CHUNK)

    // Soumettre le batch
    const init = await safeFetch('/bulk-single-searchs', {
      name:  `missiondata-${Date.now()}`,
      task:  'email-search',
      data:  batch.map(p => [p.firstname, p.lastname, p.domainOrCompany]),
    })

    const batchId = init?.item?._id || init?._id
    if (!batchId) continue

    // Poll le batch (max 60s)
    const DONE_STATUSES = ['DONE', 'PARTIALLY_DONE', 'FAILED']
    let batchDone = false
    for (let attempt = 0; attempt < 20 && !batchDone; attempt++) {
      await new Promise(r => setTimeout(r, 3000))
      const poll = await safeFetch('/bulk-single-searchs/read', { id: batchId })
      const status = poll?.item?.status || poll?.status
      batchDone = DONE_STATUSES.some(s => status?.includes(s))

      // Récupérer les résultats dès qu'ils sont prêts
      const items = poll?.items || poll?.item?.results || []
      for (const item of items) {
        if (item.results) {
          allResults.push({
            firstname: item.results.firstname || '',
            lastname:  item.results.lastname  || '',
            email:     item.results.emails?.[0]?.email     || null,
            certainty: item.results.emails?.[0]?.certainty || null,
          })
        }
      }
    }
  }

  return allResults
}
