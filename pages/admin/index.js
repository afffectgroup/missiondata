// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../_app';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const { profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | {user}
  const [form, setForm] = useState({ email:'', password:'', full_name:'' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'admin')) router.push('/login');
  }, [loading, profile]);

  useEffect(() => { if (profile?.role === 'admin') { fetchStats(); fetchUsers(); } }, [profile]);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    return { 'Authorization': `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' };
  }

  async function fetchStats() {
    const h = await authHeader();
    const r = await fetch('/api/admin/stats', { headers: h });
    const d = await r.json();
    setStats(d);
  }

  async function fetchUsers() {
    const h = await authHeader();
    const r = await fetch('/api/admin/users', { headers: h });
    const d = await r.json();
    setUsers(d.users || []);
  }

  async function createUser() {
    setSaving(true);
    const h = await authHeader();
    const r = await fetch('/api/admin/users', { method:'POST', headers:h, body:JSON.stringify(form) });
    const d = await r.json();
    if (d.error) showToast('Erreur : ' + d.error);
    else { showToast('Compte créé ✓'); setModal(null); setForm({ email:'', password:'', full_name:'' }); fetchUsers(); fetchStats(); }
    setSaving(false);
  }

  async function toggleUser(user) {
    const h = await authHeader();
    await fetch(`/api/admin/users/${user.id}`, { method:'PATCH', headers:h, body:JSON.stringify({ is_active: !user.is_active }) });
    showToast(user.is_active ? 'Compte désactivé' : 'Compte activé ✓');
    fetchUsers();
  }

  async function updatePassword(userId, pwd) {
    const h = await authHeader();
    const r = await fetch(`/api/admin/users/${userId}`, { method:'PATCH', headers:h, body:JSON.stringify({ password: pwd }) });
    const d = await r.json();
    if (d.ok) showToast('Mot de passe mis à jour ✓');
    else showToast('Erreur : ' + d.error);
  }

  async function deleteUser(user) {
    if (!confirm(`Supprimer le compte de ${user.email} et toutes ses données ?`)) return;
    const h = await authHeader();
    await fetch(`/api/admin/users/${user.id}`, { method:'DELETE', headers:h });
    showToast('Compte supprimé.');
    fetchUsers(); fetchStats();
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  if (loading || !profile) return <div style={{ display:'grid', placeItems:'center', height:'100vh', color:'var(--muted)' }}>Chargement…</div>;

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>

      {/* SIDEBAR */}
      <aside style={{ width:'240px', background:'white', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100vh' }}>
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'34px', height:'34px', background:'var(--mf-blue)', borderRadius:'8px', display:'grid', placeItems:'center', flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.5 5.5H18l-4.5 3.5 2 6L10 13.5 4.5 17l2-6L2 7.5h5.5L10 2z" fill="white"/></svg>
            </div>
            <div>
              <div style={{ fontSize:'14px', fontWeight:'700', color:'var(--text)' }}>MissionData</div>
              <div style={{ fontSize:'11px', color:'var(--muted)' }}>Espace Admin</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'12px 8px', display:'flex', flexDirection:'column', gap:'2px' }}>
          <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--muted)', padding:'8px 8px 4px', letterSpacing:'0.5px', textTransform:'uppercase' }}>Administration</div>
          {[
            { id:'stats', label:'Tableau de bord', icon:<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg> },
            { id:'users', label:'Freelances', icon:<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM.458 10C1.732 7.943 4.022 7 6 7c.34 0 .672.033.993.095A4.979 4.979 0 004.667 14H2a2 2 0 01-2-2v-2zm14 0c1.274-2.057 3.564-3 5.542-3 .34 0 .672.033.993.095A4.979 4.979 0 0017.333 14H16a2 2 0 01-2-2v-2z"/></svg> },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 10px', borderRadius:'var(--r)', cursor:'pointer', fontSize:'13px', fontWeight: tab===item.id ? '600' : '500', border:'none', textAlign:'left', width:'100%', background: tab===item.id ? 'var(--mf-blue-lt)' : 'none', color: tab===item.id ? 'var(--mf-blue)' : 'var(--text2)', transition:'all .15s' }}
              onMouseOver={e => { if(tab!==item.id) e.currentTarget.style.background='var(--surface)'; }}
              onMouseOut={e => { if(tab!==item.id) e.currentTarget.style.background='none'; }}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding:'12px 8px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'var(--r)', marginBottom:'4px' }}>
            <div style={{ width:'28px', height:'28px', background:'var(--red)', borderRadius:'50%', display:'grid', placeItems:'center', fontSize:'12px', fontWeight:'700', color:'white', flexShrink:0 }}>A</div>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text)' }}>Admin</div>
              <div style={{ fontSize:'11px', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile.email}</div>
            </div>
          </div>
          <button onClick={signOut} style={{ display:'flex', alignItems:'center', gap:'8px', width:'100%', padding:'8px 10px', borderRadius:'var(--r)', background:'none', border:'none', color:'var(--muted)', fontSize:'13px', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}
            onMouseOver={e => e.currentTarget.style.background='var(--surface)'}
            onMouseOut={e => e.currentTarget.style.background='none'}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex:1, padding:'28px', overflowY:'auto' }}>

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', marginBottom:'4px' }}>📊 Tableau de bord</h1>
            <p style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'24px' }}>Vue globale de la plateforme</p>

            {stats && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'24px' }}>
                  {[
                    { n: stats.active_freelances, label:'Freelances actifs', sub:`/${stats.total_freelances} total`, color:'var(--mf-blue)' },
                    { n: stats.completed_campaigns, label:'Campagnes terminées', sub:`/${stats.total_campaigns} total`, color:'var(--mf-green)' },
                    { n: stats.total_prospects, label:'Prospects générés', sub:`${stats.total_sequences} séquences`, color:'var(--mf-orange)' },
                  ].map((s,i) => (
                    <div key={i} className="card" style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'32px', fontWeight:'900', color:s.color, marginBottom:'4px' }}>{s.n?.toLocaleString() || 0}</div>
                      <div style={{ fontSize:'13px', fontWeight:'700', marginBottom:'2px' }}>{s.label}</div>
                      <div style={{ fontSize:'11px', color:'var(--muted)' }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Recent campaigns */}
                <div className="card">
                  <div className="card-title">🕐 Campagnes récentes</div>
                  {stats.recent_campaigns?.length ? (
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                      <thead>
                        <tr style={{ borderBottom:'1px solid var(--border)' }}>
                          {['Nom','Freelance','Statut','Date'].map(h => (
                            <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:'10px', fontWeight:'700', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recent_campaigns.map(c => (
                          <tr key={c.id} style={{ borderBottom:'1px solid rgba(226,230,243,.5)' }}>
                            <td style={{ padding:'10px 12px', fontWeight:'600' }}>{c.name}</td>
                            <td style={{ padding:'10px 12px', color:'var(--text2)' }}>{c.profiles?.full_name || c.profiles?.email || '—'}</td>
                            <td style={{ padding:'10px 12px' }}>
                              <span className={`badge badge-${c.status==='done'?'green':c.status==='generating'?'blue':'muted'}`}>
                                {c.status==='done'?'Terminée':c.status==='generating'?'En cours':'Brouillon'}
                              </span>
                            </td>
                            <td style={{ padding:'10px 12px', color:'var(--muted)', fontSize:'12px' }}>
                              {new Date(c.created_at).toLocaleDateString('fr-FR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p style={{ color:'var(--muted)', fontSize:'13px' }}>Aucune campagne pour l'instant.</p>}
                </div>
              </>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {tab === 'users' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'10px' }}>
              <div>
                <h1 style={{ fontSize:'20px', fontWeight:'800', marginBottom:'4px' }}>👥 Freelances</h1>
                <p style={{ fontSize:'13px', color:'var(--muted)' }}>{users.length} compte{users.length!==1?'s':''} enregistré{users.length!==1?'s':''}</p>
              </div>
              <button className="btn btn-primary" onClick={() => setModal('create')}>+ Créer un compte</button>
            </div>

            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
                    {['Nom','Email','Statut','Créé le','Actions'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'10px', fontWeight:'700', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom:'1px solid rgba(226,230,243,.5)' }}>
                      <td style={{ padding:'12px 16px', fontWeight:'600' }}>{u.full_name || '—'}</td>
                      <td style={{ padding:'12px 16px', color:'var(--text2)', fontFamily:'JetBrains Mono,monospace', fontSize:'12px' }}>{u.email}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span className={`badge badge-${u.is_active?'green':'red'}`}>{u.is_active?'Actif':'Désactivé'}</span>
                      </td>
                      <td style={{ padding:'12px 16px', color:'var(--muted)', fontSize:'12px' }}>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(u)}>✏️ Éditer</button>
                          <button className="btn btn-sm" style={{ background:u.is_active?'var(--red-lt)':'var(--mf-green-lt)', color:u.is_active?'var(--red)':'var(--mf-green)', border:'none' }} onClick={() => toggleUser(u)}>
                            {u.is_active?'Désactiver':'Activer'}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!users.length && (
                    <tr><td colSpan="5" style={{ padding:'32px', textAlign:'center', color:'var(--muted)' }}>Aucun freelance pour l'instant. Crée le premier compte !</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL CREATE / EDIT */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,27,62,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:'24px' }} onClick={e => e.target===e.currentTarget&&setModal(null)}>
          <div style={{ background:'white', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 24px 60px rgba(13,27,62,.2)' }}>
            <h2 style={{ fontSize:'16px', fontWeight:'800', marginBottom:'20px' }}>
              {modal==='create' ? '+ Créer un compte freelance' : `✏️ Éditer — ${modal.email}`}
            </h2>

            {modal === 'create' && (
              <>
                <div className="field"><label>Prénom / Nom</label><input className="input" placeholder="Thierry Martin" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} /></div>
                <div className="field"><label>Email *</label><input className="input" type="email" placeholder="freelance@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
                <div className="field"><label>Mot de passe *</label><input className="input" type="password" placeholder="Min. 8 caractères" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
                <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'8px' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Annuler</button>
                  <button className="btn btn-primary btn-sm" onClick={createUser} disabled={saving}>
                    {saving ? <div className="spinner" /> : null}Créer le compte
                  </button>
                </div>
              </>
            )}

            {modal !== 'create' && (
              <EditUserForm user={modal} onUpdate={async (updates) => {
                const h = await authHeader();
                if (updates.password) await updatePassword(modal.id, updates.password);
                showToast('Mis à jour ✓'); setModal(null); fetchUsers();
              }} onClose={() => setModal(null)} />
            )}
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position:'fixed', bottom:'24px', right:'24px', background:'var(--mf-dark)', color:'white', padding:'12px 20px', borderRadius:'var(--r)', fontSize:'13px', fontWeight:'600', boxShadow:'var(--shadow-lg)', animation:'fadeUp .3s ease', zIndex:1000 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function EditUserForm({ user, onUpdate, onClose }) {
  const [pwd, setPwd] = useState('');
  return (
    <div>
      <p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'16px' }}>Laisse le mot de passe vide pour ne pas le modifier.</p>
      <div className="field"><label>Nouveau mot de passe</label><input className="input" type="password" placeholder="Nouveau mot de passe…" value={pwd} onChange={e=>setPwd(e.target.value)} /></div>
      <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'8px' }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary btn-sm" onClick={() => onUpdate({ password: pwd })}>Sauvegarder</button>
      </div>
    </div>
  );
}
