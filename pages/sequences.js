import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Layout from '../components/Layout'

const MSG_TABS = [
  { k: 'email_1', l: 'Email 1', icon: '✉' },
  { k: 'email_2', l: 'Email 2', icon: '✉' },
  { k: 'email_3', l: 'Email 3', icon: '✉' },
  { k: 'linkedin_1', l: 'LinkedIn 1', icon: '◈' },
  { k: 'linkedin_2', l: 'LinkedIn 2', icon: '◈' },
]

function SeqCard({ seq, prospect, campaignName }) {
  const [tab, setTab] = useState('email_1')
  const content = seq[tab] || ''

  const copy = () => {
    navigator.clipboard.writeText(content)
      .then(() => alert('Copié dans le presse-papiers !'))
  }

  return (
    <div className="card fade-in" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        background: 'var(--navy)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.9)' }}>
            {prospect?.fullname || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>
            {[prospect?.job_title, prospect?.company].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {prospect?.email && (
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--abl)', marginBottom: 3 }}>
              {prospect.email}
            </div>
          )}
          <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '.04em' }}>
            {campaignName}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        overflow: 'auto',
      }}>
        {MSG_TABS.map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            style={{
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: tab === t.k ? 600 : 400,
              color: tab === t.k ? 'var(--mf-blue)' : 'var(--t3)',
              borderBottom: `2px solid ${tab === t.k ? 'var(--mf-blue)' : 'transparent'}`,
              marginBottom: -1,
              whiteSpace: 'nowrap',
              background: 'none',
              transition: 'all .12s',
            }}>
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '18px 20px' }}>
        {content ? (
          <>
            <pre style={{
              fontFamily: 'var(--fb)',
              fontSize: 13,
              color: 'var(--t2)',
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              minHeight: 60,
            }}>{content}</pre>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-secondary btn-sm" onClick={copy}>⧉ Copier</button>
              {tab.startsWith('email') && prospect?.email && (
                <a href={`mailto:${prospect.email}?body=${encodeURIComponent(content)}`}
                   className="btn btn-ghost btn-sm">
                  ✉ Ouvrir dans Mail
                </a>
              )}
              {tab.startsWith('linkedin') && prospect?.linkedin_url && (
                <a href={prospect.linkedin_url} target="_blank" rel="noreferrer"
                   className="btn btn-ghost btn-sm">
                  ↗ Ouvrir LinkedIn
                </a>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize: 13 }}>Contenu non généré pour ce message.</p>
        )}
      </div>
    </div>
  )
}

export default function SequencesPage() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const user     = useUser()

  const [sequences, setSequences]   = useState([])
  const [prospects, setProspects]   = useState([])
  const [campaigns, setCampaigns]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [campFilter, setCampFilter] = useState('all')

  useEffect(() => {
    if (user === null) router.push('/login')
  }, [user])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('sequences').select('*').order('created_at', { ascending: false }),
      supabase.from('prospects').select('id, fullname, job_title, company, email, email_cert, linkedin_url, campaign_id'),
      supabase.from('campaigns').select('id, name'),
    ]).then(([s, p, c]) => {
      setSequences(s.data || [])
      setProspects(p.data || [])
      setCampaigns(c.data || [])
      setLoading(false)
    })
  }, [user])

  const prospectMap = Object.fromEntries((prospects || []).map(p => [p.id, p]))
  const campMap     = Object.fromEntries((campaigns || []).map(c => [c.id, c.name]))

  const filtered = sequences.filter(s => {
    const p = prospectMap[s.prospect_id]
    const txt = search.toLowerCase()
    const matchSearch = !txt ||
      (p?.fullname || '').toLowerCase().includes(txt) ||
      (p?.company || '').toLowerCase().includes(txt)
    const matchCamp = campFilter === 'all' || s.campaign_id === campFilter
    return matchSearch && matchCamp
  })

  return (
    <>
      <Head><title>Séquences — Mission Freelances</title></Head>
      <Layout
        title="Séquences"
        action={
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--t3)' }}>
            {sequences.length} séquence{sequences.length !== 1 ? 's' : ''} générée{sequences.length !== 1 ? 's' : ''}
          </div>
        }
      >
        {/* Filters */}
        <div className="card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Rechercher un prospect, une société..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280, padding: '8px 12px' }}
          />
          <select className="select" value={campFilter} onChange={e => setCampFilter(e.target.value)}
            style={{ width: 220, padding: '8px 12px' }}>
            <option value="all">Toutes les campagnes</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--t3)' }}>
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">✦</div>
              <h3>{sequences.length === 0 ? 'Aucune séquence' : 'Aucun résultat'}</h3>
              <p>{sequences.length === 0
                ? 'Ouvrez une campagne, trouvez des prospects, puis cliquez sur "Générer les séquences".'
                : 'Modifiez votre recherche.'}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 }}>
            {filtered.map(seq => (
              <SeqCard
                key={seq.id}
                seq={seq}
                prospect={prospectMap[seq.prospect_id]}
                campaignName={campMap[seq.campaign_id] || '—'}
              />
            ))}
          </div>
        )}
      </Layout>
    </>
  )
}
