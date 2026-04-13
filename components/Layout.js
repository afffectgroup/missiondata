import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../pages/_app'

const NAV = [
  { href: '/dashboard', icon: '⬡', label: 'Mes bases' },
  { href: '/contacts',  icon: '◎', label: 'Contacts' },
  { href: '/export',    icon: '↓', label: 'Exports',  soon: true },
  { href: '/stats',     icon: '▲', label: 'Stats',    soon: true },
]

export default function Layout({ children, title, action }) {
  const router = useRouter()
  const { profile, signOut } = useAuth()

  const initials = profile?.email?.slice(0, 2).toUpperCase() || 'MD'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar)', background: 'var(--navy)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        borderRight: '1px solid rgba(255,255,255,.04)',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontFamily: 'var(--fd)', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}>
            <span style={{ background: 'linear-gradient(135deg, #A2D6E2 0%, #fff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mission</span>
            <br />
            <span style={{ background: 'var(--brand-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'brightness(3)' }}>Data</span>
          </div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'rgba(162,214,226,.35)', marginTop: 4, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            B2B Intelligence
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(item => {
            const active = router.pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.soon ? '#' : item.href}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px',
                  borderRadius: 'var(--r-md)', marginBottom: 2,
                  background: active ? 'rgba(162,214,226,.1)' : 'transparent',
                  color: active ? 'var(--brand-lt)' : 'rgba(255,255,255,.42)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: item.soon ? 'not-allowed' : 'pointer', transition: 'all .14s',
                }}>
                  <span style={{ fontSize: 14, opacity: active ? 1 : .6 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.soon && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--fm)', background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.28)', padding: '2px 6px', borderRadius: 4 }}>
                      bientôt
                    </span>
                  )}
                </div>
              </Link>
            )
          })}

          {/* Admin */}
          {profile?.role === 'admin' && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '10px 4px' }} />
              <Link href="/admin">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px',
                  borderRadius: 'var(--r-md)',
                  background: router.pathname.startsWith('/admin') ? 'rgba(239,68,68,.1)' : 'transparent',
                  color: router.pathname.startsWith('/admin') ? '#FCA5A5' : 'rgba(255,255,255,.28)',
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
            <div style={{ width: 30, height: 30, borderRadius: 'var(--r-full)', background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.email?.split('@')[0]}
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'rgba(255,255,255,.28)' }}>
                {profile?.role || 'user'}
              </div>
            </div>
          </div>
          <button onClick={() => signOut().then(() => location.href='/')} style={{ width: '100%', padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 12, color: 'rgba(255,255,255,.32)', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', fontFamily: 'var(--fb)', cursor: 'pointer' }}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ marginLeft: 'var(--sidebar)', flex: 1, minWidth: 0 }}>
        {(title || action) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 36px 0' }}>
            {title && <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em' }}>{title}</h1>}
            {action && <div>{action}</div>}
          </div>
        )}
        <div style={{ padding: '24px 36px 48px' }}>{children}</div>
      </main>
    </div>
  )
}
