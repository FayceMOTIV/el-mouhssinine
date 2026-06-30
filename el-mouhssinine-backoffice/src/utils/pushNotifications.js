import { getFunctions, httpsCallable } from 'firebase/functions'

// Clé publique VAPID (publique par design — la clé privée reste côté serveur)
const VAPID_PUBLIC = 'BGvV0zTkH6mcWFhnmPBgs27UZYGeJnrQg2s6xclDCWGZ1HKioIXQhEWy4L48Xc87Wc148JjRzMCCoUBi1X33Zuo'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// État actuel : 'unsupported' | 'denied' | 'granted' | 'default'
export function pushPermission() {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

// Active les notifications (à appeler depuis un clic utilisateur — requis sur iOS)
export async function enablePushNotifications() {
  if (!pushSupported()) {
    throw new Error("Les notifications ne sont pas supportées sur cet appareil/navigateur. Sur iPhone : ajoute le site à l'écran d'accueil d'abord.")
  }
  // 1. Permission
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    throw new Error('Permission refusée. Active les notifications dans les réglages du téléphone.')
  }
  // 2. Service worker
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  // 3. Abonnement push
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
  }
  // 4. Enregistrer côté serveur
  const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'saveAdminPushSub')
  await fn({ subscription: sub.toJSON() })
  return true
}

// Re-souscrit silencieusement si la permission est déjà granted (iOS révoque les tokens après inactivité)
export async function refreshPushSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'saveAdminPushSub')
    await fn({ subscription: sub.toJSON() })
    return true
  } catch (e) {
    console.warn('[Push] refresh silencieux échoué:', e.message)
    return false
  }
}

// Envoie une notif de test
export async function testPushNotification() {
  const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'testAdminPush')
  await fn()
}
