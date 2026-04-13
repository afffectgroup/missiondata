import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Layout from '../components/Layout'
import { useAuth } from './_app'

const COLUMNS = [
  { id: 'applied',      label: 'Candidaté',  icon: '✉', color: '#1E40AF', bg: 'var(--blue-bg)' },
  { id: 'followed_up',  label: 'Relancé',    icon: '↻', color: '#78350F', bg: 'var(--amber-bg)' },
  { id: 'in_progress',  label: 'En cours',   icon: '◎', color: '#15803D', bg: 'var(--green-bg)' },
  { id: 'signed',       label: 'Signé ✓',    icon: '★', color: '#5B21B6', bg: '#EDE9FE' },
]

const CERT_MAP = {
  ultra_sure: { label:'Vérifié', bg:'var(--green-bg)', c:'#15803D' },
  sure:       { label:'Sûr',     bg:'var(--blue-bg)',  c:'#1E40AF' },
  probable:   { label:'Prob.',   bg:'var(--blue-bg)',  c:'#1E40AF' },
  risky:      { label:'Risqué',  bg:'var(--amber-bg)', c:'#78350F' },
}

function ProspectCard({ prospect, column, onMove, onDragStart }) {
  const cert = CERT_MAP[prospect.email_cert]
  const [dragging, setDragging] = useState(false)

  return (
    <div
      draggable
      onDragStart={e => { setDragging(true); onDragStart(e, prospect.id) }}
      onDragEnd={() => setDragging(false)}
      style={{
        background: 'var(--white)',
        border: `1px solid ${dragging ? 'var(--mf-2)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
        cursor: 'grab',
        opacity: dragging ? 0.5 : 1,
        boxShadow: dragging ? 'var(--sh3)' : 'var(--sh1)',
        transition: 'box-shadow .15s, opacity .15s',
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>
        {prospect.fullname}
      </div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 6 }}>
        {[prospect.job_title, prospect.company].filter(Boolean).join(' · ')}
      </div>

      {prospect.email && (
        <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ab)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prospect.email}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {cert
          ? <span className="badge" style={{ background: cert.bg, color: cert.c, fontSize: 10 }}>{cert.label}</span>
          : <span />
        }
        {prospect.linkedin_url && (
          <a href={prospect.linkedin_url} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 11, color: 'var(--ab)', fontWeight: 500 }}>↗ LinkedIn</a>
        )}
      </div>

      {/* Move buttons */}
      <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
        {COLUMNS.filter(c => c.id !== column?.id).map(c => (
          <button
            key={c.id}
            onClick={() => onMove(prospect.id, c.id)}
            style={{
              padding: '3px 8px', borderRadius: 'var(--r-full)',
              fontSize: 10, fontWeight: 500, cursor: 'pointer',
              background: c.bg, color: c.color,
              border: 'none', transition: 'all .1s',
            }}>
            → {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function KanbanColumn({ column, prospects, onMove, onDragStart, onDrop }) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      style={{
        flex: 1, minWidth: 220, maxWidth: 300,
        display: 'flex', flexDirection: 'column',
        background: dragOver ? 'var(--bg2)' : 'var(--bg)',
        border: `1px solid ${dragOver ? 'var(--border3)' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)',
        transition: 'all .15s',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { setDragOver(false); onDrop(e, column.id) }}
    >
      {/* Column header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{column.icon}</span>
          <span style={{ fontFamily: 'var(--fd)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {column.label}
          </span>
          <span style={{
            marginLeft: 'auto', fontFamily: 'var(--fm)', fontSize: 11,
            background: column.bg, color: column.color,
            padding: '2px 8px', borderRadius: 'var(--r-full)',
          }}>{prospects.length}</span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, padding: '12px 12px 16px', overflowY: 'auto', minHeight: 120 }}>
        {prospects.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--t4)', fontSize: 12, padding: '20px 0', fontStyle: 'italic' }}>
            Glissez des cartes ici
          </div>
        ) : (
          prospects.map(p => (
            <ProspectCard
              key={p.id}
              prospect={p}
              column={column}
              onMove={onMove}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function KanbanPage() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const { user } = useAuth()

  const [prospects, setProspects] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [campFilter, setCampFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState(null)

  useEffect(() => { if (user === null) router.push('/') }, [user])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('prospects')
        .select('*')
        .not('kanban_status', 'is', null)
        .order('kanban_updated_at', { ascending: false }),
      supabase.from('campaigns').select('id, name'),
    ]).then(([p, c]) => {
      setProspects(p.data || [])
      setCampaigns(c.data || [])
      setLoading(false)
    })
  }, [user])

  async function moveProspect(prospectId, newStatus) {
    const { data } = await supabase
      .from('prospects')
      .update({ kanban_status: newStatus, kanban_updated_at: new Date().toISOString() })
      .eq('id', prospectId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (data) {
      setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, kanban_status: newStatus } : p))
    }
  }

  function handleDragStart(e, prospectId) {
    e.dataTransfer.setData('prospectId', prospectId)
    setDragId(prospectId)
  }

  function handleDrop(e, columnId) {
    const prospectId = e.dataTransfer.getData('prospectId')
    if (prospectId) moveProspect(prospectId, columnId)
    setDragId(null)
  }

  const campMap = Object.fromEntries(campaigns.map(c => [c.id, c.name]))

  const filtered = campFilter === 'all'
    ? prospects
    : prospects.filter(p => p.campaign_id === campFilter)

  const byColumn = Object.fromEntries(
    COLUMNS.map(c => [c.id, filtered.filter(p => p.kanban_status === c.id)])
  )

  const stats = {
    total: filtered.length,
    signed: byColumn.signed?.length || 0,
    inProgress: byColumn.in_progress?.length || 0,
  }

  return (
    <>
      <Head><title>Pipeline — Mission Freelances</title></Head>
      <Layout
        title="Pipeline"
        action={
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--t3)' }}>
            {stats.total} suivi{stats.total !== 1 ? 's' : ''} · {stats.signed} signé{stats.signed !== 1 ? 's' : ''}
          </div>
        }
      >
        {/* Info banner if empty */}
        {!loading && filtered.length === 0 && (
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            ✦ Le kanban se remplit depuis la page de chaque campagne.
            Dans l'onglet Prospects, les cartes apparaissent ici dès que vous leur attribuez un statut.
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
          {COLUMNS.map(c => (
            <div key={c.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{c.icon}</div>
              <div>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 22, fontWeight: 800, color: c.color, lineHeight: 1 }}>
                  {byColumn[c.id]?.length || 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <select className="select" value={campFilter} onChange={e => setCampFilter(e.target.value)} style={{ width: 240, padding: '8px 12px' }}>
            <option value="all">Toutes les campagnes</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--t4)' }}>
            Glisser-déposer pour changer de colonne
          </span>
        </div>

        {/* Board */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 16 }}>
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                prospects={byColumn[col.id] || []}
                onMove={moveProspect}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </Layout>
    </>
  )
}
