import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'
import { useAuth } from './_app'

const STATUS = {
  done:       { label: 'Prête',    bg: 'var(--green-bg)', c: 'var(--green)' },
  generating: { label: 'En cours', bg: 'var(--amber-bg)', c: 'var(--amber)' },
  draft:      { label: 'Vide',     bg: 'var(--bg3)',      c: 'var(--t3)'    },
}

function BaseCard({ base, onDelete }) {
  const router = useRouter()
  // Badge basé sur le VRAI count de contacts, pas sur status (qui peut être obsolète)
  const hasContacts = (base.prospects_count || 0) > 0
  const effectiveStatus = hasContacts ? 'done' : base.status
  const s = STATUS[effectiveStatus] || STATUS.draft
  const label = base.ape_label || base.client_sector || '—'
  const dept  = base.dept_label || base.client_location || '—'

  return (
    <div className="card card-hover" style={{ padding: 22, cursor: 'pointer' }}
      onClick={() => router.push(`/bases/${base.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <h3 style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {base.name}
            </h3>
            <span className="badge" style={{ background: s.bg, color: s.c, flexShrink: 0 }}>{s.label}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--t3)' }}>{label} · {dept}</p>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--t4)', flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onDelete(base.id) }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 17, fontWeight: 500, color: 'var(--text)' }}>{base.prospects_count || 0}</span>
          <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 4 }}>contacts</span>
        </div>
        {base.job_titles && (
          <div style={{ fontSize: 12, color: 'var(--t4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', alignSelf: 'center' }}>
            {base.job_titles.split(',')[0].trim()}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--t4)' }}>
          {new Date(base.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>Ouvrir →</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const { user, loading: authLoading } = useAuth()

  const [bases, setBases]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!authLoading && !user) router.push('/login') }, [user, authLoading])
  useEffect(() => { if (user) fetchBases() }, [user])

  async function fetchBases() {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    setBases(data || [])
    setLoading(false)
  }

  async function deleteBase(id) {
    if (!confirm('Supprimer cette base ?')) return
    await supabase.from('campaigns').delete().eq('id', id)
    setBases(b => b.filter(x => x.id !== id))
  }

  const stats = {
    total:    bases.length,
    ready:    bases.filter(b => (b.prospects_count || 0) > 0).length,
    contacts: bases.reduce((a, b) => a + (b.prospects_count || 0), 0),
  }

  return (
    <>
      <Head><title>Mission Data — Dashboard</title></Head>
      <Layout title="Mes bases"
        action={
          <Link href="/nouvelle-base">
            <button className="btn btn-primary">+ Nouvelle base</button>
          </Link>
        }>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { v: stats.total,    l: 'Bases créées',     s: 'au total' },
            { v: stats.ready,    l: 'Bases prêtes',     s: 'avec contacts' },
            { v: stats.contacts, l: 'Contacts totaux',  s: 'enrichis Icypeas' },
          ].map(s => (
            <div key={s.l} className="card" style={{ padding: '18px 22px' }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginTop: 6 }}>{s.l}</div>
              <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>{s.s}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : bases.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">◎</div>
              <h3>Aucune base</h3>
              <p>Créez votre première base de prospection B2B — secteur, zone géo, poste cible en 30 secondes.</p>
              <Link href="/nouvelle-base">
                <button className="btn btn-primary" style={{ marginTop: 20 }}>+ Créer ma première base</button>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {bases.map(b => <BaseCard key={b.id} base={b} onDelete={deleteBase} />)}
          </div>
        )}
      </Layout>
    </>
  )
}

// Force SSR — évite les erreurs d'hydration avec l'auth client-side
export async function getServerSideProps() {
  return { props: {} }
}
