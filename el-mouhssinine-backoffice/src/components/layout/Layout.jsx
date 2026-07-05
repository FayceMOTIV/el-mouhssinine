import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const pageTitles = {
  '/': 'Dashboard',
  '/horaires': 'Horaires de prière',
  '/annonces': 'Annonces',
  '/popups': 'Popups',
  '/evenements': 'Événements',
  '/janaza': 'Salat Janaza',
  '/dons': 'Dons & Projets',
  '/adherents': 'Membres',
  '/revenus': 'Gestion financière',
  '/notifications': 'Notifications',
  '/audit-logs': 'Journal d\'audit',
  '/admins': 'Gestion Admins',
  '/parametres': 'Paramètres',
  '/services': 'Services'
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const title = pageTitles[location.pathname] || 'El Mohsinine'

  return (
    <div className="min-h-screen bg-bg-dark flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen lg:ml-0 min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
        />

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
