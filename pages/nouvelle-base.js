import { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'
import { useAuth } from './_app'

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
const DEPTS = DEPTS_RAW.map(([code, nom]) => ({ code, label:`${nom} (${code})`, nom }))

const NAF_SECTORS = {
  "💻 Tech & Numérique": [
    ["62.01Z","Programmation informatique"],["62.02A","Conseil SI"],
    ["62.09Z","Autres activités informatiques"],["63.11Z","Data / Cloud / Hébergement"],
    ["63.12Z","Portails Internet"],["58.29C","Logiciels applicatifs (SaaS)"],
    ["61.20Z","Télécommunications sans fil"],["61.10Z","Télécommunications filaires"],
  ],
  "📣 Communication & Marketing": [
    ["73.11Z","Agences de publicité"],["73.12Z","Régies publicitaires"],
    ["73.20Z","Études de marché"],["70.21Z","Relations publiques / RP"],
    ["58.13Z","Presse"],["60.20A","Chaînes TV"],
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
    ["66.22Z","Courtiers assurance"],["66.30Z","Gestion de fonds"],
  ],
  "🏠 Immobilier": [
    ["41.10A","Promotion immobilière"],["68.31Z","Agences immobilières"],
    ["68.20A","Location logements"],["68.32A","Gestion de copropriété"],
  ],
  "👥 RH & Recrutement": [
    ["78.10Z","Recrutement / Chasse"],["78.20Z","Travail temporaire"],
    ["82.20Z","Centres d'appels"],["82.30Z","Événementiel / Congrès"],
  ],
  "🎨 Design & Création": [
    ["74.10Z","Design graphique / UX"],["74.20Z","Photographie"],
    ["74.30Z","Traduction"],["59.11B","Production films / vidéo"],
    ["90.03A","Arts et création"],
  ],
  "🏗️ BTP & Construction": [
    ["41.20B","Construction bâtiments"],["43.21A","Électricité"],
    ["43.22A","Plomberie / chauffage"],["43.34Z","Peinture"],
  ],
  "🍽️ Restauration & Hôtellerie": [
    ["55.10Z","Hôtels"],["56.10A","Restauration traditionnelle"],
    ["56.10C","Restauration rapide"],["56.29A","Restauration collective"],
  ],
  "🛒 E-commerce & Distribution": [
    ["47.91B","Commerce en ligne"],["46.51Z","Informatique en gros"],
    ["46.90Z","Commerce de gros divers"],
  ],
  "🎓 Formation & Éducation": [
    ["85.42Z","Enseignement supérieur"],["85.59A","Formation continue"],
    ["85.59B","Autres formations"],
  ],
  "🌿 Luxe & Mode": [
    ["32.12Z","Bijouterie / joaillerie"],["15.12Z","Maroquinerie"],
    ["14.19Z","Mode / vêtements"],["11.02A","Vins & spiritueux"],
  ],
  "⚙️ Services B2B": [
    ["82.99Z","Services B2B divers"],["81.21Z","Nettoyage / facility"],
    ["80.10Z","Sécurité privée"],["82.11Z","Services administratifs"],
  ],
}
const APE_FLAT = Object.entries(NAF_SECTORS).flatMap(([cat, codes]) =>
  codes.map(([code, label]) => ({ code, label, cat }))
)

const EFFECTIFS = [
  { code:'', label:'Toutes tailles' },
  { code:'11', label:'10 – 19 sal.' }, { code:'12', label:'20 – 49 sal.' },
  { code:'21', label:'50 – 99 sal.' }, { code:'22', label:'100 – 199 sal.' },
  { code:'31', label:'200 – 249 sal.' }, { code:'32', label:'250 – 499 sal.' },
]

const COUNTRIES = [
  { code:'BE', label:'Belgique 🇧🇪' }, { code:'CH', label:'Suisse 🇨🇭' },
  { code:'LU', label:'Luxembourg 🇱🇺' }, { code:'DE', label:'Allemagne 🇩🇪' },
  { code:'ES', label:'Espagne 🇪🇸' }, { code:'IT', label:'Italie 🇮🇹' },
  { code:'NL', label:'Pays-Bas 🇳🇱' }, { code:'GB', label:'Royaume-Uni 🇬🇧' },
  { code:'US', label:'États-Unis 🇺🇸' }, { code:'CA', label:'Canada 🇨🇦' },
  { code:'MA', label:'Maroc 🇲🇦' }, { code:'TN', label:'Tunisie 🇹🇳' },
  { code:'SG', label:'Singapour 🇸🇬' }, { code:'AE', label:'Émirats 🇦🇪' },
  { code:'AU', label:'Australie 🇦🇺' },
]

const JOB_PRESETS = [
  { label:'DG / CEO',           v:'Directeur Général, CEO, DG, Président' },
  { label:'Dir. Marketing',     v:'Directeur Marketing, CMO, VP Marketing' },
  { label:'Dir. Commercial',    v:'Directeur Commercial, VP Sales, CSO' },
  { label:'Dir. Communication', v:'Directeur Communication, Head of Communications' },
  { label:'Head of Growth',     v:'Head of Growth, Growth Manager, VP Growth' },
  { label:'Head of Sales',      v:'Head of Sales, Sales Director, Sales Manager' },
  { label:'DRH / CPO',          v:'DRH, Directeur RH, Chief People Officer' },
  { label:'CTO / DSI',          v:'CTO, Directeur Technique, DSI' },
]

/* ── Chip button ── */
function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:500,
      cursor:'pointer', transition:'all .12s',
      border:`1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
      background: active ? 'var(--brand)' : 'var(--white)',
      color: active ? 'white' : 'var(--t2)',
    }}>{children}</button>
  )
}

export default function NouvelleBase() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const { user } = useAuth()

  const [mode, setMode]         = useState('france')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [apeSearch, setApeSearch]   = useState('')
  const [deptSearch, setDeptSearch] = useState('')

  const [form, setForm] = useState({
    name:'', ape:'73.11Z', dept:'75', effectif:'12',
    jobTitles:'', nCompanies:10,
    country:'BE', intlSector:'SaaS / Tech', intlCity:'', companySize:'',
  })

  const sf = k => v => setForm(f => ({ ...f, [k]: v?.target ? v.target.value : v }))

  const filteredAPE = useMemo(() => {
    if (!apeSearch) return null
    const s = apeSearch.toLowerCase()
    return APE_FLAT.filter(a => a.code.toLowerCase().includes(s) || a.label.toLowerCase().includes(s))
  }, [apeSearch])

  const filteredDepts = useMemo(() => {
    if (!deptSearch) return DEPTS
    const s = deptSearch.toLowerCase()
    return DEPTS.filter(d => d.nom.toLowerCase().includes(s) || d.code.includes(s))
  }, [deptSearch])

  const apeInfo     = APE_FLAT.find(a => a.code === form.ape)
  const deptInfo    = DEPTS.find(d => d.code === form.dept)
  const effInfo     = EFFECTIFS.find(e => e.code === form.effectif)
  const countryInfo = COUNTRIES.find(c => c.code === form.country)
  const isFrance    = mode === 'france'
  const canSubmit   = form.name.trim() && form.jobTitles.trim()

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
        // France
        ...(isFrance ? {
          ape_code:      form.ape,
          ape_label:     apeInfo?.label || '',
          departement:   form.dept,
          dept_label:    deptInfo?.nom || '',
          effectif_code: form.effectif,
          effectif_label:effInfo?.label || '',
          client_sector: apeInfo?.label || '',
          client_location: deptInfo?.nom || '',
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
      // ── Redirect + auto-start flag ──
      router.push(`/bases/${data.id}?autostart=1`)
    } catch(e) { setError(e.message); setSaving(false) }
  }

  const sel = { width:'100%', padding:'9px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--white)', color:'var(--text)', outline:'none' }

  return (
    <>
      <Head><title>Mission Data — Nouvelle base</title></Head>
      <Layout>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <Link href="/dashboard">
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }}>← Retour</button>
          </Link>
          <h1 style={{ fontFamily:'var(--fd)', fontSize:24, fontWeight:800, letterSpacing:'-.02em', marginBottom:4 }}>
            Nouvelle base
          </h1>
          <p style={{ fontSize:13, color:'var(--t3)', marginBottom:20 }}>
            Configurez votre ciblage — Mission Data génère les contacts automatiquement.
          </p>

          {error && <div className="alert alert-error" style={{ marginBottom:16 }}>⚠ {error}</div>}

          {/* Nom */}
          <div className="card" style={{ padding:'20px 24px', marginBottom:12 }}>
            <div className="field">
              <label className="label">Nom de la base</label>
              <input className="input" value={form.name}
                onChange={e => setForm(f => ({...f, name:e.target.value}))}
                placeholder="Ex : Agences pub Paris · DG · Avril 2026"
                autoFocus />
            </div>
          </div>

          {/* Mode */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            {[
              { v:'france', icon:'🇫🇷', title:'France', sub:'SIRENE + APE + département' },
              { v:'international', icon:'🌍', title:'International', sub:'Icypeas worldwide' },
            ].map(m => (
              <button key={m.v} onClick={() => setMode(m.v)} style={{
                padding:'14px 18px', borderRadius:10, textAlign:'left', cursor:'pointer',
                border:`2px solid ${mode===m.v ? 'var(--brand)' : 'var(--border)'}`,
                background: mode===m.v ? 'var(--bg2)' : 'var(--white)',
                transition:'all .14s',
              }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{m.icon}</div>
                <div style={{ fontWeight:700, color: mode===m.v ? 'var(--brand)' : 'var(--text)', fontSize:14 }}>{m.title}</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{m.sub}</div>
              </button>
            ))}
          </div>

          {/* Filtres France */}
          {isFrance && (
            <div className="card" style={{ padding:'20px 24px', marginBottom:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <label className="label" style={{ margin:0 }}>Secteur APE</label>
                    <a href="https://www.data.gouv.fr/datasets/codes-et-libelles-naf-niveau-2" target="_blank" rel="noreferrer" style={{ fontSize:10, color:'var(--ab)' }}>INSEE NAF ↗</a>
                  </div>
                  <input placeholder="Rechercher…" value={apeSearch} onChange={e => setApeSearch(e.target.value)}
                    style={{ ...sel, marginBottom:6, fontSize:12 }} />
                  {filteredAPE ? (
                    <select style={sel} value={form.ape}
                      onChange={e => { setForm(f=>({...f,ape:e.target.value})); setApeSearch('') }}>
                      {filteredAPE.length === 0
                        ? <option>Aucun résultat</option>
                        : filteredAPE.map(a => <option key={a.code} value={a.code}>{a.code} — {a.label}</option>)}
                    </select>
                  ) : (
                    <select style={sel} value={form.ape} onChange={e => setForm(f=>({...f,ape:e.target.value}))}>
                      {Object.entries(NAF_SECTORS).map(([cat, codes]) => (
                        <optgroup key={cat} label={cat}>
                          {codes.map(([code,label]) => <option key={code} value={code}>{code} — {label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  )}
                  {apeInfo && <div style={{ fontSize:11, color:'var(--brand-mid)', marginTop:4 }}>✓ {apeInfo.label}</div>}
                </div>

                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <label className="label" style={{ margin:0 }}>Département</label>
                    <a href="https://www.data.gouv.fr/datasets/code-officiel-geographique-cog" target="_blank" rel="noreferrer" style={{ fontSize:10, color:'var(--ab)' }}>INSEE COG ↗</a>
                  </div>
                  <input placeholder="Rechercher…" value={deptSearch} onChange={e => setDeptSearch(e.target.value)}
                    style={{ ...sel, marginBottom:6, fontSize:12 }} />
                  <select style={sel} value={form.dept}
                    onChange={e => { setForm(f=>({...f,dept:e.target.value})); setDeptSearch('') }}>
                    {filteredDepts.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                  </select>
                  {deptInfo && <div style={{ fontSize:11, color:'var(--brand-mid)', marginTop:4 }}>✓ {deptInfo.nom}</div>}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="field">
                  <label className="label">Taille d'entreprise</label>
                  <select className="select" value={form.effectif} onChange={e => setForm(f=>({...f,effectif:e.target.value}))}>
                    {EFFECTIFS.map(e => <option key={e.code} value={e.code}>{e.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Sociétés SIRENE : <strong style={{ color:'var(--brand)' }}>{form.nCompanies}</strong></label>
                  <input type="range" min={5} max={25} step={5} value={form.nCompanies}
                    onChange={e => setForm(f=>({...f,nCompanies:+e.target.value}))}
                    style={{ width:'100%', marginTop:10, accentColor:'var(--brand)' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--t4)', marginTop:2 }}>
                    <span>5</span><span>25</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filtres International */}
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
                    {['SaaS / Tech','Marketing / Pub','Finance / Fintech','Conseil / Consulting','RH / Recrutement','E-commerce','Industrie','Immobilier','Santé / Medtech','Éducation'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
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

          {/* Poste cible */}
          <div className="card" style={{ padding:'20px 24px', marginBottom:16 }}>
            <label className="label" style={{ marginBottom:10 }}>Poste cible</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {JOB_PRESETS.map(p => (
                <Chip key={p.label} active={form.jobTitles===p.v}
                  onClick={() => setForm(f=>({...f,jobTitles:p.v}))}>
                  {p.label}
                </Chip>
              ))}
            </div>
            <input className="input" value={form.jobTitles}
              onChange={e => setForm(f=>({...f,jobTitles:e.target.value}))}
              placeholder="Ex: Directeur Marketing, CMO, VP Marketing — ou choisissez un raccourci" />
          </div>

          {/* Récap + CTA */}
          {canSubmit && (
            <div style={{ padding:'12px 16px', background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border3)', fontSize:13, color:'var(--brand-mid)', marginBottom:14 }}>
              <strong>{form.jobTitles.split(',')[0].trim()}</strong>
              {isFrance
                ? <> dans les <strong>{apeInfo?.label}</strong> · <strong>{deptInfo?.nom}</strong> · {effInfo?.label || 'toutes tailles'} · {form.nCompanies} sociétés</>
                : <> · <strong>{form.intlSector}</strong> · <strong>{countryInfo?.label}</strong>{form.intlCity ? ` · ${form.intlCity}` : ''}</>
              }
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Link href="/dashboard">
              <button className="btn btn-secondary">Annuler</button>
            </Link>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || saving}
              style={{ gap:8 }}>
              {saving
                ? <><span className="spinner" style={{ width:14, height:14, borderColor:'rgba(255,255,255,.3)', borderTopColor:'white' }} /> Création…</>
                : '◎ Créer et générer →'}
            </button>
          </div>
          <p style={{ textAlign:'right', fontSize:11, color:'var(--t4)', marginTop:6 }}>
            La génération démarre automatiquement après la création
          </p>
        </div>
      </Layout>
    </>
  )
}
