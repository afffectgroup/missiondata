import { LogoIcon } from '../../lib/Logo';
// pages/app/index.js
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
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="input" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setOpen(!open)}>
        <span style={{ color: selected ? 'var(--text)' : 'var(--muted)' }}>{selected ? selected.l : 'Choisir un secteur...'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r)', zIndex: 100, boxShadow: 'var(--shadow)' }}>
          <div style={{ padding: '8px' }}>
            <input className="input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ marginBottom: 0 }} />
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.map(s => (
              <div key={s.v} onClick={() => { onChange(s.v); setOpen(false); setSearch(''); }}
                style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', background: value === s.v ? 'var(--mf-blue-lt)' : 'white', color: value === s.v ? 'var(--mf-blue)' : 'var(--text)', fontWeight: value === s.v ? '600' : '400' }}
                onMouseOver={e => { if (value !== s.v) e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseOut={e => { if (value !== s.v) e.currentTarget.style.background = 'white'; }}>
                {s.l}
              </div>
            ))}
            {!filtered.length && <div style={{ padding: '12px', color: 'var(--muted)', fontSize: '13px', textAlign: 'center' }}>Aucun résultat</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { icon: <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"/></svg>, label: 'Dossiers', key: 'dossiers' },
];

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
    if (!confirm('Supprimer ce dossier ?')) return;
    const { data } = await supabase.auth.getSession();
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${data.session?.access_token}` } });
    showToast('Dossier supprimé');
    fetchCampaigns();
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  if (loading || !profile) return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--muted)' }}>
      <div className="spinner spinner-dark" />
    </div>
  );

  const name = profile.full_name || profile.email?.split('@')[0] || 'Freelance';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* SIDEBAR */}
      <aside style={{ width: '240px', background: 'white', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LogoIcon size={34} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Mission Data</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>mission-freelances.com</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted)', padding: '8px 8px 4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Prospection</div>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 10px', borderRadius: 'var(--r)', background: 'var(--mf-blue-lt)', color: 'var(--mf-blue)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', textAlign: 'left' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
            Mes dossiers
            <span style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #1FC95A, #0F632D)', color: 'white', borderRadius: '20px', padding: '1px 7px', fontSize: '11px' }}>{campaigns.length}</span>
          </button>
        </nav>

        {/* User */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--r)', marginBottom: '4px' }}>
            <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #1FC95A, #0F632D)', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
              {name[0].toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Freelance</div>
            </div>
          </div>
          <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', borderRadius: 'var(--r)', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
            onMouseOut={e => e.currentTarget.style.background = 'none'}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', maxWidth: '1100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '2px' }}>Mes dossiers</h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Chaque dossier génère une base de prospects + séquences personnalisées</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
            Nouveau dossier
          </button>
        </div>

        {/* Empty state */}
        {campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', background: 'white', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--mf-blue-lt)', borderRadius: '12px', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="var(--mf-blue)"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Aucun dossier</div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Crée ton premier dossier en décrivant un client existant.</p>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>Créer mon premier dossier</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 100px 120px', gap: '16px', padding: '8px 16px', fontSize: '11px', fontWeight: '600', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Dossier</span>
              <span>Secteur</span>
              <span>Prospects</span>
              <span>Séquences</span>
              <span>Date</span>
            </div>
            {campaigns.map(c => (
              <div key={c.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 100px 120px', gap: '16px', padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r)', alignItems: 'center', cursor: 'pointer', transition: 'border-color .15s' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--mf-blue)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                onClick={() => router.push(`/app/campaign/${c.id}`)}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{c.name}</div>
                  {c.client_location && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{c.client_location}</div>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{c.client_sector || '—'}</div>
                <div>
                  {c.prospects_count > 0
                    ? <span className="badge badge-blue">{c.prospects_count}</span>
                    : <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>}
                </div>
                <div>
                  {c.sequences_count > 0
                    ? <span className="badge badge-green">{c.sequences_count}</span>
                    : <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                  <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }}>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onCreated={id => { setShowNew(false); router.push(`/app/campaign/${id}`); }} />}
      {toast && <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--text)', color: 'white', padding: '10px 16px', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: '500', boxShadow: 'var(--shadow)', zIndex: 1000 }}>{toast}</div>}
    </div>
  );
}

function NewCampaignModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', client_type: 'PME', client_sector: '', job_title_target: '', client_location: '', prospect_limit: 10,
    client_need: '', freelance_result: '', freelance_kpi: '', freelance_angle: '', freelance_tone: 'professionnel'
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function create() {
    if (!form.name || !form.client_sector) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${s.session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const d = await r.json();
    if (d.campaign) onCreated(d.campaign.id);
    setSaving(false);
  }

  const inp = (k, props = {}) => <input className="input" value={form[k]} onChange={e => f(k, e.target.value)} {...props} />;
  const sel = (k, opts) => (
    <select className="input" value={form[k]} onChange={e => f(k, e.target.value)}>
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  const ta = (k, props = {}) => <textarea className="input" value={form[k]} onChange={e => f(k, e.target.value)} {...props} />;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '24px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>

        {/* Modal header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>{step === 1 ? 'Nouveau dossier' : 'Ton profil de résultats'}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Étape {step} sur 2</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 24px' }}>
          {[1, 2].map(n => <div key={n} style={{ flex: 1, height: '3px', borderRadius: '99px', background: step >= n ? 'var(--mf-blue)' : 'var(--border)', transition: 'background .3s' }} />)}
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {step === 1 && (
            <>
              <div className="field"><label>Nom du dossier *</label>{inp('name', { placeholder: 'Ex : Dirigeants Assurance Bretagne' })}</div>
              <div className="field">
                <label>Type de client</label>
                {sel('client_type', [
                  { v: 'TPE', l: 'TPE (1-10 salariés)' },
                  { v: 'PME', l: 'PME (11-250 salariés)' },
                  { v: 'ETI', l: 'ETI (250-5000 salariés)' },
                  { v: 'Grande entreprise', l: 'Grande entreprise (5000+)' },
                  { v: 'Indépendant', l: 'Indépendant / Freelance' },
                ])}
              </div>
              <div className="field">
                <label>Secteur d'activité *</label>
                <SectorSearch value={form.client_sector} onChange={v => f('client_sector', v)} />
              </div>
              <div className="field">
                <label>Domaine de poste ciblé *</label>
                <select className="input" value={form.job_title_target} onChange={e => f('job_title_target', e.target.value)}>
                  <option value="">-- Choisir un domaine --</option>
                  <option value="Direction générale">Direction générale</option>
                  <option value="Direction financière">Direction financière</option>
                  <option value="Direction commerciale">Direction commerciale</option>
                  <option value="Direction marketing">Direction marketing</option>
                  <option value="Direction RH">Direction RH</option>
                  <option value="Direction technique">Direction technique</option>
                  <option value="Direction opérations">Direction opérations</option>
                  <option value="Métiers juridiques">Métiers juridiques</option>
                  <option value="Métiers de santé">Métiers de santé</option>
                  <option value="Métiers immobilier">Métiers immobilier</option>
                  <option value="Métiers de la restauration">Métiers de la restauration</option>
                  <option value="Métiers artisanaux">Métiers artisanaux</option>
                </select>
              </div>
              <div className="field"><label>Localisation</label>{inp('client_location', { placeholder: 'Ex : Rennes, Paris, Lyon...' })}</div>
              <div className="field">
                <label>Taille de la liste</label>
                <div style={{ display:'flex', gap:'8px' }}>
                  {[10, 25, 50].map(n => (
                    <button key={n} type="button" onClick={() => f('prospect_limit', n)}
                      style={{ flex:1, padding:'9px', borderRadius:'var(--r)', border: form.prospect_limit===n ? '2px solid var(--mf-blue)' : '1px solid var(--border)', background: form.prospect_limit===n ? 'var(--mf-blue-lt)' : 'white', color: form.prospect_limit===n ? 'var(--mf-blue)' : 'var(--text2)', fontWeight: form.prospect_limit===n ? '700' : '500', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
                      {n} prospects
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
                <button className="btn btn-primary btn-sm" onClick={() => setStep(2)} disabled={!form.name || !form.client_sector || !form.job_title_target}>Suivant →</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="field"><label>Résultat obtenu pour un client similaire</label>{ta('freelance_result', { placeholder: 'Ex : Refonte du site d\'une agence → +40% de leads en 3 mois', rows: 3 })}</div>
              <div className="field"><label>Chiffre clé / KPI</label>{inp('freelance_kpi', { placeholder: 'Ex : +40% de leads, 3× plus de visibilité...' })}</div>
              <div className="field"><label>Ton angle différenciateur</label>{inp('freelance_angle', { placeholder: 'Ex : Spécialiste secteur assurance depuis 5 ans...' })}</div>
              <div className="field">
                <label>Ton des messages</label>
                {sel('freelance_tone', [
                  { v: 'professionnel', l: 'Professionnel' },
                  { v: 'chaleureux', l: 'Chaleureux' },
                  { v: 'direct', l: 'Direct' },
                  { v: 'expert', l: 'Expert' },
                ])}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Retour</button>
                <button className="btn btn-primary btn-sm" onClick={create} disabled={saving}>
                  {saving ? <div className="spinner" /> : null}
                  Créer le dossier
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
// Tue Mar 17 10:18:19 UTC 2026
