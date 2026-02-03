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
import Admins from './pages/Admins'
import Parametres from './pages/Parametres'
import Rappels from './pages/Rappels'
import Messages from './pages/Messages'
import Revenus from './pages/Revenus'
import RecusFiscaux from './pages/RecusFiscaux'
import Notifications from './pages/Notifications'
import Ramadan from './pages/Ramadan'

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, authChecked } = useAuth()

  if (loading || !authChecked) {
    return <FullPageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Admin Route Component
function AdminRoute({ children }) {
  const { isSuperAdmin, loading, authChecked } = useAuth()

  if (loading || !authChecked) {
    return <FullPageLoader />
  }

  if (!isSuperAdmin()) {
    return <Navigate to="/" replace />
  }

  return children
}

// App Routes
function AppRoutes() {
  const { isAuthenticated, loading, authChecked } = useAuth()

  // Attendre que l'auth soit complètement vérifié
  if (loading || !authChecked) {
    return <FullPageLoader />
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
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
        <Route path="revenus" element={<Revenus />} />
        <Route path="recus-fiscaux" element={<RecusFiscaux />} />
        <Route path="messages" element={<Messages />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="ramadan" element={<Ramadan />} />
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
