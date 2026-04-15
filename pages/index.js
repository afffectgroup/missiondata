import { useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'
import Link from 'next/link'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const [mode, setMode]     = useState('login')
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [name, setName]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data?.user) {
          await supabase.from('profiles').insert({ id: data.user.id, email, full_name: name, role: 'freelance', is_active: true })
        }
      }
      router.push('/dashboard')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const inp = {
    width: '100%', padding: '11px 14px',
    border: '1px solid #E5E7EB', borderRadius: 10,
    fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif",
    outline: 'none', transition: 'border .15s, box-shadow .15s',
    background: 'white', color: '#0C1120',
  }

  return (
    <>
      <Head><title>Mission Data — Connexion</title></Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600&family=DM+Mono:wght@400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: #005E6F !important; box-shadow: 0 0 0 3px rgba(0,66,79,.08) !important; }
        a:hover { opacity: .8; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#F7FAFF', display: 'flex' }}>

        {/* ── Left panel — brand ── */}
        <div style={{
          width: 380, flexShrink: 0, background: '#0F172A',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '48px 44px',
        }} className="hide-mobile">

          {/* Logo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(155deg, #003A48 0%, #007A8F 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
                  <rect x="0" y="7" width="4" height="9" rx="1.5" fill="rgba(255,255,255,.85)"/>
                  <rect x="5" y="4" width="4" height="12" rx="1.5" fill="white"/>
                  <rect x="10" y="0" width="4" height="16" rx="1.5" fill="white"/>
                  <rect x="15" y="5" width="3" height="11" rx="1.5" fill="rgba(255,255,255,.6)"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-.02em', lineHeight: 1.1 }}>
                  Mission<br/>
                  <span style={{ color: '#A2D6E2' }}>Data</span>
                </div>
              </div>
            </div>

            {/* Value props */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {[
                { n: '01', title: 'SIRENE + Icypeas', sub: '10 sociétés → contacts enrichis en 30 secondes' },
                { n: '02', title: 'Emails vérifiés', sub: 'ultra_sure, sure, probable — filtrez par certitude' },
                { n: '03', title: 'France & International', sub: '15 pays disponibles, 30 secteurs APE/NAF' },
              ].map(p => (
                <div key={p.n} style={{ display: 'flex', gap: 14 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(162,214,226,.4)', paddingTop: 2, flexShrink: 0 }}>{p.n}</span>
                  <div>
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 3 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.42)', lineHeight: 1.5 }}>{p.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div>
            <div style={{ height: 1, background: 'rgba(255,255,255,.07)', marginBottom: 20 }} />
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: 'rgba(255,255,255,.25)', letterSpacing: '.04em' }}>
              data.mission-freelances.fr
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: 'rgba(255,255,255,.18)', marginTop: 4 }}>
              B2B Intelligence · v1.0
            </div>
          </div>
        </div>

        {/* ── Right panel — form ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>

            <div style={{ marginBottom: 36 }}>
              <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 800, color: '#0C1120', letterSpacing: '-.02em', marginBottom: 8 }}>
                {mode === 'login' ? 'Connexion' : 'Créer un compte'}
              </h1>
              <p style={{ fontSize: 14, color: '#6B7280' }}>
                {mode === 'login' ? 'Bienvenue sur Mission Data.' : 'Commencez à générer vos bases de prospection.'}
              </p>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, color: '#991B1B', fontSize: 13, marginBottom: 20 }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              {mode === 'register' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nom</label>
                  <input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jean Dupont" />
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email</label>
                <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@agence.fr" onKeyDown={e => e.key === 'Enter' && submit()} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Mot de passe</label>
                <input style={inp} type="password" value={password} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} />
              </div>
            </div>

            <button onClick={submit} disabled={loading}
              style={{
                width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(155deg, #003A48 0%, #007A8F 100%)',
                color: 'white', fontSize: 14, fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(0,66,79,.2)',
              }}>
              {loading && <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
              {loading ? '…' : mode === 'login' ? 'Se connecter →' : 'Créer mon compte →'}
            </button>

            <div style={{ height: 1, background: '#E5E7EB', margin: '24px 0' }} />

            <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
              {mode === 'login' ? 'Pas de compte ? ' : 'Déjà inscrit ? '}
              <button style={{ color: '#005E6F', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
                {mode === 'login' ? "S'inscrire" : 'Se connecter'}
              </button>
            </p>

            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#9CA3AF', marginTop: 24, fontFamily: "'DM Mono', monospace" }}>
              Produit Mission Freelances · <a href="https://mission-freelances.fr" style={{ color: '#9CA3AF' }}>mission-freelances.fr</a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
