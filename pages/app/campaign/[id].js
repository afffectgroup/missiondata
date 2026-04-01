import { LogoIcon } from '../../../lib/Logo';
// pages/app/campaign/[id].js — v2 with advanced filters + sequence wizard
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../_app';
import { supabase } from '../../../lib/supabase';

export default function CampaignPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [campaign, setCampaign] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [sequences, setSequences] = useState([]);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [toast, setToast] = useState('');
  const [selectedTitles, setSelectedTitles] = useState([]);
  const [searchLimit, setSearchLimit] = useState(null);
  const [selected, setSelected] = useState([]);
  const [enriching, setEnriching] = useState(false);
  const [reserveWithEmail, setReserveWithEmail] = useState(0);
  const [polling, setPolling] = useState(false);
  const [showSeqWizard, setShowSeqWizard] = useState(false);
  const [feLoading, setFeLoading] = useState({}); // { [prospectId]: 'email'|'phone'|'both' }
  const [fePopover, setFePopover] = useState(null); // prospectId with open popover
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');

  async function saveName() {
    if (!nameVal.trim()) { setEditingName(false); return; }
    const token = await getToken();
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameVal.trim() }),
    });
    showToast('Dossier renommé ✓');
    setEditingName(false);
    await load();
  }

  // Advanced filters
  const [filters, setFilters] = useState({
    sector: campaign?.client_sector || '',
    location: campaign?.client_location || '',
    companySize: [],
    keywords: '',
    minTenure: '',
    maxTenure: '',
  });

  function toggleSelect(pid) { setSelected(p => p.includes(pid) ? p.filter(x => x !== pid) : [...p, pid]); }
  function toggleAll() { setSelected(p => p.length === visibleProspects.length ? [] : visibleProspects.map(p => p.id)); }

  async function deleteProspect(prospectId) {
    const token = await getToken();
    await fetch(`/api/prospects/${prospectId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setProspects(p => p.filter(x => x.id !== prospectId));
    setSelected(s => s.filter(x => x !== prospectId));
    showToast('Prospect supprimé');
  }

  async function generateMore() {
    const token = await getToken();
    const r = await fetch(`/api/campaigns/${id}/reserve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.ok) { showToast(d.revealed + ' nouveau' + (d.revealed > 1 ? 'x' : '') + ' prospect' + (d.revealed > 1 ? 's' : '') + ' avec email !'); setReserveWithEmail(0); await load(); }
    else showToast('Erreur : ' + (d.error || 'inconnue'));
  }

  async function collectEmails() {
    setEnriching(true);
    const token = await getToken();
    const ids = prospects.filter(p => p.icypeas_search_id && !p.email).map(p => p.id);
    if (!ids.length) { showToast('Aucune recherche en attente.'); setEnriching(false); return; }
    const r = await fetch('/api/prospects/enrich', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect_ids: ids, action: 'collect' }) });
    const d = await r.json();
    if (d.error) { showToast('Erreur : ' + d.error); setEnriching(false); return; }
    if (d.enriched > 0) showToast(d.enriched + ' email' + (d.enriched > 1 ? 's' : '') + ' trouvé' + (d.enriched > 1 ? 's' : '') + (d.pending > 0 ? ' · ' + d.pending + ' en attente' : '') + ' !');
    else if (d.pending > 0) showToast(d.pending + ' encore en cours — réessaie dans 30s');
    else showToast('Aucun email trouvé.');
    await load(); setEnriching(false);
  }

  useEffect(() => { if (!loading && !profile) router.push('/login'); }, [loading, profile]);

  // Close Source 2 popover on outside click
  useEffect(() => {
    function handleClick() { setFePopover(null); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
  useEffect(() => { if (id && profile) load(); }, [id, profile]);

  // Auto-poll every 30s
  useEffect(() => {
    const pending = prospects.filter(p => p.icypeas_search_id && !p.email);
    if (!pending.length) { setPolling(false); return; }
    setPolling(true);
    const interval = setInterval(async () => {
      const ids = prospects.filter(p => p.icypeas_search_id && !p.email).map(p => p.id);
      if (!ids.length) { clearInterval(interval); setPolling(false); return; }
      const token = await getToken();
      const r = await fetch('/api/prospects/enrich', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect_ids: ids, action: 'collect' }) });
      const d = await r.json();
      if (d.enriched > 0) { showToast(d.enriched + ' email' + (d.enriched > 1 ? 's' : '') + ' trouvé' + (d.enriched > 1 ? 's' : '') + ' !'); await load(); }
      if (!d.pending) { clearInterval(interval); setPolling(false); }
    }, 30000);
    return () => clearInterval(interval);
  }, [prospects.length]);

  useEffect(() => {
    setReserveWithEmail(prospects.filter(p => p.reserve && p.email).length);
  }, [prospects]);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch(`/api/campaigns/${id}`, { headers: { Authorization: `Bearer ${s.session?.access_token}` } });
    const d = await r.json();
    if (d.campaign) {
      setCampaign(d.campaign);
      setProspects(d.prospects || []);
      setSequences(d.sequences || []);
      setSelectedTitles(d.campaign.selected_titles || []);
      // Sync filters: prefer DB, fallback to localStorage
      const cachedFilters = (() => {
        try { return JSON.parse(localStorage.getItem(`filters_${id}`) || '{}'); } catch { return {}; }
      })();
      setFilters(f => ({
        ...f,
        sector: d.campaign.client_sector || cachedFilters.sector || '',
        location: d.campaign.client_location || cachedFilters.location || '',
      }));
    }
  }

  async function getToken() { const { data: s } = await supabase.auth.getSession(); return s.session?.access_token; }
  function addLog(msg, type = '') { setLog(p => [...p, { msg, type, ts: new Date().toLocaleTimeString() }]); }
  function showToast(msg, duration = 4500) { setToast(msg); setTimeout(() => setToast(''), duration); }

  async function saveTitles(titles) {
    const token = await getToken();
    await fetch(`/api/campaigns/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ selected_titles: titles }) });
  }

  async function runSearch() {
    if (!selectedTitles.length) { showToast('Sélectionne au moins un poste.'); return; }
    setBusy(true);
    addLog('Recherche Source 1 en cours…', 'inf');
    addLog('Source 1 : enrichissement email en cours…', 'inf');
    const token = await getToken();

    // Always use filters state (synced from DB on load)
    const activeSector = filters.sector || campaign.client_sector || '';
    const activeLocation = filters.location || campaign.client_location || '';
    
    addLog(`Filtres : secteur="${activeSector}" · localisation="${activeLocation}"`, 'inf');

    const query = {
      currentJobTitle: { include: selectedTitles },
      ...(activeLocation ? { location: { include: [activeLocation] } } : {}),
      ...(activeSector ? { industry: { include: [activeSector] } } : {}),
      ...(filters.companySize.length ? { companyHeadcount: { include: filters.companySize } } : {}),
      ...(filters.keywords ? { keywords: { include: filters.keywords.split(',').map(k => k.trim()).filter(Boolean) } } : {}),
      ...((filters.minTenure || filters.maxTenure) ? { currentJobTenure: { min: parseInt(filters.minTenure)||0, max: parseInt(filters.maxTenure)||120 } } : {}),
    };

    const r = await fetch('/api/prospects/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: id,
        query,
        limit: searchLimit || campaign.prospect_limit || 10,
        offset: Math.floor(Math.random() * 5) * (searchLimit || campaign.prospect_limit || 10),
      }),
    });
    const d = await r.json();
    if (d.error) { addLog('Erreur : ' + d.error, 'err'); showToast('Erreur Source 1 : ' + d.error); setBusy(false); return; }
    addLog(`${d.saved} prospects affichés · ${d.reserve} en réserve · ${d.emails_submitted} emails en cours`, 'ok');
    showToast(d.saved + ' prospects affichés · ' + d.reserve + ' en réserve · emails en cours...');
    await load();
    setBusy(false);
  }

  async function runSequences(freelanceProfile) {
    if (!visibleProspects.length) { showToast('Génère d\'abord la base de prospects.'); return; }
    setBusy(true);
    addLog('Génération de la séquence IA…', 'inf');
    const token = await getToken();

    // Save freelance profile first
    if (freelanceProfile) {
      await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(freelanceProfile),
      });
      await load();
    }

    const r = await fetch('/api/sequences/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: id }),
    });
    const d = await r.json();
    if (d.error) { addLog('Erreur : ' + d.error, 'err'); showToast('Erreur : ' + d.error); setBusy(false); return; }
    addLog(`${d.generated} séquence générée !`, 'ok');
    showToast('Séquence générée avec succès !');
    await load();
    setTab('sequences');
    setBusy(false);
  }

  async function fullenrichSubmit(prospectId, field) {
    setFePopover(null);
    setFeLoading(p => ({ ...p, [prospectId]: field }));
    const token = await getToken();
    const r = await fetch('/api/prospects/fullenrich', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_id: prospectId, action: 'submit', field }),
    });
    const d = await r.json();
    if (d.error) { showToast('Erreur Source 2 : ' + d.error); setFeLoading(p => { const n={...p}; delete n[prospectId]; return n; }); return; }
    showToast('Enrichissement lancé — résultat dans ~30-60s');
    // Poll every 10s
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      if (attempts > 12) { clearInterval(poll); setFeLoading(p => { const n={...p}; delete n[prospectId]; return n; }); showToast('Délai dépassé — réessaie dans quelques minutes'); return; }
      const r2 = await fetch('/api/prospects/fullenrich', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: prospectId, action: 'collect' }),
      });
      const d2 = await r2.json();
      if (d2.pending) return;
      clearInterval(poll);
      setFeLoading(p => { const n={...p}; delete n[prospectId]; return n; });
      if (d2.not_found) { showToast('Aucun résultat trouvé via Source 2'); return; }
      if (d2.error) { showToast('Erreur : ' + d2.error); return; }
      const msg = [d2.email && '✓ Email trouvé', d2.mobile && '✓ Mobile trouvé'].filter(Boolean).join(' · ');
      showToast(msg || 'Enrichissement terminé');
      await load();
    }, 10000);
  }

  function exportCSV() {
    const rows = visibleProspects.map(p => [p.fullname, p.job_title, p.company, p.sector, p.email, p.email_cert, p.location, p.linkedin_url].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = '\uFEFF' + ['Nom,Poste,Entreprise,Secteur,Email,Score,Localisation,LinkedIn', ...rows].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `${campaign?.name?.replace(/[^a-z0-9]/gi, '_') || 'export'}.csv`; a.click();
    showToast('CSV exporté ✓');
  }

  if (loading || !campaign) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--muted)' }}>Chargement…</div>;

  const visibleProspects = prospects.filter(p => !p.reserve);
  const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];

  const tabs = [
    { id: 'overview', label: 'Aperçu', icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg> },
    { id: 'search', label: 'Génération', icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg> },
    { id: 'prospects', label: `Prospects (${visibleProspects.length})`, icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM.458 10C1.732 7.943 4.022 7 6 7c.34 0 .672.033.993.095A4.979 4.979 0 004.667 14H2a2 2 0 01-2-2v-2zm14 0c1.274-2.057 3.564-3 5.542-3 .34 0 .672.033.993.095A4.979 4.979 0 0017.333 14H16a2 2 0 01-2-2v-2z"/></svg> },
    { id: 'sequences', label: 'Séquence', icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* SIDEBAR */}
      <aside style={{ width: '240px', background: 'white', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => router.push('/app')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px', borderRadius: '6px', marginBottom: '10px' }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--text)'} onMouseOut={e => e.currentTarget.style.color = 'var(--muted)'}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
            Mes dossiers
          </button>
          {editingName ? (
            <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
              <input className="input" value={nameVal} onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                autoFocus style={{ fontSize:'12px', padding:'4px 8px', flex:1 }} />
              <button onClick={saveName} className="btn btn-primary btn-sm" style={{ padding:'4px 8px', fontSize:'11px' }}>✓</button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px', cursor:'pointer' }}
              onClick={() => { setNameVal(campaign.name); setEditingName(true); }}
              title="Cliquer pour renommer">
              <div style={{ fontSize:'13px', fontWeight:'700', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{campaign.name}</div>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="var(--muted)" style={{ flexShrink:0 }}><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
            </div>
          )}
          <span className={`badge badge-${campaign.status === 'done' ? 'green' : campaign.status === 'generating' ? 'blue' : 'muted'}`} style={{ fontSize: '11px' }}>
            {campaign.status === 'done' ? 'Terminé' : campaign.status === 'generating' ? 'En cours' : 'Brouillon'}
          </span>
        </div>
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted)', padding: '8px 8px 4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Navigation</div>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 'var(--r)', border: 'none', fontSize: '13px', fontWeight: tab === t.id ? '600' : '500', cursor: 'pointer', marginBottom: '2px', background: tab === t.id ? 'var(--mf-blue-lt)' : 'none', color: tab === t.id ? 'var(--mf-blue)' : 'var(--text2)', fontFamily: 'inherit', transition: 'all .15s' }}
              onMouseOver={e => { if (tab !== t.id) e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseOut={e => { if (tab !== t.id) e.currentTarget.style.background = 'none'; }}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={exportCSV}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            Exporter CSV
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: '700', margin:0 }}>{campaign.name}</h1>
              <button onClick={() => { setNameVal(campaign.name); setEditingName(true); }} title="Renommer"
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:'4px', borderRadius:'4px' }}
                onMouseOver={e => e.currentTarget.style.color='var(--text)'} onMouseOut={e => e.currentTarget.style.color='var(--muted)'}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div className="card">
                <div className="card-title">Ciblage</div>
                {[['Secteur', campaign.client_sector], ['Domaine', campaign.job_title_target], ['Localisation', campaign.client_location]].filter(r => r[1]).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: '500' }}>{k}</span>
                    <span style={{ fontWeight: '600' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">Profil de prospection</div>
                {campaign.freelance_result && <div style={{ fontSize: '13px', marginBottom: '8px' }}>{campaign.freelance_result}</div>}
                {campaign.freelance_kpi && <div style={{ background: 'var(--mf-blue-lt)', color: 'var(--mf-blue)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>{campaign.freelance_kpi}</div>}
                {!campaign.freelance_result && <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Profil à renseigner avant de générer la séquence</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="card" style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--mf-blue)' }}>{visibleProspects.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Prospects</div>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--mf-blue)' }}>{visibleProspects.filter(p => p.email).length}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Emails trouvés</div>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--muted)' }}>{reserveWithEmail}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>En réserve</div>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH + FILTERS */}
        {tab === 'search' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '2px' }}>Génération de la base prospects</h2>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Secteur : <strong>{campaign.client_sector}</strong> · Domaine : <strong>{campaign.job_title_target || '—'}</strong> · Localisation : <strong>{campaign.client_location || 'France'}</strong></p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>

              {/* Postes */}
              <div className="card" style={{ borderLeft: '3px solid var(--mf-blue)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--mf-blue-lt)', display: 'grid', placeItems: 'center', fontWeight: '800', color: 'var(--mf-blue)', flexShrink: 0, fontSize: '14px' }}>{selectedTitles.length ? '✓' : '1'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Postes ciblés</div>
                    {selectedTitles.length === 0 && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: '10px', fontSize: '12px', color: '#92400e' }}>
                        Sélectionne au moins un poste ci-dessous.
                      </div>
                    )}
                    <JobTitleSelector selected={selectedTitles} onChange={(titles) => { setSelectedTitles(titles); saveTitles(titles); }} sector={campaign.job_title_target} />
                  </div>
                </div>
              </div>

              {/* Filtres de recherche */}
              <div className="card" style={{ borderLeft: '3px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--muted)', flexShrink: 0, fontSize: '14px', fontWeight: '800' }}>2</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>Filtres de recherche</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Secteur, localisation et filtres avancés</div>
                  </div>
                </div>

                {/* Secteur + Localisation */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Secteur d'activité</div>
                    <SectorSearch value={filters.sector} onChange={v => { const nf = {...filters, sector: v}; setFilters(nf); saveFilters(nf); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Localisation</div>
                    <LocationSelect value={filters.location} onChange={v => { const nf = {...filters, location: v}; setFilters(nf); saveFilters(nf); }} />
                  </div>
                </div>

                {/* Taille entreprise */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Taille d'entreprise</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'].map(s => {
                      const active = filters.companySize.includes(s);
                      return (
                        <button key={s} onClick={() => setFilters(f => ({ ...f, companySize: active ? f.companySize.filter(x => x !== s) : [...f.companySize, s] }))}
                          style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: '1.5px solid', borderColor: active ? 'var(--mf-blue)' : 'var(--border)', background: active ? 'var(--mf-blue-lt)' : 'white', color: active ? 'var(--mf-blue)' : 'var(--text2)', fontWeight: active ? '700' : '400' }}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mots-clés */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Mots-clés (bio / fonction)</div>
                  <input className="input" value={filters.keywords} onChange={e => setFilters(f => ({ ...f, keywords: e.target.value }))} placeholder="Ex : growth, SaaS, B2B (séparés par virgule)" style={{ fontSize: '12px' }} />
                </div>

                {/* Ancienneté */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Ancienneté dans le poste (mois)</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input className="input" value={filters.minTenure} onChange={e => setFilters(f => ({ ...f, minTenure: e.target.value }))} placeholder="Min" style={{ fontSize: '12px', width: '80px' }} type="number" min="0" />
                    <span style={{ color: 'var(--muted)', fontSize: '12px' }}>à</span>
                    <input className="input" value={filters.maxTenure} onChange={e => setFilters(f => ({ ...f, maxTenure: e.target.value }))} placeholder="Max" style={{ fontSize: '12px', width: '80px' }} type="number" min="0" />
                    <span style={{ color: 'var(--muted)', fontSize: '12px' }}>mois</span>
                  </div>
                </div>
              </div>

              {/* Lancer recherche */}
              <div className="card" style={{ borderLeft: `3px solid ${visibleProspects.length ? 'var(--mf-blue)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--mf-blue-lt)', display: 'grid', placeItems: 'center', fontWeight: '800', color: 'var(--mf-blue)', flexShrink: 0, fontSize: '14px' }}>{visibleProspects.length ? '✓' : '3'}</div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Recherche vos futurs clients</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>3× scraping + enrichissement email automatique</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Afficher :</span>
                        {[10, 25, 50].map(n => {
                          const active = (searchLimit || campaign.prospect_limit || 10) === n;
                          return <button key={n} onClick={() => setSearchLimit(n)} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: active ? '700' : '500', cursor: 'pointer', border: '1.5px solid', borderColor: active ? 'var(--mf-blue)' : 'var(--border)', background: active ? 'var(--mf-blue-lt)' : 'white', color: active ? 'var(--mf-blue)' : 'var(--text2)' }}>{n}</button>;
                        })}
                      </div>
                    </div>
                  </div>
                  <button className={`btn btn-${visibleProspects.length ? 'ghost' : 'primary'} btn-sm`} onClick={runSearch} disabled={busy || !selectedTitles.length} style={{ flexShrink: 0 }}>
                    {busy ? <div className="spinner" /> : null}
                    {visibleProspects.length ? 'Relancer' : 'Lancer la recherche'}
                  </button>
                </div>
              </div>

              {/* Séquence */}
              <div className="card" style={{ borderLeft: `3px solid ${sequences.length ? 'var(--mf-blue)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--mf-blue-lt)', display: 'grid', placeItems: 'center', fontWeight: '800', color: 'var(--mf-blue)', flexShrink: 0, fontSize: '14px' }}>{sequences.length ? '✓' : '4'}</div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>Séquence IA</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>3 emails + 2 LinkedIn personnalisés selon ton cas client</div>
                    </div>
                  </div>
                  <button className={`btn btn-${sequences.length ? 'ghost' : 'primary'} btn-sm`} onClick={() => setShowSeqWizard(true)} disabled={busy || !visibleProspects.length} style={{ flexShrink: 0 }}>
                    {sequences.length ? 'Relancer' : 'Générer la séquence'}
                  </button>
                </div>
              </div>
            </div>

            {log.length > 0 && (
              <div className="card">
                <div className="card-title">Journal</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  {log.map((l, i) => (
                    <div key={i} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: l.type === 'ok' ? 'var(--mf-blue)' : l.type === 'err' ? 'var(--red)' : 'var(--muted)', display: 'flex', gap: '10px' }}>
                      <span style={{ opacity: .5, flexShrink: 0 }}>{l.ts}</span><span>{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROSPECTS */}
        {tab === 'prospects' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                Base prospects ({visibleProspects.length})
                {visibleProspects.length > 0 && (() => {
                  const found = visibleProspects.filter(p => p.email).length;
                  const notFound = visibleProspects.filter(p => p.email_cert === 'not_found').length;
                  const pending = visibleProspects.filter(p => p.icypeas_search_id && !p.email && p.email_cert !== 'not_found').length;
                  const pct = Math.round((found / visibleProspects.length) * 100);
                  return (
                    <span style={{ fontSize:'12px', fontWeight:'500', display:'inline-flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ color:'var(--mf-blue)' }}>✉ {found}/{visibleProspects.length} emails ({pct}%)</span>
                      {notFound > 0 && <span style={{ color:'#ef4444' }}>· {notFound} non trouvé{notFound > 1 ? 's' : ''}</span>}
                      {polling && <span style={{ color:'var(--muted)', display:'inline-flex', alignItems:'center', gap:'4px' }}><div className="spinner spinner-dark" style={{ width:'10px', height:'10px', borderWidth:'1.5px' }} /> {pending} en cours</span>}
                    </span>
                  );
                })()}
              </h2>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {reserveWithEmail > 0 && <button className="btn btn-primary btn-sm" onClick={generateMore}>+ Générer plus ({reserveWithEmail} avec email)</button>}
                {prospects.some(p => p.icypeas_search_id && !p.email && !p.reserve) && (
                  <button className="btn btn-ghost btn-sm" onClick={collectEmails} disabled={enriching}>
                    {enriching ? <div className="spinner spinner-dark" /> : null}
                    Récupérer emails ({prospects.filter(p => p.icypeas_search_id && !p.email && !p.reserve).length})
                  </button>
                )}
              </div>
            </div>

            {visibleProspects.length > 0 && selected.length === 0 && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: '#1e40af' }}>
                Les emails sont recherchés automatiquement — résultats dans ~30s.
              </div>
            )}
            {selected.length > 0 && (
              <div style={{ background: 'var(--mf-blue-lt)', border: '1px solid rgba(0,144,255,.2)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: 'var(--mf-blue)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{selected.length === visibleProspects.length ? 'Tous sélectionnés' : selected.length + ' sélectionné(s)'}</span>
                <button onClick={() => setSelected([])} style={{ background: 'none', border: 'none', color: 'var(--mf-blue)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', fontFamily: 'inherit' }}>Désélectionner</button>
              </div>
            )}

            {!visibleProspects.length ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--surface)', borderRadius: '10px', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><svg width="20" height="20" viewBox="0 0 20 20" fill="var(--muted)"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM.458 10C1.732 7.943 4.022 7 6 7c.34 0 .672.033.993.095A4.979 4.979 0 004.667 14H2a2 2 0 01-2-2v-2zm14 0c1.274-2.057 3.564-3 5.542-3 .34 0 .672.033.993.095A4.979 4.979 0 0017.333 14H16a2 2 0 01-2-2v-2z"/></svg></div>
                <div style={{ fontWeight: '700', marginBottom: '6px' }}>Aucun prospect</div>
                <button className="btn btn-primary btn-sm" onClick={() => setTab('search')}>Lancer la recherche →</button>
              </div>
            ) : (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '650px' }}>
                  <thead style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '9px 12px', width: '36px' }}>
                        <input type="checkbox" checked={selected.length === visibleProspects.length && visibleProspects.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: '14px', height: '14px' }} />
                      </th>
                      {['Nom', 'Poste', 'Entreprise', 'Email', 'Mobile', 'Score', 'LinkedIn', ''].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '9px', fontWeight: '700', letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...visibleProspects].sort((a, b) => { const s = p => p.email ? 0 : (p.icypeas_search_id ? 1 : 2); return s(a) - s(b); }).map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(226,230,243,.5)', background: selected.includes(p.id) ? 'var(--mf-blue-lt)' : 'white' }}>
                        <td style={{ padding: '9px 12px' }}><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} style={{ cursor: 'pointer', width: '14px', height: '14px' }} /></td>
                        <td style={{ padding: '9px 12px', fontWeight: '600' }}>{p.fullname || '—'}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--text2)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.job_title || '—'}</td>
                        <td style={{ padding: '9px 12px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.company || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: '11px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            {p.email
                              ? <span style={{ color: 'var(--mf-blue)', fontWeight: '600' }}>{p.email}</span>
                              : p.icypeas_search_id && !p.email_cert
                                ? <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', color:'var(--muted)', fontSize:'11px' }}>
                                    <div className="spinner spinner-dark" style={{ width:'10px', height:'10px', borderWidth:'1.5px' }} />
                                    En cours...
                                  </span>
                                : <span style={{ color:'var(--muted)', fontSize:'11px' }}>
                                    {p.email_cert === 'not_found' ? <span style={{ color:'#ef4444' }}>❌ Non trouvé</span> : '—'}
                                  </span>
                            }
                            {/* Source 2 CTA — show only when Source 1 is done */}
                            {!p.email && (!p.icypeas_search_id || p.email_cert) && (
                              <div style={{ position:'relative' }}>
                                {feLoading[p.id] ? (
                                  <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', fontSize:'10px', color:'#7c3aed', background:'#f0ebff', padding:'2px 6px', borderRadius:'4px' }}>
                                    <div className="spinner" style={{ width:'8px', height:'8px', borderWidth:'1.5px', borderColor:'#7c3aed', borderTopColor:'transparent' }} />
                                    {feLoading[p.id] === 'email' ? 'Email...' : feLoading[p.id] === 'phone' ? 'Mobile...' : 'Enrichissement...'}
                                  </span>
                                ) : (
                                  <>
                                    <button onClick={() => setFePopover(fePopover === p.id ? null : p.id)}
                                      style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', border:'1px solid #7c3aed', background:'white', color:'#7c3aed', cursor:'pointer', fontFamily:'inherit', fontWeight:'600', whiteSpace:'nowrap' }}
                                      title="Enrichir via Source 2">
                                      ✦ Source 2
                                    </button>
                                    {fePopover === p.id && (
                                      <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, background:'white', border:'1px solid var(--border)', borderRadius:'var(--r)', boxShadow:'var(--shadow)', zIndex:100, padding:'8px', minWidth:'160px' }}>
                                        <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'6px', fontWeight:'600' }}>Enrichir via Source 2</div>
                                        {[
                                          { field:'email', label:'📧 Email seulement', desc:'~5ct si trouvé' },
                                          { field:'phone', label:'📱 Mobile seulement', desc:'~5ct si trouvé' },
                                          { field:'both', label:'📧📱 Email + Mobile', desc:'~10ct si trouvé' },
                                        ].map(opt => (
                                          <button key={opt.field} onClick={() => fullenrichSubmit(p.id, opt.field)}
                                            style={{ display:'flex', flexDirection:'column', width:'100%', padding:'6px 8px', borderRadius:'4px', border:'none', background:'none', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}
                                            onMouseOver={e => e.currentTarget.style.background='var(--surface)'}
                                            onMouseOut={e => e.currentTarget.style.background='none'}>
                                            <span style={{ fontSize:'12px', fontWeight:'500' }}>{opt.label}</span>
                                            <span style={{ fontSize:'10px', color:'var(--muted)' }}>{opt.desc}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Mobile */}
                        <td style={{ padding: '9px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: '11px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            {p.mobile
                              ? <span style={{ color:'#7c3aed', fontWeight:'600' }}>{p.mobile}</span>
                              : <span style={{ color:'var(--muted)' }}>—</span>
                            }
                            {/* Mobile CTA — show for all prospects without mobile */}
                            {!p.mobile && !feLoading[p.id] && (
                              <button onClick={() => fullenrichSubmit(p.id, 'phone')}
                                style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', border:'1px solid #7c3aed', background:'white', color:'#7c3aed', cursor:'pointer', fontFamily:'inherit', fontWeight:'600' }}
                                title="Trouver le mobile via Source 2">
                                📱
                              </button>
                            )}
                            {feLoading[p.id] === 'phone' && (
                              <div className="spinner" style={{ width:'10px', height:'10px', borderWidth:'1.5px', borderColor:'#7c3aed', borderTopColor:'transparent' }} />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>{p.email_cert ? <span style={{ background: 'var(--mf-blue-lt)', color: 'var(--mf-blue)', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>{p.email_cert}</span> : '—'}</td>
                        <td style={{ padding: '9px 12px' }}>{p.linkedin_url ? <a href={p.linkedin_url} target="_blank" rel="noopener" style={{ color: 'var(--mf-blue)', fontWeight: '600', fontSize: '12px' }}>↗</a> : '—'}</td>
                        <td style={{ padding: '9px 6px' }}>
                          <button onClick={() => deleteProspect(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', borderRadius: '4px' }}
                            onMouseOver={e => e.currentTarget.style.color = 'var(--red)'} onMouseOut={e => e.currentTarget.style.color = 'var(--muted)'}>
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SEQUENCE */}
        {tab === 'sequences' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700' }}>Séquence de prospection</h2>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Utilisez {'{{PRENOM}}'} et {'{{ENTREPRISE}}'} comme variables</p>
            </div>
            {(() => { const seq = sequences.find(s => s.email_1); return !seq; })() ? (
              <div style={{ textAlign: 'center', padding: '60px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', color: 'var(--muted)' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--surface)', borderRadius: '10px', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--muted)"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                </div>
                <div style={{ fontWeight: '600', marginBottom: '6px' }}>Aucune séquence générée</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowSeqWizard(true)}>Générer la séquence →</button>
              </div>
            ) : (() => {
              const seq = sequences.find(s => s.email_1) || sequences[0];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { key: 'email_1', label: 'Email 1 — Accroche', type: 'email' },
                    { key: 'email_2', label: 'Email 2 — Preuve & KPI', type: 'email' },
                    { key: 'email_3', label: 'Email 3 — Relance', type: 'email' },
                    { key: 'linkedin_1', label: 'LinkedIn 1 — Connexion', type: 'linkedin' },
                    { key: 'linkedin_2', label: 'LinkedIn 2 — Suivi', type: 'linkedin' },
                  ].map(({ key, label, type }) => (
                    <SingleSequenceCard key={key} label={label} type={type} content={seq[key] || ''} onSave={async (val) => {
                      const token = await getToken();
                      await fetch(`/api/sequences/${seq.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: val }) });
                      showToast('Sauvegardé ✓'); await load();
                    }} />
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {toast && <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#0090FF', color: 'white', padding: '12px 20px', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: '600', boxShadow: 'var(--shadow-lg)', animation: 'fadeUp .3s ease', zIndex: 1000 }}>{toast}</div>}

      {showSeqWizard && (
        <SequenceWizard
          campaign={campaign}
          onClose={() => setShowSeqWizard(false)}
          onGenerate={(profile) => { setShowSeqWizard(false); runSequences(profile); }}
        />
      )}
    </div>
  );
}

// ─── SEQUENCE WIZARD ──────────────────────────────────────────────────────────
function SequenceWizard({ campaign, onClose, onGenerate }) {
  const [form, setForm] = useState({
    freelance_offer: campaign.freelance_offer || '',
    freelance_icp: campaign.freelance_icp || '',
    freelance_problem: campaign.freelance_problem || '',
    freelance_result: campaign.freelance_result || '',
    freelance_kpi: campaign.freelance_kpi || '',
    freelance_angle: campaign.freelance_angle || '',
    freelance_tone: campaign.freelance_tone || 'professionnel',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = (k, props = {}) => <input className="input" value={form[k]} onChange={e => f(k, e.target.value)} {...props} />;
  const ta = (k, props = {}) => <textarea className="input" value={form[k]} onChange={e => f(k, e.target.value)} {...props} />;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '24px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>Profil de prospection</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Ces infos personnalisent ta séquence — plus c'est précis, meilleure est la séquence</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>
          <div className="field">
            <label>Ton offre / service</label>
            {inp('freelance_offer', { placeholder: 'Ex : Création de sites web performants pour PME' })}
          </div>
          <div className="field">
            <label>Client idéal (ICP)</label>
            {inp('freelance_icp', { placeholder: 'Ex : Directeurs marketing de PME 50-200 salariés' })}
          </div>
          <div className="field">
            <label>Problème que tu résous</label>
            {inp('freelance_problem', { placeholder: 'Ex : Site web vieillissant qui ne génère pas de leads' })}
          </div>
          <div className="field">
            <label>Résultat obtenu pour un client similaire</label>
            {ta('freelance_result', { placeholder: 'Ex : Refonte du site d\'une agence → +40% de leads en 3 mois', rows: 2 })}
          </div>
          <div className="field">
            <label>Chiffre clé / KPI</label>
            {inp('freelance_kpi', { placeholder: 'Ex : +40% de leads, ROI 3× en 6 mois' })}
          </div>
          <div className="field">
            <label>Ton différenciateur</label>
            {inp('freelance_angle', { placeholder: 'Ex : Spécialiste secteur assurance depuis 5 ans' })}
          </div>
          <div className="field">
            <label>Ton des messages</label>
            <select className="input" value={form.freelance_tone} onChange={e => f('freelance_tone', e.target.value)}>
              <option value="professionnel">Professionnel</option>
              <option value="chaleureux">Chaleureux</option>
              <option value="direct">Direct</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={() => onGenerate(form)}>
              Générer la séquence →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SEQUENCE CARD ────────────────────────────────────────────────────────────
function SingleSequenceCard({ label, type, content: initialContent, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(initialContent);
  const [copied, setCopied] = useState(false);
  const isEmail = type === 'email';

  function copyContent() {
    navigator.clipboard.writeText(val).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'grid', placeItems: 'center', background: isEmail ? 'var(--mf-blue-lt)' : '#f0ebff', flexShrink: 0 }}>
            {isEmail
              ? <svg width="15" height="15" viewBox="0 0 20 20" fill="var(--mf-blue)"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="#7c3aed"><path d="M16 8c0-2.21-1.79-4-4-4S8 5.79 8 8s1.79 4 4 4 4-1.79 4-4zm-10 9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1H6v-1z"/></svg>
            }
          </div>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-ghost btn-sm" onClick={copyContent}>
            {copied ? '✓ Copié !' : 'Copier'}
          </button>
          {editing ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { setVal(initialContent); setEditing(false); }}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={() => { onSave(val); setEditing(false); }}>Sauvegarder</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Modifier</button>
          )}
        </div>
      </div>
      <div style={{ padding: '16px 18px' }}>
        {editing ? (
          <textarea className="input" value={val} onChange={e => setVal(e.target.value)} rows={isEmail ? 8 : 4} style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }} />
        ) : (
          <pre style={{ fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: 'var(--text2)', margin: 0 }}>{val || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Aucun contenu</span>}</pre>
        )}
      </div>
    </div>
  );
}

// ─── LOCATION SELECT ─────────────────────────────────────────────────────────
const LOCATIONS = [
  // Pays
  { group: 'Pays', v: 'FR', l: '🇫🇷 France' },
  { group: 'Pays', v: 'BE', l: '🇧🇪 Belgique' },
  { group: 'Pays', v: 'CH', l: '🇨🇭 Suisse' },
  { group: 'Pays', v: 'LU', l: '🇱🇺 Luxembourg' },
  { group: 'Pays', v: 'DE', l: '🇩🇪 Allemagne' },
  { group: 'Pays', v: 'ES', l: '🇪🇸 Espagne' },
  { group: 'Pays', v: 'IT', l: '🇮🇹 Italie' },
  { group: 'Pays', v: 'GB', l: '🇬🇧 Royaume-Uni' },
  { group: 'Pays', v: 'NL', l: '🇳🇱 Pays-Bas' },
  { group: 'Pays', v: 'US', l: '🇺🇸 États-Unis' },
  { group: 'Pays', v: 'CA', l: '🇨🇦 Canada' },
  // Grandes villes françaises
  { group: 'Villes', v: 'Paris', l: '📍 Paris' },
  { group: 'Villes', v: 'Lyon', l: '📍 Lyon' },
  { group: 'Villes', v: 'Marseille', l: '📍 Marseille' },
  { group: 'Villes', v: 'Bordeaux', l: '📍 Bordeaux' },
  { group: 'Villes', v: 'Lille', l: '📍 Lille' },
  { group: 'Villes', v: 'Nantes', l: '📍 Nantes' },
  { group: 'Villes', v: 'Toulouse', l: '📍 Toulouse' },
  { group: 'Villes', v: 'Strasbourg', l: '📍 Strasbourg' },
  { group: 'Villes', v: 'Rennes', l: '📍 Rennes' },
  { group: 'Villes', v: 'Nice', l: '📍 Nice' },
  { group: 'Villes', v: 'Montpellier', l: '📍 Montpellier' },
  { group: 'Villes', v: 'Grenoble', l: '📍 Grenoble' },
  { group: 'Villes', v: 'Rouen', l: '📍 Rouen' },
  { group: 'Villes', v: 'Dijon', l: '📍 Dijon' },
  { group: 'Villes', v: 'Metz', l: '📍 Metz' },
  { group: 'Villes', v: 'Reims', l: '📍 Reims' },
  { group: 'Villes', v: 'Tours', l: '📍 Tours' },
  { group: 'Villes', v: 'Clermont-Ferrand', l: '📍 Clermont-Ferrand' },
  { group: 'Villes', v: 'Aix-en-Provence', l: '📍 Aix-en-Provence' },
  { group: 'Villes', v: 'Angers', l: '📍 Angers' },
  // Régions françaises
  { group: 'Régions', v: 'Île-de-France', l: '🗺 Île-de-France' },
  { group: 'Régions', v: 'Auvergne-Rhône-Alpes', l: '🗺 Auvergne-Rhône-Alpes' },
  { group: 'Régions', v: 'Nouvelle-Aquitaine', l: '🗺 Nouvelle-Aquitaine' },
  { group: 'Régions', v: 'Occitanie', l: '🗺 Occitanie' },
  { group: 'Régions', v: 'Hauts-de-France', l: '🗺 Hauts-de-France' },
  { group: 'Régions', v: 'Grand Est', l: '🗺 Grand Est' },
  { group: 'Régions', v: 'Pays de la Loire', l: '🗺 Pays de la Loire' },
  { group: 'Régions', v: 'Normandie', l: '🗺 Normandie' },
  { group: 'Régions', v: 'Bretagne', l: '🗺 Bretagne' },
  { group: 'Régions', v: "Provence-Alpes-Côte d'Azur", l: "🗺 Provence-Alpes-Côte d'Azur" },
  { group: 'Régions', v: 'Bourgogne-Franche-Comté', l: '🗺 Bourgogne-Franche-Comté' },
  { group: 'Régions', v: 'Centre-Val de Loire', l: '🗺 Centre-Val de Loire' },
  { group: 'Régions', v: 'Corse', l: '🗺 Corse' },
];

function LocationSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const selected = LOCATIONS.find(l => l.v === value);
  const filtered = LOCATIONS.filter(l => l.l.toLowerCase().includes(search.toLowerCase()));
  const groups = ['Pays', 'Villes', 'Régions'];

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="input" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }} onClick={() => setOpen(!open)}>
        <span style={{ color: selected ? 'var(--text)' : 'var(--muted)' }}>
          {selected ? (selected.l.includes(' — ') ? selected.l.split(' — ')[0] : selected.l) : 'Choisir un secteur...'}
        </span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r)', zIndex: 200, boxShadow: 'var(--shadow)' }}>
          <div style={{ padding: '6px' }}>
            <input className="input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ marginBottom: 0, fontSize: '12px' }} />
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {value && <div onClick={() => { onChange(''); setOpen(false); setSearch(''); }} style={{ padding: '7px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>— Aucun filtre —</div>}
            {groups.map(group => {
              const items = filtered.filter(l => l.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <div style={{ padding: '5px 10px 3px', fontSize: '10px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--surface)' }}>{group}</div>
                  {items.map(l => (
                    <div key={l.v} onClick={() => { onChange(l.v); setOpen(false); setSearch(''); }}
                      style={{ padding: '7px 10px', fontSize: '12px', cursor: 'pointer', background: value === l.v ? 'var(--mf-blue-lt)' : 'white', color: value === l.v ? 'var(--mf-blue)' : 'var(--text)', fontWeight: value === l.v ? '600' : '400' }}
                      onMouseOver={e => { if (value !== l.v) e.currentTarget.style.background = 'var(--surface)'; }}
                      onMouseOut={e => { if (value !== l.v) e.currentTarget.style.background = 'white'; }}>
                      {l.l}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECTOR SEARCH ───────────────────────────────────────────────────────────
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
      <div className="input" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }} onClick={() => setOpen(!open)}>
        <span style={{ color: selected ? 'var(--text)' : 'var(--muted)' }}>
          {selected ? (selected.l.includes(' — ') ? selected.l.split(' — ')[0] : selected.l) : 'Choisir un secteur...'}
        </span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r)', zIndex: 200, boxShadow: 'var(--shadow)' }}>
          <div style={{ padding: '6px' }}>
            <input className="input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ marginBottom: 0, fontSize: '12px' }} />
          </div>
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {value && <div onClick={() => { onChange(''); setOpen(false); setSearch(''); }} style={{ padding: '7px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--muted)' }}>— Aucun filtre —</div>}
            {filtered.map(s => {
              const [en, fr] = s.l.includes(' — ') ? s.l.split(' — ') : [s.l, null];
              return (
                <div key={s.v} onClick={() => { onChange(s.v); setOpen(false); setSearch(''); }}
                  style={{ padding: '7px 10px', cursor: 'pointer', background: value === s.v ? 'var(--mf-blue-lt)' : 'white' }}
                  onMouseOver={e => { if (value !== s.v) e.currentTarget.style.background = 'var(--surface)'; }}
                  onMouseOut={e => { if (value !== s.v) e.currentTarget.style.background = 'white'; }}>
                  <div style={{ fontSize: '12px', fontWeight: value === s.v ? '600' : '400', color: value === s.v ? 'var(--mf-blue)' : 'var(--text)' }}>{en}</div>
                  {fr && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{fr}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── JOB TITLES ───────────────────────────────────────────────────────────────
const JOB_TITLES_BY_DOMAIN = {
  'Direction générale': ['Dirigeant', 'PDG', 'CEO', 'Directeur Général', 'Gérant', 'Associé', 'Co-fondateur', 'Président'],
  'Direction financière': ['DAF', 'CFO', 'Directeur Administratif et Financier', 'Responsable financier', 'Expert-comptable', 'Chef comptable', 'Responsable contrôle de gestion'],
  'Direction commerciale': ['Directeur Commercial', 'Responsable Commercial', 'Business Developer', 'Directeur des Ventes', 'Responsable grands comptes', 'Chef des ventes'],
  'Direction marketing': ['Directeur Marketing', 'CMO', 'Responsable Marketing', 'Responsable Communication', 'Directeur de la communication', 'Responsable digital'],
  'Direction RH': ['DRH', 'Directeur RH', 'Responsable RH', 'Responsable recrutement', 'HRBP', 'Responsable formation'],
  'Direction technique': ['DSI', 'CTO', 'Directeur technique', 'Responsable IT', 'Responsable informatique', 'Directeur des systèmes d information'],
  'Direction opérations': ['COO', 'Directeur des Opérations', 'Directeur de projet', 'Responsable achats', 'Directeur supply chain', 'Responsable logistique'],
  'Métiers juridiques': ['Notaire', 'Avocat', 'Directeur juridique', 'Responsable affaires juridiques', 'Juriste senior'],
  'Métiers de santé': ['Médecin', 'Directeur clinique', 'Directeur EHPAD', 'Responsable centre de santé', 'Pharmacien', 'Directeur médical'],
  'Métiers immobilier': ['Agent immobilier', 'Directeur agence immobilière', 'Négociateur immobilier', 'Promoteur immobilier', 'Gestionnaire de biens'],
  'Métiers de la restauration': ['Restaurateur', 'Gérant restaurant', 'Chef cuisinier', 'Directeur restauration'],
  'Métiers artisanaux': ['Artisan', 'Chef d atelier', 'Maître artisan', 'Responsable production'],
};

function JobTitleSelector({ selected, onChange, sector }) {
  const [custom, setCustom] = useState('');
  const titles = JOB_TITLES_BY_DOMAIN[(sector || '').trim()] || [];
  const customTitles = selected.filter(t => !titles.includes(t));

  function toggle(t) { onChange(selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t]); }
  function addCustom() { const v = custom.trim(); if (v && !selected.includes(v)) onChange([...selected, v]); setCustom(''); }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {titles.map(t => (
          <button key={t} onClick={() => toggle(t)}
            style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '1.5px solid', transition: 'all .15s', borderColor: selected.includes(t) ? 'var(--mf-blue)' : 'var(--border)', background: selected.includes(t) ? 'var(--mf-blue-lt)' : 'white', color: selected.includes(t) ? 'var(--mf-blue)' : 'var(--text2)' }}>
            {t}
          </button>
        ))}
        {customTitles.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: 'var(--mf-blue-lt)', color: 'var(--mf-blue)', border: '1.5px solid var(--mf-blue)' }}>
            {t}
            <button onClick={() => onChange(selected.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mf-blue)', fontSize: '14px', lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <input className="input" placeholder="Ajouter un poste personnalisé..." value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()} style={{ flex: 1, fontSize: '12px' }} />
        {custom.trim() && <button className="btn btn-ghost btn-sm" onClick={addCustom}>+ Ajouter</button>}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{selected.length} poste{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}</span>
          <button onClick={() => onChange([])} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Tout effacer</button>
        </div>
      )}
    </div>
  );
}
