import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Layout from '../components/Layout'

const CERT_MAP = {
  ultra_sure: { label: 'Vérifié', cls: 'badge-ultra' },
  sure:       { label: 'Sûr', cls: 'badge-sure' },
  probable:   { label: 'Probable', cls: 'badge-sure' },
  risky:      { label: 'Risqué', cls: 'badge-risky' },
}

export default function ProspectsPage() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const user     = useUser()

  const [prospects, setProspects] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [certFilter, setCertFilter] = useState('all')
  const [campFilter, setCampFilter] = useState('all')

  useEffect(() => {
    if (user === null) router.push('/login')
  }, [user])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('prospects').select('*').order('created_at', { ascending: false }),
      supabase.from('campaigns').select('id, name'),
    ]).then(([p, c]) => {
      setProspects(p.data || [])
      setCampaigns(c.data || [])
      setLoading(false)
    })
  }, [user])

  const campMap = Object.fromEntries(campaigns.map(c => [c.id, c.name]))

  const filtered = prospects.filter(p => {
    const txt = search.toLowerCase()
    const matchSearch = !txt ||
      (p.fullname || '').toLowerCase().includes(txt) ||
      (p.company || '').toLowerCase().includes(txt) ||
      (p.email || '').toLowerCase().includes(txt) ||
      (p.job_title || '').toLowerCase().includes(txt)
    const matchCert = certFilter === 'all' || p.email_cert === certFilter
    const matchCamp = campFilter === 'all' || p.campaign_id === campFilter
    return matchSearch && matchCert && matchCamp
  })

  const stats = {
    total: prospects.length,
    withEmail: prospects.filter(p => p.email).length,
    verified: prospects.filter(p => p.email_cert === 'ultra_sure').length,
  }

  const exportCSV = () => {
    const header = ['Nom', 'Poste', 'Entreprise', 'Email', 'Certitude', 'LinkedIn', 'Campagne']
    const rows = filtered.map(p => [
      p.fullname, p.job_title, p.company, p.email || '', p.email_cert || '',
      p.linkedin_url || '', campMap[p.campaign_id] || '',
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'prospects.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Head><title>Prospects — Mission Freelances</title></Head>
      <Layout
        title="Prospects"
        action={
          <button className="btn btn-secondary" onClick={exportCSV} disabled={filtered.length === 0}>
            ↓ Export CSV
          </button>
        }
      >
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { v: stats.total, l: 'Total', sub: 'tous prospects' },
            { v: stats.withEmail, l: 'Avec email', sub: `${stats.total ? Math.round(stats.withEmail / stats.total * 100) : 0}% de couverture` },
            { v: stats.verified, l: 'Vérifiés', sub: 'ultra_sure Icypeas' },
          ].map(s => (
            <div key={s.l} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginTop: 5 }}>{s.l}</div>
              <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Rechercher nom, email, société..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 260, padding: '8px 12px' }}
          />

          <select className="select" value={certFilter} onChange={e => setCertFilter(e.target.value)}
            style={{ width: 160, padding: '8px 12px' }}>
            <option value="all">Toutes certitudes</option>
            <option value="ultra_sure">Vérifié</option>
            <option value="sure">Sûr</option>
            <option value="probable">Probable</option>
            <option value="risky">Risqué</option>
          </select>

          <select className="select" value={campFilter} onChange={e => setCampFilter(e.target.value)}
            style={{ width: 200, padding: '8px 12px' }}>
            <option value="all">Toutes campagnes</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--t3)', marginLeft: 'auto' }}>
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">◎</div>
              <h3>{prospects.length === 0 ? 'Aucun prospect' : 'Aucun résultat'}</h3>
              <p>{prospects.length === 0 ? 'Créez une campagne et lancez la recherche Icypeas.' : 'Modifiez vos filtres.'}</p>
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Poste</th>
                  <th>Entreprise</th>
                  <th>Email</th>
                  <th>Certitude</th>
                  <th>Campagne</th>
                  <th>LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const cert = CERT_MAP[p.email_cert] || null
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{p.fullname || '—'}</td>
                      <td style={{ color: 'var(--t3)', fontSize: 12 }}>{p.job_title || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{p.company || '—'}</td>
                      <td>
                        {p.email ? (
                          <a href={`mailto:${p.email}`} style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--mf-2)' }}>
                            {p.email}
                          </a>
                        ) : <span style={{ color: 'var(--t4)' }}>—</span>}
                      </td>
                      <td>
                        {cert ? <span className={`badge ${cert.cls}`}>{cert.label}</span> : '—'}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 12,
                          color: 'var(--t3)',
                          background: 'var(--bg)',
                          padding: '3px 8px',
                          borderRadius: 'var(--r-sm)',
                          whiteSpace: 'nowrap',
                        }}>
                          {campMap[p.campaign_id] || '—'}
                        </span>
                      </td>
                      <td>
                        {p.linkedin_url ? (
                          <a href={p.linkedin_url} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: 'var(--ab)', fontWeight: 500 }}>
                            ↗ Voir
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Layout>
    </>
  )
}
