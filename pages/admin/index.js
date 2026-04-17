import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '../_app'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

/* ── Helpers ── */
async function authHeader(supabase) {
  const { data } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${data.session?.access_token}`,
    'Content-Type': 'application/json',
  }
}

const STATUS_LABEL = {
  done:       { l: 'Terminé',  bg: 'var(--green-bg)',  c: '#15803D' },
  generating: { l: 'En cours', bg: 'var(--amber-bg)',  c: '#78350F' },
  draft:      { l: 'Brouillon',bg: 'var(--bg3)',       c: 'var(--t3)' },
}

/* ── Sub-components ── */
function StatCard({ value, label, sub, accent = false }) {
  return (
    <div style={{
      background: accent ? 'var(--navy)' : 'var(--white)',
      border: `1px solid ${accent ? 'transparent' : 'var(--border)'}`,
      borderRadius: 'var(--r-lg)',
      padding: '20px 24px',
      boxShadow: 'var(--sh1)',
    }}>
      <div style={{
        fontFamily: 'var(--fd)',
        fontSize: 34,
        fontWeight: 800,
        lineHeight: 1,
        background: accent ? 'var(--mf-grad)' : 'none',
        WebkitBackgroundClip: accent ? 'text' : 'initial',
        WebkitTextFillColor: accent ? 'transparent' : 'var(--text)',
        color: accent ? undefined : 'var(--text)',
      }}>{value ?? '—'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: accent ? 'rgba(255,255,255,.75)' : 'var(--t2)', marginTop: 7 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: accent ? 'rgba(255,255,255,.35)' : 'var(--t4)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(15,23,42,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(4px)',
      }}>
      <div style={{
        background: 'var(--white)',
        borderRadius: 'var(--r-xl)',
        padding: 32,
        width: '100%', maxWidth: 460,
        boxShadow: 'var(--sh4)',
      }}>
        {children}
      </div>
    </div>
  )
}

/* ── Toast ── */
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      background: 'var(--navy)', color: 'var(--white)',
      padding: '12px 20px', borderRadius: 'var(--r-lg)',
      fontSize: 13, fontWeight: 600,
      boxShadow: 'var(--sh4)',
      zIndex: 1000,
      animation: 'fadeIn .25s ease',
    }}>
      {msg}
    </div>
  )
}

/* ══════════════════════════════════════
   MAIN ADMIN PAGE
══════════════════════════════════════ */
export default function AdminPage() {
  const { profile, loading, signOut } = useAuth()
  const supabase = useSupabaseClient()
  const router   = useRouter()

  const [tab, setTab]           = useState('stats')
  const [stats, setStats]       = useState(null)
  const [users, setUsers]       = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [userFilter, setUserFilter] = useState('')
  const [modal, setModal]       = useState(null) // null | 'create' | user-object
  const [form, setForm]         = useState({ email: '', password: '', full_name: '' })
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [search, setSearch]     = useState('')

  /* ── Auth guard ── */
  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'admin')) router.push('/login')
  }, [loading, profile])

  useEffect(() => {
    if (profile?.role !== 'admin') return
    fetchStats()
    fetchUsers()
  }, [profile])

  useEffect(() => {
    if (tab === 'campaigns' && profile?.role === 'admin') fetchCampaigns()
  }, [tab, userFilter, profile])

  /* ── API helpers ── */
  async function apiFetch(url, opts = {}) {
    const h = await authHeader(supabase)
    const r = await fetch(url, { ...opts, headers: { ...h, ...opts.headers } })
    return r.json()
  }

  async function fetchStats() {
    const d = await apiFetch('/api/admin/stats')
    setStats(d)
  }

  async function fetchUsers() {
    const d = await apiFetch('/api/admin/users')
    setUsers(d.users || [])
  }

  async function fetchCampaigns() {
    const url = userFilter ? `/api/admin/campaigns?user_id=${userFilter}` : '/api/admin/campaigns'
    const d = await apiFetch(url)
    setCampaigns(d.campaigns || [])
  }

  async function createUser() {
    setSaving(true)
    const d = await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(form) })
    if (d.error) { flash('Erreur : ' + d.error) }
    else { flash('Compte créé ✓'); setModal(null); setForm({ email: '', password: '', full_name: '' }); fetchUsers(); fetchStats() }
    setSaving(false)
  }

  async function toggleUser(u) {
    await apiFetch(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !u.is_active }) })
    flash(u.is_active ? 'Compte désactivé' : 'Compte activé ✓')
    fetchUsers()
  }

  async function updatePassword(userId, pwd) {
    if (!pwd) return
    const d = await apiFetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ password: pwd }) })
    if (d.ok) flash('Mot de passe mis à jour ✓')
    else flash('Erreur : ' + d.error)
  }

  async function deleteUser(u) {
    if (!confirm(`Supprimer ${u.email} et toutes ses données ?`)) return
    await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    flash('Compte supprimé.')
    fetchUsers(); fetchStats()
  }

  async function downloadProspects(campaignId, campaignName) {
    const d = await apiFetch(`/api/admin/campaigns?prospects=1&campaign_id=${campaignId}`)
    const prospects = d.prospects || []
    if (!prospects.length) { flash('Aucun prospect pour ce dossier.'); return }

    const header = ['Nom', 'Poste', 'Entreprise', 'Secteur', 'Email', 'Score', 'Localisation', 'LinkedIn']
    const rows = prospects.map(p =>
      [p.fullname, p.job_title, p.company, p.sector, p.email, p.email_cert, p.location, p.linkedin_url]
        .map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')
    )
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `${campaignName.replace(/[^a-z0-9]/gi, '_')}_prospects.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    flash('CSV téléchargé ✓')
  }

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  /* ── Loading state ── */
  if (loading || !profile) return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div className="spinner" style={{ width: 24, height: 24 }} />
    </div>
  )

  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase()
    return !s || (u.email || '').toLowerCase().includes(s) || (u.full_name || '').toLowerCase().includes(s)
  })

  const NAV = [
    { id: 'stats',     icon: '▲', label: 'Tableau de bord' },
    { id: 'users',     icon: '◎', label: 'Freelances' },
    { id: 'campaigns', icon: '⬡', label: 'Bases prospects' },
  ]

  return (
    <>
      <Head><title>Admin — Mission Freelances</title></Head>

      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 'var(--sidebar)',
          background: 'var(--navy)',
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh',
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,.04)',
        }}>
          {/* Logo */}
          <div style={{ padding: '22px 20px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#fff 0%,#93C5FD 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mission</div>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800, background: 'var(--mf-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Freelances</div>
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', background: 'rgba(239,68,68,.15)', borderRadius: 4 }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 9, fontWeight: 600, color: '#FCA5A5', letterSpacing: '.08em', textTransform: 'uppercase' }}>Admin</span>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 10px' }}>
            {NAV.map(item => {
              const active = tab === item.id
              return (
                <button key={item.id} onClick={() => setTab(item.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 12px', borderRadius: 'var(--r-md)',
                  marginBottom: 2, width: '100%', textAlign: 'left',
                  background: active ? 'rgba(59,130,246,.15)' : 'transparent',
                  color: active ? 'var(--abl)' : 'rgba(255,255,255,.45)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: 'all .14s', border: 'none', fontFamily: 'var(--fb)',
                }}>
                  <span style={{ fontSize: 14, opacity: active ? 1 : .6 }}>{item.icon}</span>
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* User + signout */}
          <div style={{ padding: '14px 14px 20px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: 'var(--fm)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.email}
            </div>
            <button onClick={signOut} style={{
              width: '100%', padding: '7px 12px', borderRadius: 'var(--r-md)',
              fontSize: 12, color: 'rgba(255,255,255,.35)',
              background: 'transparent', border: '1px solid rgba(255,255,255,.08)',
              fontFamily: 'var(--fb)', cursor: 'pointer', transition: 'all .14s',
            }}>Déconnexion</button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{ flex: 1, minWidth: 0, padding: '32px 36px 60px', overflowY: 'auto' }}>

          {/* ════ STATS TAB ════ */}
          {tab === 'stats' && (
            <div className="fade-in">
              <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', marginBottom: 4 }}>
                Tableau de bord
              </h1>
              <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 28 }}>Vue globale de la plateforme</p>

              {stats ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                    <StatCard value={stats.active_freelances}    label="Freelances actifs"     sub={`/${stats.total_freelances} total`} />
                    <StatCard value={stats.total_campaigns}      label="Campagnes"              sub={`${stats.completed_campaigns} terminées`} accent />
                    <StatCard value={stats.total_prospects}      label="Prospects générés"      sub="via Icypeas" />
                    <StatCard value={stats.total_sequences}      label="Séquences Claude"       sub="générées" />
                  </div>

                  {/* Recent campaigns table */}
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                        Campagnes récentes
                      </h2>
                    </div>
                    {stats.recent_campaigns?.length ? (
                      <table className="table">
                        <thead>
                          <tr>
                            {['Nom', 'Freelance', 'Prospects', 'Statut', 'Date'].map(h => <th key={h}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recent_campaigns.map(c => {
                            const s = STATUS_LABEL[c.status] || STATUS_LABEL.draft
                            return (
                              <tr key={c.id}>
                                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</td>
                                <td style={{ color: 'var(--t3)' }}>{c.profiles?.full_name || c.profiles?.email || '—'}</td>
                                <td>
                                  {c.prospects_count > 0
                                    ? <span className="badge badge-new">{c.prospects_count}</span>
                                    : <span style={{ color: 'var(--t4)' }}>—</span>}
                                </td>
                                <td>
                                  <span className="badge" style={{ background: s.bg, color: s.c }}>{s.l}</span>
                                </td>
                                <td style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--t4)' }}>
                                  {new Date(c.created_at).toLocaleDateString('fr-FR')}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty"><p>Aucune campagne pour l'instant.</p></div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                  <div className="spinner" />
                </div>
              )}
            </div>
          )}

          {/* ════ USERS TAB ════ */}
          {tab === 'users' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', marginBottom: 4 }}>Freelances</h1>
                  <p style={{ fontSize: 13, color: 'var(--t3)' }}>{users.length} compte{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setModal('create')}>+ Créer un compte</button>
              </div>

              {/* Search */}
              <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
                <input
                  className="input"
                  placeholder="Rechercher par nom ou email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: 300, padding: '8px 12px' }}
                />
              </div>

              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      {['Nom', 'Email', 'Campagnes', 'Statut', 'Créé le', 'Actions'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{u.full_name || '—'}</td>
                        <td style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--t3)' }}>{u.email}</td>
                        <td>
                          <span className="badge badge-new">{u.campaigns_count ?? 0}</span>
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: u.is_active ? 'var(--green-bg)' : 'var(--red-bg)',
                            color: u.is_active ? '#15803D' : '#991B1B',
                          }}>
                            {u.is_active ? 'Actif' : 'Désactivé'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--t4)' }}>
                          {new Date(u.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setModal(u)}>✏ Éditer</button>
                            <button
                              className="btn btn-sm"
                              style={{
                                background: u.is_active ? 'var(--amber-bg)' : 'var(--green-bg)',
                                color: u.is_active ? '#92400E' : '#15803D',
                                border: 'none',
                              }}
                              onClick={() => toggleUser(u)}>
                              {u.is_active ? 'Désactiver' : 'Activer'}
                            </button>
                            <button className="btn btn-sm" style={{ background: 'var(--red-bg)', color: '#991B1B', border: 'none' }} onClick={() => deleteUser(u)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--t4)' }}>
                        {users.length === 0 ? 'Aucun freelance enregistré.' : 'Aucun résultat.'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════ CAMPAIGNS TAB ════ */}
          {tab === 'campaigns' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', marginBottom: 4 }}>Bases prospects</h1>
                  <p style={{ fontSize: 13, color: 'var(--t3)' }}>Consulter et télécharger les prospects générés</p>
                </div>
                <select
                  className="select"
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  style={{ width: 220, padding: '9px 14px' }}>
                  <option value="">Tous les freelances</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </div>

              {campaigns.length === 0 ? (
                <div className="card">
                  <div className="empty">
                    <div className="empty-icon">⬡</div>
                    <h3>Aucun dossier</h3>
                    <p>{userFilter ? 'Ce freelance n\'a pas encore de campagne.' : 'Aucune campagne sur la plateforme.'}</p>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        {['Dossier', 'Freelance', 'Secteur', 'Prospects', 'Statut', 'Date', 'Export'].map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(c => {
                        const s = STATUS_LABEL[c.status] || STATUS_LABEL.draft
                        return (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</td>
                            <td style={{ color: 'var(--t3)', fontSize: 12 }}>{c.profiles?.full_name || c.profiles?.email || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--t3)' }}>
                              {[c.client_sector, c.client_location].filter(Boolean).join(' · ') || '—'}
                            </td>
                            <td>
                              {c.prospects_count > 0
                                ? <span className="badge badge-new">{c.prospects_count}</span>
                                : <span style={{ color: 'var(--t4)' }}>—</span>}
                            </td>
                            <td>
                              <span className="badge" style={{ background: s.bg, color: s.c }}>{s.l}</span>
                            </td>
                            <td style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--t4)' }}>
                              {new Date(c.created_at).toLocaleDateString('fr-FR')}
                            </td>
                            <td>
                              {c.prospects_count > 0 ? (
                                <button className="btn btn-secondary btn-sm" onClick={() => downloadProspects(c.id, c.name)}>
                                  ↓ CSV
                                </button>
                              ) : <span style={{ color: 'var(--t4)' }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Modal create ── */}
      {modal === 'create' && (
        <Modal onClose={() => setModal(null)}>
          <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, fontWeight: 800, marginBottom: 20 }}>+ Créer un compte freelance</h2>
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="label">Prénom / Nom</label>
            <input className="input" placeholder="Marie Dupont" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="label">Email *</label>
            <input className="input" type="email" placeholder="marie@mail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 22 }}>
            <label className="label">Mot de passe *</label>
            <input className="input" type="password" placeholder="Min. 8 caractères" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
            <button className="btn btn-primary" onClick={createUser} disabled={saving || !form.email || !form.password}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} /> : null}
              Créer le compte
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal edit user ── */}
      {modal && modal !== 'create' && (
        <Modal onClose={() => setModal(null)}>
          <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>✏ Éditer</h2>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20, fontFamily: 'var(--fm)' }}>{modal.email}</p>
          <EditPasswordForm
            onSave={pwd => { updatePassword(modal.id, pwd); setModal(null) }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      <Toast msg={toast} />
    </>
  )
}

function EditPasswordForm({ onSave, onClose }) {
  const [pwd, setPwd] = useState('')
  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
        Laisse vide pour ne pas changer le mot de passe.
      </p>
      <div className="field" style={{ marginBottom: 22 }}>
        <label className="label">Nouveau mot de passe</label>
        <input className="input" type="password" placeholder="Nouveau mot de passe..." value={pwd} onChange={e => setPwd(e.target.value)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={() => onSave(pwd)} disabled={!pwd}>
          Sauvegarder
        </button>
      </div>
    </>
  )
}

// Force SSR — évite les erreurs d'hydration avec l'auth client-side
export async function getServerSideProps() {
  return { props: {} }
}
