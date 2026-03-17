import { LogoIcon } from '../lib/Logo';
// pages/login.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError('Email ou mot de passe incorrect.'); setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', data.user.id).single();
    if (!profile?.is_active) { setError('Compte désactivé. Contacte Mission Freelances.'); setLoading(false); await supabase.auth.signOut(); return; }
    router.push(profile?.role === 'admin' ? '/admin' : '/app');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>

          {/* Logo inside card */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display:'flex', justifyContent:'center', margin:'0 auto 14px' }}><LogoIcon size={56} /></div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>Bienvenue sur Mission Data</h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Génère des prospects qualifiés en quelques clics</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Adresse e-mail</label>
              <input
                className="input"
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required autoFocus
              />
            </div>
            <div className="field" style={{ marginBottom: '20px' }}>
              <label>Mot de passe</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{ background: 'var(--red-lt)', color: 'var(--red)', border: '1px solid #fecaca', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: loading ? '#7ee0a0' : 'var(--mf-blue)', color: 'white', border: 'none', borderRadius: '99px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background .15s', fontFamily: 'inherit' }}>
              {loading ? <div className="spinner" /> : null}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', padding: '14px 16px', background: 'white', borderRadius: 'var(--r)', border: '1px solid var(--border)', fontSize: '13px', lineHeight: '1.6', color: 'var(--text2)' }}>
          Pour obtenir vos accès à la plateforme, envoyez un e-mail à{' '}
          <a href="mailto:contact@mission-freelances.fr" style={{ color: 'var(--mf-blue)', fontWeight: '600' }}>contact@mission-freelances.fr</a>
        </div>
      </div>
    </div>
  );
}
