import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'

const STATUS_BADGE = {
  draft:      { label: 'Brouillon', cls: 'badge-draft' },
  generating: { label: 'En cours', cls: 'badge-gen' },
  done:       { label: 'Terminé', cls: 'badge-live' },
}

function CampaignCard({ campaign, onDelete }) {
  const router = useRouter()
  const badge = STATUS_BADGE[campaign.status] || STATUS_BADGE.draft

  return (
    <div className="card card-hover" style={{ padding: 24, cursor: 'pointer' }}
         onClick={() => router.push(`/campagnes/${campaign.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h3 style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {campaign.name}
            </h3>
            <span className={`badge ${badge.cls}`}>{badge.label}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            {[campaign.client_sector, campaign.client_type, campaign.client_location].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--t4)', flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onDelete(campaign.id) }}>
          ✕
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 24 }}>
        {[
          { v: campaign.prospects_count || 0, l: 'prospects' },
          { v: campaign.sequences_count || 0, l: 'séquences' },
        ].map(s => (
          <div key={s.l}>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>{s.v}</span>
            <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 4 }}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border2)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--t4)' }}>
          {new Date(campaign.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <span style={{ fontSize: 12, color: 'var(--mf-2)', fontWeight: 600 }}>
          Voir la campagne →
        </span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const user     = useUser()

  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (user === null) router.push('/')
  }, [user])

  useEffect(() => {
    if (!user) return
    fetchCampaigns()
  }, [user])

  async function fetchCampaigns() {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    setCampaigns(data || [])
    setLoading(false)
  }

  async function deleteCampaign(id) {
    if (!confirm('Supprimer cette campagne ?')) return
    await supabase.from('campaigns').delete().eq('id', id)
    setCampaigns(c => c.filter(x => x.id !== id))
  }

  const stats = {
    total: campaigns.length,
    done: campaigns.filter(c => c.status === 'done').length,
    prospects: campaigns.reduce((a, c) => a + (c.prospects_count || 0), 0),
    sequences: campaigns.reduce((a, c) => a + (c.sequences_count || 0), 0),
  }

  return (
    <>
      <Head><title>Mission Freelances — Dashboard</title></Head>
      <Layout
        title="Mes campagnes"
        action={
          <Link href="/nouvelle-campagne">
            <button className="btn btn-primary">+ Nouvelle campagne</button>
          </Link>
        }
      >
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { v: stats.total, l: 'Campagnes', sub: 'au total' },
            { v: stats.done, l: 'Terminées', sub: 'avec prospects' },
            { v: stats.prospects, l: 'Prospects', sub: 'enrichis Icypeas' },
            { v: stats.sequences, l: 'Séquences', sub: 'générées Claude' },
          ].map(s => (
            <div key={s.l} className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginTop: 6 }}>{s.l}</div>
              <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Campaigns grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">✦</div>
              <h3>Aucune campagne</h3>
              <p>Créez votre première campagne pour trouver vos prospects idéaux et générer vos séquences d'approche.</p>
              <Link href="/nouvelle-campagne">
                <button className="btn btn-primary" style={{ marginTop: 20 }}>
                  + Créer ma première campagne
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {campaigns.map(c => (
              <CampaignCard key={c.id} campaign={c} onDelete={deleteCampaign} />
            ))}
          </div>
        )}
      </Layout>
    </>
  )
}
