import { LogoIcon } from '../../../lib/Logo';
// pages/app/campaign/[id].js
import { useState, useEffect } from 'react';
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

  function toggleSelect(id) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  function toggleAll() {
    setSelected(p => p.length === prospects.filter(p=>!p.reserve).length ? [] : prospects.filter(p=>!p.reserve).map(p => p.id));
  }

  async function deleteProspect(prospectId) {
    const token = await getToken();
    await fetch(`/api/prospects/${prospectId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setProspects(p => p.filter(x => x.id !== prospectId));
    setSelected(s => s.filter(x => x !== prospectId));
    showToast('Prospect supprimé');
  }

  async function generateMore() {
    const token = await getToken();
    const r = await fetch(`/api/campaigns/${id}/reserve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.ok) {
      showToast(d.revealed + ' nouveau' + (d.revealed > 1 ? 'x' : '') + ' prospect' + (d.revealed > 1 ? 's' : '') + ' avec email ajouté' + (d.revealed > 1 ? 's' : '') + ' !');
      setReserveWithEmail(0);
      await load();
    } else {
      showToast('Erreur : ' + (d.error || 'inconnue'));
    }
  }

  async function collectEmails() {
    setEnriching(true);
    const token = await getToken();
    const ids = prospects.filter(p => p.icypeas_search_id && !p.email).map(p => p.id);
    if (!ids.length) { showToast('Aucune recherche en attente.'); setEnriching(false); return; }
    const r = await fetch('/api/prospects/enrich', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_ids: ids, action: 'collect' }),
    });
    const d = await r.json();
    if (d.error) { showToast('Erreur : ' + d.error); setEnriching(false); return; }
    if (d.enriched > 0) {
      showToast(d.enriched + ' email' + (d.enriched > 1 ? 's' : '') + ' trouvé' + (d.enriched > 1 ? 's' : '') + (d.pending > 0 ? ' · ' + d.pending + ' encore en attente' : '') + ' !');
    } else if (d.pending > 0) {
      showToast(d.pending + ' encore en cours — réessaie dans 30s');
    } else {
      showToast('Aucun email trouvé.');
    }
    await load();
    setEnriching(false);
  }

  useEffect(() => { if (!loading && !profile) router.push('/login'); }, [loading, profile]);
  useEffect(() => { if (id && profile) load(); }, [id, profile]);

  // Auto-poll every 30s when pending email searches exist
  useEffect(() => {
    const pending = prospects.filter(p => p.icypeas_search_id && !p.email);
    if (!pending.length) { setPolling(false); return; }
    setPolling(true);
    const interval = setInterval(async () => {
      const ids = prospects.filter(p => p.icypeas_search_id && !p.email).map(p => p.id);
      if (!ids.length) { clearInterval(interval); setPolling(false); return; }
      const token = await getToken();
      const r = await fetch('/api/prospects/enrich', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_ids: ids, action: 'collect' }),
      });
      const d = await r.json();
      if (d.enriched > 0) {
        showToast(d.enriched + ' email' + (d.enriched > 1 ? 's' : '') + ' trouvé' + (d.enriched > 1 ? 's' : '') + ' !');
        await load();
      }
      if (!d.pending) { clearInterval(interval); setPolling(false); }
    }, 30000);
    return () => clearInterval(interval);
  }, [prospects.length]);

  // Check reserve with emails
  useEffect(() => {
    if (!id || !profile) return;
    const reserveFound = prospects.filter(p => p.reserve && p.email).length;
    setReserveWithEmail(reserveFound);
  }, [prospects]);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch(`/api/campaigns/${id}`, { headers:{ Authorization:`Bearer ${s.session?.access_token}` } });
    const d = await r.json();
    if (d.campaign) {
      setCampaign(d.campaign);
      setProspects(d.prospects||[]);
      setSequences(d.sequences||[]);
      setSelectedTitles(d.campaign.selected_titles || []);
    }
  }

  async function getToken() {
    const { data: s } = await supabase.auth.getSession();
    return s.session?.access_token;
  }

  function addLog(msg, type='') { setLog(p => [...p, { msg, type, ts: new Date().toLocaleTimeString() }]); }
  function showToast(msg, duration=4500) { setToast(msg); setTimeout(() => setToast(''), duration); }

  async function saveTitles(titles) {
    const token = await getToken();
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_titles: titles }),
    });
  }

  async function runSearch() {
    if (!selectedTitles.length) { showToast('Sélectionne au moins un poste.'); return; }
    setBusy(true); addLog('Recherche Icypeas en cours…', 'inf');
    addLog('Enrichissement email automatique lancé en parallèle…', 'inf');
    const token = await getToken();
    const query = {
      currentJobTitle: { include: selectedTitles },
      ...(campaign.client_location ? { location: { include: [campaign.client_location] } } : {}),
      ...(campaign.client_sector ? { industry: { include: [campaign.client_sector] } } : {}),
    };
    const r = await fetch('/api/prospects/search', {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ campaign_id: id, query, limit: searchLimit || campaign.prospect_limit || 10 }),
    });
    const d = await r.json();
    if (d.error) { addLog('Erreur : ' + d.error, 'err'); showToast('Erreur Icypeas : ' + d.error); setBusy(false); return; }
    addLog(`${d.saved} prospects affichés · ${d.reserve} en réserve · ${d.emails_submitted} emails en cours`, 'ok');
    showToast(d.saved + ' prospects · ' + d.reserve + ' en réserve · emails en cours de recherche automatique...');
    await load();
    setBusy(false);
  }

  async function runSequences() {
    if (!prospects.filter(p=>!p.reserve).length) { showToast('Génère d\'abord la base de prospects.'); return; }
    setBusy(true); addLog('Génération de la séquence IA…', 'inf');
    const token = await getToken();
    const r = await fetch('/api/sequences/generate', {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
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

  function exportCSV() {
    const visibleProspects = prospects.filter(p => !p.reserve);
    const rows = visibleProspects.map(p => {
      return [p.fullname,p.job_title,p.company,p.sector,p.email,p.email_cert,p.location,p.linkedin_url]
        .map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(',');
    });
    const headers = 'Nom,Poste,Entreprise,Secteur,Email,Score,Localisation,LinkedIn';
    const csv = '\uFEFF' + [headers, ...rows].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download = `${campaign?.name?.replace(/[^a-z0-9]/gi,'_')||'export'}.csv`; a.click();
    showToast('CSV exporté ✓');
  }

  if (loading || !campaign) return <div style={{ display:'grid', placeItems:'center', height:'100vh', color:'var(--muted)' }}>Chargement…</div>;

  const visibleProspects = prospects.filter(p => !p.reserve);

  const tabs = [
    { id:'overview',  label:'Aperçu', icon:<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg> },
    { id:'search',    label:'Génération', icon:<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg> },
    { id:'prospects', label:`Prospects (${visibleProspects.length})`, icon:<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM.458 10C1.732 7.943 4.022 7 6 7c.34 0 .672.033.993.095A4.979 4.979 0 004.667 14H2a2 2 0 01-2-2v-2zm14 0c1.274-2.057 3.564-3 5.542-3 .34 0 .672.033.993.095A4.979 4.979 0 0017.333 14H16a2 2 0 01-2-2v-2z"/></svg> },
    { id:'sequences', label:'Séquence', icon:<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg> },
  ];

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{ width:'240px', background:'white', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100vh' }}>
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid var(--border)' }}>
          <button onClick={() => router.push('/app')} style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', color:'var(--muted)', fontSize:'12px', cursor:'pointer', fontFamily:'inherit', padding:'4px 6px', borderRadius:'6px', marginBottom:'10px' }}
            onMouseOver={e => e.currentTarget.style.color='var(--text)'}
            onMouseOut={e => e.currentTarget.style.color='var(--muted)'}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
            Mes dossiers
          </button>
          <div style={{ fontSize:'13px', fontWeight:'700', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'6px' }}>{campaign.name}</div>
          <span className={`badge badge-${campaign.status==='done'?'green':campaign.status==='generating'?'blue':'muted'}`} style={{ fontSize:'11px' }}>
            {campaign.status==='done'?'Terminé':campaign.status==='generating'?'En cours':'Brouillon'}
          </span>
        </div>
        <nav style={{ flex:1, padding:'12px 8px' }}>
          <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--muted)', padding:'8px 8px 4px', letterSpacing:'0.5px', textTransform:'uppercase' }}>Navigation</div>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', textAlign:'left', padding:'9px 10px', borderRadius:'var(--r)', border:'none', fontSize:'13px', fontWeight: tab===t.id ? '600' : '500', cursor:'pointer', marginBottom:'2px', background: tab===t.id ? 'var(--mf-blue-lt)' : 'none', color: tab===t.id ? 'var(--mf-blue)' : 'var(--text2)', fontFamily:'inherit', transition:'all .15s' }}
              onMouseOver={e => { if(tab!==t.id) e.currentTarget.style.background='var(--surface)'; }}
              onMouseOut={e => { if(tab!==t.id) e.currentTarget.style.background='none'; }}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding:'12px', borderTop:'1px solid var(--border)' }}>
          <button className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center' }} onClick={exportCSV}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            Exporter CSV
          </button>
        </div>
      </aside>

      <main style={{ flex:1, padding:'28px', overflowY:'auto' }}>

        {/* OVERVIEW */}
        {tab==='overview' && (
          <div>
            <h1 style={{ fontSize:'18px', fontWeight:'800', marginBottom:'20px' }}>{campaign.name}</h1>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'20px' }}>
              <div className="card">
                <div className="card-title">Client miroir</div>
                {[['Type', campaign.client_type],['Secteur',campaign.client_sector],['Domaine poste',campaign.job_title_target],['Localisation',campaign.client_location],['Besoin',campaign.client_need]].filter(r=>r[1]).map(([k,v])=>(
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
                    <span style={{ color:'var(--muted)', fontWeight:'500' }}>{k}</span>
                    <span style={{ fontWeight:'600' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">Cas client & résultats</div>
                {campaign.freelance_result && <div style={{ fontSize:'13px', marginBottom:'10px' }}>{campaign.freelance_result}</div>}
                {campaign.freelance_kpi && <div style={{ background:'var(--mf-blue-lt)', color:'var(--mf-blue)', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', fontWeight:'600', marginBottom:'8px' }}>{campaign.freelance_kpi}</div>}
                {campaign.freelance_angle && <div style={{ fontSize:'12px', color:'var(--muted)' }}>{campaign.freelance_angle}</div>}
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <div className="card" style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:'800', color:'var(--mf-blue)' }}>{visibleProspects.length}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)' }}>Prospects</div>
              </div>
              <div className="card" style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:'800', color:'var(--mf-blue)' }}>{visibleProspects.filter(p=>p.email).length}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)' }}>Emails trouvés</div>
              </div>
              <div className="card" style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:'800', color:'var(--muted)' }}>{reserveWithEmail}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)' }}>En réserve (avec email)</div>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH */}
        {tab==='search' && (
          <div>
            <div style={{ marginBottom:'20px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'700', marginBottom:'2px' }}>Génération de la base prospects</h2>
              <p style={{ fontSize:'13px', color:'var(--muted)' }}>Secteur : <strong>{campaign.client_sector}</strong> · Domaine : <strong>{campaign.job_title_target || '—'}</strong> · Localisation : <strong>{campaign.client_location || 'France'}</strong></p>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px' }}>

              {/* Job titles */}
              <div className="card" style={{ borderLeft:'3px solid var(--mf-blue)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'var(--mf-blue-lt)', display:'grid', placeItems:'center', fontWeight:'800', color:'var(--mf-blue)', flexShrink:0, fontSize:'14px' }}>{selectedTitles.length ? '✓' : '1'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'4px' }}>Postes ciblés</div>
                    {selectedTitles.length === 0 && (
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'var(--r)', padding:'8px 12px', marginBottom:'10px', fontSize:'12px', color:'#92400e' }}>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="#f59e0b" style={{ flexShrink:0 }}><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                        <span><strong>Sélectionne au moins un poste</strong> en cliquant sur les chips ci-dessous.</span>
                      </div>
                    )}
                    <JobTitleSelector selected={selectedTitles} onChange={(titles) => { setSelectedTitles(titles); saveTitles(titles); }} sector={campaign.job_title_target} />
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="card" style={{ borderLeft:`3px solid ${visibleProspects.length ? 'var(--mf-blue)' : 'var(--border)'}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'var(--mf-blue-lt)', display:'grid', placeItems:'center', fontWeight:'800', color:'var(--mf-blue)', flexShrink:0, fontSize:'14px' }}>{visibleProspects.length ? '✓' : '2'}</div>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'4px' }}>Recherche Icypeas</div>
                      <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'6px' }}>Scrape 3× la limite — enrichissement email automatique sur tous les résultats</div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontSize:'12px', color:'var(--muted)' }}>Afficher :</span>
                        {[10, 25, 50].map(n => {
                          const active = (searchLimit || campaign.prospect_limit || 10) === n;
                          return (
                            <button key={n} onClick={() => setSearchLimit(n)}
                              style={{ padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight: active ? '700' : '500', cursor:'pointer', border:'1.5px solid',
                                borderColor: active ? 'var(--mf-blue)' : 'var(--border)',
                                background: active ? 'var(--mf-blue-lt)' : 'white',
                                color: active ? 'var(--mf-blue)' : 'var(--text2)',
                              }}>{n}</button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <button className={`btn btn-${visibleProspects.length ? 'ghost' : 'primary'} btn-sm`} onClick={runSearch} disabled={busy || !selectedTitles.length} style={{ flexShrink:0 }}>
                    {busy ? <div className="spinner" /> : null}
                    {visibleProspects.length ? 'Relancer' : 'Lancer la recherche'}
                  </button>
                </div>
              </div>

              {/* Sequence */}
              <div className="card" style={{ borderLeft:`3px solid ${sequences.length ? 'var(--mf-blue)' : 'var(--border)'}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'var(--mf-blue-lt)', display:'grid', placeItems:'center', fontWeight:'800', color:'var(--mf-blue)', flexShrink:0, fontSize:'14px' }}>{sequences.length ? '✓' : '3'}</div>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'600' }}>Séquence IA</div>
                      <div style={{ fontSize:'12px', color:'var(--muted)' }}>1 séquence de 3 emails + 2 LinkedIn pour tous les contacts</div>
                    </div>
                  </div>
                  <button className={`btn btn-${sequences.length ? 'ghost' : 'primary'} btn-sm`} onClick={runSequences} disabled={busy || !visibleProspects.length} style={{ flexShrink:0 }}>
                    {busy ? <div className="spinner" /> : null}
                    {sequences.length ? 'Relancer' : 'Générer la séquence'}
                  </button>
                </div>
              </div>
            </div>

            {log.length > 0 && (
              <div className="card">
                <div className="card-title">Journal</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'200px', overflowY:'auto' }}>
                  {log.map((l,i) => (
                    <div key={i} style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:l.type==='ok'?'var(--mf-blue)':l.type==='err'?'var(--red)':l.type==='inf'?'var(--mf-blue)':'var(--muted)', display:'flex', gap:'10px' }}>
                      <span style={{ opacity:.5, flexShrink:0 }}>{l.ts}</span><span>{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROSPECTS */}
        {tab==='prospects' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'700' }}>
                Base prospects ({visibleProspects.length})
                {polling && <span style={{ fontSize:'12px', color:'var(--muted)', fontWeight:'400', marginLeft:'10px', display:'inline-flex', alignItems:'center', gap:'5px' }}><div className="spinner spinner-dark" /> Emails en cours...</span>}
              </h2>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {reserveWithEmail > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={generateMore}>
                    + Générer plus ({reserveWithEmail} avec email)
                  </button>
                )}
                {prospects.some(p => p.icypeas_search_id && !p.email && !p.reserve) && (
                  <button className="btn btn-ghost btn-sm" onClick={collectEmails} disabled={enriching}>
                    {enriching ? <div className="spinner spinner-dark" /> : null}
                    Récupérer emails ({prospects.filter(p => p.icypeas_search_id && !p.email && !p.reserve).length})
                  </button>
                )}
              </div>
            </div>

            {visibleProspects.length > 0 && selected.length === 0 && (
              <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:'12px', fontSize:'12px', color:'#1e40af', display:'flex', alignItems:'center', gap:'8px' }}>
                <span>Les emails sont recherchés automatiquement. Coche des contacts pour relancer manuellement si besoin.</span>
              </div>
            )}
            {selected.length > 0 && (
              <div style={{ background:'var(--mf-blue-lt)', border:'1px solid rgba(0,144,255,.2)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:'12px', fontSize:'12px', color:'var(--mf-blue)', fontWeight:'600', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>{selected.length === visibleProspects.length ? 'Tous sélectionnés' : selected.length + ' sélectionné(s)'}</span>
                <button onClick={() => setSelected([])} style={{ background:'none', border:'none', color:'var(--mf-blue)', cursor:'pointer', fontSize:'12px', textDecoration:'underline', fontFamily:'inherit' }}>Désélectionner</button>
              </div>
            )}

            {!visibleProspects.length ? (
              <div style={{ textAlign:'center', padding:'40px', color:'var(--muted)' }}>
                <div style={{ width:'40px', height:'40px', background:'var(--surface)', borderRadius:'10px', display:'grid', placeItems:'center', margin:'0 auto 12px' }}><svg width="20" height="20" viewBox="0 0 20 20" fill="var(--muted)"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM.458 10C1.732 7.943 4.022 7 6 7c.34 0 .672.033.993.095A4.979 4.979 0 004.667 14H2a2 2 0 01-2-2v-2zm14 0c1.274-2.057 3.564-3 5.542-3 .34 0 .672.033.993.095A4.979 4.979 0 0017.333 14H16a2 2 0 01-2-2v-2z"/></svg></div>
                <div style={{ fontWeight:'700', marginBottom:'6px' }}>Aucun prospect</div>
                <button className="btn btn-primary btn-sm" onClick={() => setTab('search')}>Lancer la recherche →</button>
              </div>
            ) : (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'650px' }}>
                  <thead style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding:'9px 12px', width:'36px' }}>
                        <input type="checkbox" checked={selected.length === visibleProspects.length && visibleProspects.length > 0} onChange={toggleAll} style={{ cursor:'pointer', width:'14px', height:'14px' }} />
                      </th>
                      {['Nom','Poste','Entreprise','Email','Score','LinkedIn',''].map(h=>(
                        <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'9px', fontWeight:'700', letterSpacing:'1.2px', textTransform:'uppercase', color:'var(--muted)', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...visibleProspects].sort((a,b) => {
                      const score = p => p.email ? 0 : (p.icypeas_search_id ? 1 : 2);
                      return score(a) - score(b);
                    }).map((p,i) => (
                      <tr key={p.id} style={{ borderBottom:'1px solid rgba(226,230,243,.5)', background: selected.includes(p.id) ? 'var(--mf-blue-lt)' : 'white' }}>
                        <td style={{ padding:'9px 12px' }}>
                          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} style={{ cursor:'pointer', width:'14px', height:'14px' }} />
                        </td>
                        <td style={{ padding:'9px 12px', fontWeight:'600' }}>{p.fullname||'—'}</td>
                        <td style={{ padding:'9px 12px', color:'var(--text2)', maxWidth:'130px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.job_title||'—'}</td>
                        <td style={{ padding:'9px 12px', maxWidth:'130px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.company||'—'}</td>
                        <td style={{ padding:'9px 12px', fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>
                          {p.email
                            ? <span style={{ color:'var(--mf-blue)', fontWeight:'600' }}>{p.email}</span>
                            : p.icypeas_search_id
                              ? <span style={{ color:'var(--muted)', fontSize:'11px' }}>⏳ en cours...</span>
                              : <span style={{ color:'var(--muted)' }}>—</span>
                          }
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          {p.email_cert ? <span style={{ background:'var(--mf-blue-lt)', color:'var(--mf-blue)', padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontWeight:'600' }}>{p.email_cert}</span> : '—'}
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          {p.linkedin_url ? <a href={p.linkedin_url} target="_blank" rel="noopener" style={{ color:'var(--mf-blue)', fontWeight:'600', fontSize:'12px' }}>↗</a> : '—'}
                        </td>
                        <td style={{ padding:'9px 6px' }}>
                          <button onClick={() => deleteProspect(p.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:'4px', borderRadius:'4px' }}
                            onMouseOver={e => e.currentTarget.style.color='var(--red)'}
                            onMouseOut={e => e.currentTarget.style.color='var(--muted)'}>
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
        {tab==='sequences' && (
          <div>
            <div style={{ marginBottom:'16px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'700' }}>Séquence de prospection</h2>
              <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>1 séquence commune — utilisez {'{{PRENOM}}'} et {'{{ENTREPRISE}}'} comme variables</p>
            </div>
            {(() => { const seq = sequences.find(s => s.email_1); return !seq; })() ? (
              <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', color:'var(--muted)' }}>
                <div style={{ width:'40px', height:'40px', background:'var(--surface)', borderRadius:'10px', display:'grid', placeItems:'center', margin:'0 auto 12px' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--muted)"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                </div>
                <div style={{ fontWeight:'600', marginBottom:'6px' }}>Aucune séquence générée</div>
                <button className="btn btn-primary btn-sm" onClick={() => setTab('search')}>Générer la séquence →</button>
              </div>
            ) : (() => {
              const seq = sequences.find(s => s.email_1) || sequences[0];
              const messages = [
                { key:'email_1', label:'Email 1 — Accroche', type:'email' },
                { key:'email_2', label:'Email 2 — Preuve & KPI', type:'email' },
                { key:'email_3', label:'Email 3 — Relance', type:'email' },
                { key:'linkedin_1', label:'LinkedIn 1 — Connexion', type:'linkedin' },
                { key:'linkedin_2', label:'LinkedIn 2 — Suivi', type:'linkedin' },
              ];
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {messages.map(({ key, label, type }) => (
                    <SingleSequenceCard key={key} label={label} type={type} content={seq[key]||''} seqId={seq.id} fieldKey={key} onSave={async (val) => {
                      const token = await getToken();
                      await fetch(`/api/sequences/${seq.id}`, { method:'PATCH', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ [key]: val }) });
                      showToast('Sauvegardé ✓');
                      await load();
                    }} />
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {toast && <div style={{ position:'fixed', bottom:'24px', right:'24px', background:'#0090FF', color:'white', padding:'12px 20px', borderRadius:'var(--r)', fontSize:'13px', fontWeight:'600', boxShadow:'var(--shadow-lg)', animation:'fadeUp .3s ease', zIndex:1000 }}>{toast}</div>}
    </div>
  );
}

function SingleSequenceCard({ label, type, content: initialContent, seqId, fieldKey, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(initialContent);
  const isEmail = type === 'email';

  function copyContent() {
    navigator.clipboard.writeText(val).then(() => {}).catch(() => {});
  }

  return (
    <div className="card" style={{ padding: 0, overflow:'hidden' }}>
      <div style={{ padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', display:'grid', placeItems:'center', background: isEmail ? 'var(--mf-blue-lt)' : '#f0ebff', flexShrink:0 }}>
            {isEmail
              ? <svg width="15" height="15" viewBox="0 0 20 20" fill="var(--mf-blue)"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="#7c3aed"><path d="M16 8c0-2.21-1.79-4-4-4S8 5.79 8 8s1.79 4 4 4 4-1.79 4-4zm-10 9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1H6v-1z"/></svg>
            }
          </div>
          <span style={{ fontSize:'13px', fontWeight:'600' }}>{label}</span>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          <button className="btn btn-ghost btn-sm" onClick={copyContent} title="Copier">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"/><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></svg>
            Copier
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
      <div style={{ padding:'16px 18px' }}>
        {editing ? (
          <textarea className="input" value={val} onChange={e => setVal(e.target.value)} rows={isEmail ? 8 : 4} style={{ fontFamily:'monospace', fontSize:'12px', lineHeight:'1.6' }} />
        ) : (
          <pre style={{ fontFamily:'inherit', fontSize:'13px', lineHeight:'1.7', whiteSpace:'pre-wrap', color:'var(--text2)', margin:0 }}>{val || <span style={{ color:'var(--muted)', fontStyle:'italic' }}>Aucun contenu</span>}</pre>
        )}
      </div>
    </div>
  );
}

const JOB_TITLES_BY_DOMAIN = {
  'Direction générale': ['Dirigeant','PDG','CEO','Directeur Général','Gérant','Associé','Co-fondateur','Président'],
  'Direction financière': ['DAF','CFO','Directeur Administratif et Financier','Responsable financier','Expert-comptable','Chef comptable','Responsable contrôle de gestion'],
  'Direction commerciale': ['Directeur Commercial','Responsable Commercial','Business Developer','Directeur des Ventes','Responsable grands comptes','Chef des ventes'],
  'Direction marketing': ['Directeur Marketing','CMO','Responsable Marketing','Responsable Communication','Directeur de la communication','Responsable digital'],
  'Direction RH': ['DRH','Directeur RH','Responsable RH','Responsable recrutement','HRBP','Responsable formation'],
  'Direction technique': ['DSI','CTO','Directeur technique','Responsable IT','Responsable informatique','Directeur des systèmes d information'],
  'Direction opérations': ['COO','Directeur des Opérations','Directeur de projet','Responsable achats','Directeur supply chain','Responsable logistique'],
  'Métiers juridiques': ['Notaire','Avocat','Directeur juridique','Responsable affaires juridiques','Juriste senior'],
  'Métiers de santé': ['Médecin','Directeur clinique','Directeur EHPAD','Responsable centre de santé','Pharmacien','Directeur médical'],
  'Métiers immobilier': ['Agent immobilier','Directeur agence immobilière','Négociateur immobilier','Promoteur immobilier','Gestionnaire de biens'],
  'Métiers de la restauration': ['Restaurateur','Gérant restaurant','Chef cuisinier','Directeur restauration'],
  'Métiers artisanaux': ['Artisan','Chef d atelier','Maître artisan','Responsable production'],
};

function JobTitleSelector({ selected, onChange, sector }) {
  const [custom, setCustom] = useState('');
  const normalizedSector = (sector || '').trim();
  const titles = JOB_TITLES_BY_DOMAIN[normalizedSector] || [];

  function toggle(t) {
    onChange(selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t]);
  }

  function addCustom() {
    const v = custom.trim();
    if (v && !selected.includes(v)) onChange([...selected, v]);
    setCustom('');
  }

  const customTitles = selected.filter(t => !titles.includes(t));

  return (
    <div>
      <p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'8px' }}>Sélectionne les postes à cibler, ou ajoute un poste personnalisé.</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
        {titles.map(t => (
          <button key={t} onClick={() => toggle(t)}
            style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1.5px solid', transition:'all .15s',
              borderColor: selected.includes(t) ? 'var(--mf-blue)' : 'var(--border)',
              background: selected.includes(t) ? 'var(--mf-blue-lt)' : 'white',
              color: selected.includes(t) ? 'var(--mf-blue)' : 'var(--text2)',
            }}>{t}</button>
        ))}
        {customTitles.map(t => (
          <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'600', background:'var(--mf-blue-lt)', color:'var(--mf-blue)', border:'1.5px solid var(--mf-blue)' }}>
            {t}
            <button onClick={() => onChange(selected.filter(x => x !== t))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--mf-blue)', fontSize:'14px', lineHeight:1, padding:0, fontFamily:'inherit' }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:'8px', marginTop:'6px' }}>
        <input className="input" placeholder="Ajouter un poste personnalisé..." value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCustom()}
          style={{ flex:1, fontSize:'12px' }} />
        {custom.trim() && <button className="btn btn-ghost btn-sm" onClick={addCustom}>+ Ajouter</button>}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop:'8px', fontSize:'12px', color:'var(--muted)', display:'flex', alignItems:'center', gap:'8px' }}>
          <span>{selected.length} poste{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}</span>
          <button onClick={() => onChange([])} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:'12px', fontFamily:'inherit' }}>Tout effacer</button>
        </div>
      )}
    </div>
  );
}
