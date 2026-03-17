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
  const [searchLimit, setSearchLimit] = useState(50);
  const [selected, setSelected] = useState([]);
  const [enriching, setEnriching] = useState(false);

  function toggleSelect(id) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  function toggleAll() {
    setSelected(p => p.length === prospects.length ? [] : prospects.map(p => p.id));
  }

  async function runEnrich() {
    if (!selected.length) { showToast('Selectionne au moins un prospect.'); return; }
    setEnriching(true);
    showToast('Lancement des recherches emails...');
    const token = await getToken();
    // Step 1: submit
    const r1 = await fetch('/api/prospects/enrich', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_ids: selected, action: 'submit' }),
    });
    const d1 = await r1.json();
    if (d1.error) { showToast('Erreur : ' + d1.error); setEnriching(false); return; }
    showToast(d1.submitted + ' recherche(s) lancee(s). Attends 20-30s puis clique sur "Recuperer les emails".');
    setSelected([]);
    await load();
    setEnriching(false);
  }

  async function collectEmails() {
    setEnriching(true);
    showToast('Recuperation des emails en cours...');
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
    showToast(d.enriched + ' email(s) recupere(s) !' + (d.pending > 0 ? ' ' + d.pending + ' encore en attente.' : ''));
    await load();
    setEnriching(false);
  }

  useEffect(() => { if (!loading && !profile) router.push('/login'); }, [loading, profile]);
  useEffect(() => { if (id && profile) load(); }, [id, profile]);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch(`/api/campaigns/${id}`, { headers:{ Authorization:`Bearer ${s.session?.access_token}` } });
    const d = await r.json();
    if (d.campaign) {
      setCampaign(d.campaign);
      setProspects(d.prospects||[]);
      setSequences(d.sequences||[]);
      if (d.campaign.mirror_criteria) setMirrorCriteria(d.campaign.mirror_criteria);
      if (d.campaign.selected_titles) setSelectedTitles(d.campaign.selected_titles);
    }
  }

  async function getToken() {
    const { data: s } = await supabase.auth.getSession();
    return s.session?.access_token;
  }

  function addLog(msg, type='') { setLog(p => [...p, { msg, type, ts: new Date().toLocaleTimeString() }]); }
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  // STEP 2: Search prospects
  async function runSearch() {
    if (!selectedTitles.length) { showToast('Sélectionne au moins un poste.'); return; }
    setBusy(true); addLog('Recherche Icypeas en cours…', 'inf');
    const token = await getToken();

    // Persist selected titles
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_titles: selectedTitles }),
    });

    const query = {
      currentJobTitle: { include: selectedTitles },
      ...(campaign.client_location ? { location: { include: [campaign.client_location] } } : {}),
      ...(campaign.client_sector ? { industry: { include: [campaign.client_sector] } } : {}),
    };

    const r = await fetch('/api/prospects/search', {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ campaign_id: id, query, limit: searchLimit }),
    });
    const d = await r.json();
    if (d.error) { addLog('Erreur : ' + d.error, 'err'); setBusy(false); return; }
    addLog(`${d.saved} prospects sauvegardés (${d.total} disponibles)`, 'ok');
    await load();
    setBusy(false);
  }

  // STEP 3: Generate sequences
  async function runSequences() {
    if (!prospects.length) { showToast('Génère d\'abord la base de prospects.'); return; }
    setBusy(true); addLog('Génération de la séquence IA…', 'inf');
    addLog('1 séquence commune pour tous les contacts — cela prend environ 15 secondes…');
    const token = await getToken();
    const r = await fetch('/api/sequences/generate', {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ campaign_id: id }),
    });
    const d = await r.json();
    if (d.error) { addLog('❌ Erreur : ' + d.error, 'err'); setBusy(false); return; }
    addLog(`${d.generated} séquence générée !`, 'ok');
    await load();
    setTab('sequences');
    setBusy(false);
  }

  // Export CSV
  function exportCSV() {
    const rows = prospects.map(p => {
      const seq = sequences.find(s => s.prospect_id === p.id) || {};
      return [p.fullname,p.job_title,p.company,p.sector,p.email,p.email_cert,p.location,p.linkedin_url,seq.email_1?.replace(/\n/g,' ')||'',seq.email_2?.replace(/\n/g,' ')||'',seq.email_3?.replace(/\n/g,' ')||'',seq.linkedin_1||'',seq.linkedin_2?.replace(/\n/g,' ')||'']
        .map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(',');
    });
    const headers = 'Nom,Poste,Entreprise,Secteur,Email,Fiabilité,Localisation,LinkedIn,Email1,Email2,Email3,LI1,LI2';
    const csv = '\uFEFF' + [headers, ...rows].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download = `${campaign?.name?.replace(/[^a-z0-9]/gi,'_')||'export'}.csv`; a.click();
    showToast('CSV exporté ✓');
  }

  function exportGS() {
    exportCSV();
    setTimeout(() => window.open('https://sheets.new','_blank'), 500);
  }

  if (loading || !campaign) return <div style={{ display:'grid', placeItems:'center', height:'100vh', color:'var(--muted)' }}>Chargement…</div>;

  const tabs = [
    { id:'overview',  label:'Aperçu',                  icon:<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg> },
    { id:'search',    label:'Génération',               icon:<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg> },
    { id:'prospects', label:`Prospects (${prospects.length})`, icon:<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM.458 10C1.732 7.943 4.022 7 6 7c.34 0 .672.033.993.095A4.979 4.979 0 004.667 14H2a2 2 0 01-2-2v-2zm14 0c1.274-2.057 3.564-3 5.542-3 .34 0 .672.033.993.095A4.979 4.979 0 0017.333 14H16a2 2 0 01-2-2v-2z"/></svg> },
    { id:'sequences', label:'Séquence',                 icon:<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg> },
  ];

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>

      {/* SIDEBAR */}
      <aside style={{ width:'240px', background:'white', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100vh' }}>
        {/* Header */}
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

        {/* Nav tabs */}
        <nav style={{ flex:1, padding:'12px 8px' }}>
          <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--muted)', padding:'8px 8px 4px', letterSpacing:'0.5px', textTransform:'uppercase' }}>Navigation</div>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', textAlign:'left', padding:'9px 10px', borderRadius:'var(--r)', border:'none', fontSize:'13px', fontWeight: tab===t.id ? '600' : '500', cursor:'pointer', marginBottom:'2px', background: tab===t.id ? 'var(--mf-blue-lt)' : 'none', color: tab===t.id ? 'var(--mf-blue)' : 'var(--text2)', fontFamily:'inherit', transition:'all .15s' }}
              onMouseOver={e => { if(tab!==t.id) e.currentTarget.style.background='var(--surface)'; }}
              onMouseOut={e => { if(tab!==t.id) e.currentTarget.style.background='none'; }}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        {/* Export */}
        <div style={{ padding:'12px', borderTop:'1px solid var(--border)' }}>
          <button className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center' }} onClick={exportCSV}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            Exporter CSV
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex:1, padding:'28px', overflowY:'auto' }}>

        {/* OVERVIEW */}
        {tab==='overview' && (
          <div>
            <h1 style={{ fontSize:'18px', fontWeight:'800', marginBottom:'20px' }}>{campaign.name}</h1>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'20px' }}>
              <div className="card">
                <div className="card-title">Client miroir</div>
                {[['Type', campaign.client_type],['Secteur',campaign.client_sector],['Poste ciblé',campaign.job_title_target],['Localisation',campaign.client_location],['Besoin',campaign.client_need]].filter(r=>r[1]).map(([k,v])=>(
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
                    <span style={{ color:'var(--muted)', fontWeight:'500' }}>{k}</span>
                    <span style={{ fontWeight:'600' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">Cas client & résultats</div>
                {campaign.freelance_result && <div style={{ fontSize:'13px', marginBottom:'10px' }}>{campaign.freelance_result}</div>}
                {campaign.freelance_kpi && <div style={{ background:'var(--mf-green-lt)', color:'var(--mf-green)', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', fontWeight:'600', marginBottom:'8px' }}>{campaign.freelance_kpi}</div>}
                {campaign.freelance_angle && <div style={{ fontSize:'12px', color:'var(--muted)' }}>{campaign.freelance_angle}</div>}
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <div className="card" style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:'800', color:'var(--mf-blue)' }}>{prospects.length}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)' }}>Prospects</div>
              </div>
              <div className="card" style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:'800', color:'var(--mf-green)' }}>{sequences.length}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)' }}>Séquences</div>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH */}
        {tab==='search' && (
          <div>
            <div style={{ marginBottom:'20px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'700', marginBottom:'2px' }}>Génération de la base prospects</h2>
              <p style={{ fontSize:'13px', color:'var(--muted)' }}>Secteur : <strong>{campaign.client_sector}</strong> · Localisation : <strong>{campaign.client_location || 'France'}</strong></p>
            </div>

            {/* Steps */}
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px' }}>

              {/* STEP 1: Select job titles */}
              <div className="card" style={{ borderLeft:`3px solid ${selectedTitles.length ? 'var(--mf-green)' : 'var(--border)'}` }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', flex:1 }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: selectedTitles.length ? 'var(--mf-green-lt)' : 'var(--mf-blue-lt)', display:'grid', placeItems:'center', fontWeight:'800', color: selectedTitles.length ? 'var(--mf-green)' : 'var(--mf-blue)', flexShrink:0, fontSize:'14px' }}>{selectedTitles.length ? '✓' : '1'}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'8px' }}>Postes ciblés</div>
                      <JobTitleSelector selected={selectedTitles} onChange={setSelectedTitles} sector={campaign.client_sector} />
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2: Search */}
              <div className="card" style={{ borderLeft:`3px solid ${prospects.length ? 'var(--mf-green)' : 'var(--border)'}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: prospects.length ? 'var(--mf-green-lt)' : 'var(--mf-blue-lt)', display:'grid', placeItems:'center', fontWeight:'800', color: prospects.length ? 'var(--mf-green)' : 'var(--mf-blue)', flexShrink:0, fontSize:'14px' }}>{prospects.length ? '✓' : '2'}</div>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'6px' }}>Recherche Icypeas</div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontSize:'12px', color:'var(--muted)' }}>Nombre de prospects :</span>
                        {[10, 25, 50].map(n => (
                          <button key={n} onClick={() => setSearchLimit(n)}
                            style={{ padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1.5px solid',
                              borderColor: searchLimit === n ? 'var(--mf-green)' : 'var(--border)',
                              background: searchLimit === n ? 'var(--mf-green-lt)' : 'white',
                              color: searchLimit === n ? 'var(--mf-green)' : 'var(--text2)',
                            }}>{n}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button className={`btn btn-${prospects.length ? 'ghost' : 'primary'} btn-sm`} onClick={runSearch} disabled={busy || !selectedTitles.length} style={{ flexShrink:0 }}>
                    {busy ? <div className="spinner" /> : null}
                    {prospects.length ? 'Relancer' : 'Lancer la recherche'}
                  </button>
                </div>
              </div>

              {/* STEP 3: Sequence */}
              <div className="card" style={{ borderLeft:`3px solid ${sequences.length ? 'var(--mf-green)' : 'var(--border)'}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: sequences.length ? 'var(--mf-green-lt)' : 'var(--mf-blue-lt)', display:'grid', placeItems:'center', fontWeight:'800', color: sequences.length ? 'var(--mf-green)' : 'var(--mf-blue)', flexShrink:0, fontSize:'14px' }}>{sequences.length ? '✓' : '3'}</div>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'600' }}>Séquence IA</div>
                      <div style={{ fontSize:'12px', color:'var(--muted)' }}>Génère 1 séquence de 3 emails + 2 LinkedIn identiques pour tous les contacts</div>
                    </div>
                  </div>
                  <button className={`btn btn-${sequences.length ? 'ghost' : 'primary'} btn-sm`} onClick={runSequences} disabled={busy || !prospects.length} style={{ flexShrink:0 }}>
                    {busy ? <div className="spinner" /> : null}
                    {sequences.length ? 'Relancer' : 'Générer la séquence'}
                  </button>
                </div>
              </div>
            </div>

            {/* Log */}
            {log.length > 0 && (
              <div className="card">
                <div className="card-title">📋 Journal</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'200px', overflowY:'auto' }}>
                  {log.map((l,i) => (
                    <div key={i} style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:l.type==='ok'?'var(--mf-green)':l.type==='err'?'var(--red)':l.type==='inf'?'var(--mf-blue)':'var(--muted)', display:'flex', gap:'10px' }}>
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
              <h2 style={{ fontSize:'16px', fontWeight:'800' }}>Base prospects ({prospects.length})</h2>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {selected.length > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={runEnrich} disabled={enriching}>
                    {enriching ? <div className="spinner" /> : null}
                    {enriching ? 'Lancement...' : 'Rechercher emails (' + selected.length + ')'}
                  </button>
                )}
                {prospects.some(p => p.icypeas_search_id && !p.email) && (
                  <button className="btn btn-green btn-sm" onClick={collectEmails} disabled={enriching}>
                    {enriching ? <div className="spinner" /> : null}
                    {enriching ? 'Recuperation...' : 'Recuperer les emails (' + prospects.filter(p => p.icypeas_search_id && !p.email).length + ')'}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={exportCSV}>Exporter CSV</button>
              </div>
            </div>

            {/* CTA or selection banner */}
            {prospects.length > 0 && selected.length === 0 && (
              <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:'12px', fontSize:'12px', color:'#92400e', display:'flex', alignItems:'center', gap:'8px' }}>
                
                <span>Coche les contacts pour lesquels tu veux générer les emails, puis clique sur <strong>Générer emails</strong>. Tu peux tout sélectionner en une fois avec la case en haut à gauche.</span>
              </div>
            )}
            {selected.length > 0 && (
              <div style={{ background:'var(--mf-blue-lt)', border:'1px solid rgba(31,201,90,.2)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:'12px', fontSize:'12px', color:'var(--mf-blue)', fontWeight:'600', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>{selected.length === prospects.length ? 'Tous les prospects sélectionnés' : selected.length + ' prospect(s) sélectionné(s)'}</span>
                <button onClick={() => setSelected([])} style={{ background:'none', border:'none', color:'var(--mf-blue)', cursor:'pointer', fontSize:'12px', textDecoration:'underline', fontFamily:'Figtree,sans-serif' }}>Tout désélectionner</button>
              </div>
            )}

            {!prospects.length ? (
              <div style={{ textAlign:'center', padding:'40px', color:'var(--muted)' }}>
                <div style={{ width:'40px', height:'40px', background:'var(--surface)', borderRadius:'10px', display:'grid', placeItems:'center', margin:'0 auto 12px' }}><svg width="20" height="20" viewBox="0 0 20 20" fill="var(--muted)"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM.458 10C1.732 7.943 4.022 7 6 7c.34 0 .672.033.993.095A4.979 4.979 0 004.667 14H2a2 2 0 01-2-2v-2zm14 0c1.274-2.057 3.564-3 5.542-3 .34 0 .672.033.993.095A4.979 4.979 0 0017.333 14H16a2 2 0 01-2-2v-2z"/></svg></div>
                <div style={{ fontWeight:'700', marginBottom:'6px' }}>Aucun prospect</div>
                <button className="btn btn-primary btn-sm" onClick={() => setTab('search')}>Lancer la recherche →</button>
              </div>
            ) : (
              <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', overflowX:'auto', boxShadow:'var(--shadow-sm)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'650px' }}>
                  <thead style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding:'9px 12px', width:'36px' }}>
                        <input type="checkbox" checked={selected.length === prospects.length && prospects.length > 0} onChange={toggleAll} style={{ cursor:'pointer', width:'14px', height:'14px' }} />
                      </th>
                      {['Nom','Poste','Entreprise','Email','Score','LinkedIn'].map(h=>(
                        <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'9px', fontWeight:'700', letterSpacing:'1.2px', textTransform:'uppercase', color:'var(--muted)', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...prospects].sort((a,b) => {
                const score = p => {
                  if (p.email) return 0;
                  if (p.email_cert === 'not_found') return 1;
                  return 2;
                };
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
                            ? <span style={{ color:'var(--mf-green)', fontWeight:'600' }}>{p.email}</span>
                            : <span style={{ color:'var(--muted)' }}>—</span>
                          }
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          {p.email_cert
                            ? <span style={{ background:'var(--mf-green-lt)', color:'var(--mf-green)', padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontWeight:'600' }}>{p.email_cert}</span>
                            : '—'
                          }
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          {p.linkedin_url
                            ? <a href={p.linkedin_url} target="_blank" rel="noopener" style={{ color:'var(--mf-blue)', fontWeight:'600', fontSize:'12px' }}>↗ LinkedIn</a>
                            : '—'
                          }
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
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:'700' }}>Séquence de prospection</h2>
                <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>1 séquence commune — utilisez [Prénom] et [Entreprise] comme variables</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={exportCSV}>Exporter CSV</button>
            </div>
            {(() => { const seq = sequences.find(s => s.email_1); return !seq; })() ? (
              <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', color:'var(--muted)' }}>
                <div style={{ width:'40px', height:'40px', background:'var(--surface)', borderRadius:'10px', display:'grid', placeItems:'center', margin:'0 auto 12px' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--muted)"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                </div>
                <div style={{ fontWeight:'600', marginBottom:'6px' }}>Aucune séquence générée</div>
                <p style={{ fontSize:'13px', marginBottom:'16px' }}>Va dans l'onglet Recherche et clique sur "Générer les séquences"</p>
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

      {toast && <div style={{ position:'fixed', bottom:'24px', right:'24px', background:'var(--mf-dark)', color:'white', padding:'12px 20px', borderRadius:'var(--r)', fontSize:'13px', fontWeight:'600', boxShadow:'var(--shadow-lg)', animation:'fadeUp .3s ease', zIndex:1000 }}>{toast}</div>}
    </div>
  );
}


function SingleSequenceCard({ label, type, content: initialContent, seqId, fieldKey, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(initialContent);
  const isEmail = type === 'email';

  return (
    <div className="card" style={{ padding: 0, overflow:'hidden' }}>
      <div style={{ padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom: editing ? '1px solid var(--border)' : 'none' }}>
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

const JOB_TITLES_BY_SECTOR = {
  default: [
    'Directeur Général','PDG','CEO','Gérant','Directeur Associé',
    'DAF','Directeur Administratif et Financier',
    'DRH','Directeur des Ressources Humaines',
    'DSI','Directeur des Systèmes d\'Information',
    'Directeur Commercial','Directeur Marketing',
    'Directeur des Opérations','COO',
    'Fondateur','Co-fondateur',
  ],
  Accounting: ['Expert-comptable','Commissaire aux comptes','Chef comptable','DAF','Directeur administratif et financier','Responsable comptabilité','Contrôleur de gestion','Directeur financier'],
  Insurance: ['Courtier en assurance','Agent général d\'assurance','Directeur agence assurance','Responsable sinistres','Chargé de clientèle assurance','Directeur régional assurance'],
  'Real Estate': ['Agent immobilier','Directeur agence immobilière','Négociateur immobilier','Promoteur immobilier','Gestionnaire de biens','Directeur patrimoine'],
  Construction: ['Chef de chantier','Conducteur de travaux','Directeur travaux','Maître d\'oeuvre','Architecte','Directeur BTP','Responsable technique'],
  'Marketing and Advertising': ['Directeur artistique','Directeur agence communication','Chef de projet digital','Directeur marketing','Responsable communication','Head of Marketing'],
  'Information Technology and Services': ['CTO','DSI','Directeur technique','Responsable IT','Chef de projet IT','Directeur digital','Head of Engineering'],
  'Management Consulting': ['Associé cabinet conseil','Directeur conseil','Manager consulting','Partner','Senior Manager'],
  'Financial Services': ['Directeur financier','DAF','Gérant patrimoine','Responsable gestion','Directeur agence bancaire','Conseiller en gestion de patrimoine'],
  'Health, Wellness and Fitness': ['Directeur clinique','Responsable centre santé','Médecin directeur','Directeur EHPAD','Responsable établissement santé'],
  'Professional Training & Coaching': ['Directeur organisme formation','Responsable formation','Directeur pédagogique','Gérant centre formation'],
  'Restaurants': ['Restaurateur','Gérant restaurant','Directeur restauration','Chef cuisinier étoilé','Directeur groupe restauration'],
  'Retail': ['Directeur magasin','Responsable point de vente','Directeur commercial','Gérant boutique','Directeur réseau'],
  'Staffing and Recruiting': ['Directeur cabinet recrutement','Consultant recrutement senior','Responsable RH','DRH','Head of Talent'],
  'Law Practice': ['Avocat associé','Directeur cabinet juridique','Managing Partner','Associé','Responsable juridique'],
  'Legal Services': ['Directeur juridique','Responsable affaires juridiques','Juriste senior','General Counsel'],
};

function JobTitleSelector({ selected, onChange, sector }) {
  const [custom, setCustom] = useState('');
  const titles = JOB_TITLES_BY_SECTOR[sector] || JOB_TITLES_BY_SECTOR.default;

  function toggle(t) {
    onChange(selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t]);
  }

  function addCustom() {
    const v = custom.trim();
    if (v && !selected.includes(v)) onChange([...selected, v]);
    setCustom('');
  }

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
        {titles.map(t => (
          <button key={t} onClick={() => toggle(t)}
            style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1.5px solid', transition:'all .15s',
              borderColor: selected.includes(t) ? 'var(--mf-green)' : 'var(--border)',
              background: selected.includes(t) ? 'var(--mf-green-lt)' : 'white',
              color: selected.includes(t) ? 'var(--mf-green)' : 'var(--text2)',
            }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', gap:'8px' }}>
        <input className="input" placeholder="Ajouter un poste personnalisé..." value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCustom()}
          style={{ flex:1, fontSize:'12px' }} />
        <button className="btn btn-ghost btn-sm" onClick={addCustom} disabled={!custom.trim()}>+ Ajouter</button>
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop:'8px', fontSize:'12px', color:'var(--muted)' }}>
          {selected.length} poste{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
          <button onClick={() => onChange([])} style={{ marginLeft:'8px', background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:'12px', fontFamily:'inherit' }}>Tout effacer</button>
        </div>
      )}
    </div>
  );
}
