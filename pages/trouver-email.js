import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Layout from '../components/Layout'

/* Helpers */
function timeAgo(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60)      return `il y a ${Math.floor(diff)}s`
  if (diff < 3600)    return `il y a ${Math.floor(diff/60)}min`
  if (diff < 86400)   return `il y a ${Math.floor(diff/3600)}h`
  if (diff < 604800)  return `il y a ${Math.floor(diff/86400)}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const CERT_STYLES = {
  ultra_sure: { label: 'Vérifié ✓', bg: '#D1FAE5', c: '#047857' },
  sure:       { label: 'Sûr',       bg: '#DBEAFE', c: '#1E40AF' },
  probable:   { label: 'Probable',  bg: '#FEF3C7', c: '#B45309' },
  risky:      { label: 'Risqué',    bg: '#FEE2E2', c: '#B91C1C' },
}

export default function TrouverEmail() {
  const supabase = useSupabaseClient()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname]   = useState('')
  const [domain, setDomain]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)  // { emails, notFound }
  const [error, setError]         = useState(null)
  const [history, setHistory]     = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [copiedId, setCopiedId]   = useState(null)

  const fetchHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/icypeas/search-history', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const json = await r.json()
      if (r.ok) setHistory(json.searches || [])
    } catch {} finally {
      setHistoryLoading(false)
    }
  }, [supabase])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  async function onSearch() {
    setResult(null)
    setError(null)

    const d = domain.trim(), f = firstname.trim(), l = lastname.trim()
    if (!d) return setError('Entrez un domaine ou un nom d\'entreprise.')
    if (!f && !l) return setError('Entrez au moins un prénom ou un nom.')

    setLoading(true)
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
        setResult({ emails: json.emails, query: { f, l, d } })
      } else {
        setResult({ emails: [], query: { f, l, d }, notFound: true })
      }
      fetchHistory()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function copyEmail(email, id) {
    try {
      await navigator.clipboard.writeText(email)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    } catch {}
  }

  async function deleteSearch(id) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/icypeas/search-history?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      setHistory(h => h.filter(x => x.id !== id))
    } catch {}
  }

  async function clearAll() {
    if (!confirm('Supprimer tout l\'historique ?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/icypeas/search-history?id=all', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      setHistory([])
    } catch {}
  }

  function reRun(search) {
    setFirstname(search.firstname || '')
    setLastname(search.lastname   || '')
    setDomain(search.domain_or_company || '')
    setResult(null)
    setError(null)
    // scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEnter = (e) => e.key === 'Enter' && !loading && onSearch()

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

        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Intro */}
          <p style={{ color: 'var(--t2)', marginTop: 0, marginBottom: 24, fontSize: 14, lineHeight: 1.55 }}>
            Recherchez l'email professionnel d'une personne à partir de son prénom, nom et de son entreprise.
            Chaque recherche est sauvegardée dans votre historique.
          </p>

          {/* Form card */}
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.02em' }}>
                  PRÉNOM
                </label>
                <input type="text" placeholder="John" value={firstname}
                  onChange={e => setFirstname(e.target.value)} onKeyDown={handleEnter}
                  autoComplete="given-name" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.02em' }}>
                  NOM
                </label>
                <input type="text" placeholder="Doe" value={lastname}
                  onChange={e => setLastname(e.target.value)} onKeyDown={handleEnter}
                  autoComplete="family-name" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5, display: 'block', fontWeight: 500, letterSpacing: '0.02em' }}>
                  DOMAINE OU ENTREPRISE
                </label>
                <input type="text" placeholder="entreprise.com" value={domain}
                  onChange={e => setDomain(e.target.value)} onKeyDown={handleEnter} />
              </div>
            </div>

            <button className="btn btn-primary" onClick={onSearch} disabled={loading} style={{ width: '100%' }}>
              {loading
                ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Recherche…</>
                : '🔍 Trouver l\'email'}
            </button>

            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--t3)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              Les emails sont enrichis par <strong>Icypeas</strong>, solution 100% conforme RGPD.
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>
          )}

          {/* Result */}
          {result && (
            <div style={{ marginBottom: 28 }}>
              {result.notFound ? (
                <div className="card" style={{ padding: 20, background: '#FEF2F2', borderLeft: '3px solid #DC2626' }}>
                  <div style={{ fontSize: 14, color: '#B91C1C', fontWeight: 600, marginBottom: 4 }}>
                    Aucun email trouvé
                  </div>
                  <div style={{ fontSize: 12, color: '#7F1D1D' }}>
                    Icypeas n'a pas pu vérifier d'email pour <strong>{result.query.f} {result.query.l}</strong> chez <strong>{result.query.d}</strong>.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--fm)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    ✓ {result.emails.length} email{result.emails.length > 1 ? 's' : ''} trouvé{result.emails.length > 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.emails.map((e, i) => {
                      const cert = CERT_STYLES[e.certainty] || { label: e.certainty || '—', bg: 'var(--border)', c: 'var(--t2)' }
                      return (
                        <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {e.email}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ padding: '2px 8px', background: cert.bg, color: cert.c, borderRadius: 10, fontWeight: 600 }}>
                                {cert.label}
                              </span>
                              {e.mxProvider && <span>MX : <strong>{e.mxProvider}</strong></span>}
                            </div>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={() => copyEmail(e.email, `r-${i}`)}>
                            {copiedId === `r-${i}` ? '✓ Copié' : 'Copier'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Historique ── */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h2 style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: 0, letterSpacing: '-0.01em' }}>
                Historique
                {history.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--t3)' }}>
                    ({history.length})
                  </span>
                )}
              </h2>
              {history.length > 0 && (
                <button onClick={clearAll} style={{
                  fontSize: 11, color: 'var(--t3)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 4,
                }}>
                  Tout supprimer
                </button>
              )}
            </div>

            {historyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="spinner" />
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--r-lg)' }}>
                Aucune recherche pour l'instant.<br/>
                <span style={{ fontSize: 12, color: 'var(--t4)' }}>Vos recherches passées apparaîtront ici.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.map(s => {
                  const fullName = [s.firstname, s.lastname].filter(Boolean).join(' ') || '—'
                  const cert = CERT_STYLES[s.certainty]
                  return (
                    <div key={s.id} style={{
                      padding: '12px 16px',
                      background: 'var(--white)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1.2fr 1.4fr auto',
                      gap: 14, alignItems: 'center', fontSize: 13,
                    }}>
                      {/* Nom */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fullName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                          {s.domain_or_company}
                        </div>
                      </div>

                      {/* Email + certitude */}
                      <div style={{ minWidth: 0 }}>
                        {s.email_found ? (
                          <>
                            <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.email_found}
                            </div>
                            {cert && (
                              <span style={{ display: 'inline-block', marginTop: 3, padding: '1px 7px', background: cert.bg, color: cert.c, borderRadius: 8, fontSize: 10, fontWeight: 600 }}>
                                {cert.label}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>
                            {s.status === 'ERROR' ? 'Erreur' : 'Non trouvé'}
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--fm)' }}>
                        {timeAgo(s.created_at)}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {s.email_found && (
                          <button onClick={() => copyEmail(s.email_found, s.id)} style={{
                            padding: '4px 10px', fontSize: 11, borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--white)',
                            color: 'var(--t2)', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>
                            {copiedId === s.id ? '✓' : 'Copier'}
                          </button>
                        )}
                        <button onClick={() => reRun(s)} title="Relancer cette recherche" style={{
                          padding: '4px 10px', fontSize: 11, borderRadius: 6,
                          border: '1px solid var(--border)', background: 'var(--white)',
                          color: 'var(--t2)', cursor: 'pointer',
                        }}>
                          ↻
                        </button>
                        <button onClick={() => deleteSearch(s.id)} title="Supprimer" style={{
                          padding: '4px 8px', fontSize: 11, borderRadius: 6,
                          border: '1px solid transparent', background: 'transparent',
                          color: 'var(--t4)', cursor: 'pointer',
                        }}>
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  )
}

export async function getServerSideProps() {
  return { props: {} }
}
