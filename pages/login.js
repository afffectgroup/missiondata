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

    // Get profile to redirect correctly
    const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', data.user.id).single();
    if (!profile?.is_active) { setError('Compte désactivé. Contacte Mission Freelances.'); setLoading(false); await supabase.auth.signOut(); return; }

    router.push(profile?.role === 'admin' ? '/admin' : '/app');
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--mf-dark)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative', overflow:'hidden' }}>
      {/* Background decoration */}
      <div style={{ position:'absolute', top:'-100px', right:'-100px', width:'400px', height:'400px', background:'rgba(26,86,240,.15)', borderRadius:'50%', filter:'blur(60px)' }} />
      <div style={{ position:'absolute', bottom:'-80px', left:'-80px', width:'300px', height:'300px', background:'rgba(0,196,140,.1)', borderRadius:'50%', filter:'blur(50px)' }} />

      <div style={{ width:'100%', maxWidth:'400px', position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'36px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
            <div style={{ width:'36px', height:'36px', background:'var(--mf-blue)', borderRadius:'9px', display:'grid', placeItems:'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.5 5.5H18l-4.5 3.5 2 6L10 13.5 4.5 17l2-6L2 7.5h5.5L10 2z" fill="white" opacity=".92"/></svg>
            </div>
            <span style={{ fontSize:'16px', fontWeight:'800', color:'white' }}>Mission<span style={{ color:'#7eb3ff' }}>Freelances</span></span>
          </div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(26,86,240,.3)', border:'1px solid rgba(26,86,240,.5)', borderRadius:'6px', padding:'4px 12px' }}>
            <span style={{ fontSize:'11px', fontWeight:'700', color:'#7eb3ff', letterSpacing:'.3px' }}>📊 Mission Data</span>
          </div>
        </div>

        {/* Card */}
        <div style={{ background:'white', borderRadius:'20px', padding:'36px', boxShadow:'0 24px 60px rgba(0,0,0,.3)' }}>
          <h1 style={{ fontSize:'20px', fontWeight:'800', marginBottom:'6px' }}>Connexion</h1>
          <p style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'28px' }}>Accède à ton espace Mission Data</p>

          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>Mot de passe</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            {error && (
              <div style={{ background:'var(--red-lt)', color:'var(--red)', border:'1px solid rgba(255,71,87,.2)', borderRadius:'var(--r)', padding:'10px 14px', fontSize:'13px', marginBottom:'16px' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop:'4px' }}>
              {loading ? <div className="spinner" /> : null}
              {loading ? 'Connexion…' : 'Se connecter →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', fontSize:'11px', color:'rgba(255,255,255,.3)', marginTop:'20px' }}>
          mission-freelances.com · Mission Data v2
        </p>
      </div>
    </div>
  );
}
