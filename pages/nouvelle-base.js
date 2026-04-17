import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'
import { useAuth } from './_app'
import { JOB_TITLE_FAMILIES, detectFamiliesFromTitles, suggestTitles } from '../lib/job-title-families'

/* ── Données INSEE / Datagouv ── */
const DEPTS_RAW = [
  ["01","Ain"],["02","Aisne"],["03","Allier"],["04","Alpes-de-Haute-Provence"],
  ["05","Hautes-Alpes"],["06","Alpes-Maritimes"],["07","Ardèche"],["08","Ardennes"],
  ["09","Ariège"],["10","Aube"],["11","Aude"],["12","Aveyron"],
  ["13","Bouches-du-Rhône"],["14","Calvados"],["15","Cantal"],["16","Charente"],
  ["17","Charente-Maritime"],["18","Cher"],["19","Corrèze"],["2A","Corse-du-Sud"],
  ["2B","Haute-Corse"],["21","Côte-d'Or"],["22","Côtes-d'Armor"],["23","Creuse"],
  ["24","Dordogne"],["25","Doubs"],["26","Drôme"],["27","Eure"],
  ["28","Eure-et-Loir"],["29","Finistère"],["30","Gard"],["31","Haute-Garonne"],
  ["32","Gers"],["33","Gironde"],["34","Hérault"],["35","Ille-et-Vilaine"],
  ["36","Indre"],["37","Indre-et-Loire"],["38","Isère"],["39","Jura"],
  ["40","Landes"],["41","Loir-et-Cher"],["42","Loire"],["43","Haute-Loire"],
  ["44","Loire-Atlantique"],["45","Loiret"],["46","Lot"],["47","Lot-et-Garonne"],
  ["48","Lozère"],["49","Maine-et-Loire"],["50","Manche"],["51","Marne"],
  ["52","Haute-Marne"],["53","Mayenne"],["54","Meurthe-et-Moselle"],["55","Meuse"],
  ["56","Morbihan"],["57","Moselle"],["58","Nièvre"],["59","Nord"],
  ["60","Oise"],["61","Orne"],["62","Pas-de-Calais"],["63","Puy-de-Dôme"],
  ["64","Pyrénées-Atlantiques"],["65","Hautes-Pyrénées"],["66","Pyrénées-Orientales"],
  ["67","Bas-Rhin"],["68","Haut-Rhin"],["69","Rhône"],["70","Haute-Saône"],
  ["71","Saône-et-Loire"],["72","Sarthe"],["73","Savoie"],["74","Haute-Savoie"],
  ["75","Paris"],["76","Seine-Maritime"],["77","Seine-et-Marne"],["78","Yvelines"],
  ["79","Deux-Sèvres"],["80","Somme"],["81","Tarn"],["82","Tarn-et-Garonne"],
  ["83","Var"],["84","Vaucluse"],["85","Vendée"],["86","Vienne"],
  ["87","Haute-Vienne"],["88","Vosges"],["89","Yonne"],["90","Territoire de Belfort"],
  ["91","Essonne"],["92","Hauts-de-Seine"],["93","Seine-Saint-Denis"],
  ["94","Val-de-Marne"],["95","Val-d'Oise"],
  ["971","Guadeloupe"],["972","Martinique"],["973","Guyane"],
  ["974","La Réunion"],["976","Mayotte"],
]
const ALL_DEPTS = [
  { code: '', nom: 'Toute la France' },
  ...DEPTS_RAW.map(([code, nom]) => ({ code, nom }))
]

const NAF_SECTORS = {
  "💻 Tech & Numérique": [
    ["62.01Z","Programmation informatique"],["62.02A","Conseil SI"],
    ["62.09Z","Autres activités info."],["63.11Z","Data / Cloud / SaaS"],
    ["63.12Z","Portails Internet"],["58.29C","Logiciels applicatifs"],
    ["61.20Z","Télécommunications sans fil"],
  ],
  "📣 Communication & Marketing": [
    ["73.11Z","Agences de publicité"],["73.12Z","Régies publicitaires"],
    ["73.20Z","Études de marché"],["70.21Z","Relations publiques"],
  ],
  "💼 Conseil & Management": [
    ["70.22Z","Conseil en management"],["69.10Z","Juridique"],
    ["69.20Z","Comptabilité / Audit"],["70.10Z","Sièges sociaux"],
    ["71.12B","Ingénierie"],["72.20Z","R&D"],
  ],
  "💄 Cosmétique & Beauté": [
    ["20.42Z","Fabrication parfums et cosmétiques"],
    ["46.45Z","Grossiste parfumerie et beauté"],
    ["47.75Z","Commerce détail beauté"],["96.02A","Coiffure"],
    ["96.02B","Soins esthétiques"],["96.04Z","Spas / bien-être"],
  ],
  "🏦 Finance & Assurance": [
    ["64.19Z","Banques"],["65.11Z","Assurance vie"],
    ["65.12Z","Autres assurances"],["66.12Z","Courtage"],
    ["66.22Z","Courtiers assurance"],
  ],
  "🏠 Immobilier": [
    ["41.10A","Promotion immobilière"],["68.31Z","Agences immobilières"],
    ["68.20A","Location logements"],
  ],
  "👥 RH & Recrutement": [
    ["78.10Z","Recrutement / Chasse"],["78.20Z","Travail temporaire"],
    ["82.30Z","Événementiel / Congrès"],
  ],
  "🎨 Design & Création": [
    ["74.10Z","Design graphique / UX"],["74.20Z","Photographie"],
    ["59.11B","Production films / vidéo"],
  ],
  "🏗️ BTP & Construction": [
    ["41.20B","Construction bâtiments"],["43.21A","Électricité"],
    ["43.22A","Plomberie / chauffage"],
  ],
  "🍽️ Restauration & Hôtellerie": [
    ["55.10Z","Hôtels"],["56.10A","Restauration traditionnelle"],
    ["56.10C","Restauration rapide"],
  ],
  "🌿 Luxe & Mode": [
    ["32.12Z","Bijouterie / joaillerie"],["15.12Z","Maroquinerie"],
    ["14.19Z","Mode / vêtements"],["11.02A","Vins & spiritueux"],
  ],
  "⚙️ Services B2B": [
    ["82.99Z","Services B2B divers"],["82.11Z","Services administratifs"],
    ["80.10Z","Sécurité privée"],
  ],
}
const APE_FLAT = Object.entries(NAF_SECTORS).flatMap(([cat, codes]) =>
  codes.map(([code, label]) => ({ code, label, cat }))
)

const EFFECTIFS = [
  { code:'11', label:'10 – 19' },
  { code:'12', label:'20 – 49' },
  { code:'21', label:'50 – 99' },
  { code:'22', label:'100 – 199' },
  { code:'31', label:'200 – 249' },
  { code:'32', label:'250 – 499' },
]

const JOB_PRESETS = [
  { label:'DG / CEO',           v:'Directeur Général, CEO, DG, Président' },
  { label:'Dir. Marketing',     v:'Directeur Marketing, CMO, VP Marketing' },
  { label:'Dir. Commercial',    v:'Directeur Commercial, VP Sales, CSO' },
  { label:'Dir. Communication', v:'Directeur Communication, Head of Communications' },
  { label:'Head of Growth',     v:'Head of Growth, Growth Manager' },
  { label:'Head of Sales',      v:'Head of Sales, Sales Director' },
  { label:'DRH / CPO',          v:'DRH, Chief People Officer' },
  { label:'CTO / DSI',          v:'CTO, Directeur Technique, DSI' },
]

const COUNTRIES = [
  { code:'BE', label:'Belgique 🇧🇪' }, { code:'CH', label:'Suisse 🇨🇭' },
  { code:'LU', label:'Luxembourg 🇱🇺' }, { code:'DE', label:'Allemagne 🇩🇪' },
  { code:'ES', label:'Espagne 🇪🇸' }, { code:'IT', label:'Italie 🇮🇹' },
  { code:'NL', label:'Pays-Bas 🇳🇱' }, { code:'GB', label:'Royaume-Uni 🇬🇧' },
  { code:'US', label:'États-Unis 🇺🇸' }, { code:'CA', label:'Canada 🇨🇦' },
  { code:'MA', label:'Maroc 🇲🇦' }, { code:'TN', label:'Tunisie 🇹🇳' },
  { code:'SG', label:'Singapour 🇸🇬' }, { code:'AE', label:'Émirats 🇦🇪' },
]

/* ── Multi-select tag component ── */
function TagInput({ placeholder, tags, onAdd, onRemove, suggestions, label, source, sourceUrl, showGrouped, groupedData }) {
  const [q, setQ]           = useState('')
  const [browsing, setBrowse] = useState(false)

  const filtered = useMemo(() => {
    if (!q || q.length < 2) return []
    const s = q.toLowerCase()
    return suggestions
      .filter(x => !tags.find(t => t.code === x.code))
      .filter(x => x.label.toLowerCase().includes(s) || x.code?.toLowerCase().includes(s) || x.nom?.toLowerCase().includes(s))
      .slice(0, 10)
  }, [q, suggestions, tags])

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <label className="label" style={{ margin:0 }}>{label}</label>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {showGrouped && (
            <button type="button" onClick={() => setBrowse(b => !b)}
              style={{ fontSize:11, color: browsing ? 'var(--brand)' : 'var(--ab)', fontFamily:'var(--fm)', background:'none', border:'none', cursor:'pointer', fontWeight: browsing ? 600 : 400 }}>
              {browsing ? '↑ Fermer' : '↓ Parcourir tous'}
            </button>
          )}
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'var(--ab)', fontFamily:'var(--fm)' }}>{source} ↗</a>}
        </div>
      </div>

      {/* Tags sélectionnés */}
      {tags.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {tags.map(t => (
            <span key={t.code || t.nom} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background:'var(--brand)', color:'white', borderRadius:20, fontSize:12, fontWeight:500 }}>
              {t.label || `${t.nom} (${t.code})`}
              <button onClick={() => onRemove(t)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.8)', cursor:'pointer', padding:0, fontSize:14, lineHeight:1, display:'flex', alignItems:'center' }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Browse groupé (APE uniquement) */}
      {showGrouped && browsing && (
        <div style={{ border:'1px solid var(--border)', borderRadius:'var(--r-md)', maxHeight:320, overflowY:'auto', marginBottom:8, background:'var(--white)' }}>
          {Object.entries(groupedData || {}).map(([cat, codes]) => (
            <div key={cat}>
              <div style={{ padding:'7px 12px', background:'var(--bg)', fontFamily:'var(--fm)', fontSize:10, fontWeight:500, color:'var(--t3)', letterSpacing:'.05em', textTransform:'uppercase', position:'sticky', top:0, zIndex:1, borderBottom:'1px solid var(--border2)' }}>
                {cat}
              </div>
              {codes.map(([code, lbl]) => {
                const already = tags.find(t => t.code === code)
                return (
                  <button key={code} type="button"
                    onClick={() => { if (!already) { onAdd({ code, label: lbl }); } else { onRemove({ code }) } }}
                    style={{ width:'100%', padding:'8px 14px', textAlign:'left', background: already ? 'var(--bg2-data)' : 'none', border:'none', borderBottom:'1px solid var(--border2)', cursor:'pointer', fontSize:12, color: already ? 'var(--brand)' : 'var(--text)', display:'flex', gap:10, alignItems:'center', fontFamily:'var(--fb)' }}
                    onMouseEnter={e => { if (!already) e.currentTarget.style.background = 'var(--bg)' }}
                    onMouseLeave={e => { if (!already) e.currentTarget.style.background = 'none' }}>
                    <span style={{ fontFamily:'var(--fm)', fontSize:10, color: already ? 'var(--brand)' : 'var(--t3)', flexShrink:0, minWidth:42 }}>{code}</span>
                    <span style={{ flex:1 }}>{lbl}</span>
                    {already && <span style={{ fontSize:11, color:'var(--brand)', flexShrink:0 }}>✓</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Input recherche */}
      {!browsing && (
        <div style={{ position:'relative' }}>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={tags.length > 0 ? `+ Ajouter ${placeholder}` : placeholder}
            style={{ width:'100%', padding:'9px 13px', border:'1px solid var(--border)', borderRadius:'var(--r-md)', fontSize:13, fontFamily:'var(--fb)', outline:'none', background:'var(--white)', color:'var(--text)' }}
          />
          {filtered.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', boxShadow:'var(--sh2)', zIndex:100, marginTop:4, maxHeight:240, overflowY:'auto' }}>
              {filtered.map(s => (
                <button key={s.code || s.nom} onClick={() => { onAdd(s); setQ('') }}
                  style={{ width:'100%', padding:'9px 14px', textAlign:'left', background:'none', border:'none', borderBottom:'1px solid var(--border2)', cursor:'pointer', fontSize:13, color:'var(--text)', display:'flex', gap:10, alignItems:'center', fontFamily:'var(--fb)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {s.code && <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--t3)', flexShrink:0 }}>{s.code}</span>}
                  <span>{s.label || s.nom}</span>
                </button>
              ))}
            </div>
          )}
          {!q && tags.length === 0 && (
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:5 }}>
              Tapez pour rechercher · ou cliquez <strong>Parcourir tous</strong> pour voir les {suggestions.length} codes disponibles
            </div>
          )}
          {q && q.length < 2 && <div style={{ fontSize:11, color:'var(--t3)', marginTop:5 }}>Tapez au moins 2 caractères</div>}
        </div>
      )}
    </div>
  )
}

export default function NouvelleBase() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const { user } = useAuth()

  const [mode, setMode]     = useState('france')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [form, setForm] = useState({
    name: '',
    // France multi-select
    apes:      [],  // [{code, label}]
    depts:     [],  // [{code, nom}] — empty array = toute la France
    effectifs: [],  // [{code, label}]
    jobTitles: '',
    nCompanies: 10,
    // International
    country: 'BE', intlSector: 'SaaS / Tech', intlCity: '', companySize: '',
  })

  // ── APE helpers
  const addApe    = useCallback(a => setForm(f => ({ ...f, apes: [...f.apes.filter(x => x.code !== a.code), a] })), [])
  const removeApe = useCallback(a => setForm(f => ({ ...f, apes: f.apes.filter(x => x.code !== a.code) })), [])

  // ── Dept helpers
  const addDept    = useCallback(d => {
    // Sélectionner "Toute la France" = vider les depts spécifiques
    if (d.code === '') return setForm(f => ({ ...f, depts: [] }))
    setForm(f => ({ ...f, depts: [...f.depts.filter(x => x.code !== d.code), d] }))
  }, [])
  const removeDept = useCallback(d => setForm(f => ({ ...f, depts: f.depts.filter(x => x.code !== d.code) })), [])

  // ── Effectif toggle
  const toggleEffectif = useCallback(e => {
    setForm(f => ({
      ...f,
      effectifs: f.effectifs.find(x => x.code === e.code)
        ? f.effectifs.filter(x => x.code !== e.code)
        : [...f.effectifs, e]
    }))
  }, [])

  // ── Job titles: presets are cumulative
  const togglePreset = useCallback(preset => {
    setForm(f => {
      const current = f.jobTitles.split(',').map(s => s.trim()).filter(Boolean)
      const presetTitles = preset.v.split(',').map(s => s.trim())
      const allPresent = presetTitles.every(pt => current.includes(pt))
      if (allPresent) {
        // Remove preset titles
        const updated = current.filter(t => !presetTitles.includes(t))
        return { ...f, jobTitles: updated.join(', ') }
      } else {
        // Add preset titles (deduplicated)
        const merged = [...new Set([...current, ...presetTitles])]
        return { ...f, jobTitles: merged.join(', ') }
      }
    })
  }, [])

  const isPresetActive = useCallback(preset => {
    const current = form.jobTitles.split(',').map(s => s.trim())
    return preset.v.split(',').map(s => s.trim()).every(pt => current.includes(pt))
  }, [form.jobTitles])

  const isFrance    = mode === 'france'
  const countryInfo = COUNTRIES.find(c => c.code === form.country)
  const canSubmit   = form.name.trim() && form.jobTitles.trim() && (
    isFrance ? form.apes.length > 0 : true
  )

  // Summary
  const summary = useMemo(() => {
    if (!canSubmit) return null
    const job = form.jobTitles.split(',')[0]?.trim()
    if (isFrance) {
      const apeStr  = form.apes.length === 1 ? form.apes[0].label : `${form.apes.length} secteurs`
      const deptStr = form.depts.length === 0 ? 'toute la France' : form.depts.length === 1 ? form.depts[0].nom : `${form.depts.length} départements`
      const effStr  = form.effectifs.length === 0 ? 'toutes tailles' : form.effectifs.map(e => e.label).join(', ') + ' sal.'
      return `${job} · ${apeStr} · ${deptStr} · ${effStr}`
    }
    return `${job} · ${form.intlSector} · ${countryInfo?.label}`
  }, [form, canSubmit, isFrance, countryInfo])

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true); setError('')
    try {
      const { data, error } = await supabase.from('campaigns').insert({
        user_id:     user.id,
        name:        form.name.trim(),
        status:      'draft',
        mode,
        job_titles:  form.jobTitles,
        n_companies: form.nCompanies,
        ...(isFrance ? {
          // Store as comma-separated for SIRENE calls
          ape_code:       form.apes.map(a => a.code).join(','),
          ape_label:      form.apes.map(a => a.label).join(', '),
          departement:    form.depts.map(d => d.code).join(','),
          dept_label:     form.depts.map(d => d.nom).join(', ') || 'Toute la France',
          effectif_code:  form.effectifs.map(e => e.code).join(','),
          effectif_label: form.effectifs.map(e => e.label).join(', ') || 'Toutes tailles',
          client_sector:  form.apes.map(a => a.label).join(', '),
          client_location:form.depts.map(d => d.nom).join(', ') || 'Toute la France',
          client_size:    form.effectifs.map(e => e.label).join(', '),
        } : {
          country_code:  form.country,
          country_label: countryInfo?.label || '',
          intl_sector:   form.intlSector,
          intl_city:     form.intlCity,
          company_size:  form.companySize,
          client_sector: form.intlSector,
          client_location: countryInfo?.label || '',
        }),
        client_need: form.jobTitles,
      }).select().single()
      if (error) throw error
      router.push(`/bases/${data.id}?autostart=1`)
    } catch(e) { setError(e.message); setSaving(false) }
  }

  return (
    <>
      <Head><title>Mission Data — Nouvelle base</title></Head>
      <Layout>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <Link href="/dashboard">
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }}>← Retour</button>
          </Link>
          <h1 style={{ fontFamily:'var(--fd)', fontSize:24, fontWeight:800, letterSpacing:'-.02em', marginBottom:4 }}>Nouvelle base</h1>
          <p style={{ fontSize:13, color:'var(--t3)', marginBottom:20 }}>Configurez votre ciblage — plusieurs secteurs, zones et personas possibles.</p>

          {error && <div className="alert alert-error" style={{ marginBottom:16 }}>⚠ {error}</div>}

          {/* Nom */}
          <div className="card" style={{ padding:'20px 24px', marginBottom:12 }}>
            <div className="field">
              <label className="label">Nom de la base</label>
              <input className="input" value={form.name}
                onChange={e => setForm(f => ({...f, name:e.target.value}))}
                placeholder="Ex : Cosmétique France · DG + CMO · Avril 2026" autoFocus />
            </div>
          </div>

          {/* Mode France / International */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            {[
              { v:'france', icon:'🇫🇷', title:'France', sub:'SIRENE · APE · INSEE' },
              { v:'international', icon:'🌍', title:'International', sub:'Icypeas worldwide' },
            ].map(m => (
              <button key={m.v} onClick={() => setMode(m.v)} style={{
                padding:'14px 18px', borderRadius:10, textAlign:'left', cursor:'pointer',
                border:`2px solid ${mode===m.v ? 'var(--brand)' : 'var(--border)'}`,
                background: mode===m.v ? 'var(--bg2-data)' : 'var(--white)',
                transition:'all .14s', fontFamily:'var(--fb)',
              }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{m.icon}</div>
                <div style={{ fontFamily:'var(--fd)', fontWeight:700, color:mode===m.v?'var(--brand)':'var(--text)', fontSize:14 }}>{m.title}</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{m.sub}</div>
              </button>
            ))}
          </div>

          {/* ── FRANCE ── */}
          {isFrance && (
            <div className="card" style={{ padding:'20px 24px', marginBottom:12, display:'flex', flexDirection:'column', gap:20 }}>

              {/* APE multi */}
              <TagInput
                label="Secteurs APE" source="INSEE NAF" sourceUrl="https://www.data.gouv.fr/datasets/codes-et-libelles-naf-niveau-2"
                placeholder="Rechercher ou parcourir un secteur…"
                tags={form.apes.map(a => ({ ...a, label: `${a.code} — ${a.label}` }))}
                suggestions={APE_FLAT.map(a => ({ ...a, label: `${a.label}` }))}
                onAdd={a => addApe({ code: a.code, label: a.label })}
                onRemove={a => removeApe({ code: a.code })}
                showGrouped={true}
                groupedData={NAF_SECTORS}
              />

              {/* Département multi */}
              <TagInput
                label={`Départements ${form.depts.length === 0 ? '— Toute la France' : ''}`}
                source="INSEE COG 2026" sourceUrl="https://www.data.gouv.fr/datasets/code-officiel-geographique-cog"
                placeholder="Rechercher un département (ex: Paris, Lyon, 69…)"
                tags={form.depts.map(d => ({ code:d.code, label:`${d.nom} (${d.code})` }))}
                suggestions={ALL_DEPTS.filter(d => d.code !== '').map(d => ({ code:d.code, label:`${d.nom} (${d.code})`, nom:d.nom }))}
                onAdd={d => addDept({ code:d.code, nom:d.nom || d.label.split(' (')[0] })}
                onRemove={d => removeDept(d)}
              />
              {form.depts.length === 0 && (
                <div style={{ marginTop:-12, fontSize:12, color:'var(--brand-mid)', display:'flex', alignItems:'center', gap:6 }}>
                  <span>✓</span> Toute la France — aucun filtre département
                </div>
              )}

              {/* Taille multi-toggle */}
              <div>
                <label className="label" style={{ marginBottom:10 }}>Taille d'entreprise <span style={{ fontWeight:400, color:'var(--t4)' }}>(plusieurs possibles · vide = toutes)</span></label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {EFFECTIFS.map(e => {
                    const active = !!form.effectifs.find(x => x.code === e.code)
                    return (
                      <button key={e.code} onClick={() => toggleEffectif(e)} style={{
                        padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:500,
                        cursor:'pointer', transition:'all .12s',
                        border:`1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                        background: active ? 'var(--brand)' : 'var(--white)',
                        color: active ? 'white' : 'var(--t2)',
                      }}>
                        {e.label} sal.
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* N sociétés */}
              <div>
                <label className="label" style={{ marginBottom:8 }}>
                  Sociétés SIRENE à rechercher : <strong style={{ color:'var(--brand)' }}>{form.nCompanies}</strong>
                  <span style={{ fontWeight:400, color:'var(--t4)', fontSize:12, marginLeft:8 }}>par secteur APE sélectionné</span>
                </label>
                <input type="range" min={5} max={25} step={5} value={form.nCompanies}
                  onChange={e => setForm(f=>({...f,nCompanies:+e.target.value}))}
                  style={{ width:'100%', accentColor:'var(--brand)' }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t4)', marginTop:3 }}>
                  <span>5</span>
                  <span style={{ color:'var(--t3)', fontSize:12 }}>
                    Total max : {form.nCompanies * Math.max(form.apes.length, 1)} sociétés
                  </span>
                  <span>25</span>
                </div>
              </div>
            </div>
          )}

          {/* ── INTERNATIONAL ── */}
          {!isFrance && (
            <div className="card" style={{ padding:'20px 24px', marginBottom:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                <div className="field">
                  <label className="label">Pays</label>
                  <select className="select" value={form.country} onChange={e => setForm(f=>({...f,country:e.target.value}))}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Ville <span style={{ fontWeight:400, color:'var(--t4)' }}>(optionnel)</span></label>
                  <input className="input" value={form.intlCity}
                    onChange={e => setForm(f=>({...f,intlCity:e.target.value}))}
                    placeholder="Brussels, Zurich, London…" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="field">
                  <label className="label">Secteur</label>
                  <select className="select" value={form.intlSector} onChange={e => setForm(f=>({...f,intlSector:e.target.value}))}>
                    <optgroup label="💻 Tech & Digital">
                      {['SaaS / Logiciels','Cybersécurité','Intelligence Artificielle','Data & Analytics','Cloud & Infrastructure','Développement / Agence web','E-commerce / Retail tech','Gaming / Jeux vidéo'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="📣 Marketing & Communication">
                      {['Marketing & Publicité','Relations publiques / RP','Médias & Presse','Content / Studio créatif','Social Media & Influence','Événementiel & Communication'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="💼 Conseil & Services B2B">
                      {['Conseil en stratégie','Conseil en management','Conseil IT / Digital','Cabinet d\'avocats / Juridique','Comptabilité & Audit','Facility Management','Traduction & Localisation'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="👥 RH & Formation">
                      {['RH & Recrutement','Chasse de têtes','Travail temporaire','Formation professionnelle','Coaching & Développement'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="🏦 Finance & Assurance">
                      {['Fintech','Banque & Finance','Assurance','Private Equity / VC','Gestion de patrimoine','Comptabilité & Audit'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="🏥 Santé & Sciences">
                      {['Santé & Medtech','Pharmacie & Biotech','Dispositifs médicaux','Santé digitale / HealthTech','Recherche & Développement'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="🏭 Industrie & Énergie">
                      {['Industrie & Manufacture','Énergie & Utilities','GreenTech & Environnement','Automobile & Mobilité','Aérospatial & Défense','Chimie & Matériaux'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="🏠 Immobilier & Construction">
                      {['Immobilier','Promotion immobilière','Construction & BTP','Architecture & Design','PropTech'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="🛒 Commerce & Logistique">
                      {['Retail & Grande distribution','Logistique & Supply Chain','Import / Export','Marketplace & E-commerce'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="🎭 Lifestyle & Luxe">
                      {['Hôtellerie & Tourisme','Restauration & Food','Luxe & Mode','Cosmétique & Beauté','Sport & Fitness & Loisirs','Bien-être & Spa'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="🎓 Éducation & Culture">
                      {['Éducation & Edtech','Enseignement supérieur','Culture & Arts','ONG & Associations','Collectivités & Secteur public'].map(s=><option key={s} value={s}>{s}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div className="field">
                  <label className="label">Contacts : <strong style={{ color:'var(--brand)' }}>{form.nCompanies}</strong></label>
                  <input type="range" min={5} max={50} step={5} value={form.nCompanies}
                    onChange={e => setForm(f=>({...f,nCompanies:+e.target.value}))}
                    style={{ width:'100%', marginTop:10, accentColor:'var(--brand)' }} />
                </div>
              </div>
            </div>
          )}

          {/* Poste cible — presets cumulatifs */}
          <div className="card" style={{ padding:'20px 24px', marginBottom:12 }}>
            <label className="label" style={{ marginBottom:10 }}>
              Postes cibles
              <span style={{ fontWeight:400, color:'var(--t4)', fontSize:12, marginLeft:8 }}>plusieurs presets cumulables</span>
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {JOB_PRESETS.map(p => {
                const active = isPresetActive(p)
                return (
                  <button key={p.label} onClick={() => togglePreset(p)} style={{
                    padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:500,
                    cursor:'pointer', transition:'all .12s',
                    border:`1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                    background: active ? 'var(--brand)' : 'var(--white)',
                    color: active ? 'white' : 'var(--t2)',
                  }}>
                    {active ? '✓ ' : ''}{p.label}
                  </button>
                )
              })}
            </div>
            <input className="input" value={form.jobTitles}
              onChange={e => setForm(f=>({...f,jobTitles:e.target.value}))}
              placeholder="Modifiez ou ajoutez librement des postes, séparés par des virgules" />
            {form.jobTitles && (
              <div style={{ marginTop:6, fontSize:11, color:'var(--t3)', fontFamily:'var(--fm)' }}>
                {form.jobTitles.split(',').filter(Boolean).length} titre{form.jobTitles.split(',').filter(Boolean).length > 1 ? 's' : ''} · {form.jobTitles.split(',').filter(Boolean).map(s => s.trim()).join(' · ')}
              </div>
            )}

            {/* Expansion automatique des titres de poste */}
            {(() => {
              const currentTitles = form.jobTitles.split(',').map(s => s.trim()).filter(Boolean)
              if (currentTitles.length === 0) return null
              const families = detectFamiliesFromTitles(currentTitles)
              if (families.length === 0) return null

              return (
                <div style={{ marginTop:14, padding:'10px 14px', background:'var(--bg2-data)', borderRadius:'var(--r-md)', border:'1px dashed var(--border)' }}>
                  <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8, fontFamily:'var(--fm)', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                    💡 Suggestions — ajoutez des synonymes pour augmenter le nombre de contacts trouvés
                  </div>
                  {families.map(famKey => {
                    const fam = JOB_TITLE_FAMILIES[famKey]
                    const suggestions = suggestTitles(currentTitles, famKey, 6)
                    if (suggestions.length === 0) return null
                    return (
                      <div key={famKey} style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:'var(--t2)', marginBottom:6 }}>
                          {fam.emoji} <strong>{fam.label}</strong>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {suggestions.map(title => (
                            <button key={title} onClick={() => {
                              const newTitles = [...currentTitles, title].join(', ')
                              setForm(f => ({ ...f, jobTitles: newTitles }))
                            }} style={{
                              padding:'4px 10px', borderRadius:16, fontSize:11.5,
                              border:'1px solid var(--border)', background:'var(--white)',
                              color:'var(--t2)', cursor:'pointer', transition:'all .12s',
                            }}
                            onMouseEnter={e => { e.target.style.borderColor = 'var(--brand)'; e.target.style.color = 'var(--brand)' }}
                            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--t2)' }}>
                              + {title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {/* Bouton ajouter toute la famille */}
                  <div style={{ marginTop:10, borderTop:'1px solid var(--border)', paddingTop:8, display:'flex', gap:6 }}>
                    {families.map(famKey => {
                      const fam = JOB_TITLE_FAMILIES[famKey]
                      const suggestions = suggestTitles(currentTitles, famKey, 20)
                      if (suggestions.length === 0) return null
                      return (
                        <button key={famKey} onClick={() => {
                          const newTitles = [...currentTitles, ...suggestions].join(', ')
                          setForm(f => ({ ...f, jobTitles: newTitles }))
                        }} style={{
                          padding:'4px 10px', borderRadius:12, fontSize:11,
                          border:'1px solid var(--brand)', background:'var(--bg2-data)',
                          color:'var(--brand-mid)', cursor:'pointer', fontWeight:500,
                        }}>
                          + Toute la famille {fam.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Récap */}
          {summary && (
            <div style={{ padding:'10px 16px', background:'var(--bg2-data)', borderRadius:'var(--r-md)', border:'1px solid var(--border3-data)', fontSize:13, color:'var(--brand-mid)', marginBottom:14 }}>
              {summary}
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Link href="/dashboard">
              <button className="btn btn-secondary">Annuler</button>
            </Link>
            <button className="btn btn-primary" onClick={handleSubmit}
              disabled={!canSubmit || saving}>
              {saving
                ? <><span className="spinner" style={{ width:14, height:14, borderColor:'rgba(255,255,255,.3)', borderTopColor:'white' }} /> Création…</>
                : '◎ Créer et générer →'}
            </button>
          </div>
          <p style={{ textAlign:'right', fontSize:11, color:'var(--t4)', marginTop:6 }}>
            Génération automatique après la création
          </p>
        </div>
      </Layout>
    </>
  )
}

// Force SSR — évite les erreurs d'hydration avec l'auth client-side
export async function getServerSideProps() {
  return { props: {} }
}
