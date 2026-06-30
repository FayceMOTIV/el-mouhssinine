/**
 * Notifications Web Push pour les ADMINS du backoffice (PWA installée).
 * Permet de recevoir une vraie notif "comme une app" sur iPhone/Android/desktop
 * (ex: quand un nouveau membre s'inscrit).
 *
 * Secrets dans process.env (functions/.env) : VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT
 * Abonnements stockés dans Firestore : collection `admin_push_subs`.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const REGION = 'europe-west1';

function getWebPush() {
  const webpush = require('web-push');
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contact@elmouhssinine.fr',
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE,
  );
  return webpush;
}

// Envoie une notif push à tous les admins abonnés. Best-effort, nettoie les abos morts.
async function sendAdminPush(title, body, url = 'https://el-mouhssinine.web.app') {
  if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) return;
  let webpush;
  try { webpush = getWebPush(); } catch (e) { console.error('webpush init:', e.message); return; }

  const snap = await admin.firestore().collection('admin_push_subs').get();
  const payload = JSON.stringify({ title, body, url });
  const dead = [];
  await Promise.all(snap.docs.map(async (doc) => {
    try {
      await webpush.sendNotification(doc.data().subscription, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(doc.ref);
    }
  }));
  // Supprimer les abonnements expirés
  await Promise.all(dead.map((ref) => ref.delete().catch(() => {})));
}

// Vérifie que l'appelant est admin
async function assertAdmin(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise');
  const uid = context.auth.uid;
  const doc = await admin.firestore().collection('admins').doc(uid).get();
  if (doc.exists && doc.data().actif !== false) return;
  const q = await admin.firestore().collection('admins').where('uid', '==', uid).limit(1).get();
  if (q.empty) throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs');
}

// Callable : enregistre l'abonnement push d'un admin
exports.saveAdminPushSub = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    await assertAdmin(context);
    const sub = data && data.subscription;
    if (!sub || !sub.endpoint) {
      throw new functions.https.HttpsError('invalid-argument', 'Abonnement invalide');
    }
    const id = crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 40);
    await admin.firestore().collection('admin_push_subs').doc(id).set({
      subscription: sub,
      uid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  });

// Callable : test (envoie une notif de test à l'admin)
exports.testAdminPush = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    await assertAdmin(context);
    await sendAdminPush('🕌 Test notification', 'Les notifications fonctionnent !');
    return { success: true };
  });

module.exports.sendAdminPush = sendAdminPush;
