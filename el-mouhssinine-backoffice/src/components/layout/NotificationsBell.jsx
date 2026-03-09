import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { db } from '../../services/firebase'
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  writeBatch,
  doc,
  updateDoc,
} from 'firebase/firestore'

const TYPE_ICONS = {
  nouveau_membre: '🆕',
  paiement: '💳',
  validation_requise: '⏳',
  annulation: '📋',
  remboursement: '💸',
  expiration_proche: '⚠️',
  compte_supprime: '🗑️',
  don: '🤲',
  refus_admin: '❌',
  janaza: '🕌',
}

function timeAgo(date) {
  if (!date) return ''
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hier'
  return `il y a ${days}j`
}

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const q = query(
      collection(db, 'notifications_bo'),
      orderBy('createdAt', 'desc'),
      limit(20)
    )

    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || null,
      }))
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n) => !n.lu).length)
    })

    return () => unsub()
  }, [])

  // Fermer le dropdown en cliquant ailleurs
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAsRead = async (notifId) => {
    try {
      await updateDoc(doc(db, 'notifications_bo', notifId), { lu: true })
    } catch (e) {
      console.error('Erreur markAsRead:', e)
    }
  }

  const markAllRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.lu)
      const batch = writeBatch(db)
      unread.forEach((n) => {
        batch.update(doc(db, 'notifications_bo', n.id), { lu: true })
      })
      await batch.commit()
    } catch (e) {
      console.error('Erreur markAllRead:', e)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-white/70 hover:text-white transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-bg-dark border border-border-gold rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-secondary hover:text-secondary/80 transition-colors"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-sm">
                Aucune notification
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.lu && markAsRead(notif.id)}
                  className={`px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                    !notif.lu ? 'bg-white/[0.03]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">
                      {TYPE_ICONS[notif.type] || '📌'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">
                          {notif.titre}
                        </span>
                        {!notif.lu && (
                          <span className="w-2 h-2 bg-secondary rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-white/50 text-xs mt-0.5 truncate">
                        {notif.message}
                      </p>
                      <span className="text-white/30 text-[10px] mt-1 block">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                    {notif.montant && (
                      <span className="text-secondary text-sm font-medium flex-shrink-0">
                        {notif.montant}€
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
