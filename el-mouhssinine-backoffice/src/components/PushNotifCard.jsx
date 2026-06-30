import { useState, useEffect } from 'react'
import { Bell, BellRing, Check } from 'lucide-react'
import { toast } from 'react-toastify'
import { Card } from './common'
import { enablePushNotifications, testPushNotification, pushPermission, pushSupported } from '../utils/pushNotifications'

export default function PushNotifCard() {
  const [status, setStatus] = useState('default')
  const [loading, setLoading] = useState(false)
  // Détecte si on est en mode "app installée" (standalone) — requis sur iPhone
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setStatus(pushPermission())
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    setStandalone(isStandalone)
  }, [])

  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  const handleEnable = async () => {
    setLoading(true)
    try {
      await enablePushNotifications()
      setStatus('granted')
      toast.success('Notifications activées ! Tu seras prévenu sur ce téléphone.')
    } catch (e) {
      toast.error(e.message || "Impossible d'activer les notifications")
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setLoading(true)
    try {
      await testPushNotification()
      toast.info('Notification de test envoyée 📲')
    } catch (e) {
      toast.error("Échec de l'envoi du test")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
          <BellRing className="w-5 h-5 text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold">Notifications sur ce téléphone</h3>
          <p className="text-sm text-white/50 mt-0.5">
            Reçois une notif (comme une app) quand un nouveau membre s'inscrit.
          </p>

          {/* iPhone : doit être installé sur l'écran d'accueil */}
          {isiOS && !standalone && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
              📲 Sur iPhone, ajoute d'abord ce site à l'écran d'accueil :
              <br />Safari → bouton Partager → « Sur l'écran d'accueil ». Puis ouvre l'app et reviens ici.
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {status === 'granted' ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/15 text-green-400 text-sm">
                  <Check className="w-4 h-4" /> Activées
                </span>
                <button
                  onClick={handleTest}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm transition-colors disabled:opacity-50"
                >
                  Envoyer un test
                </button>
              </>
            ) : status === 'denied' ? (
              <p className="text-sm text-red-400">
                Notifications bloquées. Active-les dans les réglages de ton téléphone (Réglages → Notifications).
              </p>
            ) : (
              <button
                onClick={handleEnable}
                disabled={loading || !pushSupported() || (isiOS && !standalone)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-white text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-40"
              >
                <Bell className="w-4 h-4" />
                {loading ? 'Activation…' : 'Activer les notifications'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
