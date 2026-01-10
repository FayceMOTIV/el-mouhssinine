import { Menu, Bell, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function Header({ onMenuClick, title }) {
  const { admin } = useAuth()

  return (
    <header className="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur border-b border-white/10">
      <div className="flex items-center justify-between px-4 lg:px-6 py-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-white/70 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Search (desktop only) */}
          <div className="hidden md:flex items-center bg-white/5 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-white/50 mr-2" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="bg-transparent border-none outline-none text-white placeholder-white/50 w-48"
            />
          </div>

          {/* Notifications */}
          <button className="relative text-white/70 hover:text-white">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full text-[10px] flex items-center justify-center text-white">
              3
            </span>
          </button>

          {/* User avatar */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
              <span className="text-secondary font-medium text-sm">
                {admin?.nom?.charAt(0) || 'A'}
              </span>
            </div>
            <span className="text-white/70 text-sm">{admin?.nom || 'Admin'}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
