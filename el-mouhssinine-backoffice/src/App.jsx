import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/layout'
import { FullPageLoader } from './components/common/Loading'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Horaires from './pages/Horaires'
import Annonces from './pages/Annonces'
import Popups from './pages/Popups'
import Evenements from './pages/Evenements'
import Janaza from './pages/Janaza'
import Dons from './pages/Dons'
import Adherents from './pages/Adherents'
import Notifications from './pages/Notifications'
import Admins from './pages/Admins'
import Parametres from './pages/Parametres'
import Rappels from './pages/Rappels'

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <FullPageLoader />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Admin Route Component
function AdminRoute({ children }) {
  const { isSuperAdmin, loading } = useAuth()

  if (loading) {
    return <FullPageLoader />
  }

  if (!isSuperAdmin()) {
    return <Navigate to="/" replace />
  }

  return children
}

// App Routes
function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <FullPageLoader />
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="horaires" element={<Horaires />} />
        <Route path="annonces" element={<Annonces />} />
        <Route path="rappels" element={<Rappels />} />
        <Route path="popups" element={<Popups />} />
        <Route path="evenements" element={<Evenements />} />
        <Route path="janaza" element={<Janaza />} />
        <Route path="dons" element={<Dons />} />
        <Route path="adherents" element={<Adherents />} />
        <Route path="notifications" element={<Notifications />} />
        <Route
          path="admins"
          element={
            <AdminRoute>
              <Admins />
            </AdminRoute>
          }
        />
        <Route path="parametres" element={<Parametres />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
