import { useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Head from 'next/head'

export default function LoginPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()

  const [mode, setMode]     = useState('login') // login | register
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [name, setName]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // Create profile
        if (data?.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email,
            full_name: name,
            role: 'freelance',
          })
        }
        router.push('/dashboard')
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>Mission Freelances — Connexion</title>
      </Head>
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,42,254,.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{
              fontFamily: 'var(--fd)',
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-.03em',
              lineHeight: 1.1,
            }}>
              <span className="grad-text">Mission</span>
              <br />
              <span style={{ color: 'var(--mf-dark)' }}>Freelances</span>
            </h1>
            <p style={{ fontSize: 14, color: 'var(--t3)', marginTop: 10 }}>
              {mode === 'login' ? 'Connectez-vous à votre espace' : 'Créez votre compte gratuitement'}
            </p>
          </div>

          {/* Card */}
          <div className="card" style={{ padding: 32, boxShadow: 'var(--sh3)' }}>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 20 }}>
                ⚠ {error}
              </div>
            )}

            {mode === 'register' && (
              <div className="field" style={{ marginBottom: 16 }}>
                <label className="label">Nom complet</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Marie Dupont"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}

            <div className="field" style={{ marginBottom: 16 }}>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="marie@exemple.fr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <div className="field" style={{ marginBottom: 24 }}>
              <label className="label">Mot de passe</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px 20px' }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} />
                  {mode === 'login' ? 'Connexion...' : 'Création...'}
                </span>
              ) : (
                mode === 'login' ? 'Se connecter →' : 'Créer mon compte →'
              )}
            </button>

            <div className="divider" />

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
              {mode === 'login' ? "Pas encore de compte ? " : "Déjà un compte ? "}
              <button
                style={{ color: 'var(--mf-2)', fontWeight: 600, fontSize: 13 }}
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              >
                {mode === 'login' ? "S'inscrire gratuitement" : 'Se connecter'}
              </button>
            </p>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--t4)', marginTop: 20 }}>
            Sans carte bancaire · Sans engagement
          </p>
        </div>
      </div>
    </>
  )
}
