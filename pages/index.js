import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useUser } from '@supabase/auth-helpers-react'
import Head from 'next/head'

/**
 * Page racine : redirige vers /login ou /dashboard selon l'état d'auth.
 * Rendue en SSR pour éviter un flash avant redirection.
 */
export default function Home() {
  const router = useRouter()
  const user   = useUser()

  useEffect(() => {
    if (user === undefined) return // loading
    router.replace(user ? '/dashboard' : '/login')
  }, [user, router])

  return (
    <>
      <Head><title>Mission Data</title></Head>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F6F9FC',
      }}>
        <div className="spinner" />
      </div>
    </>
  )
}

// Force SSR — évite le flash de page vide pendant la résolution d'auth
export async function getServerSideProps() {
  return { props: {} }
}
