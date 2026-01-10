import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Clock,
  Megaphone,
  MessageSquare,
  Calendar,
  Heart,
  Coins,
  Users,
  Bell,
  Shield,
  Settings,
  LogOut,
  X
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/horaires', icon: Clock, label: 'Horaires de prière' },
  { path: '/annonces', icon: Megaphone, label: 'Annonces' },
  { path: '/popups', icon: MessageSquare, label: 'Popups' },
  { path: '/evenements', icon: Calendar, label: 'Événements' },
  { path: '/janaza', icon: Heart, label: 'Salat Janaza' },
  { path: '/dons', icon: Coins, label: 'Dons & Projets' },
  { path: '/adherents', icon: Users, label: 'Adhérents' },
  { path: '/notifications', icon: Bell, label: 'Notifications' },
  { path: '/admins', icon: Shield, label: 'Gestion Admins', adminOnly: true },
  { path: '/parametres', icon: Settings, label: 'Paramètres' }
]

export default function Sidebar({ isOpen, onClose }) {
  const { admin, logout, isSuperAdmin } = useAuth()
  const location = useLocation()

  const filteredMenuItems = menuItems.filter(
    item => !item.adminOnly || isSuperAdmin()
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-bg-dark border-r border-white/10
          transform transition-transform duration-300 z-50
          lg:translate-x-0 lg:static
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                <span className="text-white font-bold text-lg">EM</span>
              </div>
              <div>
                <h1 className="text-white font-semibold">El Mouhssinine</h1>
                <p className="text-xs text-white/50">Backoffice</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {filteredMenuItems.map(item => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200
                      ${isActive
                        ? 'bg-secondary/20 text-secondary'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center">
                <span className="text-secondary font-medium">
                  {admin?.nom?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{admin?.nom || 'Admin'}</p>
                <p className="text-xs text-white/50 truncate">{admin?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
