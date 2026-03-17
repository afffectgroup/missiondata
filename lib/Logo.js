// lib/Logo.js — MissionData logo SVG component
export function LogoIcon({ size = 34 }) {
  const s = size;
  const r = Math.round(s * 0.24);
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="mdg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0090ff"/>
          <stop offset="100%" stopColor="#1a3fd4"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx={r} fill="url(#mdg)"/>
      <circle cx="45" cy="42" r="20" fill="none" stroke="white" strokeWidth="7"/>
      <line x1="59" y1="57" x2="74" y2="72" stroke="white" strokeWidth="7" strokeLinecap="round"/>
      <circle cx="45" cy="35" r="6" fill="white"/>
      <path d="M33 54 Q33 46 45 46 Q57 46 57 54" fill="white"/>
    </svg>
  );
}
