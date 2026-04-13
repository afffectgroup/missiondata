import { useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = useSupabaseClient()
  const [mode, setMode]       = useState('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [name, setName]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
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

  return (
    <>
      <Head><title>Mission Data — Connexion</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--fb)' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600&family=DM+Mono:wght@400&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} input{font-family:var(--fb);}`}</style>

        <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,94,111,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 38, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1 }}>
              <span style={{ color: 'var(--brand)' }}>Mission</span>
              <br />
              <span style={{ color: 'var(--text)' }}>Data</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 10 }}>
              Bases de prospection B2B enrichies
            </p>
          </div>

          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, boxShadow: 'var(--sh3)' }}>
            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 8, color: 'var(--red)', fontSize: 13, marginBottom: 20, border: '1px solid #FCA5A5' }}>
                ⚠ {error}
              </div>
            )}

            {mode === 'register' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Nom</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jean Dupont"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@agence.fr"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPass(e.target.value)} placeholder="••••••••"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            <button onClick={handleSubmit} disabled={loading}
              style={{ width: '100%', padding: '12px 20px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--fb)', opacity: loading ? .7 : 1 }}>
              {loading ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }} /></> : null}
              {loading ? (mode === 'login' ? 'Connexion…' : 'Création…') : (mode === 'login' ? 'Se connecter →' : 'Créer mon compte →')}
            </button>

            <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
              {mode === 'login' ? "Pas de compte ? " : "Déjà un compte ? "}
              <button style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 13, fontFamily: 'var(--fb)', cursor: 'pointer' }}
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
                {mode === 'login' ? "S'inscrire" : 'Se connecter'}
              </button>
            </p>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--t4)', marginTop: 16 }}>
            SIRENE · Icypeas · LinkedIn
          </p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    </>
  )
}
