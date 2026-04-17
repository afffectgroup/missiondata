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

// Preview count widget — interroge Icypeas sans consommer de crédits
function PreviewCount({ base, supabase }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!base?.id) return
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch('/api/icypeas/count', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode:          base.mode,
            job_titles:    base.job_titles,
            dept_code:     base.departement,
            dept_label:    base.dept_label,
            ape_label:     base.ape_label,
            country_code:  base.country_code,
            country_label: base.country_label,
            intl_sector:   base.intl_sector,
            intl_city:     base.intl_city,
          }),
        })
        const json = await r.json()
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setData({ error: e.message })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [base?.id])

  if (!data && !loading) return null

  const strict = data?.strict || 0
  const max    = data?.max    || 0

  // Couleur du card selon la qualité de l'estimation
  let quality = 'good'
  if (strict === 0) quality = 'bad'
  else if (strict < 10) quality = 'warn'

  const colors = {
    good: { bg:'var(--green-bg)',  border:'var(--green)', text:'var(--green)' },
    warn: { bg:'var(--amber-bg)',  border:'var(--amber)', text:'var(--amber)' },
    bad:  { bg:'#FEE2E2',          border:'#DC2626',      text:'#DC2626'      },
  }[quality]

  return (
    <div style={{
      marginBottom:16, padding:'14px 18px',
      background:colors.bg, borderLeft:`3px solid ${colors.border}`,
      borderRadius:'var(--r-lg)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:'var(--fm)', fontSize:10, color:'var(--t3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:3 }}>
            Estimation Icypeas
          </div>
          <div style={{ fontSize:22, fontWeight:700, color:colors.text, lineHeight:1 }}>
            {loading ? <span style={{ opacity:0.5 }}>…</span> : strict.toLocaleString('fr-FR')}
            <span style={{ fontSize:13, fontWeight:400, color:'var(--t3)', marginLeft:6 }}>
              contact{strict > 1 ? 's' : ''} disponible{strict > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {!loading && data && (
          <div style={{ display:'flex', gap:14, marginLeft:'auto', fontSize:12 }}>
            {data.noSector > strict && (
              <div style={{ color:'var(--t3)' }}>
                Sans secteur: <strong style={{ color:'var(--t1)' }}>{data.noSector.toLocaleString('fr-FR')}</strong>
              </div>
            )}
            {data.noGeo > strict && (
              <div style={{ color:'var(--t3)' }}>
                Sans géo: <strong style={{ color:'var(--t1)' }}>{data.noGeo.toLocaleString('fr-FR')}</strong>
              </div>
            )}
            <div style={{ color:'var(--t3)' }}>
              Max (postes seuls): <strong style={{ color:'var(--t1)' }}>{max.toLocaleString('fr-FR')}</strong>
            </div>
          </div>
        )}
      </div>

      {!loading && quality !== 'good' && (
        <div style={{ marginTop:10, fontSize:12, color:colors.text, lineHeight:1.5 }}>
          {quality === 'bad' && <strong>⚠ Aucun contact avec ces critères exacts.</strong>}
          {quality === 'warn' && <strong>⚠ Peu de résultats disponibles.</strong>}
          <div style={{ marginTop:4 }}>
            {(() => {
              const suggestions = []
              // Sector filter too strict
              if (data.noSector > strict * 3 && data.noSector > 20) {
                suggestions.push(`Le filtre secteur divise par ${Math.round(data.noSector / Math.max(strict, 1))} → essayez de le retirer ou d'en choisir plus`)
              }
              // Geo filter too strict
              if (data.noGeo > strict * 3 && data.noGeo > 20) {
                suggestions.push(`Le filtre géo divise par ${Math.round(data.noGeo / Math.max(strict, 1))} → essayez d'ajouter des départements voisins`)
              }
              // Both filters combined are the problem
              if (data.max > 500 && strict < 10) {
                suggestions.push(`Avec les postes seuls il y a ${data.max.toLocaleString('fr-FR')} contacts — vos filtres combinés sont trop restrictifs`)
              }
              // Small Icypeas coverage in that country/zone
              if (data.max < 100) {
                suggestions.push('Icypeas indexe surtout les grandes structures — pour des petites entreprises en province, essayez des titres plus larges (ex: "Gérant, Président, Associé" au lieu de "CEO")')
              }
              // No specific suggestion but low count
              if (suggestions.length === 0 && quality === 'warn') {
                suggestions.push('Essayez des postes plus génériques ou élargissez la zone géographique')
              }
              return suggestions.map((s, i) => (
                <div key={i} style={{ marginTop:3 }}>→ {s}</div>
              ))
            })()}
          </div>
        </div>
      )}
    </div>
  )
}


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

// Modal pour modifier les critères de la base
function EditBaseModal({ base, supabase, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:          base.name || '',
    job_titles:    base.job_titles || '',
    n_companies:   base.n_companies || 10,
    // France
    ape_label:     base.ape_label || '',
    departement:   base.departement || '',
    dept_label:    base.dept_label || '',
    effectif_code: base.effectif_code || '',
    effectif_label: base.effectif_label || '',
    // International
    intl_sector:   base.intl_sector || '',
    intl_city:     base.intl_city || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const isFR = (base.mode || 'france') !== 'international'

  async function save() {
    setSaving(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(`/api/bases/${base.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Erreur')
      onSaved?.()
      onClose()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 'var(--r-lg)', maxWidth: 600, width: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h2 style={{ fontFamily: 'var(--fd)', fontSize: 17, fontWeight: 700, margin: 0 }}>
            Modifier les critères
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--t3)', padding: 0 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nom */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Nom de la base
            </label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {/* Postes */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Postes cibles <span style={{ fontWeight: 400, color: 'var(--t4)', textTransform: 'none', letterSpacing: 0 }}>(séparés par des virgules)</span>
            </label>
            <input type="text" value={form.job_titles}
              onChange={e => setForm(f => ({ ...f, job_titles: e.target.value }))}
              placeholder="CEO, Directeur Général, Founder…" />
          </div>

          {isFR ? (
            <>
              {/* FR : secteurs (libellés APE) */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Secteurs
                </label>
                <input type="text" value={form.ape_label}
                  onChange={e => setForm(f => ({ ...f, ape_label: e.target.value }))}
                  placeholder="Agences de publicité, Édition logiciel…" />
                <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 4 }}>
                  ℹ Pour changer le code APE SIRENE, utilisez le wizard (Dashboard → Nouvelle base)
                </div>
              </div>

              {/* FR : département */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Code département
                  </label>
                  <input type="text" value={form.departement}
                    onChange={e => setForm(f => ({ ...f, departement: e.target.value }))}
                    placeholder="35, 29" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Label département
                  </label>
                  <input type="text" value={form.dept_label}
                    onChange={e => setForm(f => ({ ...f, dept_label: e.target.value }))}
                    placeholder="Ille-et-Vilaine, Finistère" />
                </div>
              </div>

              {/* FR : effectifs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Codes effectif
                  </label>
                  <input type="text" value={form.effectif_code}
                    onChange={e => setForm(f => ({ ...f, effectif_code: e.target.value }))}
                    placeholder="12, 21, 22" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Label effectif
                  </label>
                  <input type="text" value={form.effectif_label}
                    onChange={e => setForm(f => ({ ...f, effectif_label: e.target.value }))}
                    placeholder="10 - 19, 20 - 49" />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* INTL : secteur + ville */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Secteur international
                </label>
                <input type="text" value={form.intl_sector}
                  onChange={e => setForm(f => ({ ...f, intl_sector: e.target.value }))}
                  placeholder="Cosmétique & Beauté, Tech & SaaS…" />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Ville (optionnel, précise la géo)
                </label>
                <input type="text" value={form.intl_city}
                  onChange={e => setForm(f => ({ ...f, intl_city: e.target.value }))}
                  placeholder="Berlin, Barcelona, London…" />
              </div>
            </>
          )}

          {/* Nombre de sociétés */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Nombre de contacts visé
            </label>
            <input type="number" value={form.n_companies} min="1" max="50"
              onChange={e => setForm(f => ({ ...f, n_companies: parseInt(e.target.value) || 10 }))} />
          </div>

          {error && <div className="alert alert-error">⚠ {error}</div>}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Enregistrement…</> : 'Enregistrer'}
          </button>
        </div>
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
  const [editOpen, setEditOpen] = useState(false)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')

  useEffect(() => { if (user === null) router.push('/login') }, [user])

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
  async function generate(baseData, opts = {}) {
    const b = (baseData && baseData.id) ? baseData : base
    if (!b) { setError('Données non chargées — rechargez la page.'); return }
    const isDelta = opts.delta === true
    setRunning(true); setError('')
    setLogs([{ msg: isDelta ? 'Recherche de contacts supplémentaires…' : 'Démarrage…', type: 'i', ts: new Date().toLocaleTimeString('fr-FR') }])

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
        // Overfetch AGRESSIF : l'API SIRENE filtre mal par département
        // (inclut les entreprises avec établissement secondaire dans le dept)
        // Observé : ~68% des résultats ont un siège hors zone. Donc pour garantir nCo sièges valides,
        // on demande nCo * ~8 pour avoir une marge de sécurité confortable
        const OVERFETCH = deptCodes.length ? 10 : 3
        const perApe    = Math.min(Math.max(Math.ceil(nCo / Math.max(apeCodes.length, 1)) * OVERFETCH, 50), 100)

        const apesToSearch  = apeCodes.length  ? apeCodes  : ['']
        const deptsToSearch = deptCodes.length ? deptCodes : ['']
        const effsToSearch  = effCodes.length  ? effCodes  : ['']

        const sirenePromises = []
        for (const ape of apesToSearch) {
          for (const dept of deptsToSearch) {
            for (const eff of effsToSearch) {
              const p = new URLSearchParams({ per_page: perApe, page: 1, etat_administratif: 'A' })
              if (ape)  p.set('activite_principale', ape)
              if (dept) p.set('departement', dept)
              if (eff)  p.set('tranche_effectif_salarie', eff)
              sirenePromises.push(
                fetch(`https://recherche-entreprises.api.gouv.fr/search?${p}`, { headers: { Accept: 'application/json' } })
                  .then(r => r.ok ? r.json() : { results: [], total_results: 0 })
                  .then(d => ({ results: d.results || [], total: d.total_results || 0 }))
                  .catch(() => ({ results: [], total: 0 }))
              )
            }
          }
        }

        const batches = await Promise.all(sirenePromises)
        const seen = new Set()
        let rawCompanies = []
        for (const batch of batches) {
          for (const co of batch.results) {
            if (co.siren && !seen.has(co.siren)) { seen.add(co.siren); rawCompanies.push(co) }
          }
        }

        // FILTRAGE STRICT : ne garder que les entreprises dont le SIÈGE est dans un dept demandé
        if (deptCodes.length) {
          const before = rawCompanies.length
          rawCompanies = rawCompanies.filter(co => {
            const siegeDept = co.siege?.departement || ''
            return deptCodes.includes(siegeDept)
          })
          if (before !== rawCompanies.length) {
            addLog(`Filtre siège strict: ${rawCompanies.length}/${before} sociétés (sièges en ${deptCodes.join(',')})`, 'i')
          }
        }

        // Trim à nCo après filtre strict
        companies = rawCompanies.slice(0, nCo)

        const total = batches.reduce((acc, b) => acc + b.total, 0)
        addLog(`SIRENE: ${companies.length}/${nCo} demandées (${total} matches total, ${rawCompanies.length} sièges valides)`, companies.length >= nCo ? 's' : 'w')

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
          const fbSet = new Set(companies.map(c => c.siren))
          for (const batch of fb) {
            for (const co of batch) {
              if (co.siren && !fbSet.has(co.siren)) {
                // Filtre siège strict
                const siegeDept = co.siege?.departement || ''
                if (!deptCodes.length || deptCodes.includes(siegeDept)) {
                  fbSet.add(co.siren); companies.push(co)
                }
              }
            }
          }
          companies = companies.slice(0, nCo)
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

      const reqBody = { companies }
      if (isDelta) {
        reqBody.excludeProfileUrls = contacts
          .map(c => c.linkedin_url)
          .filter(Boolean)
        addLog(`Mode delta : on exclut ${reqBody.excludeProfileUrls.length} profils déjà en base`, 'i')
      }

      const es = await fetch(`/api/bases/${id}/pipeline`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
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

        {/* Preview count — affiché seulement si base vide pour aider à anticiper */}
        {!isGenerating && contacts.length === 0 && (
          <PreviewCount base={base} supabase={supabase} />
        )}

        {/* Actions bar */}
        {!isGenerating && (
          <div style={{ display:'flex', gap:10, marginBottom:20, padding:'14px 18px', background:'var(--white)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)', boxShadow:'var(--sh1)', alignItems:'center', flexWrap:'wrap' }}>
            <button className="btn btn-primary" onClick={() => generate()}>
              {contacts.length > 0 ? '↺ Régénérer' : '◎ Trouver les contacts'}
            </button>
            {contacts.length > 0 && (
              <button className="btn btn-secondary" onClick={() => generate(null, { delta: true })}>
                + {base?.n_companies || 10} contacts supplémentaires
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setEditOpen(true)}>
              ⚙ Modifier les critères
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

      {/* Modal d'édition des critères */}
      {editOpen && base && (
        <EditBaseModal
          base={base}
          supabase={supabase}
          onClose={() => setEditOpen(false)}
          onSaved={() => fetchAll()}
        />
      )}
    </>
  )
}

// Force SSR — évite les erreurs d'hydration avec l'auth client-side
export async function getServerSideProps() {
  return { props: {} }
}
