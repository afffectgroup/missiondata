// lib/Logo.js — MissionData logo using uploaded PNG
export function LogoIcon({ size = 34 }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="MissionData"
      style={{ borderRadius: Math.round(size * 0.22) + 'px', flexShrink: 0, display: 'block' }}
    />
  );
}
