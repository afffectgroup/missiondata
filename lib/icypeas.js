const BASE = 'https://app.icypeas.com/api'
const KEY  = process.env.ICYPEAS_API_KEY

function headers() {
  return { 'Content-Type': 'application/json', Authorization: KEY }
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: headers(), body: JSON.stringify(body)
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Icypeas ${path} → ${r.status}: ${text.slice(0, 200)}`)
  }
  return r.json()
}

/* ── Poll a single-search result until done ── */
async function pollResult(id, maxWait = 30000) {
  const start = Date.now()
  const PENDING = ['NONE', 'SCHEDULED', 'IN_PROGRESS']
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 2500))
    const data = await post('/bulk-single-searchs/read', { id })
    const item = data?.items?.[0]
    if (item && !PENDING.includes(item.status)) return item
  }
  throw new Error('Icypeas polling timeout après 30s')
}

/* ── Find People (with credits) ── */
export async function findPeople(query, maxResults = 20) {
  const data = await post('/find-people', { query, maxResults })
  return data?.leads || []
}

/* ── Count People (FREE — 0 crédit) ── */
export async function countPeople(query) {
  const data = await post('/find-people/count', { query })
  return data?.total || 0
}

/* ── Single email search ── */
export async function searchEmail(firstname, lastname, domainOrCompany) {
  const init = await post('/email-search', { firstname, lastname, domainOrCompany })
  if (!init?.item?._id) return null
  const result = await pollResult(init.item._id)
  return result?.results?.emails?.[0] || null
}

/* ── Bulk email search — batched by 50 ── */
export async function bulkEmailSearch(prospects) {
  // prospects = [{ firstname, lastname, domainOrCompany }]
  if (!prospects.length) return []

  const all = []
  const CHUNK = 50

  for (let i = 0; i < prospects.length; i += CHUNK) {
    const chunk = prospects.slice(i, i + CHUNK)

    const init = await post('/bulk-single-searchs', {
      name:  `MF-${Date.now()}`,
      task:  'email-search',
      data:  chunk.map(p => [p.firstname || '', p.lastname || '', p.domainOrCompany || '']),
    })

    if (!init?.item?._id) continue

    // Wait for bulk job to process
    await new Promise(r => setTimeout(r, 8000))

    // Fetch results with pagination
    let page = 0
    while (true) {
      const res = await post('/bulk-single-searchs/read', { id: init.item._id, page })
      const items = res?.items || []
      all.push(...items)
      if (items.length < 50) break   // no more pages
      page++
    }
  }

  return all
}
