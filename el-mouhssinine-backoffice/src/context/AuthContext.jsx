import { createContext, useContext, useState, useEffect } from 'react'
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

  useEffect(() => {
    // Check if we're in demo mode
    if (isDemoMode) {
      console.log('🎭 Mode démo activé - Firebase non disponible')
      setDemoMode(true)
      setUser({ uid: 'demo-user', email: 'admin@demo.local' })
      setAdmin(DEMO_ADMIN)
      setLoading(false)
      return
    }

    let unsubscribe = () => {}

    try {
      unsubscribe = onAuthChange(async (firebaseUser) => {
        try {
          if (firebaseUser) {
            setUser(firebaseUser)
            // Fetch admin data
            const adminData = await getAdminByUid(firebaseUser.uid)
            if (adminData) {
              setAdmin(adminData)
            } else {
              // User is not an admin
              setAdmin(null)
            }
          } else {
            setUser(null)
            setAdmin(null)
          }
        } catch (err) {
          console.error('Error in auth change handler:', err)
        }
        setLoading(false)
      })
    } catch (err) {
      console.error('Error setting up auth listener:', err)
      setLoading(false)
    }

    return () => unsubscribe()
  }, [])

  const login = async (email, password) => {
    // Demo mode login
    if (demoMode || isDemoMode) {
      setUser({ uid: 'demo-user', email })
      setAdmin(DEMO_ADMIN)
      return { user: { uid: 'demo-user', email } }
    }

    const result = await loginUser(email, password)
    const adminData = await getAdminByUid(result.user.uid)
    if (!adminData || !adminData.actif) {
      await logoutUser()
      throw new Error('Accès refusé. Vous n\'êtes pas administrateur.')
    }
    return result
  }

  const logout = async () => {
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

  const value = {
    user,
    admin,
    loading,
    login,
    logout,
    hasPermission,
    isSuperAdmin,
    demoMode: demoMode || isDemoMode,
    isAuthenticated: !!user && !!admin
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
