import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { onAuthChange, getAdminByUid, loginUser, logoutUser, isDemoMode } from '../services/firebase'
import { rolePermissions, AdminRole } from '../types'

const AuthContext = createContext(null)

// Demo admin for when Firebase is not available
const DEMO_ADMIN = {
  id: 'demo-admin',
  nom: 'Admin Demo',
  email: 'admin@demo.local',
  role: AdminRole.SUPER_ADMIN,
  permissions: rolePermissions[AdminRole.SUPER_ADMIN],
  actif: true
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Refs pour éviter les race conditions
  const isLoggingIn = useRef(false)
  const currentUid = useRef(null)
  const adminFetched = useRef(false)

  useEffect(() => {
    if (isDemoMode) {
      setDemoMode(true)
      setUser({ uid: 'demo-user', email: 'admin@demo.local' })
      setAdmin(DEMO_ADMIN)
      setLoading(false)
      setAuthChecked(true)
      return
    }

    let unsubscribe = () => {}

    try {
      unsubscribe = onAuthChange(async (firebaseUser) => {
        // Si on est en train de se connecter, ignorer ce callback
        if (isLoggingIn.current) {
          return
        }

        try {
          if (firebaseUser) {
            // Si c'est le même user ET qu'on a déjà fetch l'admin, ne pas refaire
            if (currentUid.current === firebaseUser.uid && adminFetched.current) {
              setLoading(false)
              setAuthChecked(true)
              return
            }

            setUser(firebaseUser)
            currentUid.current = firebaseUser.uid

            const adminData = await getAdminByUid(firebaseUser.uid)

            if (adminData && adminData.actif) {
              setAdmin(adminData)
              adminFetched.current = true
            } else {
              setAdmin(null)
              adminFetched.current = true
            }
          } else {
            setUser(null)
            setAdmin(null)
            currentUid.current = null
            adminFetched.current = false
          }
        } catch (err) {
          console.error('[Auth] Erreur:', err)
          setAdmin(null)
        }

        setLoading(false)
        setAuthChecked(true)
      })
    } catch (err) {
      console.error('[Auth] Erreur setup listener:', err)
      setLoading(false)
      setAuthChecked(true)
    }

    return () => unsubscribe()
  }, [])

  const login = async (email, password) => {
    // Demo mode login
    if (demoMode || isDemoMode) {
      setUser({ uid: 'demo-user', email })
      setAdmin(DEMO_ADMIN)
      currentUid.current = 'demo-user'
      adminFetched.current = true
      return { user: { uid: 'demo-user', email } }
    }

    isLoggingIn.current = true
    setLoading(true)

    try {
      const result = await loginUser(email, password)
      const adminData = await getAdminByUid(result.user.uid)

      if (!adminData || !adminData.actif) {
        await logoutUser()
        isLoggingIn.current = false
        currentUid.current = null
        adminFetched.current = false
        setLoading(false)
        throw new Error('Accès refusé. Vous n\'êtes pas administrateur.')
      }

      currentUid.current = result.user.uid
      adminFetched.current = true

      setUser(result.user)
      setAdmin(adminData)
      setAuthChecked(true)
      setLoading(false)

      await new Promise(resolve => setTimeout(resolve, 50))
      isLoggingIn.current = false

      return result
    } catch (error) {
      isLoggingIn.current = false
      currentUid.current = null
      adminFetched.current = false
      setLoading(false)
      throw error
    }
  }

  const logout = async () => {
    currentUid.current = null
    adminFetched.current = false

    if (!demoMode && !isDemoMode) {
      await logoutUser()
    }
    setUser(null)
    setAdmin(null)
  }

  const hasPermission = (permission) => {
    if (!admin) return false
    if (admin.role === AdminRole.SUPER_ADMIN) return true
    return admin.permissions?.[permission] || rolePermissions[admin.role]?.[permission] || false
  }

  const isSuperAdmin = () => {
    return admin?.role === AdminRole.SUPER_ADMIN
  }

  const isAuthenticated = !!user && !!admin && admin.actif

  const value = {
    user,
    admin,
    loading,
    authChecked,
    login,
    logout,
    hasPermission,
    isSuperAdmin,
    demoMode: demoMode || isDemoMode,
    isAuthenticated
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
