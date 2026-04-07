import { LogoIcon } from '../../lib/Logo';
// pages/app/index.js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../_app';
import { supabase } from '../../lib/supabase';

const SECTORS = [
  {v:"Accounting",l:"Accounting — Expertise comptable"},
  {v:"Airlines/Aviation",l:"Airlines/Aviation — Aviation"},
  {v:"Alternative Dispute Resolution",l:"Alternative Dispute Resolution"},
  {v:"Alternative Medicine",l:"Alternative Medicine — Médecine alternative"},
  {v:"Animation",l:"Animation"},
  {v:"Apparel & Fashion",l:"Apparel & Fashion — Mode"},
  {v:"Architecture & Planning",l:"Architecture & Planning — Architecture"},
  {v:"Arts and Crafts",l:"Arts and Crafts — Arts & Artisanat"},
  {v:"Automotive",l:"Automotive — Automobile"},
  {v:"Aviation & Aerospace",l:"Aviation & Aerospace — Aérospatiale"},
  {v:"Banking",l:"Banking — Banque"},
  {v:"Biotechnology",l:"Biotechnology — Biotechnologie"},
  {v:"Broadcast Media",l:"Broadcast Media — Médias"},
  {v:"Building Materials",l:"Building Materials — Matériaux de construction"},
  {v:"Business Supplies and Equipment",l:"Business Supplies and Equipment"},
  {v:"Capital Markets",l:"Capital Markets — Marchés financiers"},
  {v:"Chemicals",l:"Chemicals — Chimie"},
  {v:"Civic & Social Organization",l:"Civic & Social Organization"},
  {v:"Civil Engineering",l:"Civil Engineering — Génie civil"},
  {v:"Commercial Real Estate",l:"Commercial Real Estate — Immobilier commercial"},
  {v:"Computer & Network Security",l:"Computer & Network Security — Cybersécurité"},
  {v:"Computer Games",l:"Computer Games — Jeux vidéo"},
  {v:"Computer Hardware",l:"Computer Hardware — Matériel informatique"},
  {v:"Computer Networking",l:"Computer Networking — Réseaux"},
  {v:"Computer Software",l:"Computer Software — Logiciels"},
  {v:"Construction",l:"Construction — BTP"},
  {v:"Consumer Electronics",l:"Consumer Electronics — Électronique grand public"},
  {v:"Consumer Goods",l:"Consumer Goods — Biens de consommation"},
  {v:"Consumer Services",l:"Consumer Services — Services aux particuliers"},
  {v:"Cosmetics",l:"Cosmetics — Cosmétique"},
  {v:"Dairy",l:"Dairy — Produits laitiers"},
  {v:"Defense & Space",l:"Defense & Space — Défense & Spatial"},
  {v:"Design",l:"Design"},
  {v:"E-Learning",l:"E-Learning — Formation en ligne"},
  {v:"Education Management",l:"Education Management — Éducation"},
  {v:"Electrical/Electronic Manufacturing",l:"Electrical/Electronic Manufacturing — Électronique"},
  {v:"Entertainment",l:"Entertainment — Divertissement"},
  {v:"Environmental Services",l:"Environmental Services — Environnement"},
  {v:"Events Services",l:"Events Services — Événementiel"},
  {v:"Executive Office",l:"Executive Office — Direction générale"},
  {v:"Facilities Services",l:"Facilities Services — Services aux entreprises"},
  {v:"Farming",l:"Farming — Agriculture"},
  {v:"Financial Services",l:"Financial Services — Services financiers"},
  {v:"Fine Art",l:"Fine Art — Beaux-arts"},
  {v:"Fishery",l:"Fishery — Pêche"},
  {v:"Food & Beverages",l:"Food & Beverages — Alimentation & Boissons"},
  {v:"Food Production",l:"Food Production — Production alimentaire"},
  {v:"Fund-Raising",l:"Fund-Raising — Collecte de fonds"},
  {v:"Furniture",l:"Furniture — Mobilier"},
  {v:"Gambling & Casinos",l:"Gambling & Casinos"},
  {v:"Glass, Ceramics & Concrete",l:"Glass, Ceramics & Concrete"},
  {v:"Government Administration",l:"Government Administration — Administration publique"},
  {v:"Government Relations",l:"Government Relations — Relations gouvernementales"},
  {v:"Graphic Design",l:"Graphic Design — Design graphique"},
  {v:"Health, Wellness and Fitness",l:"Health, Wellness and Fitness — Santé & Bien-être"},
  {v:"Higher Education",l:"Higher Education — Enseignement supérieur"},
  {v:"Hospital & Health Care",l:"Hospital & Health Care — Hôpital & Santé"},
  {v:"Hospitality",l:"Hospitality — Hôtellerie & Restauration"},
  {v:"Human Resources",l:"Human Resources — Ressources humaines"},
  {v:"Import and Export",l:"Import and Export — Import/Export"},
  {v:"Individual & Family Services",l:"Individual & Family Services — Services à la personne"},
  {v:"Industrial Automation",l:"Industrial Automation — Automatisation industrielle"},
  {v:"Information Services",l:"Information Services — Services d'information"},
  {v:"Information Technology and Services",l:"Information Technology and Services — IT"},
  {v:"Insurance",l:"Insurance — Assurance"},
  {v:"International Affairs",l:"International Affairs — Affaires internationales"},
  {v:"International Trade and Development",l:"International Trade and Development"},
  {v:"Internet",l:"Internet"},
  {v:"Investment Banking",l:"Investment Banking — Banque d'investissement"},
  {v:"Investment Management",l:"Investment Management — Gestion d'investissements"},
  {v:"Judiciary",l:"Judiciary — Justice"},
  {v:"Law Enforcement",l:"Law Enforcement — Forces de l'ordre"},
  {v:"Law Practice",l:"Law Practice — Cabinet juridique"},
  {v:"Legal Services",l:"Legal Services — Services juridiques"},
  {v:"Legislative Office",l:"Legislative Office — Législatif"},
  {v:"Leisure, Travel & Tourism",l:"Leisure, Travel & Tourism — Tourisme"},
  {v:"Libraries",l:"Libraries — Bibliothèques"},
  {v:"Logistics and Supply Chain",l:"Logistics and Supply Chain — Logistique"},
  {v:"Luxury Goods & Jewelry",l:"Luxury Goods & Jewelry — Luxe & Joaillerie"},
  {v:"Machinery",l:"Machinery — Machines & Équipements"},
  {v:"Management Consulting",l:"Management Consulting — Conseil en management"},
  {v:"Maritime",l:"Maritime"},
  {v:"Market Research",l:"Market Research — Études de marché"},
  {v:"Marketing and Advertising",l:"Marketing and Advertising — Marketing & Publicité"},
  {v:"Mechanical or Industrial Engineering",l:"Mechanical or Industrial Engineering — Génie industriel"},
  {v:"Media Production",l:"Media Production — Production médias"},
  {v:"Medical Devices",l:"Medical Devices — Dispositifs médicaux"},
  {v:"Medical Practice",l:"Medical Practice — Cabinet médical"},
  {v:"Mental Health Care",l:"Mental Health Care — Santé mentale"},
  {v:"Military",l:"Military — Militaire"},
  {v:"Mining & Metals",l:"Mining & Metals — Mines & Métaux"},
  {v:"Motion Pictures and Film",l:"Motion Pictures and Film — Cinéma"},
  {v:"Museums and Institutions",l:"Museums and Institutions — Musées"},
  {v:"Music",l:"Music — Musique"},
  {v:"Nanotechnology",l:"Nanotechnology — Nanotechnologie"},
  {v:"Newspapers",l:"Newspapers — Presse"},
  {v:"Non-Profit Organization Management",l:"Non-Profit Organization Management — ONG/Association"},
  {v:"Oil & Energy",l:"Oil & Energy — Pétrole & Énergie"},
  {v:"Online Media",l:"Online Media — Médias en ligne"},
  {v:"Outsourcing/Offshoring",l:"Outsourcing/Offshoring — Externalisation"},
  {v:"Package/Freight Delivery",l:"Package/Freight Delivery — Livraison & Fret"},
  {v:"Packaging and Containers",l:"Packaging and Containers — Emballage"},
  {v:"Paper & Forest Products",l:"Paper & Forest Products — Papier & Forêt"},
  {v:"Performing Arts",l:"Performing Arts — Arts du spectacle"},
  {v:"Pharmaceuticals",l:"Pharmaceuticals — Pharmaceutique"},
  {v:"Philanthropy",l:"Philanthropy — Philanthropie"},
  {v:"Photography",l:"Photography — Photographie"},
  {v:"Plastics",l:"Plastics — Plastiques"},
  {v:"Political Organization",l:"Political Organization — Organisation politique"},
  {v:"Primary/Secondary Education",l:"Primary/Secondary Education — Enseignement primaire/secondaire"},
  {v:"Printing",l:"Printing — Imprimerie"},
  {v:"Professional Training & Coaching",l:"Professional Training & Coaching — Formation professionnelle"},
  {v:"Program Development",l:"Program Development — Développement de programmes"},
  {v:"Public Policy",l:"Public Policy — Politiques publiques"},
  {v:"Public Relations and Communications",l:"Public Relations and Communications — Communication"},
  {v:"Public Safety",l:"Public Safety — Sécurité publique"},
  {v:"Publishing",l:"Publishing — Édition"},
  {v:"Railroad Manufacture",l:"Railroad Manufacture — Fabrication ferroviaire"},
  {v:"Ranching",l:"Ranching — Élevage"},
  {v:"Real Estate",l:"Real Estate — Immobilier"},
  {v:"Recreational Facilities and Services",l:"Recreational Facilities and Services — Loisirs"},
  {v:"Religious Institutions",l:"Religious Institutions — Institutions religieuses"},
  {v:"Renewables & Environment",l:"Renewables & Environment — Énergies renouvelables"},
  {v:"Research",l:"Research — Recherche"},
  {v:"Restaurants",l:"Restaurants — Restauration"},
  {v:"Retail",l:"Retail — Commerce de détail"},
  {v:"Security and Investigations",l:"Security and Investigations — Sécurité"},
  {v:"Semiconductors",l:"Semiconductors — Semi-conducteurs"},
  {v:"Shipbuilding",l:"Shipbuilding — Construction navale"},
  {v:"Sporting Goods",l:"Sporting Goods — Articles de sport"},
  {v:"Sports",l:"Sports"},
  {v:"Staffing and Recruiting",l:"Staffing and Recruiting — Recrutement"},
  {v:"Supermarkets",l:"Supermarkets — Grande distribution"},
  {v:"Telecommunications",l:"Telecommunications — Télécommunications"},
  {v:"Textiles",l:"Textiles"},
  {v:"Think Tanks",l:"Think Tanks"},
  {v:"Tobacco",l:"Tobacco — Tabac"},
  {v:"Translation and Localization",l:"Translation and Localization — Traduction"},
  {v:"Transportation/Trucking/Railroad",l:"Transportation/Trucking/Railroad — Transport"},
  {v:"Utilities",l:"Utilities — Services publics"},
  {v:"Venture Capital & Private Equity",l:"Venture Capital & Private Equity"},
  {v:"Veterinary",l:"Veterinary — Vétérinaire"},
  {v:"Warehousing",l:"Warehousing — Entreposage"},
  {v:"Wholesale",l:"Wholesale — Commerce de gros"},
  {v:"Wine and Spirits",l:"Wine and Spirits — Vins & Spiritueux"},
  {v:"Wireless",l:"Wireless — Sans fil"},
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
      <aside style={{ width: '240px', background: 'white', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LogoIcon size={34} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Mission Data</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>mission-freelances.com</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted)', padding: '8px 8px 4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Prospection</div>
          <button style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 10px', borderRadius: 'var(--r)', background: 'var(--mf-blue-lt)', color: 'var(--mf-blue)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', textAlign: 'left' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
            Mes dossiers
            <span style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #0090FF, #0070CC)', color: 'white', borderRadius: '20px', padding: '1px 7px', fontSize: '11px' }}>{campaigns.length}</span>
          </button>
        </nav>
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--r)', marginBottom: '4px' }}>
            <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #0090FF, #0070CC)', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0 }}>{name[0].toUpperCase()}</div>
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

      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '2px' }}>Mes dossiers</h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Chaque dossier génère une base de prospects + séquence de prospection</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
            Nouveau dossier
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', background: 'white', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--mf-blue-lt)', borderRadius: '12px', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="var(--mf-blue)"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Aucun dossier</div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Crée ton premier dossier — 30 secondes chrono.</p>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>Créer mon premier dossier</button>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 110px 44px', padding: '10px 20px', fontSize: '10px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <span>Dossier</span>
              <span>Secteur</span>
              <span>Domaine</span>
              <span style={{ textAlign:'center' }}>Prospects</span>
              <span style={{ textAlign:'center' }}>Séquence</span>
              <span>Date</span>
              <span></span>
            </div>
            {campaigns.map((c, i) => (
              <div key={c.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 110px 44px', padding: '0', background: 'white', borderBottom: i < campaigns.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'stretch', cursor: 'pointer', transition: 'background .1s' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--mf-blue-lt)'}
                onMouseOut={e => e.currentTarget.style.background = 'white'}
                onClick={() => router.push(`/app/campaign/${c.id}`)}>
                {/* Nom */}
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{c.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {c.client_location && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>📍 {c.client_location}</span>}
                    <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '20px', fontWeight: '600',
                      background: c.status === 'done' ? '#f0fdf4' : 'var(--surface)',
                      color: c.status === 'done' ? '#15803d' : 'var(--muted)' }}>
                      {c.status === 'done' ? 'Terminé' : 'Brouillon'}
                    </span>
                  </div>
                </div>
                {/* Secteur */}
                <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.client_sector || <span style={{ color: 'var(--border)' }}>—</span>}</span>
                </div>
                {/* Domaine */}
                <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.job_title_target || <span style={{ color: 'var(--border)' }}>—</span>}</span>
                </div>
                {/* Prospects */}
                <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.prospects_count > 0
                    ? <span style={{ background: 'var(--mf-blue-lt)', color: 'var(--mf-blue)', borderRadius: '20px', padding: '3px 11px', fontSize: '12px', fontWeight: '700' }}>{c.prospects_count}</span>
                    : <span style={{ color: 'var(--border)' }}>—</span>}
                </div>
                {/* Séquence */}
                <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.sequences_count > 0
                    ? <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: '20px', padding: '3px 11px', fontSize: '12px', fontWeight: '700' }}>✓</span>
                    : <span style={{ color: 'var(--border)' }}>—</span>}
                </div>
                {/* Date */}
                <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                {/* Supprimer */}
                <div style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                  <button
                    style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'grid', placeItems: 'center' }}
                    onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }}
                    onMouseOver={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onCreated={id => { setShowNew(false); showToast('Dossier créé !'); router.push(`/app/campaign/${id}`); }} />}
      {toast && <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#0090FF', color: 'white', padding: '10px 16px', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: '500', boxShadow: 'var(--shadow)', zIndex: 1000 }}>{toast}</div>}
    </div>
  );
}

// ─── MODAL CRÉATION 1 ÉTAPE ────────────────────────────────────────────────────
function NewCampaignModal({ onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', job_title_target: '', prospect_limit: 10,
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const canSubmit = form.name && form.job_title_target;

  async function create() {
    if (!canSubmit) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${s.session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, status: 'draft' })
    });
    const d = await r.json();
    if (d.campaign) onCreated(d.campaign.id);
    setSaving(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '24px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>Nouveau dossier</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>30 secondes — tu pourras affiner dans le dossier</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>
          <div className="field">
            <label>Nom du dossier *</label>
            <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Ex : DAF Banque Île-de-France" autoFocus />
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
          <div className="field">
            <label>Taille de la liste</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[10, 25, 50].map(n => (
                <button key={n} type="button" onClick={() => f('prospect_limit', n)}
                  style={{ flex: 1, padding: '9px', borderRadius: 'var(--r)', border: form.prospect_limit === n ? '2px solid var(--mf-blue)' : '1px solid var(--border)', background: form.prospect_limit === n ? 'var(--mf-blue-lt)' : 'white', color: form.prospect_limit === n ? 'var(--mf-blue)' : 'var(--text2)', fontWeight: form.prospect_limit === n ? '700' : '500', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {n} prospects
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={create} disabled={!canSubmit || saving}>
              {saving ? <div className="spinner" /> : null}
              Créer le dossier →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
