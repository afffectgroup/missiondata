import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../../components/Layout'
import { useAuth } from '../_app'

const CERT_MAP = {
  ultra_sure: { label: 'Vérifié ✓', bg: 'var(--green-bg)', c: '#15803D' },
  sure:       { label: 'Sûr',       bg: 'var(--blue-bg)',  c: '#1E40AF' },
  probable:   { label: 'Probable',  bg: 'var(--blue-bg)',  c: '#1E40AF' },
  risky:      { label: 'Risqué',    bg: 'var(--amber-bg)', c: '#78350F' },
}
const LOG_C = { i:'#7DD3FC', s:'#86EFAC', e:'#FCA5A5', c:'#C4B5FD' }
const TONES = ['Professionnel', 'Direct & incisif', 'Chaleureux & humain', 'Expert & technique', 'Créatif & décalé']

/* ── Realtime progress ── */
function GenerationProgress({ pct, logs }) {
  const logRef = useRef(null)
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div className="spinner" />
        <span style={{ fontFamily:'var(--fd)', fontSize:15, fontWeight:700, color:'var(--text)' }}>Pipeline en cours…</span>
        <span style={{ marginLeft:'auto', fontFamily:'var(--fm)', fontSize:12, color:'var(--t3)' }}>{pct}%</span>
      </div>
      <div style={{ height:5, background:'var(--bg)', borderRadius:'var(--r-full)', overflow:'hidden', marginBottom:16 }}>
        <div style={{ height:'100%', background:'var(--mf-grad)', borderRadius:'var(--r-full)', width:`${pct}%`, transition:'width .4s ease' }} />
      </div>
      <div ref={logRef} style={{ background:'#0D1117', borderRadius:8, padding:'12px 16px', fontFamily:'var(--fm)', fontSize:12, height:200, overflowY:'auto', lineHeight:1.8 }}>
        {(logs || []).map((l, i) => (
          <div key={i} style={{ display:'flex', gap:14 }}>
            <span style={{ color:'#3D4451', flexShrink:0 }}>{l.ts}</span>
            <span style={{ color: LOG_C[l.type] || '#C9D1D9' }}>{l.msg}</span>
          </div>
        ))}
        {logs?.length === 0 && <span style={{ color:'#3D4451' }}>Démarrage…</span>}
      </div>
    </div>
  )
}

/* ── Volume estimate ── */
function VolumeEstimate({ campaignId }) {
  const [count, setCount]     = useState(null)
  const [loading, setLoading] = useState(false)
  const supabase = useSupabaseClient()

  async function estimate() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch(`/api/campaigns/${campaignId}/estimate`, {
      method:'POST',
      headers:{ Authorization:`Bearer ${session?.access_token}`, 'Content-Type':'application/json' }
    })
    const d = await r.json()
    setCount(d.total ?? null)
    setLoading(false)
  }

  if (count !== null) return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background:'var(--bg2)', borderRadius:'var(--r-md)', border:'1px solid var(--border3)' }}>
      <span style={{ fontFamily:'var(--fd)', fontSize:18, fontWeight:800, color:'var(--mf-blue)' }}>{count.toLocaleString('fr-FR')}</span>
      <span style={{ fontSize:13, color:'var(--t2)' }}>profils correspondent</span>
      <span style={{ fontFamily:'var(--fm)', fontSize:10, color:'var(--t4)' }}>· gratuit · 0 crédit</span>
    </div>
  )

  return (
    <button className="btn btn-secondary btn-sm" onClick={estimate} disabled={loading}>
      {loading ? <><span className="spinner" style={{ width:13, height:13 }} /> Estimation…</> : '◎ Estimer le volume (gratuit)'}
    </button>
  )
}

/* ── Sequence card ── */
function SequenceCard({ seq, prospect, onRegenerate }) {
  const [tab, setTab]     = useState('email_1')
  const [content, setCnt] = useState(seq[tab] || '')
  const [editing, setEd]  = useState(false)
  const [regen, setRegen] = useState(false)
  useEffect(() => setCnt(seq[tab] || ''), [tab, seq])

  const TABS = [
    { k:'email_1',l:'Email 1' },{ k:'email_2',l:'Email 2' },{ k:'email_3',l:'Email 3' },
    { k:'linkedin_1',l:'LinkedIn 1' },{ k:'linkedin_2',l:'LinkedIn 2' },
  ]

  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{prospect?.fullname || '—'}</div>
          <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>{[prospect?.job_title, prospect?.company].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {prospect?.email && <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ab)' }}>{prospect.email}</span>}
          <button className="btn btn-secondary btn-sm" onClick={async () => { setRegen(true); await onRegenerate(seq.prospect_id); setRegen(false) }} disabled={regen}>
            {regen ? <span className="spinner" style={{ width:12, height:12 }} /> : '↺'}
          </button>
        </div>
      </div>
      <div className="tabs" style={{ padding:'0 14px', background:'var(--bg)' }}>
        {TABS.map(t => <button key={t.k} className={`tab ${tab===t.k?'active':''}`} onClick={() => setTab(t.k)}>{t.l}</button>)}
      </div>
      <div style={{ padding:20 }}>
        {editing ? (
          <>
            <textarea className="textarea" value={content} onChange={e => setCnt(e.target.value)} style={{ minHeight:160, fontSize:13, lineHeight:1.7 }} />
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setEd(false)}>Sauvegarder</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEd(false); setCnt(seq[tab]) }}>Annuler</button>
            </div>
          </>
        ) : (
          <>
            <pre style={{ fontFamily:'var(--fb)', fontSize:13, color:'var(--t2)', lineHeight:1.8, whiteSpace:'pre-wrap', wordBreak:'break-word', minHeight:60 }}>
              {content || <span style={{ color:'var(--t4)', fontStyle:'italic' }}>Non généré</span>}
            </pre>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEd(true)}>✏ Éditer</button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(content).then(() => alert('Copié !'))}>⧉ Copier</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   CAMPAIGN DETAIL
══════════════════════════════════════ */
export default function CampaignDetail() {
  const router   = useRouter()
  const { id }   = router.query
  const supabase = useSupabaseClient()
  const { user } = useAuth()

  const [campaign, setCampaign]   = useState(null)
  const [prospects, setProspects] = useState([])
  const [sequences, setSequences] = useState([])
  const [tab, setTab]             = useState('prospects')
  const [loading, setLoading]     = useState(true)
  const [genSeq, setGenSeq]       = useState(false)
  const [error, setError]         = useState('')

  // Valeur ajoutée — renseignée dans l'onglet Séquences
  const [va, setVa] = useState({ freelance_result:'', freelance_kpi:'', freelance_angle:'', freelance_tone:'Professionnel' })
  const [vaSaved, setVaSaved] = useState(false)
  const [vaSaving, setVaSaving] = useState(false)

  useEffect(() => { if (user === null) router.push('/login') }, [user])

  useEffect(() => {
    if (!id || !user) return
    fetchAll()
    const channel = supabase
      .channel(`campaign-${id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'campaigns', filter:`id=eq.${id}` }, payload => {
        setCampaign(prev => prev ? { ...prev, ...payload.new } : payload.new)
        if (payload.new.status === 'done' && payload.new.generation_pct === 100) fetchProspects()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, user])

  async function fetchAll() {
    setLoading(true)
    const [c, p, s] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('prospects').select('*').eq('campaign_id', id).order('created_at'),
      supabase.from('sequences').select('*').eq('campaign_id', id),
    ])
    setCampaign(c.data)
    setProspects(p.data || [])
    setSequences(s.data || [])
    // Restore saved valeur ajoutée if exists
    if (c.data?.freelance_result) {
      setVa({ freelance_result: c.data.freelance_result || '', freelance_kpi: c.data.freelance_kpi || '', freelance_angle: c.data.freelance_angle || '', freelance_tone: c.data.freelance_tone || 'Professionnel' })
      setVaSaved(true)
    }
    setLoading(false)
  }

  async function fetchProspects() {
    const { data } = await supabase.from('prospects').select('*').eq('campaign_id', id).order('created_at')
    setProspects(data || [])
  }

  async function generateProspects() {
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch(`/api/campaigns/${id}/generate-prospects`, {
      method:'POST', headers:{ Authorization:`Bearer ${session?.access_token}`, 'Content-Type':'application/json' }
    })
    if (!r.ok) { const d = await r.json(); setError(d.error || 'Erreur') }
  }

  async function saveVA() {
    setVaSaving(true)
    await supabase.from('campaigns').update(va).eq('id', id)
    setVaSaved(true)
    setVaSaving(false)
  }

  async function generateSequences() {
    // Save VA first if not saved
    if (!vaSaved) await saveVA()
    setGenSeq(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch(`/api/campaigns/${id}/generate-sequences`, {
      method:'POST', headers:{ Authorization:`Bearer ${session?.access_token}`, 'Content-Type':'application/json' }
    })
    if (r.ok) { const d = await r.json(); setSequences(d.sequences || []) }
    else { const d = await r.json(); setError(d.error || 'Erreur') }
    setGenSeq(false)
  }

  async function regenerateOne(prospectId) {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch(`/api/campaigns/${id}/generate-sequences`, {
      method:'POST',
      headers:{ Authorization:`Bearer ${session?.access_token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ prospect_ids: [prospectId] }),
    })
    if (r.ok) {
      const d = await r.json()
      setSequences(prev => {
        const next = [...prev]
        for (const s of (d.sequences || [])) {
          const idx = next.findIndex(x => x.prospect_id === s.prospect_id)
          if (idx >= 0) next[idx] = s; else next.push(s)
        }
        return next
      })
    }
  }

  const isGenerating = campaign?.status === 'generating'

  if (loading) return <Layout><div style={{ display:'flex', justifyContent:'center', padding:80 }}><div className="spinner" /></div></Layout>
  if (!campaign) return <Layout><div className="empty"><h3>Campagne introuvable</h3></div></Layout>

  return (
    <>
      <Head><title>{campaign.name} — Mission Freelances</title></Head>
      <Layout title={campaign.name} action={<Link href="/dashboard"><button className="btn btn-secondary btn-sm">← Dashboard</button></Link>}>

        {/* Meta badges */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:-8, marginBottom:24, flexWrap:'wrap' }}>
          {[campaign.client_type, campaign.client_sector, campaign.client_location].filter(Boolean).map(t => (
            <span key={t} className="badge badge-new">{t}</span>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom:20 }}>⚠ {error}</div>}

        {/* Realtime progress */}
        {isGenerating && <GenerationProgress pct={campaign.generation_pct || 0} logs={campaign.generation_logs || []} />}

        {/* Actions bar */}
        {!isGenerating && (
          <div style={{ display:'flex', gap:12, marginBottom:24, padding:'14px 18px', background:'var(--white)', borderRadius:'var(--r-lg)', border:`1px solid var(--border)`, boxShadow:'var(--sh1)', flexWrap:'wrap', alignItems:'center' }}>
            <button className="btn btn-primary" onClick={generateProspects}>
              ◎ {prospects.length > 0 ? 'Relancer la recherche' : 'Trouver des prospects'}
            </button>
            <div style={{ width:1, height:28, background:'var(--border)', margin:'0 4px' }} />
            <VolumeEstimate campaignId={id} />
            <div style={{ marginLeft:'auto', fontFamily:'var(--fm)', fontSize:12, color:'var(--t3)' }}>
              {prospects.length} prospects · {sequences.length} séquences
            </div>
          </div>
        )}

        {/* Tabs */}
        {!isGenerating && (
          <>
            <div className="tabs" style={{ marginBottom:20 }}>
              <button className={`tab ${tab==='prospects'?'active':''}`} onClick={() => setTab('prospects')}>Prospects ({prospects.length})</button>
              <button className={`tab ${tab==='sequences'?'active':''}`} onClick={() => setTab('sequences')}>Séquences ({sequences.length})</button>
              <button className={`tab ${tab==='info'?'active':''}`} onClick={() => setTab('info')}>Campagne</button>
            </div>

            {/* ── Prospects ── */}
            {tab === 'prospects' && (
              <div className="fade-in">
                {prospects.length === 0 ? (
                  <div className="card"><div className="empty"><div className="empty-icon">◎</div><h3>Aucun prospect</h3><p>Cliquez "Trouver des prospects" pour lancer la recherche.</p></div></div>
                ) : (
                  <div className="card" style={{ overflow:'hidden' }}>
                    <table className="table">
                      <thead><tr><th>Nom</th><th>Poste</th><th>Entreprise</th><th>Email</th><th>Certitude</th><th>LinkedIn</th></tr></thead>
                      <tbody>
                        {prospects.map(p => {
                          const cert = CERT_MAP[p.email_cert]
                          return (
                            <tr key={p.id}>
                              <td style={{ fontWeight:600, color:'var(--text)' }}>{p.fullname || '—'}</td>
                              <td style={{ color:'var(--t3)', fontSize:12 }}>{p.job_title || '—'}</td>
                              <td style={{ fontWeight:500 }}>{p.company || '—'}</td>
                              <td style={{ fontFamily:'var(--fm)', fontSize:11 }}>{p.email || '—'}</td>
                              <td>{cert ? <span className="badge" style={{ background:cert.bg, color:cert.c }}>{cert.label}</span> : '—'}</td>
                              <td>{p.linkedin_url ? <a href={p.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--ab)', fontWeight:500 }}>↗ Voir</a> : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Séquences ── */}
            {tab === 'sequences' && (
              <div className="fade-in">

                {/* === Valeur ajoutée — déplacée ici === */}
                <div className="card" style={{ padding:24, marginBottom:20, border:`1px solid var(--border3)`, background:'var(--bg2)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <div>
                      <div style={{ fontFamily:'var(--fd)', fontSize:15, fontWeight:700, color:'var(--text)' }}>Votre valeur ajoutée</div>
                      <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>Renseignez ces champs pour que Claude personnalise les messages</div>
                    </div>
                    {vaSaved && <span className="badge badge-live">Sauvegardé ✓</span>}
                  </div>

                  <div style={{ display:'grid', gap:14 }}>
                    <div className="field">
                      <label className="label">Résultat client concret</label>
                      <span className="input-hint">Ce que vous avez accompli pour un client similaire</span>
                      <textarea className="textarea" placeholder="Ex : J'ai refait le site d'une agence RH parisienne, +240% de leads en 3 mois..."
                        value={va.freelance_result} onChange={e => { setVa(v => ({ ...v, freelance_result:e.target.value })); setVaSaved(false) }} style={{ minHeight:80 }} />
                    </div>
                    <div className="field">
                      <label className="label">KPI / avant–après</label>
                      <input className="input" placeholder="Ex : +240% de trafic, délai 3 semaines, ROI 4×..."
                        value={va.freelance_kpi} onChange={e => { setVa(v => ({ ...v, freelance_kpi:e.target.value })); setVaSaved(false) }} />
                    </div>
                    <div className="field">
                      <label className="label">Angle différenciateur</label>
                      <textarea className="textarea" placeholder="Ex : Je suis spécialisé agences de com depuis 5 ans, je connais leurs contraintes budget et délais..."
                        value={va.freelance_angle} onChange={e => { setVa(v => ({ ...v, freelance_angle:e.target.value })); setVaSaved(false) }} style={{ minHeight:70 }} />
                    </div>
                    <div className="field">
                      <label className="label">Ton des messages</label>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                        {TONES.map(t => (
                          <button key={t} type="button"
                            onClick={() => { setVa(v => ({ ...v, freelance_tone:t })); setVaSaved(false) }}
                            style={{ padding:'7px 14px', borderRadius:'var(--r-full)', fontSize:13, fontWeight:500, cursor:'pointer', transition:'all .12s',
                              border:`1px solid ${va.freelance_tone===t?'var(--mf-2)':'var(--border)'}`,
                              background: va.freelance_tone===t?'var(--bg2)':'var(--white)',
                              color: va.freelance_tone===t?'var(--mf-2)':'var(--t2)' }}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:10, marginTop:18, alignItems:'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={saveVA} disabled={vaSaving}>
                      {vaSaving ? <><span className="spinner" style={{ width:12, height:12 }} /> Sauvegarde…</> : '💾 Sauvegarder'}
                    </button>
                    {prospects.length > 0 && (
                      <button className="btn btn-primary" onClick={generateSequences} disabled={genSeq}>
                        {genSeq
                          ? <><span className="spinner" style={{ width:14, height:14, borderColor:'rgba(255,255,255,.3)', borderTopColor:'white' }} /> Génération Claude…</>
                          : '✦ Générer les séquences'}
                      </button>
                    )}
                    {prospects.length === 0 && (
                      <span style={{ fontSize:12, color:'var(--t3)' }}>Trouvez d'abord des prospects via l'onglet Prospects</span>
                    )}
                  </div>
                </div>

                {/* Séquences générées */}
                {sequences.length === 0 ? (
                  <div className="card"><div className="empty"><div className="empty-icon">✦</div><h3>Aucune séquence</h3><p>Renseignez votre valeur ajoutée ci-dessus et cliquez "Générer les séquences".</p></div></div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {sequences.map(seq => (
                      <SequenceCard key={seq.id} seq={seq} prospect={prospects.find(p => p.id === seq.prospect_id)} onRegenerate={regenerateOne} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Info campagne ── */}
            {tab === 'info' && (
              <div className="fade-in card" style={{ padding:28 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  {[
                    { l:'Type', v:campaign.client_type }, { l:'Secteur', v:campaign.client_sector },
                    { l:'Taille', v:campaign.client_size }, { l:'Localisation', v:campaign.client_location },
                    { l:'Besoin', v:campaign.client_need }, { l:'Budget', v:campaign.client_budget },
                  ].map(r => (
                    <div key={r.l} style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:'var(--r-md)' }}>
                      <div style={{ fontFamily:'var(--fm)', fontSize:10, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{r.l}</div>
                      <div style={{ fontSize:14, color:'var(--text)', fontWeight:500 }}>{r.v || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Layout>
    </>
  )
}
