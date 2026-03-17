// pages/index.js — smart redirect
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './_app';

export default function Home() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    if (profile?.role === 'admin') router.replace('/admin');
    else router.replace('/app');
  }, [loading, session, profile]);

  return (
    <div style={{ display:'grid', placeItems:'center', height:'100vh', color:'var(--muted)', fontFamily:'Figtree,sans-serif' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
        <div style={{ width:'16px', height:'16px', border:'2px solid #e2e6f3', borderTopColor:'#1a56f0', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
        <span style={{ fontSize:'13px' }}>Chargement…</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
