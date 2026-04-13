const BASE = 'https://app.icypeas.com/api'
const KEY = process.env.ICYPEAS_API_KEY

const headers = {
  'Content-Type': 'application/json',
  Authorization: KEY,
}

/* ── Helpers ── */
async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`Icypeas ${path}: ${r.status}`)
  return r.json()
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers })
  if (!r.ok) throw new Error(`Icypeas ${path}: ${r.status}`)
  return r.json()
}

/* ── Poll until done ── */
async function poll(id, maxWait = 30000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 2000))
    const data = await post('/bulk-single-searchs/read', { id })
    const item = data?.items?.[0]
    if (item && !['NONE', 'SCHEDULED', 'IN_PROGRESS'].includes(item.status)) {
      return item
    }
  }
  throw new Error('Icypeas timeout')
}

/* ── Lead database ── */
export async function findPeople(query, maxResults = 50) {
  const data = await post('/find-people', { query, maxResults })
  return data?.leads || []
}

export async function countPeople(query) {
  const data = await post('/find-people/count', { query })
  return data?.total || 0
}

/* ── Email search (single) ── */
export async function searchEmail(firstname, lastname, domainOrCompany) {
  const init = await post('/email-search', { firstname, lastname, domainOrCompany })
  if (!init?.item?._id) return null
  const result = await poll(init.item._id)
  return result?.results?.emails?.[0] || null
}

/* ── Bulk email search ── */
export async function bulkEmailSearch(prospects) {
  // prospects = [{ firstname, lastname, domainOrCompany }]
  const chunks = []
  for (let i = 0; i < prospects.length; i += 50) chunks.push(prospects.slice(i, i + 50))

  const results = []
  for (const chunk of chunks) {
    const data = await post('/bulk-single-searchs', {
      name: `MF-bulk-${Date.now()}`,
      task: 'email-search',
      data: chunk.map(p => [p.firstname, p.lastname, p.domainOrCompany]),
    })

    // Poll for completion
    if (data?.item?._id) {
      await new Promise(r => setTimeout(r, 8000))
      const res = await post('/bulk-single-searchs/read', { id: data.item._id })
      results.push(...(res?.items || []))
    }
  }
  return results
}

/* ── Credits ── */
export async function getCredits() {
  const data = await get('/subscription')
  return data?.credits || null
}
