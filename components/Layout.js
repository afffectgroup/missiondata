import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../pages/_app'

const NAV = [
  { href: '/dashboard',     label: 'Mes bases' },
  { href: '/trouver-email', label: 'Trouver un email' },
]

export default function Layout({ children, title, action }) {
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const initials = profile?.email?.slice(0, 2).toUpperCase() || 'MD'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Sidebar — identique palette MF App (navy #0F172A) ── */}
      <aside style={{
        width: 'var(--sidebar)', background: 'var(--navy)',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,.04)',
      }}>

        {/* Logo — wordmark MF + "Data" en teal */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <Link href="/dashboard">
            <div style={{ cursor: 'pointer' }}>
              {/* Icône Mission Data */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Nouveau logo Mission Data — 3 vagues blanches sur fond teal gradient */}
                  <svg width="36" height="36" viewBox="0 0 1511 1511" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1322.12 0H188.875C84.5622 0 0 84.5622 0 188.875V1322.12C0 1426.44 84.5622 1511 188.875 1511H1322.12C1426.44 1511 1511 1426.44 1511 1322.12V188.875C1511 84.5622 1426.44 0 1322.12 0Z" fill="url(#md_grad)"/>
                    <path d="M619.753 668.958C728.81 616.859 814.158 528.45 863.155 417.937C831.544 384.784 790.45 361.102 746.195 346.894L722.487 339C720.907 342.157 719.326 346.894 719.326 350.051C681.394 457.406 603.948 544.237 499.633 593.178C426.929 627.911 373.191 691.061 347.903 766.841L340 790.522C343.161 792.101 347.903 793.679 351.064 793.679C381.094 804.73 411.124 818.939 439.573 836.305C479.086 765.262 542.307 705.269 619.753 668.958Z" fill="white"/>
                    <path d="M1078.12 675.273C1019.64 763.683 939.032 834.727 839.459 882.089C758.852 919.979 697.211 991.023 668.762 1076.28L660.859 1103.11C690.889 1129.95 727.241 1150.48 766.755 1163.11L790.463 1171C792.043 1167.84 793.624 1163.11 793.624 1159.95C831.556 1052.59 909.002 965.763 1013.32 916.822C1086.02 882.089 1141.34 818.939 1165.05 743.159L1172.95 719.478C1139.76 710.006 1108.15 694.218 1078.12 675.273Z" fill="white"/>
                    <path d="M597.627 1021.02C637.14 926.294 709.844 848.935 803.095 804.73C888.444 763.683 959.567 700.533 1008.56 623.175C972.212 588.442 942.181 548.973 920.054 501.611C861.575 608.966 769.904 695.797 657.687 749.474C592.885 779.471 540.728 831.569 509.117 894.719C543.889 927.873 572.338 968.92 594.466 1014.7C594.466 1014.7 596.046 1017.86 597.627 1021.02Z" fill="white"/>
                    <defs>
                      <linearGradient id="md_grad" x1="755.5" y1="0" x2="774.5" y2="2045.5" gradientUnits="userSpaceOnUse">
                        <stop offset="0.294589" stopColor="#1C4451"/>
                        <stop offset="1" stopColor="#2A6678"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1, color: 'white' }}>
                    Mission
                  </div>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1, color: 'var(--brand-lt)' }}>
                    Data
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 9.5, color: 'rgba(162,214,226,.6)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 6 }}>
                B2B Intelligence
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.soon ? '#' : item.href}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', borderRadius: 'var(--r-md)',
                  background: active ? 'rgba(162,214,226,.1)' : 'transparent',
                  color: active ? 'var(--brand-lt)' : 'rgba(255,255,255,.75)',
                  fontSize: 13.5, fontWeight: active ? 600 : 400,
                  cursor: item.soon ? 'default' : 'pointer', transition: 'all .14s',
                }}
                  onMouseEnter={e => !active && !item.soon && (e.currentTarget.style.background = 'rgba(255,255,255,.07)')}
                  onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
                >
                  <span>{item.label}</span>
                  {item.soon && (
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 9, background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.25)', padding: '2px 6px', borderRadius: 4 }}>
                      bientôt
                    </span>
                  )}
                  {active && !item.soon && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--brand-lt)' }} />
                  )}
                </div>
              </Link>
            )
          })}

          {/* Séparateur + Admin */}
          {profile?.role === 'admin' && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '8px 4px' }} />
              <Link href="/admin">
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '9px 12px',
                  borderRadius: 'var(--r-md)',
                  background: router.pathname.startsWith('/admin') ? 'rgba(239,68,68,.1)' : 'transparent',
                  color: router.pathname.startsWith('/admin') ? '#FCA5A5' : 'rgba(255,255,255,.65)',
                  fontSize: 13.5, cursor: 'pointer', transition: 'all .14s',
                }}>
                  Admin
                </div>
              </Link>
            </>
          )}
        </nav>

        {/* Lien retour Mission Freelances */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.06)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <a href="https://app.mission-freelances.fr" target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', borderRadius: 'var(--r-md)', transition: 'background .14s', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 6 C1 3.24 3.24 1 6 1 C8.76 1 11 3.24 11 6 C11 8.76 8.76 11 6 11 C3.24 11 1 8.76 1 6Z" stroke="rgba(255,255,255,.25)" strokeWidth="1.2" fill="none"/>
              <path d="M4 6 H8 M6.5 4.5 L8 6 L6.5 7.5" stroke="rgba(255,255,255,.25)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', fontFamily: 'var(--fm)' }}>
              Mission Freelances ↗
            </span>
          </a>
        </div>

        {/* User */}
        <div style={{ padding: '14px 14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 'var(--r-full)',
              background: 'var(--brand-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>{initials}</div>
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.full_name || profile?.email?.split('@')[0] || '—'}
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>
                {profile?.role || 'user'}
              </div>
            </div>
          </div>
          <button onClick={() => signOut().then(() => router.push('/login'))}
            style={{ width: '100%', padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 12, color: 'rgba(255,255,255,.55)', background: 'transparent', border: '1px solid rgba(255,255,255,.14)', fontFamily: 'var(--fb)', cursor: 'pointer', transition: 'all .14s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.25)'; e.currentTarget.style.color = 'rgba(255,255,255,.75)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = 'rgba(255,255,255,.55)' }}>
            Déconnexion
          </button>
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
