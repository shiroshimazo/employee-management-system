import { createContext } from 'react'

export const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})
