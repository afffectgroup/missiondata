/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Fix build crash quand les env vars Supabase ne sont pas définies ──
  // Next.js tente de prérender les pages — createPagesBrowserClient() plante sans URL.
  // Ces valeurs placeholder permettent au build de passer ; les vraies valeurs
  // viennent des variables d'environnement Vercel/Railway au runtime.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL      || 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_anon_key',
  },
}

module.exports = nextConfig
