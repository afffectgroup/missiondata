import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Layout from '../components/Layout'

export default function TrouverEmail() {
  const supabase = useSupabaseClient()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname]   = useState('')
  const [domain, setDomain]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [emails, setEmails]       = useState([])
  const [status, setStatus]       = useState(null) // { kind: 'ok'|'ko'|'warn', text }

  async function onSearch() {
    setEmails([])
    setStatus(null)

    const d = domain.trim(), f = firstname.trim(), l = lastname.trim()
    if (!d) return setStatus({ kind: 'ko', text: 'Entrez un domaine ou un nom d\'entreprise.' })
    if (!f && !l) return setStatus({ kind: 'ko', text: 'Entrez au moins un prénom ou un nom.' })

    setLoading(true)
    setStatus({ kind: 'warn', text: 'Recherche en cours…' })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/icypeas/email-search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstname: f, lastname: l, domainOrCompany: d }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Erreur')

      if (json.success && json.status === 'FOUND' && Array.isArray(json.emails) && json.emails.length) {
        setEmails(json.emails)
        setStatus({ kind: 'ok', text: `${json.emails.length} email${json.emails.length > 1 ? 's' : ''} trouvé${json.emails.length > 1 ? 's' : ''}.` })
      } else {
        setStatus({ kind: 'ko', text: 'Aucun email trouvé pour cette personne.' })
      }
    } catch (e) {
      setStatus({ kind: 'ko', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  async function copyEmail(email) {
    try { await navigator.clipboard.writeText(email) } catch {}
  }

  const handleEnter = (e) => e.key === 'Enter' && !loading && onSearch()

  const statusColors = {
    ok:   { bg: 'var(--green-bg)', border: 'var(--green)',  text: 'var(--green)'  },
    ko:   { bg: '#FEE2E2',          border: '#DC2626',       text: '#DC2626'       },
    warn: { bg: 'var(--amber-bg)', border: 'var(--amber)',  text: 'var(--amber)'  },
  }

  return (
    <>
      <Head><title>Trouver un email — Mission Data</title></Head>
      <Layout
        title="Trouver un email"
        action={
          <Link href="/dashboard">
            <button className="btn btn-secondary btn-sm">← Dashboard</button>
          </Link>
        }>

        <div style={{ maxWidth: 680 }}>
          <p style={{ color: 'var(--t2)', marginTop: 0, marginBottom: 24 }}>
            Entrez un prénom, un nom et un domaine ou une entreprise — Icypeas vérifie si l'email professionnel existe.
          </p>

          <div className="card" style={{ padding: 22 }}>
            {/* 3 champs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
                  Prénom
                </label>
                <input
                  type="text"
                  placeholder="John"
                  value={firstname}
                  onChange={e => setFirstname(e.target.value)}
                  onKeyDown={handleEnter}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
                  Nom
                </label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={lastname}
                  onChange={e => setLastname(e.target.value)}
                  onKeyDown={handleEnter}
                  autoComplete="family-name"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
                  Domaine ou entreprise
                </label>
                <input
                  type="text"
                  placeholder="example.com"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  onKeyDown={handleEnter}
                />
              </div>
            </div>

            {/* Bouton */}
            <button
              className="btn btn-primary"
              onClick={onSearch}
              disabled={loading}
              style={{ width: '100%' }}>
              {loading
                ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Recherche…</>
                : '🔍 Trouver l\'email'}
            </button>

            {/* Hint */}
            <div style={{ marginTop: 16, fontSize: 11.5, color: 'var(--t3)', lineHeight: 1.45, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              Les emails sont enrichis par <strong>Icypeas</strong>, solution 100% conforme RGPD — aucune donnée n'est conservée sur nos serveurs au-delà de l'export.
            </div>
          </div>

          {/* Status */}
          {status && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: statusColors[status.kind].bg,
              borderLeft: `3px solid ${statusColors[status.kind].border}`,
              color: statusColors[status.kind].text,
              borderRadius: 'var(--r-md)',
              fontSize: 13, fontWeight: 500,
            }}>
              {status.text}
            </div>
          )}

          {/* Résultats */}
          {emails.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {emails.map((e, i) => (
                <div key={i} className="card" style={{
                  padding: '14px 18px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>
                      {e.email || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                      Certitude : <strong>{e.certainty || '—'}</strong>
                      {e.mxProvider && <> • MX : <strong>{e.mxProvider}</strong></>}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyEmail(e.email)}>
                    Copier
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </>
  )
}

// Force SSR — évite les erreurs d'hydration avec l'auth client-side
export async function getServerSideProps() {
  return { props: {} }
}
