// pages/app/index.js  — Freelance workspace
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../_app';
import { supabase } from '../../lib/supabase';

const SECTORS = [
  {v:"Accounting",l:"Accounting — Expertise comptable"},
  {v:"Airlines/Aviation",l:"Airlines / Aviation — Aviation"},
  {v:"Architecture & Planning",l:"Architecture & Planning — Architecture"},
  {v:"Automotive",l:"Automotive — Automobile"},
  {v:"Banking",l:"Banking — Banque"},
  {v:"Biotechnology",l:"Biotechnology — Biotechnologie"},
  {v:"Building Materials",l:"Building Materials — Matériaux de construction"},
  {v:"Civil Engineering",l:"Civil Engineering — Génie civil"},
  {v:"Computer Software",l:"Computer Software — Logiciels"},
  {v:"Construction",l:"Construction — BTP"},
  {v:"Consumer Goods",l:"Consumer Goods — Biens de consommation"},
  {v:"Design",l:"Design"},
  {v:"E-Learning",l:"E-Learning — Formation en ligne"},
  {v:"Education Management",l:"Education Management — Éducation"},
  {v:"Environmental Services",l:"Environmental Services — Environnement"},
  {v:"Events Services",l:"Events Services — Événementiel"},
  {v:"Financial Services",l:"Financial Services — Services financiers"},
  {v:"Food & Beverages",l:"Food & Beverages — Alimentation"},
  {v:"Food Production",l:"Food Production — Production alimentaire"},
  {v:"Health, Wellness and Fitness",l:"Health, Wellness and Fitness — Santé & Bien-être"},
  {v:"Higher Education",l:"Higher Education — Enseignement supérieur"},
  {v:"Hospital & Health Care",l:"Hospital & Health Care — Hôpital & Santé"},
  {v:"Hospitality",l:"Hospitality — Hôtellerie & Restauration"},
  {v:"Human Resources",l:"Human Resources — Ressources humaines"},
  {v:"Import and Export",l:"Import and Export — Import / Export"},
  {v:"Individual & Family Services",l:"Individual & Family Services — Services à la personne"},
  {v:"Information Technology and Services",l:"Information Technology — Informatique & IT"},
  {v:"Insurance",l:"Insurance — Assurance"},
  {v:"Internet",l:"Internet"},
  {v:"Investment Management",l:"Investment Management — Gestion d'investissements"},
  {v:"Law Practice",l:"Law Practice — Cabinet juridique"},
  {v:"Legal Services",l:"Legal Services — Services juridiques"},
  {v:"Leisure, Travel & Tourism",l:"Leisure, Travel & Tourism — Tourisme"},
  {v:"Logistics and Supply Chain",l:"Logistics and Supply Chain — Logistique"},
  {v:"Management Consulting",l:"Management Consulting — Conseil en management"},
  {v:"Manufacturing",l:"Manufacturing — Industrie"},
  {v:"Marketing and Advertising",l:"Marketing and Advertising — Marketing & Pub"},
  {v:"Media Production",l:"Media Production — Production médias"},
  {v:"Medical Devices",l:"Medical Devices — Dispositifs médicaux"},
  {v:"Mental Health Care",l:"Mental Health Care — Santé mentale"},
  {v:"Music",l:"Music — Musique"},
  {v:"Non-Profit Organization Management",l:"Non-Profit — Association / ONG"},
  {v:"Online Media",l:"Online Media — Médias en ligne"},
  {v:"Pharmaceuticals",l:"Pharmaceuticals — Pharmaceutique"},
  {v:"Photography",l:"Photography — Photographie"},
  {v:"Professional Training & Coaching",l:"Professional Training & Coaching — Formation"},
  {v:"Public Relations and Communications",l:"Public Relations — Communication"},
  {v:"Publishing",l:"Publishing — Édition"},
  {v:"Real Estate",l:"Real Estate — Immobilier"},
  {v:"Renewables & Environment",l:"Renewables & Environment — Énergies renouvelables"},
  {v:"Research",l:"Research — Recherche"},
  {v:"Restaurants",l:"Restaurants — Restauration"},
  {v:"Retail",l:"Retail — Commerce de détail"},
  {v:"Security and Investigations",l:"Security — Sécurité"},
  {v:"Staffing and Recruiting",l:"Staffing and Recruiting — Recrutement"},
  {v:"Telecommunications",l:"Telecommunications — Télécommunications"},
  {v:"Transportation/Trucking/Railroad",l:"Transportation — Transport & Logistique"},
  {v:"Venture Capital & Private Equity",l:"Venture Capital & Private Equity"},
  {v:"Wholesale",l:"Wholesale — Commerce de gros"},
  {v:"Wine and Spirits",l:"Wine and Spirits — Vins & Spiritueux"},
  {v:"Writing and Editing",l:"Writing and Editing — Rédaction"},
].sort((a,b) => a.l.localeCompare(b.l));

function SectorSearch({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = SECTORS.find(s => s.v === value);
  const filtered = SECTORS.filter(s => s.l.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div className="input" style={{ cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }} onClick={() => setOpen(!open)}>
        <span style={{ color: selected ? 'var(--text)' : 'var(--muted)' }}>{selected ? selected.l : '-- Choisir un secteur --'}</span>
        <span style={{ color:'var(--muted)', fontSize:'12px' }}>▾</span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1.5px solid var(--mf-blue)', borderRadius:'var(--r)', zIndex:100, boxShadow:'var(--shadow)', marginTop:'4px' }}>
          <div style={{ padding:'8px' }}>
            <input className="input" placeholder="Rechercher un secteur..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ marginBottom:0 }} />
          </div>
          <div style={{ maxHeight:'200px', overflowY:'auto' }}>
            {filtered.map(s => (
              <div key={s.v} onClick={() => { onChange(s.v); setOpen(false); setSearch(''); }}
                style={{ padding:'9px 14px', fontSize:'12px', cursor:'pointer', background: value===s.v ? 'var(--mf-blue-lt)' : 'white', color: value===s.v ? 'var(--mf-blue)' : 'var(--text)', fontWeight: value===s.v ? '600' : '400' }}
                onMouseOver={e => e.currentTarget.style.background='var(--mf-blue-lt)'}
                onMouseOut={e => e.currentTarget.style.background = value===s.v ? 'var(--mf-blue-lt)' : 'white'}>
                {s.l}
              </div>
            ))}
            {!filtered.length && <div style={{ padding:'12px', color:'var(--muted)', fontSize:'12px', textAlign:'center' }}>Aucun résultat</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppPage() {
  const { profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile?.role === 'admin') router.push('/admin');
  }, [loading, profile]);

  useEffect(() => { if (profile) fetchCampaigns(); }, [profile]);

  async function fetchCampaigns() {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns(data || []);
  }

  async function deleteCampaign(id) {
    if (!confirm('Supprimer ce dossier et toutes ses données ?')) return;
    const { data } = await supabase.auth.getSession();
    await fetch(`/api/campaigns/${id}`, { method:'DELETE', headers:{ 'Authorization':`Bearer ${data.session?.access_token}` } });
    showToast('Dossier supprime.');
    fetchCampaigns();
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  if (loading || !profile) return <div style={{ display:'grid', placeItems:'center', height:'100vh', color:'var(--muted)' }}>Chargement...</div>;

  const name = profile.full_name || profile.email?.split('@')[0] || 'Freelance';

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{ width:'220px', background:'var(--mf-dark)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'9px', marginBottom:'10px' }}>
            <div style={{ width:'30px', height:'30px', background:'var(--mf-blue)', borderRadius:'7px', display:'grid', placeItems:'center' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.5 5.5H18l-4.5 3.5 2 6L10 13.5 4.5 17l2-6L2 7.5h5.5L10 2z" fill="white" opacity=".92"/></svg>
            </div>
            <div>
              <div style={{ fontSize:'13px', fontWeight:'800', color:'white' }}>Mission<span style={{ color:'#7eb3ff' }}>Freelances</span></div>
              <div style={{ fontSize:'10px', color:'rgba(255,255,255,.4)' }}>mission-freelances.com</div>
            </div>
          </div>
          <div style={{ background:'rgba(26,86,240,.3)', border:'1px solid rgba(26,86,240,.5)', borderRadius:'6px', padding:'3px 9px', fontSize:'11px', fontWeight:'700', color:'#7eb3ff', display:'inline-block' }}>Mission Data</div>
        </div>
        <nav style={{ flex:1, padding:'14px 10px' }}>
          <div style={{ fontSize:'9px', fontWeight:'700', letterSpacing:'1.5px', textTransform:'uppercase', color:'rgba(255,255,255,.3)', padding:'10px 8px 5px' }}>Mes dossiers</div>
          <button onClick={() => setShowNew(true)} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 10px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'600', border:'1px dashed rgba(255,255,255,.15)', textAlign:'left', width:'100%', background:'none', color:'rgba(255,255,255,.5)', margin:'2px 0', transition:'all .15s' }}
            onMouseOver={e=>{e.currentTarget.style.background='rgba(26,86,240,.25)';e.currentTarget.style.color='white';}}
            onMouseOut={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='rgba(255,255,255,.5)';}}>
            <span style={{ fontSize:'16px' }}>+</span> Nouveau dossier
          </button>
          <div style={{ marginTop:'6px', display:'flex', flexDirection:'column', gap:'2px' }}>
            {campaigns.slice(0,8).map(c => (
              <button key={c.id} onClick={() => router.push(`/app/campaign/${c.id}`)}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'7px', cursor:'pointer', fontSize:'12px', fontWeight:'600', border:'none', textAlign:'left', width:'100%', background:'none', color:'rgba(255,255,255,.55)', transition:'all .15s', overflow:'hidden' }}
                onMouseOver={e=>{e.currentTarget.style.background='rgba(255,255,255,.07)';e.currentTarget.style.color='white';}}
                onMouseOut={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='rgba(255,255,255,.55)';}}>
                <span style={{ fontSize:'12px', flexShrink:0 }}>{c.status==='done'?'✅':c.status==='generating'?'⏳':'📝'}</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
              </button>
            ))}
          </div>
        </nav>
        <div style={{ padding:'14px 10px', borderTop:'1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 10px', background:'rgba(255,255,255,.06)', borderRadius:'8px', marginBottom:'6px' }}>
            <div style={{ width:'26px', height:'26px', background:'linear-gradient(135deg,var(--mf-blue),var(--mf-blue-md))', borderRadius:'7px', display:'grid', placeItems:'center', fontSize:'11px', fontWeight:'800', color:'white', flexShrink:0 }}>{name[0].toUpperCase()}</div>
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
              <div style={{ fontSize:'10px', color:'rgba(255,255,255,.4)' }}>Freelance</div>
            </div>
          </div>
          <button onClick={signOut} style={{ width:'100%', padding:'8px', borderRadius:'7px', background:'none', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.5)', fontSize:'12px', cursor:'pointer', fontFamily:'Figtree,sans-serif' }}>Deconnexion</button>
        </div>
      </aside>

      <main style={{ flex:1, padding:'28px', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'10px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', marginBottom:'4px' }}>Bonjour {name} !</h1>
            <p style={{ fontSize:'13px', color:'var(--muted)' }}>Tes dossiers de prospection</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Nouveau dossier</button>
        </div>

        {campaigns.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--muted)' }}>
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>📁</div>
            <div style={{ fontSize:'18px', fontWeight:'700', color:'var(--text2)', marginBottom:'8px' }}>Aucun dossier</div>
            <p style={{ fontSize:'13px', lineHeight:'1.6', marginBottom:'20px' }}>Cree ton premier dossier en decrivant un client existant.</p>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>Creer mon premier dossier</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'14px' }}>
            {campaigns.map(c => (
              <div key={c.id} className="card" style={{ cursor:'pointer', transition:'all .15s', borderColor:'var(--border)' }}
                onMouseOver={e => e.currentTarget.style.borderColor='var(--mf-blue)'}
                onMouseOut={e => e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px' }}>
                  <div style={{ fontSize:'20px' }}>{c.status==='done'?'✅':c.status==='generating'?'⏳':'📝'}</div>
                  <span className={`badge badge-${c.status==='done'?'green':c.status==='generating'?'blue':'muted'}`} style={{ fontSize:'10px' }}>
                    {c.status==='done'?'Termine':c.status==='generating'?'En cours':'Brouillon'}
                  </span>
                </div>
                <div style={{ fontSize:'15px', fontWeight:'700', marginBottom:'6px' }}>{c.name}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)', lineHeight:'1.6', marginBottom:'14px' }}>
                  {c.client_sector && <span>🏭 {c.client_sector}</span>}
                  {c.client_location && <span> · 📍 {c.client_location}</span>}
                  {c.client_need && <><br /><span>🎯 {c.client_need}</span></>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
                  {c.prospects_count > 0 && <span className="badge badge-blue" style={{ fontSize:'10px' }}>👤 {c.prospects_count} prospects</span>}
                  {c.sequences_count > 0 && <span className="badge badge-green" style={{ fontSize:'10px' }}>✉️ {c.sequences_count} sequences</span>}
                  <span style={{ fontSize:'11px', color:'var(--muted)', marginLeft:'auto' }}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={() => router.push(`/app/campaign/${c.id}`)}>Ouvrir →</button>
                  <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); router.push(`/app/campaign/${id}`); }} />}
      {toast && <div style={{ position:'fixed', bottom:'24px', right:'24px', background:'var(--mf-dark)', color:'white', padding:'12px 20px', borderRadius:'var(--r)', fontSize:'13px', fontWeight:'600', boxShadow:'var(--shadow-lg)', zIndex:1000 }}>{toast}</div>}
    </div>
  );
}

function NewCampaignModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name:'', client_type:'TPE', client_sector:'',
    client_location:'', client_need:'',
    freelance_result:'', freelance_kpi:'', freelance_angle:'', freelance_tone:'professionnel'
  });
  const f = (k,v) => setForm(p => ({...p,[k]:v}));

  async function create() {
    if (!form.name || !form.client_sector) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch('/api/campaigns', { method:'POST', headers:{ 'Authorization':`Bearer ${s.session?.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify(form) });
    const d = await r.json();
    if (d.campaign) onCreated(d.campaign.id);
    setSaving(false);
  }

  const inp = (k, props={}) => <input className="input" value={form[k]} onChange={e=>f(k,e.target.value)} {...props} />;
  const sel = (k, opts) => <select className="input" value={form[k]} onChange={e=>f(k,e.target.value)}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>;
  const ta = (k, props={}) => <textarea className="input" value={form[k]} onChange={e=>f(k,e.target.value)} {...props} />;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(13,27,62,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:'24px' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'32px', width:'100%', maxWidth:'540px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(13,27,62,.2)' }}>
        <div style={{ display:'flex', gap:'6px', marginBottom:'24px' }}>
          {[1,2].map(n => (
            <div key={n} style={{ flex:1, height:'4px', borderRadius:'99px', background: step>=n ? 'var(--mf-blue)' : 'var(--border)', transition:'background .3s' }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 style={{ fontSize:'16px', fontWeight:'800', marginBottom:'4px' }}>📁 Nouveau dossier</h2>
            <p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'20px' }}>Decris un client existant — Mission Data va chercher ses concurrents.</p>
            <div className="field"><label>Nom du dossier *</label>{inp('name', { placeholder:'Ex : Dirigeants Assurance Bretagne' })}</div>
            <div className="field">
              <label>Type de client</label>
              {sel('client_type',[
                {v:'TPE',l:'TPE (1-10 salaries)'},
                {v:'PME',l:'PME (11-250 salaries)'},
                {v:'ETI',l:'ETI (250-5000 salaries)'},
                {v:'Grande entreprise',l:'Grande entreprise (5000+)'},
                {v:'Independant',l:'Independant / Freelance'},
              ])}
            </div>
            <div className="field">
              <label>Secteur d activite *</label>
              <SectorSearch value={form.client_sector} onChange={v => f('client_sector', v)} />
            </div>
            <div className="field"><label>Localisation</label>{inp('client_location', { placeholder:'Ex : Rennes, Paris, Lyon...' })}</div>
            <div className="field"><label>Besoin identifie</label>{inp('client_need', { placeholder:'Ex : Site web, Redaction, Communication...' })}</div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={() => setStep(2)} disabled={!form.name||!form.client_sector}>Suivant →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize:'16px', fontWeight:'800', marginBottom:'4px' }}>💡 Tes resultats et cas client</h2>
            <p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'20px' }}>Ces elements serviront a personnaliser chaque message de prospection.</p>
            <div className="field"><label>Resultat obtenu pour un client similaire</label>{ta('freelance_result', { placeholder:'Ex : Refonte du site d une agence assurance +40% de leads en 3 mois', rows:3 })}</div>
            <div className="field"><label>Chiffre cle / KPI</label>{inp('freelance_kpi', { placeholder:'Ex : +40% de leads, 3x plus de visibilite...' })}</div>
            <div className="field"><label>Ton angle differenciateur</label>{inp('freelance_angle', { placeholder:'Ex : Specialiste secteur assurance depuis 5 ans...' })}</div>
            <div className="field">
              <label>Ton souhaite dans les messages</label>
              {sel('freelance_tone',[
                {v:'professionnel',l:'Professionnel'},
                {v:'chaleureux',l:'Chaleureux'},
                {v:'direct',l:'Direct'},
                {v:'expert',l:'Expert'},
              ])}
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Retour</button>
              <button className="btn btn-primary btn-sm" onClick={create} disabled={saving}>
                {saving ? <div className="spinner" /> : null}Creer le dossier
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
