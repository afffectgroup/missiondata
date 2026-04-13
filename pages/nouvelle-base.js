import { useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'
import { useAuth } from './_app'

const APE = [
  { code:'73.11Z', label:'Agences de publicité' },
  { code:'73.12Z', label:'Régies publicitaires' },
  { code:'73.20Z', label:'Études de marché' },
  { code:'70.22Z', label:'Conseil en gestion' },
  { code:'62.01Z', label:'Programmation / Dev' },
  { code:'62.02A', label:'Conseil systèmes IT' },
  { code:'63.11Z', label:'Data / Cloud / SaaS' },
  { code:'70.10Z', label:'Sièges sociaux' },
  { code:'68.20A', label:'Immobilier entreprise' },
  { code:'82.99Z', label:'Services B2B divers' },
  { code:'74.10Z', label:'Design / Création' },
  { code:'69.20Z', label:'Comptabilité / Audit' },
  { code:'78.10Z', label:'Recrutement / RH' },
  { code:'56.10A', label:'Restauration / Hôtellerie' },
  { code:'47.91A', label:'E-commerce' },
]

const DEPTS = [
  { code:'75', label:'Paris' },
  { code:'92', label:'Hauts-de-Seine' },
  { code:'93', label:'Seine-St-Denis' },
  { code:'94', label:'Val-de-Marne' },
  { code:'69', label:'Rhône (Lyon)' },
  { code:'13', label:'Bouches-du-Rhône' },
  { code:'31', label:'Haute-Garonne (Toulouse)' },
  { code:'33', label:'Gironde (Bordeaux)' },
  { code:'35', label:'Ille-et-Vilaine (Rennes)' },
  { code:'44', label:'Loire-Atlantique (Nantes)' },
  { code:'67', label:'Bas-Rhin (Strasbourg)' },
  { code:'06', label:'Alpes-Maritimes (Nice)' },
  { code:'59', label:'Nord (Lille)' },
  { code:'76', label:'Seine-Maritime (Rouen)' },
  { code:'34', label:'Hérault (Montpellier)' },
]

const EFFECTIFS = [
  { code:'',   label:'Toutes tailles' },
  { code:'11', label:'10 – 19 salariés' },
  { code:'12', label:'20 – 49 salariés' },
  { code:'21', label:'50 – 99 salariés' },
  { code:'22', label:'100 – 199 salariés' },
  { code:'31', label:'200 – 249 salariés' },
  { code:'32', label:'250 – 499 salariés' },
]

const JOB_PRESETS = [
  { label:'DG / CEO',          v:'Directeur Général, CEO, DG, Président, Gérant' },
  { label:'Dir. Marketing',    v:'Directeur Marketing, CMO, VP Marketing, Responsable Marketing' },
  { label:'Dir. Commercial',   v:'Directeur Commercial, CSO, VP Sales, Responsable Commercial' },
  { label:'Dir. Communication',v:'Directeur Communication, Head of Communications, Responsable Communication' },
  { label:'DRH',               v:'DRH, Directeur RH, Chief People Officer' },
  { label:'CTO / DSI',         v:'CTO, Directeur Technique, DSI, Chief Technology Officer' },
  { label:'Head of Growth',    v:'Head of Growth, Growth Manager, Responsable Acquisition, Growth Hacker' },
  { label:'Head of Sales',     v:'Head of Sales, Sales Manager, Responsable Ventes, Sales Director' },
]

export default function NouvelleBase() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const { user } = useAuth()

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [form, setForm] = useState({
    name: '', ape: '73.11Z', dept: '75', effectif: '12',
    jobTitles: '', nCompanies: 10,
  })

  const set = k => e => setForm(f => ({ ...f, [k]: typeof e === 'string' ? e : e.target.value }))

  const apeInfo   = APE.find(a => a.code === form.ape)
  const deptInfo  = DEPTS.find(d => d.code === form.dept)
  const effInfo   = EFFECTIFS.find(e => e.code === form.effectif)
  const canSubmit = form.name.trim() && form.jobTitles.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true); setError('')
    try {
      const { data, error } = await supabase.from('campaigns').insert({
        user_id:      user.id,
        name:         form.name.trim(),
        status:       'draft',
        ape_code:     form.ape,
        ape_label:    apeInfo?.label || '',
        departement:  form.dept,
        dept_label:   deptInfo?.label || '',
        effectif_code:   form.effectif,
        effectif_label:  effInfo?.label || '',
        job_titles:   form.jobTitles,
        n_companies:  form.nCompanies,
        // backward compat
        client_sector:   apeInfo?.label || '',
        client_location: deptInfo?.label || '',
        client_size:     effInfo?.label || '',
        client_need:     form.jobTitles,
      }).select().single()
      if (error) throw error
      router.push(`/bases/${data.id}`)
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <>
      <Head><title>Mission Data — Nouvelle base</title></Head>
      <Layout>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <Link href="/dashboard">
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>← Retour</button>
          </Link>

          <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>
            Nouvelle base
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 28 }}>
            Choisissez votre secteur, zone géo et poste cible — Mission Data fait le reste.
          </p>

          {/* Pipeline indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, padding: '12px 18px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border3)' }}>
            {[
              { n:'1', label:'SIRENE', sub:'Sociétés françaises', c:'var(--brand)' },
              { n:'2', label:'Icypeas', sub:'Contacts ciblés', c:'#0A66C2' },
              { n:'3', label:'Emails', sub:'Enrichissement', c:'var(--green)' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>{s.sub}</div>
                  </div>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1, background: 'var(--brand-lt)', margin: '0 12px' }} />}
              </div>
            ))}
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>⚠ {error}</div>}

          <div className="card" style={{ padding: 28 }}>
            {/* Nom de la base */}
            <div className="field" style={{ marginBottom: 22 }}>
              <label className="label">Nom de la base</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Ex : Agences pub Paris · DG · Q2 2026" />
            </div>

            {/* APE + Département */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div className="field">
                <label className="label">Secteur d'activité (code APE)</label>
                <select className="select" value={form.ape} onChange={set('ape')}>
                  {APE.map(a => <option key={a.code} value={a.code}>{a.code} — {a.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Département</label>
                <select className="select" value={form.dept} onChange={set('dept')}>
                  {DEPTS.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                </select>
              </div>
            </div>

            {/* Effectif + N */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
              <div className="field">
                <label className="label">Taille d'entreprise</label>
                <select className="select" value={form.effectif} onChange={set('effectif')}>
                  {EFFECTIFS.map(e => <option key={e.code} value={e.code}>{e.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Entreprises max : <strong style={{ color: 'var(--brand)' }}>{form.nCompanies}</strong></label>
                <input type="range" min={5} max={25} step={5} value={form.nCompanies}
                  onChange={e => setForm(f => ({ ...f, nCompanies: +e.target.value }))}
                  style={{ width: '100%', marginTop: 10, accentColor: 'var(--brand)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t4)', marginTop: 3 }}>
                  <span>5</span><span>25</span>
                </div>
              </div>
            </div>

            {/* Poste cible */}
            <div className="field" style={{ marginBottom: 10 }}>
              <label className="label">Poste cible</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                {JOB_PRESETS.map(p => (
                  <button key={p.label} type="button"
                    onClick={() => setForm(f => ({ ...f, jobTitles: p.v }))}
                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .12s', border: `1px solid ${form.jobTitles === p.v ? 'var(--brand)' : 'var(--border)'}`, background: form.jobTitles === p.v ? 'var(--brand)' : 'var(--white)', color: form.jobTitles === p.v ? 'white' : 'var(--t2)' }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input className="input" value={form.jobTitles} onChange={set('jobTitles')}
                placeholder="Ex: Head of Sales, Directeur Commercial, VP Sales" />
              <span className="input-hint" style={{ marginTop: 5 }}>Séparez par des virgules · Utilisez un raccourci ou saisissez librement</span>
            </div>
          </div>

          {/* Preview */}
          {canSubmit && (
            <div style={{ margin: '16px 0', padding: '12px 16px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border3)', fontSize: 13, color: 'var(--brand-mid)' }}>
              Recherche : <strong>{form.jobTitles.split(',')[0].trim()}</strong> dans les <strong>{apeInfo?.label}</strong> à <strong>{deptInfo?.label}</strong> · {effInfo?.label || 'toutes tailles'} · {form.nCompanies} sociétés max
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Link href="/dashboard">
              <button className="btn btn-secondary">Annuler</button>
            </Link>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || saving}>
              {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} /> Création…</> : '◎ Créer la base →'}
            </button>
          </div>
        </div>
      </Layout>
    </>
  )
}
