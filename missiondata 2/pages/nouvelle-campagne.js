import { useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'

const STEPS = [
  { n: 1, label: 'Profil client cible' },
  { n: 2, label: 'Votre valeur ajoutée' },
  { n: 3, label: 'Récapitulatif' },
]

const CLIENT_TYPES    = ['TPE (1–10)', 'PME (11–50)', 'ETI (51–250)', 'Grande entreprise (250+)', 'Startup', 'Association', 'Collectivité']
const CLIENT_SECTORS  = ['Communication & Marketing', 'Technologie / SaaS', 'Finance & Assurance', 'Immobilier', 'Santé', 'Éducation', 'Industrie', 'E-commerce', 'Conseil & Services B2B', 'Médias / Édition', 'Autre']
const CLIENT_SIZES    = ['1–10 salariés', '11–50 salariés', '51–200 salariés', '200–500 salariés', '500+ salariés']
const LOCATIONS       = ['France', 'Île-de-France', 'Paris', 'Bretagne', 'PACA', 'Auvergne-Rhône-Alpes', 'Europe']
const NEEDS           = ['Site web / refonte', 'Contenu & rédaction', 'Réseaux sociaux', 'SEO / référencement', 'Design graphique', 'Vidéo & motion', 'Développement', 'Stratégie marketing', 'Formation', 'Autre']
const TONES           = ['Professionnel', 'Direct & incisif', 'Chaleureux & humain', 'Expert & technique', 'Créatif & décalé']

function Field({ label, hint, children }) {
  return (
    <div className="field" style={{ marginBottom: 18 }}>
      <label className="label">{label}</label>
      {hint && <span className="input-hint" style={{ marginTop: -2, marginBottom: 4 }}>{hint}</span>}
      {children}
    </div>
  )
}

function ChipSelect({ options, value, onChange, multi = false }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = multi ? (value || []).includes(opt) : value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (multi) {
                const cur = value || []
                onChange(cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt])
              } else {
                onChange(opt === value ? '' : opt)
              }
            }}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--r-full)',
              fontSize: 13,
              fontWeight: 500,
              border: `1px solid ${active ? 'var(--mf-2)' : 'var(--border)'}`,
              background: active ? 'var(--bg2)' : 'var(--white)',
              color: active ? 'var(--mf-2)' : 'var(--t2)',
              transition: 'all .12s',
              cursor: 'pointer',
            }}>
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default function NouvelleCampagne() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const user     = useUser()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    // Step 1
    client_type: '',
    client_sector: '',
    client_size: '',
    client_location: '',
    client_need: '',
    client_budget: '',
    // Step 2
    freelance_result: '',
    freelance_kpi: '',
    freelance_angle: '',
    freelance_tone: 'Professionnel',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const canNext1 = form.name && form.client_sector && form.client_type
  const canNext2 = form.freelance_result && form.freelance_kpi

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({ ...form, user_id: user.id, status: 'draft' })
        .select()
        .single()
      if (error) throw error
      router.push(`/campagnes/${data.id}`)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <>
      <Head><title>Mission Freelances — Nouvelle campagne</title></Head>
      <Layout>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {/* Back */}
          <Link href="/dashboard">
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>← Retour</button>
          </Link>

          <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', marginBottom: 4 }}>
            Nouvelle campagne
          </h1>
          <p style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 28 }}>
            Décrivez votre client idéal et votre valeur — on s'occupe du reste.
          </p>

          {/* Steps indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: step > s.n ? 'var(--mf-grad)' : step === s.n ? 'var(--bg2)' : 'var(--border)',
                    color: step > s.n ? 'white' : step === s.n ? 'var(--mf-blue)' : 'var(--t4)',
                    border: step === s.n ? '2px solid var(--mf-2)' : '2px solid transparent',
                  }}>
                    {step > s.n ? '✓' : s.n}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? 'var(--text)' : 'var(--t4)' }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 14px' }} />
                )}
              </div>
            ))}
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>⚠ {error}</div>}

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="fade-in">
              <div className="card" style={{ padding: 28 }}>
                <Field label="Nom de la campagne" hint="Ex: PME communication Paris Q2">
                  <input className="input" placeholder="Mon titre de campagne..." value={form.name} onChange={e => set('name', e.target.value)} />
                </Field>

                <Field label="Type de structure ciblée">
                  <ChipSelect options={CLIENT_TYPES} value={form.client_type} onChange={v => set('client_type', v)} />
                </Field>

                <Field label="Secteur d'activité">
                  <ChipSelect options={CLIENT_SECTORS} value={form.client_sector} onChange={v => set('client_sector', v)} />
                </Field>

                <Field label="Taille de l'entreprise">
                  <ChipSelect options={CLIENT_SIZES} value={form.client_size} onChange={v => set('client_size', v)} />
                </Field>

                <Field label="Localisation">
                  <ChipSelect options={LOCATIONS} value={form.client_location} onChange={v => set('client_location', v)} />
                </Field>

                <Field label="Besoin principal" hint="Quelle mission recherchez-vous ?">
                  <ChipSelect options={NEEDS} value={form.client_need} onChange={v => set('client_need', v)} />
                </Field>

                <Field label="Budget estimé" hint="Optionnel — aide à cibler les entreprises adéquates">
                  <input className="input" placeholder="Ex: 3 000 – 8 000 €" value={form.client_budget} onChange={e => set('client_budget', e.target.value)} />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!canNext1}>
                  Étape suivante →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="fade-in">
              <div className="card" style={{ padding: 28 }}>
                <Field label="Résultat client concret" hint="Ce que vous avez accompli pour un client similaire">
                  <textarea className="textarea" placeholder="Ex: J'ai refait le site d'une agence RH parisienne, +240% de leads en 3 mois..." value={form.freelance_result} onChange={e => set('freelance_result', e.target.value)} style={{ minHeight: 100 }} />
                </Field>

                <Field label="KPI / avant–après" hint="Un chiffre marquant si possible">
                  <input className="input" placeholder="Ex: +240% de trafic, délai 3 semaines, ROI 4×..." value={form.freelance_kpi} onChange={e => set('freelance_kpi', e.target.value)} />
                </Field>

                <Field label="Angle différenciateur" hint="Ce qui vous rend unique vs un autre freelance">
                  <textarea className="textarea" placeholder="Ex: Je suis spécialisé agences de com depuis 5 ans, je connais leurs contraintes budget et délais..." value={form.freelance_angle} onChange={e => set('freelance_angle', e.target.value)} />
                </Field>

                <Field label="Ton des messages">
                  <ChipSelect options={TONES} value={form.freelance_tone} onChange={v => set('freelance_tone', v)} />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>← Précédent</button>
                <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!canNext2}>
                  Vérifier →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3 — Recap ── */}
          {step === 3 && (
            <div className="fade-in">
              <div className="card" style={{ padding: 28 }}>
                <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
                  {form.name}
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  {[
                    { l: 'Structure', v: form.client_type },
                    { l: 'Secteur', v: form.client_sector },
                    { l: 'Taille', v: form.client_size },
                    { l: 'Localisation', v: form.client_location },
                    { l: 'Besoin', v: form.client_need },
                    { l: 'Budget', v: form.client_budget || '—' },
                  ].map(r => (
                    <div key={r.l} style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{r.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{r.v || '—'}</div>
                    </div>
                  ))}
                </div>

                <div className="divider" />

                <div style={{ padding: '14px 16px', background: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border3)' }}>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--mf-2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>KPI freelance</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{form.freelance_kpi}</div>
                </div>

                <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Ton des messages</div>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>{form.freelance_tone}</div>
                </div>
              </div>

              <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--bg2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border3)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, marginTop: 1 }}>✦</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mf-2)' }}>Ce qui va se passer après la création</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4, lineHeight: 1.6 }}>
                    1 · Icypeas cherche vos prospects cibles<br />
                    2 · Claude génère une séquence personnalisée par prospect<br />
                    3 · Vous relisez, exportez ou envoyez directement
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>← Modifier</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} />
                      Création...
                    </span>
                  ) : '✦ Créer la campagne →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  )
}
