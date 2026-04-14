import { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'
import { useAuth } from './_app'

/* ═══════════════════════════════════════════════════════════
   DONNÉES FRANCE — INSEE / DATAGOUV
   ═══════════════════════════════════════════════════════════ */

// Source : INSEE COG millésime 2026 — data.gouv.fr
// https://www.data.gouv.fr/datasets/code-officiel-geographique-cog
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

// Source : INSEE NAF rév.2 — data.gouv.fr dataset 60502dd3b02b8a99a97ce5a3
const NAF_SECTORS = {
  "💻 Tech & Numérique": [
    ["62.01Z","Programmation informatique"],["62.02A","Conseil systèmes et logiciels"],
    ["62.02B","Tierce maintenance SI"],["62.03Z","Gestion installations info."],
    ["62.09Z","Autres activités informatiques"],["63.11Z","Data, cloud, hébergement"],
    ["63.12Z","Portails Internet"],["58.29A","Logiciels systèmes"],
    ["58.29B","Logiciels outils"],["58.29C","Logiciels applicatifs"],
    ["58.21Z","Édition jeux électroniques"],["61.10Z","Télécommunications filaires"],
    ["61.20Z","Télécommunications sans fil"],["61.90Z","Autres télécoms"],
    ["63.91Z","Agences de presse"],["63.99Z","Autres services information"],
  ],
  "📣 Communication & Marketing": [
    ["73.11Z","Agences de publicité"],["73.12Z","Régies publicitaires"],
    ["73.20Z","Études de marché et sondages"],["70.21Z","Relations publiques"],
    ["58.13Z","Édition de journaux"],["58.14Z","Édition de revues"],
    ["60.10Z","Édition et diffusion radio"],["60.20A","Chaînes TV généralistes"],
    ["60.20B","Chaînes TV thématiques"],
  ],
  "💼 Conseil & Management": [
    ["70.22Z","Conseil en gestion et management"],["69.10Z","Activités juridiques"],
    ["69.20Z","Comptabilité / audit"],["70.10Z","Sièges sociaux"],
    ["71.11Z","Architecture"],["71.12B","Ingénierie et études techniques"],
    ["72.19Z","R&D sciences physiques"],["72.20Z","R&D sciences humaines"],
    ["74.90B","Activités spécialisées diverses"],
  ],
  "🎨 Design & Création": [
    ["74.10Z","Design / création graphique"],["74.20Z","Photographie"],
    ["74.30Z","Traduction et interprétation"],["59.11B","Production films publicitaires"],
    ["59.12Z","Post-production"],["90.03A","Arts plastiques / graphiques"],
    ["90.03B","Autres créations artistiques"],
  ],
  "🏦 Finance & Assurance": [
    ["64.19Z","Intermédiations monétaires"],["64.20Z","Sociétés holding"],
    ["64.92Z","Distribution de crédit"],["65.11Z","Assurance vie"],
    ["65.12Z","Autres assurances"],["66.12Z","Courtage valeurs mobilières"],
    ["66.22Z","Courtiers en assurance"],["66.30Z","Gestion de fonds"],
  ],
  "🏠 Immobilier": [
    ["41.10A","Promotion immobilière logements"],["68.10Z","Marchands de biens"],
    ["68.20A","Location de logements"],["68.31Z","Agences immobilières"],
    ["68.32A","Administration immeubles résidentiels"],
  ],
  "👥 RH & Recrutement": [
    ["78.10Z","Agences de placement / recrutement"],["78.20Z","Travail temporaire"],
    ["78.30Z","Mise à disposition RH"],["82.20Z","Centres d'appels"],
    ["82.30Z","Organisation salons et congrès"],
  ],
  "🏗️ BTP & Construction": [
    ["41.20A","Construction maisons individuelles"],["41.20B","Construction bâtiments"],
    ["43.21A","Installation électrique"],["43.22A","Plomberie / gaz / chauffage"],
    ["43.31Z","Plâtrerie"],["43.32A","Menuiserie"],["43.34Z","Peinture"],
  ],
  "🚚 Transport & Logistique": [
    ["49.41A","Transport routier de fret"],["52.10B","Entreposage"],
    ["52.29A","Messagerie / fret express"],["52.29B","Affrètement"],
  ],
  "🍽️ Restauration & Hôtellerie": [
    ["55.10Z","Hôtels et hébergement"],["56.10A","Restauration traditionnelle"],
    ["56.10C","Restauration rapide"],["56.21Z","Traiteurs"],
    ["56.29A","Restauration collective"],
  ],
  "🛒 Commerce & Distribution": [
    ["46.51Z","Informatique en gros"],["46.52Z","Électronique / télécom en gros"],
    ["46.90Z","Commerce de gros non spécialisé"],["47.91B","Commerce en ligne"],
  ],
  "🎓 Éducation & Formation": [
    ["85.42Z","Enseignement supérieur"],["85.59A","Formation continue adultes"],
    ["85.59B","Autres enseignements"],["85.60Z","Soutien à l'enseignement"],
  ],
  "🏥 Santé & Bien-être": [
    ["86.21Z","Médecins généralistes"],["86.22B","Médecins spécialistes"],
    ["86.90A","Auxiliaires médicaux"],["86.90C","Centres de santé"],
  ],
  "⚙️ Services B2B": [
    ["82.11Z","Services administratifs"],["82.99Z","Autres services B2B"],
    ["81.10Z","Services de soutien combinés"],["80.10Z","Sécurité privée"],
  ],
}
const APE_FLAT = Object.entries(NAF_SECTORS).flatMap(([cat, codes]) =>
  codes.map(([code, label]) => ({ code, label, cat }))
)

const EFFECTIFS = [
  { code:'',   label:'Toutes tailles' },
  { code:'11', label:'10 – 19 salariés' },
  { code:'12', label:'20 – 49 salariés' },
  { code:'21', label:'50 – 99 salariés' },
  { code:'22', label:'100 – 199 salariés' },
  { code:'31', label:'200 – 249 salariés' },
  { code:'32', label:'250 – 499 salariés' },
]

/* ═══════════════════════════════════════════════════════════
   DONNÉES INTERNATIONAL — Icypeas (couverture mondiale)
   ═══════════════════════════════════════════════════════════ */

const COUNTRIES = [
  // Europe
  { code:'BE', label:'Belgique 🇧🇪' },
  { code:'CH', label:'Suisse 🇨🇭' },
  { code:'LU', label:'Luxembourg 🇱🇺' },
  { code:'DE', label:'Allemagne 🇩🇪' },
  { code:'ES', label:'Espagne 🇪🇸' },
  { code:'IT', label:'Italie 🇮🇹' },
  { code:'NL', label:'Pays-Bas 🇳🇱' },
  { code:'GB', label:'Royaume-Uni 🇬🇧' },
  { code:'SE', label:'Suède 🇸🇪' },
  { code:'DK', label:'Danemark 🇩🇰' },
  { code:'NO', label:'Norvège 🇳🇴' },
  { code:'FI', label:'Finlande 🇫🇮' },
  { code:'PL', label:'Pologne 🇵🇱' },
  { code:'PT', label:'Portugal 🇵🇹' },
  { code:'AT', label:'Autriche 🇦🇹' },
  { code:'IE', label:'Irlande 🇮🇪' },
  // Amérique
  { code:'US', label:'États-Unis 🇺🇸' },
  { code:'CA', label:'Canada 🇨🇦' },
  { code:'MX', label:'Mexique 🇲🇽' },
  { code:'BR', label:'Brésil 🇧🇷' },
  { code:'AR', label:'Argentine 🇦🇷' },
  // Asie
  { code:'JP', label:'Japon 🇯🇵' },
  { code:'SG', label:'Singapour 🇸🇬' },
  { code:'AE', label:'Émirats arabes unis 🇦🇪' },
  { code:'IN', label:'Inde 🇮🇳' },
  { code:'AU', label:'Australie 🇦🇺' },
  // Afrique
  { code:'MA', label:'Maroc 🇲🇦' },
  { code:'TN', label:'Tunisie 🇹🇳' },
  { code:'SN', label:'Sénégal 🇸🇳' },
  { code:'CI', label:"Côte d'Ivoire 🇨🇮" },
]

const INTL_SECTORS = [
  'SaaS / Tech', 'E-commerce', 'Finance / Fintech', 'Marketing / Publicité',
  'Conseil / Consulting', 'Industrie / Manufacture', 'Santé / Medtech',
  'Logistique / Transport', 'Immobilier', 'Éducation / Edtech',
  'Médias / Presse', 'RH / Recrutement', 'Hôtellerie / Tourisme',
  'Énergie / Environnement', 'Agro-alimentaire',
]

const COMPANY_SIZES = [
  { v:'',           label:'Toutes tailles' },
  { v:'1-10',       label:'1 – 10 employés' },
  { v:'11-50',      label:'11 – 50 employés' },
  { v:'51-200',     label:'51 – 200 employés' },
  { v:'201-500',    label:'201 – 500 employés' },
  { v:'501-1000',   label:'501 – 1 000 employés' },
  { v:'1001-5000',  label:'1 001 – 5 000 employés' },
  { v:'5001+',      label:'5 001+ employés' },
]

const JOB_PRESETS = [
  { label:'DG / CEO',           v:'Directeur Général, CEO, DG, Président, Gérant' },
  { label:'Dir. Marketing',     v:'Directeur Marketing, CMO, VP Marketing' },
  { label:'Dir. Commercial',    v:'Directeur Commercial, CSO, VP Sales' },
  { label:'Dir. Communication', v:'Directeur Communication, Head of Communications' },
  { label:'Head of Growth',     v:'Head of Growth, Growth Manager, VP Growth' },
  { label:'Head of Sales',      v:'Head of Sales, Sales Director, Sales Manager' },
  { label:'DRH / CPO',          v:'DRH, Directeur RH, Chief People Officer, VP People' },
  { label:'CTO / DSI',          v:'CTO, Directeur Technique, DSI, VP Engineering' },
]

/* ── UI atoms ── */
function SourceBadge({ label, url }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:6, fontSize:11, fontWeight:500, color:'#1D4ED8', textDecoration:'none' }}>
      <span style={{ fontSize:10 }}>🔗</span>
      {label}
    </a>
  )
}

function ModeTab({ active, onClick, icon, title, sub }) {
  return (
    <button onClick={onClick} style={{
      flex:1, padding:'14px 18px', borderRadius:10, cursor:'pointer', transition:'all .14s',
      border:`2px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
      background: active ? 'var(--bg2)' : 'var(--white)',
      textAlign:'left',
    }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
      <div style={{ fontFamily:'var(--fd)', fontSize:14, fontWeight:700, color: active ? 'var(--brand)' : 'var(--text)' }}>{title}</div>
      <div style={{ fontSize:12, color:'var(--t3)', marginTop:3, lineHeight:1.4 }}>{sub}</div>
    </button>
  )
}

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function NouvelleBase() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const { user } = useAuth()

  const [mode, setMode]         = useState('france')  // 'france' | 'international'
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [apeSearch, setApeSearch]   = useState('')
  const [deptSearch, setDeptSearch] = useState('')

  const [form, setForm] = useState({
    // Shared
    name: '', jobTitles: '', nCompanies: 10,
    // France
    ape:'73.11Z', dept:'75', effectif:'12',
    // International
    country:'BE', intlSector:'SaaS / Tech', companySize:'',
    intlCity:'',
  })

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target?.value ?? e }))

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
  const canSubmit   = form.name.trim() && form.jobTitles.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true); setError('')
    try {
      const isFR = mode === 'france'
      const payload = {
        user_id:    user.id,
        name:       form.name.trim(),
        status:     'draft',
        job_titles: form.jobTitles,
        n_companies: form.nCompanies,
        mode,
        // France
        ...(isFR ? {
          ape_code:       form.ape,
          ape_label:      apeInfo?.label || '',
          departement:    form.dept,
          dept_label:     deptInfo?.nom || '',
          effectif_code:  form.effectif,
          effectif_label: effInfo?.label || '',
          client_sector:  apeInfo?.label || '',
          client_location:deptInfo?.nom || '',
        } : {
          // International
          country_code:  form.country,
          country_label: countryInfo?.label || '',
          intl_sector:   form.intlSector,
          intl_city:     form.intlCity,
          company_size:  form.companySize,
          client_sector: form.intlSector,
          client_location: countryInfo?.label || '',
        }),
        client_need: form.jobTitles,
      }
      const { data, error } = await supabase.from('campaigns').insert(payload).select().single()
      if (error) throw error
      router.push(`/bases/${data.id}`)
    } catch (e) { setError(e.message); setSaving(false) }
  }

  const sel = { width:'100%', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--white)', color:'var(--text)', outline:'none' }

  // Preview text
  const preview = mode === 'france'
    ? `${form.jobTitles.split(',')[0]?.trim()} · ${apeInfo?.label} · ${deptInfo?.nom} · ${effInfo?.label || 'toutes tailles'} · ${form.nCompanies} sociétés`
    : `${form.jobTitles.split(',')[0]?.trim()} · ${form.intlSector} · ${countryInfo?.label}${form.intlCity ? ` (${form.intlCity})` : ''} · ${form.nCompanies} contacts`

  return (
    <>
      <Head><title>Mission Data — Nouvelle base</title></Head>
      <Layout>
        <div style={{ maxWidth:720, margin:'0 auto' }}>
          <Link href="/dashboard">
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:20 }}>← Retour</button>
          </Link>

          <h1 style={{ fontFamily:'var(--fd)', fontSize:26, fontWeight:800, letterSpacing:'-.02em', marginBottom:4 }}>
            Nouvelle base
          </h1>
          <p style={{ fontSize:13, color:'var(--t3)', marginBottom:24 }}>
            France ou international — Mission Data enrichit vos contacts via Icypeas.
          </p>

          {/* Mode selector */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
            <ModeTab active={mode==='france'} onClick={() => setMode('france')}
              icon="🇫🇷" title="France"
              sub="SIRENE + APE + département → contacts Icypeas" />
            <ModeTab active={mode==='international'} onClick={() => setMode('international')}
              icon="🌍" title="International"
              sub="Icypeas worldwide → pays + secteur + poste" />
          </div>

          {/* Sources Datagouv (France only) */}
          {mode === 'france' && (
            <div style={{ display:'flex', gap:7, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'var(--t4)', fontFamily:'var(--fm)' }}>Sources data.gouv.fr :</span>
              <SourceBadge label="INSEE COG 2026 · 101 depts" url="https://www.data.gouv.fr/datasets/code-officiel-geographique-cog" />
              <SourceBadge label="INSEE NAF rév.2 · codes APE" url="https://www.data.gouv.fr/datasets/codes-et-libelles-naf-niveau-2" />
              <SourceBadge label="API Recherche Entreprises · SIRENE" url="https://www.data.gouv.fr/dataservices/672cf684c3488a0c533f7094" />
            </div>
          )}
          {mode === 'international' && (
            <div style={{ display:'flex', gap:7, marginBottom:18, alignItems:'center' }}>
              <span style={{ fontSize:11, color:'var(--t4)', fontFamily:'var(--fm)' }}>Source :</span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:6, fontSize:11, fontWeight:500, color:'#15803D' }}>
                🌐 Icypeas · base mondiale de contacts B2B
              </span>
            </div>
          )}

          {error && <div className="alert alert-error" style={{ marginBottom:16 }}>⚠ {error}</div>}

          <div className="card" style={{ padding:28 }}>

            {/* Nom */}
            <div className="field" style={{ marginBottom:22 }}>
              <label className="label">Nom de la base</label>
              <input className="input" value={form.name}
                onChange={e => setForm(f => ({...f, name:e.target.value}))}
                placeholder={mode === 'france' ? 'Ex : Agences pub Paris · DG · Q2 2026' : 'Ex : SaaS Belgique · Head of Sales · 2026'} />
            </div>

            {/* ══ FRANCE ══ */}
            {mode === 'france' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:18 }}>

                  {/* APE */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <label className="label" style={{ margin:0 }}>Code APE</label>
                      <a href="https://www.data.gouv.fr/datasets/codes-et-libelles-naf-niveau-2" target="_blank" rel="noreferrer"
                        style={{ fontSize:10, color:'var(--ab)', fontFamily:'var(--fm)' }}>INSEE NAF ↗</a>
                    </div>
                    <input placeholder="Rechercher secteur…" value={apeSearch}
                      onChange={e => setApeSearch(e.target.value)}
                      style={{ ...sel, marginBottom:6, padding:'7px 10px', fontSize:12 }} />
                    {filteredAPE ? (
                      <select style={sel} value={form.ape}
                        onChange={e => { setForm(f=>({...f,ape:e.target.value})); setApeSearch('') }}>
                        {filteredAPE.length === 0
                          ? <option>Aucun résultat</option>
                          : filteredAPE.map(a => <option key={a.code} value={a.code}>{a.code} — {a.label}</option>)}
                      </select>
                    ) : (
                      <select style={sel} value={form.ape}
                        onChange={e => setForm(f=>({...f,ape:e.target.value}))}>
                        {Object.entries(NAF_SECTORS).map(([cat, codes]) => (
                          <optgroup key={cat} label={cat}>
                            {codes.map(([code,label]) => <option key={code} value={code}>{code} — {label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    )}
                    {apeInfo && <div style={{ fontSize:11, color:'var(--brand-mid)', marginTop:4 }}>✓ {apeInfo.label}</div>}
                  </div>

                  {/* Département */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <label className="label" style={{ margin:0 }}>Département</label>
                      <a href="https://www.data.gouv.fr/datasets/code-officiel-geographique-cog" target="_blank" rel="noreferrer"
                        style={{ fontSize:10, color:'var(--ab)', fontFamily:'var(--fm)' }}>INSEE COG ↗</a>
                    </div>
                    <input placeholder="Rechercher (nom ou code)…" value={deptSearch}
                      onChange={e => setDeptSearch(e.target.value)}
                      style={{ ...sel, marginBottom:6, padding:'7px 10px', fontSize:12 }} />
                    <select style={sel} value={form.dept}
                      onChange={e => { setForm(f=>({...f,dept:e.target.value})); setDeptSearch('') }}>
                      {filteredDepts.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                    </select>
                    {deptInfo && <div style={{ fontSize:11, color:'var(--brand-mid)', marginTop:4 }}>✓ {deptInfo.nom}</div>}
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:22 }}>
                  <div className="field">
                    <label className="label">Taille d'entreprise</label>
                    <select className="select" value={form.effectif}
                      onChange={e => setForm(f=>({...f,effectif:e.target.value}))}>
                      {EFFECTIFS.map(e => <option key={e.code} value={e.code}>{e.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Entreprises : <strong style={{ color:'var(--brand)' }}>{form.nCompanies}</strong></label>
                    <input type="range" min={5} max={25} step={5} value={form.nCompanies}
                      onChange={e => setForm(f=>({...f,nCompanies:+e.target.value}))}
                      style={{ width:'100%', marginTop:10, accentColor:'var(--brand)' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--t4)', marginTop:3 }}>
                      <span>5 rapide</span><span>25 exhaustif</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══ INTERNATIONAL ══ */}
            {mode === 'international' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:18 }}>
                  <div className="field">
                    <label className="label">Pays</label>
                    <select className="select" value={form.country}
                      onChange={e => setForm(f=>({...f,country:e.target.value}))}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Ville <span style={{ fontWeight:400, color:'var(--t4)' }}>(optionnel)</span></label>
                    <input className="input" value={form.intlCity}
                      onChange={e => setForm(f=>({...f,intlCity:e.target.value}))}
                      placeholder="Ex: Brussels, Zurich, London…" />
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:22 }}>
                  <div className="field">
                    <label className="label">Secteur</label>
                    <select className="select" value={form.intlSector}
                      onChange={e => setForm(f=>({...f,intlSector:e.target.value}))}>
                      {INTL_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Taille d'entreprise</label>
                    <select className="select" value={form.companySize}
                      onChange={e => setForm(f=>({...f,companySize:e.target.value}))}>
                      {COMPANY_SIZES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="field" style={{ marginBottom:18 }}>
                  <label className="label">Contacts à trouver : <strong style={{ color:'var(--brand)' }}>{form.nCompanies}</strong></label>
                  <input type="range" min={5} max={50} step={5} value={form.nCompanies}
                    onChange={e => setForm(f=>({...f,nCompanies:+e.target.value}))}
                    style={{ width:'100%', marginTop:8, accentColor:'var(--brand)' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--t4)', marginTop:3 }}>
                    <span>5</span><span>50</span>
                  </div>
                </div>
              </>
            )}

            {/* Poste cible — commun */}
            <div className="field">
              <label className="label">Poste cible</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:10 }}>
                {JOB_PRESETS.map(p => (
                  <button key={p.label} type="button"
                    onClick={() => setForm(f=>({...f,jobTitles:p.v}))}
                    style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .12s',
                      border:`1px solid ${form.jobTitles===p.v?'var(--brand)':'var(--border)'}`,
                      background:form.jobTitles===p.v?'var(--brand)':'var(--white)',
                      color:form.jobTitles===p.v?'white':'var(--t2)' }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input className="input" value={form.jobTitles}
                onChange={e => setForm(f=>({...f,jobTitles:e.target.value}))}
                placeholder="Ex: Head of Sales, Directeur Commercial, VP Sales" />
              <span className="input-hint" style={{ marginTop:5 }}>
                Raccourcis ou texte libre, séparé par des virgules
              </span>
            </div>
          </div>

          {/* Preview */}
          {canSubmit && (
            <div style={{ margin:'14px 0', padding:'10px 16px', background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border3)', fontSize:12, color:'var(--brand-mid)' }}>
              {preview}
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
            <Link href="/dashboard">
              <button className="btn btn-secondary">Annuler</button>
            </Link>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || saving}>
              {saving
                ? <><span className="spinner" style={{ width:14, height:14, borderColor:'rgba(255,255,255,.3)', borderTopColor:'white' }} /> Création…</>
                : '◎ Créer la base →'}
            </button>
          </div>

        </div>
      </Layout>
    </>
  )
}
