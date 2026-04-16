import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import Layout from '../../components/Layout'
import { useAuth } from '../_app'

const CERT = {
  ultra_sure:{ label:'Vérifié ✓', bg:'var(--green-bg)', c:'var(--green)' },
  sure:      { label:'Sûr',       bg:'var(--blue-bg)',  c:'var(--blue)'  },
  probable:  { label:'Probable',  bg:'var(--blue-bg)',  c:'var(--blue)'  },
  risky:     { label:'Risqué',    bg:'var(--amber-bg)', c:'var(--amber)' },
}
const LOG_C = { i:'#7DD3FC', s:'#86EFAC', e:'#FCA5A5', t:'#C4B5FD', w:'#FCD34D' }

function Progress({ pct, logs }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
  return (
    <div className="card" style={{ padding:24, marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <div className="spinner" />
        <span style={{ fontFamily:'var(--fd)', fontSize:15, fontWeight:700 }}>Génération en cours…</span>
        <span style={{ marginLeft:'auto', fontFamily:'var(--fm)', fontSize:12, color:'var(--t3)' }}>{pct}%</span>
      </div>
      <div className="progress-bar" style={{ marginBottom:16 }}>
        <div className="progress-fill" style={{ width:`${pct}%` }} />
      </div>
      <div ref={ref} style={{ background:'#0D1117', borderRadius:8, padding:'12px 16px', fontFamily:'var(--fm)', fontSize:12, height:200, overflowY:'auto', lineHeight:1.8 }}>
        {(logs||[]).map((l,i) => (
          <div key={i} style={{ display:'flex', gap:12 }}>
            <span style={{ color:'#3D4451', flexShrink:0 }}>{l.ts}</span>
            <span style={{ color: LOG_C[l.type]||'#C9D1D9' }}>{l.msg}</span>
          </div>
        ))}
        {!logs?.length && <span style={{ color:'#3D4451' }}>Initialisation…</span>}
      </div>
    </div>
  )
}

export default function BasePage() {
  const router   = useRouter()
  const { id }   = router.query
  const supabase = useSupabaseClient()
  const { user } = useAuth()

  const [base, setBase]         = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [running, setRunning]   = useState(false)
  const [logs, setLogs]         = useState([])
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState(null)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')

  useEffect(() => { if (user === null) router.push('/') }, [user])

  useEffect(() => {
    if (!id || !user) return
    // Auto-start if redirected from creation with ?autostart=1
    const autostart = router.query.autostart === '1'
    fetchAll().then((loadedBase) => {
      if (autostart && loadedBase) {
        router.replace(`/bases/${id}`, undefined, { shallow: true })
        setTimeout(() => generate(loadedBase), 400)
      }
    })

    // Supabase Realtime subscription
    const ch = supabase.channel(`base-${id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'campaigns', filter:`id=eq.${id}` }, p => {
        setBase(prev => prev ? { ...prev, ...p.new } : p.new)
        if (p.new.status === 'done' && p.new.generation_pct === 100) {
          fetchContacts()
          setRunning(false)
        }
      }).subscribe()

    return () => supabase.removeChannel(ch)
  }, [id, user])

  async function fetchAll() {
    setLoading(true)
    const [b, p] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('prospects').select('*').eq('campaign_id', id).order('created_at'),
    ])
    setBase(b.data)
    setContacts(p.data || [])
    setLoading(false)
    return b.data  // Return for autostart
  }

  async function fetchContacts() {
    const { data } = await supabase.from('prospects').select('*').eq('campaign_id', id).order('created_at')
    setContacts(data || [])
  }

  // baseData uniquement pour l'autostart — sinon on utilise le state `base`
  // IMPORTANT: onClick passe un SyntheticEvent comme premier arg, il faut l'ignorer
  // baseData uniquement pour l'autostart — sinon on utilise le state `base`
  async function generate(baseData) {
    const b = (baseData && baseData.id) ? baseData : base
    if (!b) { setError('Données non chargées — rechargez la page.'); return }
    setRunning(true); setError('')
    setLogs([{ msg: 'Démarrage…', type: 'i', ts: new Date().toLocaleTimeString('fr-FR') }])

    const addLog = (msg, type = 'i') =>
      setLogs(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString('fr-FR') }])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const isFR = (b.mode || 'france') !== 'international'
      let companies = []

      // ── Étape 1 : SIRENE depuis le navigateur (accessible en CORS) ──
      if (isFR) {
        addLog('↗ SIRENE — recherche entreprises…', 'i')

        const apeCodes  = (b.ape_code    || '').split(',').map(s => s.trim()).filter(Boolean)
        const deptCodes = (b.departement || '').split(',').map(s => s.trim()).filter(Boolean)
        const effCodes  = (b.effectif_code || '').split(',').map(s => s.trim()).filter(Boolean)
        const nCo       = b.n_companies || 10
        const perApe    = Math.max(Math.ceil(nCo / Math.max(apeCodes.length, 1)), 5)

        const apesToSearch  = apeCodes.length  ? apeCodes  : ['']
        const deptsToSearch = deptCodes.length ? deptCodes : ['']

        const sirenePromises = []
        for (const ape of apesToSearch) {
          for (const dept of deptsToSearch) {
            const p = new URLSearchParams({ per_page: perApe, page: 1, etat_administratif: 'A' })
            if (ape)  p.set('activite_principale', ape)
            if (dept) p.set('departement', dept)
            if (effCodes.length) p.set('tranche_effectif_salarie', effCodes[0])
            sirenePromises.push(
              fetch(`https://recherche-entreprises.api.gouv.fr/search?${p}`, { headers: { Accept: 'application/json' } })
                .then(r => r.ok ? r.json() : { results: [], total_results: 0 })
                .then(d => ({ results: d.results || [], total: d.total_results || 0 }))
                .catch(() => ({ results: [], total: 0 }))
            )
          }
        }

        const batches = await Promise.all(sirenePromises)
        const seen = new Set()
        for (const batch of batches) {
          for (const co of batch.results) {
            if (co.siren && !seen.has(co.siren)) { seen.add(co.siren); companies.push(co) }
          }
        }

        const total = batches.reduce((acc, b) => acc + b.total, 0)
        addLog(`SIRENE: ${companies.length} sociétés récupérées (${total} dispo au total)`, companies.length > 0 ? 's' : 'w')

        // Fallback sans effectif
        if (!companies.length && effCodes.length) {
          addLog('Réessai sans filtre taille…', 'w')
          const fb = await Promise.all(apesToSearch.flatMap(ape =>
            deptsToSearch.map(dept => {
              const p = new URLSearchParams({ per_page: perApe, page: 1, etat_administratif: 'A' })
              if (ape)  p.set('activite_principale', ape)
              if (dept) p.set('departement', dept)
              return fetch(`https://recherche-entreprises.api.gouv.fr/search?${p}`)
                .then(r => r.ok ? r.json() : { results: [] })
                .then(d => d.results || [])
                .catch(() => [])
            })
          ))
          for (const batch of fb) {
            for (const co of batch) {
              if (co.siren && !seen.has(co.siren)) { seen.add(co.siren); companies.push(co) }
            }
          }
          addLog(`Fallback sans taille: ${companies.length} sociétés`, companies.length > 0 ? 's' : 'w')
        }

        // Fallback sans département
        if (!companies.length && deptCodes.length) {
          addLog('Réessai sans filtre département…', 'w')
          const fb = await Promise.all(apesToSearch.map(ape => {
            const p = new URLSearchParams({ per_page: nCo, page: 1, etat_administratif: 'A' })
            if (ape) p.set('activite_principale', ape)
            return fetch(`https://recherche-entreprises.api.gouv.fr/search?${p}`)
              .then(r => r.ok ? r.json() : { results: [] })
              .then(d => d.results || [])
              .catch(() => [])
          }))
          for (const batch of fb) {
            for (const co of batch) {
              if (co.siren && !seen.has(co.siren)) { seen.add(co.siren); companies.push(co) }
            }
          }
          addLog(`Fallback sans dept: ${companies.length} sociétés`, companies.length > 0 ? 's' : 'w')
        }

        if (companies.length > 0) {
          addLog(`✓ ${companies.length} sociétés SIRENE`, 's')
        } else {
          addLog('SIRENE: 0 résultat — Icypeas recherche directe par secteur', 'w')
        }
      }

      // ── Étape 2+3 : Icypeas côté serveur via SSE ──
      addLog('↗ Icypeas — recherche contacts + emails…', 't')

      const es = await fetch(`/api/bases/${id}/pipeline`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies }),
      })

      if (!es.ok) {
        const e = await es.json().catch(() => ({}))
        throw new Error(e.error || `Erreur ${es.status}`)
      }

      // Lire le stream SSE
      const reader  = es.body.getReader()
      const decoder = new TextDecoder()
      const SEP     = '\n\n'
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split(SEP)
        buffer = parts.pop()
        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim()
          if (!line) continue
          try {
            const ev = JSON.parse(line)
            if (ev.type === 'log') {
              setLogs(prev => [...prev, { msg: ev.msg, type: ev.t, ts: ev.ts }])
            } else if (ev.type === 'done') {
              await fetchContacts()
              setBase(prev => ({ ...prev, status: 'done', generation_pct: 100, prospects_count: ev.count }))
              setRunning(false)
            } else if (ev.type === 'error') {
              throw new Error(ev.msg)
            }
          } catch (parseErr) {
            if (parseErr.message !== line) throw parseErr
          }
        }
      }

    } catch (e) {
      setLogs(prev => [...prev, { msg: `✗ ${e.message}`, type: 'e', ts: new Date().toLocaleTimeString('fr-FR') }])
      setError(e.message)
      setRunning(false)
    }
  }

  async function enrichEmails() {
    setEnriching(true); setEnrichResult(null); setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(`/api/bases/${id}/enrich-emails`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Erreur")
      setEnrichResult(d)
      fetchContacts()
    } catch (e) { setError(e.message) }
    setEnriching(false)
  }


  function exportCSV() {
    const h = ['Nom','Poste','Entreprise','Email','Certitude','LinkedIn','Ville']
    const rows = contacts.map(c => [c.fullname,c.job_title,c.company,c.email||'',c.email_cert||'',c.linkedin_url||'',c.location||''])
    const csv = '\uFEFF' + [h,...rows].map(r => r.map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }))
    a.download = `${base.name.replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  function exportXLSX() {
    const ws = XLSX.utils.json_to_sheet(contacts.map(c => ({
      'Nom': c.fullname||'', 'Poste': c.job_title||'', 'Entreprise': c.company||'',
      'Email': c.email||'', 'Certitude': c.email_cert||'',
      'LinkedIn': c.linkedin_url||'', 'Ville': c.location||'',
    })))
    ws['!cols'] = [22,26,24,32,12,42,16].map(w => ({ wch:w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts')
    XLSX.writeFile(wb, `${base.name.replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const isGenerating = running
  const filtered = contacts.filter(c => {
    const s = search.toLowerCase()
    return !s || [c.fullname,c.company,c.job_title,c.email,c.location].some(v => (v||'').toLowerCase().includes(s))
  })

  if (loading) return <Layout><div style={{ display:'flex', justifyContent:'center', padding:80 }}><div className="spinner" /></div></Layout>
  if (!base) return <Layout><div className="empty"><h3>Base introuvable</h3></div></Layout>

  return (
    <>
      <Head><title>{base.name} — Mission Data</title></Head>
      <Layout
        title={base.name}
        action={
          <div style={{ display:'flex', gap:8 }}>
            {contacts.length > 0 && !isGenerating && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={exportCSV}>↓ CSV</button>
                <button className="btn btn-primary btn-sm" onClick={exportXLSX}>↓ Excel</button>
              </>
            )}
            <Link href="/dashboard">
              <button className="btn btn-secondary btn-sm">← Dashboard</button>
            </Link>
          </div>
        }>

        {/* Meta */}
        <div style={{ display:'flex', gap:8, marginTop:-8, marginBottom:24, flexWrap:'wrap', alignItems:'center' }}>
          {[
            base.mode==='international' ? base.country_label : (base.ape_label||base.client_sector),
            base.mode==='international' ? (base.intl_sector||base.client_sector) : (base.dept_label||base.client_location),
            base.mode==='international' ? base.intl_city : (base.effectif_label||base.client_size),
          ].filter(Boolean).map(t => (
            <span key={t} className="badge badge-new">{t}</span>
          ))}
          {base.job_titles && (
            <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--t3)', marginLeft:4 }}>
              {base.job_titles.split(',').slice(0,2).map(s=>s.trim()).join(', ')}
            </span>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom:20 }}>⚠ {error}</div>}

        {/* Progress */}
        {isGenerating && <Progress pct={running ? 50 : (base?.generation_pct||0)} logs={logs} />}

        {/* Actions bar */}
        {!isGenerating && (
          <div style={{ display:'flex', gap:10, marginBottom:20, padding:'14px 18px', background:'var(--white)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)', boxShadow:'var(--sh1)', alignItems:'center', flexWrap:'wrap' }}>
            <button className="btn btn-primary" onClick={generate}>
              {contacts.length > 0 ? '↺ Régénérer' : '◎ Trouver les contacts'}
            </button>
            <div style={{ height:24, width:1, background:'var(--border)' }} />
            <button className="btn btn-secondary" onClick={enrichEmails}
              disabled={enriching || contacts.length === 0}>
              {enriching
                ? <><span className="spinner" style={{ width:14, height:14 }} /> Enrichissement…</>
                : '✉ Enrichir les emails'}
            </button>
            {enrichResult && (
              <span style={{ fontSize:12, color:'var(--green)', fontWeight:500 }}>
                ✓ {enrichResult.enriched}/{enrichResult.total} emails trouvés
              </span>
            )}
            <div style={{ marginLeft:'auto', fontFamily:'var(--fm)', fontSize:12, color:'var(--t3)' }}>
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''} · {contacts.filter(c=>c.email).length} emails
            </div>
          </div>
        )}

        {/* Stats row */}
        {contacts.length > 0 && !isGenerating && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
            {[
              { v:contacts.length,                                               l:'Contacts' },
              { v:contacts.filter(c=>c.email).length,                            l:'Avec email' },
              { v:contacts.filter(c=>c.email_cert==='ultra_sure').length,        l:'Vérifiés' },
              { v:Math.round(contacts.filter(c=>c.email).length/contacts.length*100||0)+'%', l:'Taux enrichi' },
            ].map(s => (
              <div key={s.l} className="card" style={{ padding:'14px 18px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:22, fontWeight:800, color:'var(--brand)', lineHeight:1 }}>{s.v}</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {!isGenerating && (
          contacts.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon">◎</div>
                <h3>Base vide</h3>
                <p>Cliquez "Générer les contacts" pour lancer le pipeline SIRENE + Icypeas.</p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ overflow:'hidden' }}>
              {/* Search */}
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
                <input className="input" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Filtrer nom, société, email, ville…"
                  style={{ width:280, padding:'7px 12px' }} />
                <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--t4)', marginLeft:'auto' }}>
                  {filtered.length} / {contacts.length}
                </span>
              </div>

              <div style={{ overflowX:'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      {['Nom','Poste','Entreprise','Email','Certitude','Ville','LinkedIn'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => {
                      const cert = CERT[c.email_cert]
                      return (
                        <tr key={c.id} style={{ background: i%2===0?'var(--white)':'var(--bg)' }}>
                          <td style={{ fontWeight:600, color:'var(--text)', whiteSpace:'nowrap' }}>{c.fullname||'—'}</td>
                          <td style={{ color:'var(--t3)', fontSize:12 }}>{c.job_title||'—'}</td>
                          <td style={{ fontWeight:500 }}>{c.company||'—'}</td>
                          <td>
                            {c.email
                              ? <a href={`mailto:${c.email}`} style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--brand-mid)', textDecoration:'none' }}>{c.email}</a>
                              : <span style={{ color:'#bbb' }}>—</span>}
                          </td>
                          <td>
                            {cert
                              ? <span className="badge" style={{ background:cert.bg, color:cert.c }}>{cert.label}</span>
                              : <span style={{ color:'#bbb' }}>—</span>}
                          </td>
                          <td style={{ fontSize:12, color:'var(--t3)' }}>{c.location||'—'}</td>
                          <td>
                            {c.linkedin_url
                              ? <a href={c.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#0A66C2', fontWeight:600 }}>↗ Voir</a>
                              : <span style={{ color:'#bbb' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </Layout>
    </>
  )
}
