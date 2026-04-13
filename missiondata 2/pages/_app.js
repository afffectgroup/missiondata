import { useState, useEffect, createContext, useContext } from 'react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider, useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import '../styles/globals.css'

/* ── Auth context — provides profile + signOut to the whole app ── */
const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const user      = useUser()
  const supabase  = useSupabaseClient()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setProfile(data)
          setLoading(false)
        })
    } else if (user === null) {
      setProfile(null)
      setLoading(false)
    }
  }, [user])

  const signOut = () => supabase.auth.signOut()


  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function App({ Component, pageProps }) {
  const [supabase] = useState(() => createPagesBrowserClient())

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </SessionContextProvider>
  )
}
