import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../pages/_app'

const NAV = [
  { href: '/dashboard', icon: '⬡', label: 'Campagnes' },
  { href: '/prospects', icon: '◎', label: 'Prospects' },
  { href: '/sequences', icon: '✦', label: 'Séquences' },
  { href: '/kanban',    icon: '◈', label: 'Pipeline', soon: true },
  { href: '/stats',     icon: '▲', label: 'Stats',    soon: true },
]

export default function Layout({ children, title, action }) {
  const router  = useRouter()
  const { profile, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  const initials = profile?.email?.slice(0, 2).toUpperCase() || 'MF'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar)',
        background: 'var(--navy)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
        borderRight: '1px solid rgba(255,255,255,.04)',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{
            fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800,
            background: 'linear-gradient(135deg, #fff 0%, #93C5FD 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-.01em',
          }}>Mission</div>
          <div style={{
            fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800,
            background: 'var(--mf-grad)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-.01em',
          }}>Freelances</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(item => {
            const active = router.pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.soon ? '#' : item.href}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 12px', borderRadius: 'var(--r-md)', marginBottom: 2,
                  background: active ? 'rgba(59,130,246,.15)' : 'transparent',
                  color: active ? 'var(--abl)' : 'rgba(255,255,255,.45)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: item.soon ? 'not-allowed' : 'pointer', transition: 'all .14s',
                }}>
                  <span style={{ fontSize: 14, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.soon && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--fm)', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.3)', padding: '2px 6px', borderRadius: 4 }}>
                      bientôt
                    </span>
                  )}
                </div>
              </Link>
            )
          })}

          {/* Admin link — visible only for admins */}
          {profile?.role === 'admin' && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '10px 4px' }} />
              <Link href="/admin">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 12px', borderRadius: 'var(--r-md)',
                  background: router.pathname.startsWith('/admin') ? 'rgba(239,68,68,.12)' : 'transparent',
                  color: router.pathname.startsWith('/admin') ? '#FCA5A5' : 'rgba(255,255,255,.3)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all .14s',
                }}>
                  <span style={{ fontSize: 12 }}>⚙</span>
                  <span>Administration</span>
                </div>
              </Link>
            </>
          )}
        </nav>

        {/* User */}
        <div style={{ padding: '14px 14px 20px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 'var(--r-full)',
              background: 'var(--mf-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>{initials}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.email?.split('@')[0]}
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'rgba(255,255,255,.3)' }}>
                {profile?.role || 'freelance'}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '7px 12px', borderRadius: 'var(--r-md)',
            fontSize: 12, color: 'rgba(255,255,255,.35)',
            background: 'transparent', border: '1px solid rgba(255,255,255,.08)',
            transition: 'all .14s', cursor: 'pointer', fontFamily: 'var(--fb)',
          }}>Déconnexion</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ marginLeft: 'var(--sidebar)', flex: 1, minWidth: 0 }}>
        {(title || action) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 36px 0' }}>
            {title && (
              <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em' }}>
                {title}
              </h1>
            )}
            {action && <div>{action}</div>}
          </div>
        )}
        <div style={{ padding: '24px 36px 48px' }}>{children}</div>
      </main>
    </div>
  )
}
