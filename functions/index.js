/**
 * Cloud Functions pour El Mouhssinine
 * Gestion des notifications push via Firebase Cloud Messaging
 * Paiements Stripe
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Initialiser Stripe avec la clé secrète (à configurer via firebase functions:config:set)
// Pour configurer: firebase functions:config:set stripe.secret_key="sk_live_xxx"
const stripeSecretKey = functions.config().stripe?.secret_key;
if (!stripeSecretKey) {
  console.warn('⚠️ ATTENTION: stripe.secret_key non configuré - les paiements échoueront');
}
const stripe = new Stripe(stripeSecretKey || 'sk_test_not_configured', {
  apiVersion: '2023-10-16',
});

// ==================== HELPERS ====================

/**
 * Vérifie si l'utilisateur est admin
 * @param {string} uid - L'ID de l'utilisateur Firebase Auth
 * @returns {Promise<boolean>}
 */
const isAdmin = async (uid) => {
  if (!uid) return false;
  try {
    const adminDoc = await admin.firestore().collection('admins').doc(uid).get();
    return adminDoc.exists;
  } catch (error) {
    console.error('Erreur vérification admin:', error);
    return false;
  }
};

/**
 * Tronque un texte à une longueur max
 */
const truncate = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Sanitize une chaîne pour éviter XSS et injection
 * @param {string} str - La chaîne à nettoyer
 * @param {number} maxLength - Longueur max (défaut 100)
 * @returns {string}
 */
const sanitizeString = (str, maxLength = 100) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .substring(0, maxLength)
    .replace(/[<>'"]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
};

/**
 * Rate limiting helper - Limite les appels par utilisateur
 * @param {string} uid - L'ID de l'utilisateur
 * @param {string} functionName - Nom de la fonction
 * @param {number} maxCalls - Nombre max d'appels autorisés
 * @param {number} windowSeconds - Fenêtre de temps en secondes
 * @throws {functions.https.HttpsError} Si la limite est atteinte
 */
const checkRateLimit = async (uid, functionName, maxCalls, windowSeconds) => {
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Utilisateur non authentifié');
  }

  const key = `rate_limits/${uid}_${functionName}`;
  const ref = admin.firestore().doc(key);

  return admin.firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    if (doc.exists) {
      const data = doc.data();
      const calls = (data.calls || []).filter(t => now - t < windowMs);

      if (calls.length >= maxCalls) {
        const waitTime = Math.ceil((calls[0] + windowMs - now) / 1000 / 60);
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Limite atteinte. Réessayez dans ${waitTime > 1 ? waitTime + ' minutes' : 'quelques secondes'}.`
        );
      }

      calls.push(now);
      transaction.update(ref, {
        calls,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      transaction.set(ref, {
        calls: [now],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
};

/**
 * Formate une date en français
 */
const formatDateFr = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return date.toLocaleDateString('fr-FR', options);
  } catch {
    return dateStr;
  }
};

// ==================== NOTIFICATION ANNONCE ====================
// Trigger : quand une nouvelle annonce est créée

exports.onNewAnnouncement = functions
  .region('europe-west1')
  .firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snap, context) => {
    // DESACTIVE: Notifications automatiques désactivées
    // Utiliser le bouton "Envoyer notification" dans le backoffice
    console.log('Notification auto désactivée pour annonces - utilisez le backoffice');
    return null;

    // Code original conservé mais non exécuté
    /*
    const announcement = snap.data();

    // Ne pas notifier si l'annonce n'est pas active
    if (!announcement.actif) {
      console.log('Annonce inactive, pas de notification');
      return null;
    }

    const message = {
      notification: {
        title: announcement.titre || 'Nouvelle annonce',
        body: truncate(announcement.contenu, 150),
      },
      data: {
        type: 'announcement',
        id: context.params.announcementId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      topic: 'announcements',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification annonce envoyée:', response);

      // Mettre à jour le document avec le statut de notification
      await snap.ref.update({
        notificationSent: true,
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, messageId: response };
    } catch (error) {
      console.error('Erreur notification annonce:', error);
      return { error: error.message };
    }
    */
  });

// ==================== NOTIFICATION ÉVÉNEMENT ====================
// Trigger : quand un nouvel événement est créé

exports.onNewEvent = functions
  .region('europe-west1')
  .firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
    // DESACTIVE: Notifications automatiques désactivées
    // Utiliser le bouton "Envoyer notification" dans le backoffice
    console.log('Notification auto désactivée pour événements - utilisez le backoffice');
    return null;

    // Code original conservé mais non exécuté
    /*
    const event = snap.data();

    if (!event.actif) {
      console.log('Événement inactif, pas de notification');
      return null;
    }

    const dateFormatted = formatDateFr(event.date);
    const body = `${dateFormatted} à ${event.heure || ''} - ${event.lieu || 'Mosquée'}`;

    const message = {
      notification: {
        title: event.titre || 'Nouvel événement',
        body: truncate(body, 150),
      },
      data: {
        type: 'event',
        id: context.params.eventId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      topic: 'events',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification événement envoyée:', response);

      await snap.ref.update({
        notificationSent: true,
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, messageId: response };
    } catch (error) {
      console.error('Erreur notification événement:', error);
      return { error: error.message };
    }
    */
  });

// ==================== NOTIFICATION JANAZA ====================
// Trigger : quand une nouvelle Salat Janaza est créée (URGENT)

exports.onNewJanaza = functions
  .region('europe-west1')
  .firestore
  .document('janaza/{janazaId}')
  .onCreate(async (snap, context) => {
    // DESACTIVE: Notifications automatiques désactivées
    // Utiliser le bouton "Envoyer notification" dans le backoffice
    console.log('Notification auto désactivée pour janaza - utilisez le backoffice');
    return null;

    // Code original conservé mais non exécuté
    /*
    const janaza = snap.data();

    if (!janaza.actif) {
      console.log('Janaza inactive, pas de notification');
      return null;
    }

    const dateFormatted = formatDateFr(janaza.date);
    let body = `Prière pour ${janaza.nomDefunt || 'un défunt'}`;
    if (janaza.heurePriere) {
      body += ` - ${janaza.heurePriere}`;
    } else if (janaza.salatApres) {
      body += ` - Après ${janaza.salatApres}`;
    }
    if (janaza.lieu) {
      body += ` à ${janaza.lieu}`;
    }

    const message = {
      notification: {
        title: 'Salat Janaza',
        body: truncate(body, 150),
      },
      data: {
        type: 'janaza',
        id: context.params.janazaId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      // High priority pour les notifications urgentes
      android: {
        priority: 'high',
        notification: {
          channelId: 'janaza_channel',
          priority: 'max',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      topic: 'janaza',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification Janaza envoyée:', response);

      await snap.ref.update({
        notificationSent: true,
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, messageId: response };
    } catch (error) {
      console.error('Erreur notification Janaza:', error);
      return { error: error.message };
    }
    */
  });

// ==================== NOTIFICATION POPUP ====================
// DESACTIVE: Les popups s'affichent dans l'app, pas besoin de notification push
// Les popups et notifications sont deux fonctionnalites distinctes:
// - Popup = message affiche dans l'app a l'ouverture
// - Notification = push envoyee au telephone
//
// exports.onNewPopup = functions
//   .region('europe-west1')
//   .firestore
//   .document('popups/{popupId}')
//   .onCreate(async (snap, context) => {
//     // ... fonction desactivee
//   });

// ==================== NOTIFICATION DEPUIS BACKOFFICE ====================
// Trigger : quand une notification est créée/mise à jour avec statut "envoyée"

exports.onNotificationFromBackoffice = functions
  .region('europe-west1')
  .firestore
  .document('notifications/{notificationId}')
  .onWrite(async (change, context) => {
    // Si le document est supprimé, ne rien faire
    if (!change.after.exists) {
      console.log('Notification supprimée, pas d\'action');
      return null;
    }

    const notification = change.after.data();

    // Fix: Si deja envoye (notificationSent=true), ne pas renvoyer
    // Cela evite le double envoi cause par l'update interne
    if (notification.notificationSent === true) {
      console.log('Notification deja envoyee, skip retrigger');
      return null;
    }

    // Ne traiter que si le statut est "envoyee"
    if (notification.statut !== 'envoyee') {
      console.log('Notification pas encore envoyee, statut:', notification.statut);
      return null;
    }

    // Mapper le topic du backoffice vers le topic FCM
    const topicMapping = {
      'tous': 'general',
      'announcements': 'announcements',
      'events': 'events',
      'janaza': 'janaza',
      'prayer_reminders': 'jumua',
      'membres': 'members', // Topic specifique aux adherents
    };

    const fcmTopic = topicMapping[notification.topic] || 'general';
    const notifTitle = notification.titre || 'Notification';
    const notifBody = truncate(notification.message, 200);

    const message = {
      notification: {
        title: notifTitle,
        body: notifBody,
      },
      data: {
        type: 'backoffice_notification',
        id: context.params.notificationId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      // Configuration spécifique iOS/APNs
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            alert: {
              title: notifTitle,
              body: notifBody,
            },
            sound: 'default',
            badge: 1,
            'content-available': 1,
          },
        },
      },
      // Configuration spécifique Android
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'general',
        },
      },
      topic: fcmTopic,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('🔔 Notification backoffice envoyée:', response);

      // Marquer comme envoyée
      await change.after.ref.update({
        notificationSent: true,
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
        fcmMessageId: response,
      });

      // Enregistrer dans l'historique
      await admin.firestore().collection('notifications_history').add({
        title: notification.titre,
        body: notification.message,
        topic: fcmTopic,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        messageId: response,
        success: true,
        source: 'backoffice',
      });

      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Erreur notification backoffice:', error);

      // Marquer comme echouee (sans accent pour matcher le backoffice)
      await change.after.ref.update({
        statut: 'echouee',
        error: error.message,
      });

      return { error: error.message };
    }
  });

// ==================== NOTIFICATION MANUELLE ====================
// Appelée depuis le backoffice via callable function

exports.sendManualNotification = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Vérifier l'authentification
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Vous devez être connecté pour envoyer des notifications'
      );
    }

    // Vérifier les droits admin
    const adminCheck = await isAdmin(context.auth.uid);
    if (!adminCheck) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Seuls les administrateurs peuvent envoyer des notifications'
      );
    }

    // Rate limiting: max 10 notifications par minute
    await checkRateLimit(context.auth.uid, 'sendNotif', 10, 60);

    const { title, body, topic, data: customData } = data;

    if (!title || !body) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le titre et le contenu sont requis'
      );
    }

    const message = {
      notification: {
        title: title,
        body: truncate(body, 200),
      },
      data: {
        type: 'manual',
        sentBy: context.auth.uid,
        sentAt: new Date().toISOString(),
        ...customData,
      },
      topic: topic || 'general',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification manuelle envoyée:', response);

      // Enregistrer dans Firestore pour historique
      await admin.firestore().collection('notifications_history').add({
        title,
        body,
        topic: topic || 'general',
        sentBy: context.auth.uid,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        messageId: response,
        success: true,
      });

      return { success: true, messageId: response };
    } catch (error) {
      console.error('Erreur notification manuelle:', error);

      // Enregistrer l'erreur
      await admin.firestore().collection('notifications_history').add({
        title,
        body,
        topic: topic || 'general',
        sentBy: context.auth.uid,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
        success: false,
      });

      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== RAPPEL JUMU'A AUTOMATIQUE ====================
// Tous les vendredis à 11h30 (heure Paris)

exports.scheduledJumuaReminder = functions
  .region('europe-west1')
  .pubsub
  .schedule('30 11 * * 5') // 11h30 chaque vendredi
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    // Récupérer l'heure de Jumu'a depuis les settings
    let jumuaTime = '13:30';
    try {
      const settingsDoc = await admin.firestore()
        .collection('settings')
        .doc('prayerTimes')
        .get();
      if (settingsDoc.exists && settingsDoc.data().jumua?.jumua1) {
        jumuaTime = settingsDoc.data().jumua.jumua1;
      }
    } catch (e) {
      console.log('Impossible de recuperer l\'heure Jumu\'a, utilisation par defaut');
    }

    const message = {
      notification: {
        title: "🕌 Jumu'a aujourd'hui à " + jumuaTime,
        body: "Jour béni ! Arrivez tôt pour la meilleure place et pensez à vous garer correctement.",
      },
      data: {
        type: 'jumua_reminder',
        time: jumuaTime,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'prayer_reminders',
        },
      },
      topic: 'jumua',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Rappel Jumu\'a envoye:', response);
      return null;
    } catch (error) {
      console.error('Erreur rappel Jumu\'a:', error);
      return null;
    }
  });

// ==================== RAPPEL PRIERES DYNAMIQUE ====================
// DESACTIVE: Les notifications de priere sont maintenant gerees localement
// via @notifee/react-native dans l'app mobile (prayerNotifications.ts)
// Ces fonctions Cloud Functions sont gardees en commentaire pour reference.

// Configuration Aladhan API (meme que l'app)
const ALADHAN_CONFIG = {
  city: 'Bourg-en-Bresse',
  country: 'France',
  method: 99, // Methode personnalisee
  fajrAngle: 15,
  ishaAngle: 15,
  tune: '0,-5,0,3,2,6,0,5,0', // Ajustements Mawaqit
};

// Noms des prieres
const PRAYER_NAMES = {
  Fajr: { fr: 'Fajr', ar: 'الفجر', emoji: '🌅' },
  Dhuhr: { fr: 'Dhuhr', ar: 'الظهر', emoji: '☀️' },
  Asr: { fr: 'Asr', ar: 'العصر', emoji: '🌤️' },
  Maghrib: { fr: 'Maghrib', ar: 'المغرب', emoji: '🌅' },
  Isha: { fr: 'Isha', ar: 'العشاء', emoji: '🌙' },
};

// Messages spirituels pour les notifications
const PRAYER_MESSAGES = {
  Fajr: 'Reveillez-vous pour la priere de l\'aube. Qu\'Allah accepte votre adoration.',
  Dhuhr: 'Prenez une pause pour vous recueillir. La priere est le pilier de la religion.',
  Asr: 'N\'oubliez pas la priere du milieu d\'apres-midi.',
  Maghrib: 'Le soleil se couche, moment de gratitude envers Allah.',
  Isha: 'Terminez votre journee en vous tournant vers Allah.',
};

/**
 * Fetch les horaires de priere depuis Aladhan API
 */
const fetchPrayerTimes = async () => {
  const { city, country, method, fajrAngle, ishaAngle, tune } = ALADHAN_CONFIG;
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}&methodSettings=${fajrAngle},null,${ishaAngle}&tune=${tune}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code === 200) {
    return data.data.timings;
  }
  throw new Error('Erreur API Aladhan');
};

/**
 * Convertit une heure HH:MM en minutes depuis minuit
 */
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * DESACTIVE - Notifications gerees localement via @notifee/react-native
 * Verifie toutes les 10 minutes si une priere approche
 */
// exports.scheduledPrayerCheck = functions
//   .region('europe-west1')
//   .pubsub
//   .schedule('*/10 * * * *') // Toutes les 10 minutes
//   .timeZone('Europe/Paris')
//   .onRun(async (context) => {
//     // ... code commente pour reference ...
//   });

/**
 * DESACTIVE - Plus necessaire avec notifications locales
 * Nettoyage des marqueurs de notifications de priere (hebdomadaire)
 */
// exports.cleanupPrayerNotificationMarkers = functions
//   .region('europe-west1')
//   .pubsub
//   .schedule('0 4 * * 0') // Dimanche 4h
//   .timeZone('Europe/Paris')
//   .onRun(async (context) => {
//     // ... code commente pour reference ...
//   });

// ==================== NETTOYAGE NOTIFICATIONS ANCIENNES ====================
// Tous les dimanches à 3h du matin

exports.cleanupOldNotifications = functions
  .region('europe-west1')
  .pubsub
  .schedule('0 3 * * 0') // 3h chaque dimanche
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const snapshot = await admin.firestore()
        .collection('notifications_history')
        .where('sentAt', '<', thirtyDaysAgo)
        .get();

      const batch = admin.firestore().batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Nettoyage: ${snapshot.size} notifications supprimées`);
      return null;
    } catch (error) {
      console.error('Erreur nettoyage notifications:', error);
      return null;
    }
  });

// ==================== STATISTIQUES NOTIFICATIONS ====================
// Callable function pour le dashboard backoffice

exports.getNotificationStats = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
    }

    // Vérifier les droits admin
    const adminCheck = await isAdmin(context.auth.uid);
    if (!adminCheck) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Seuls les administrateurs peuvent accéder aux statistiques'
      );
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const snapshot = await admin.firestore()
        .collection('notifications_history')
        .where('sentAt', '>=', thirtyDaysAgo)
        .get();

      const stats = {
        total: snapshot.size,
        success: 0,
        failed: 0,
        byTopic: {},
      };

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.success) {
          stats.success++;
        } else {
          stats.failed++;
        }
        const topic = data.topic || 'unknown';
        stats.byTopic[topic] = (stats.byTopic[topic] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Erreur stats notifications:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== NOTIFICATION RÉPONSE MESSAGE ====================
// Trigger : quand un message est mis à jour (nouvelle réponse)

exports.onMessageReply = functions
  .region('europe-west1')
  .firestore
  .document('messages/{messageId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Vérifier si une nouvelle réponse a été ajoutée
    const beforeReplies = before.reponses || [];
    const afterReplies = after.reponses || [];

    if (afterReplies.length <= beforeReplies.length) {
      console.log('Pas de nouvelle réponse');
      return null;
    }

    // Trouver la nouvelle réponse
    const newReply = afterReplies[afterReplies.length - 1];

    if (newReply.createdBy === 'mosquee') {
      // === RÉPONSE DE LA MOSQUÉE → Notifier l'utilisateur ===
      const userId = after.odUserId;
      if (!userId) {
        console.log('Pas de userId trouvé');
        return null;
      }

      // Récupérer le token FCM de l'utilisateur
      try {
        const memberDoc = await admin.firestore().collection('members').doc(userId).get();
        const fcmToken = memberDoc.exists ? memberDoc.data().fcmToken : null;

        if (!fcmToken) {
          console.log('Pas de token FCM pour userId:', userId);
          return null;
        }

        const message = {
          notification: {
            title: '🕌 Nouvelle réponse',
            body: `La mosquée a répondu à votre message "${truncate(after.sujet, 30)}"`,
          },
          data: {
            type: 'message_reply',
            messageId: context.params.messageId,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
          apns: {
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert',
            },
            payload: {
              aps: {
                alert: {
                  title: '🕌 Nouvelle réponse',
                  body: `La mosquée a répondu à votre message`,
                },
                sound: 'default',
                badge: 1,
              },
            },
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'messages',
            },
          },
          token: fcmToken, // Envoyer directement au token de l'utilisateur
        };

        const response = await admin.messaging().send(message);
        console.log('🔔 Notification envoyée à l\'utilisateur:', userId, response);

        // Enregistrer dans l'historique
        await admin.firestore().collection('notifications_history').add({
          title: 'Nouvelle réponse',
          body: `Réponse au message: ${after.sujet}`,
          targetUserId: userId,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          messageId: response,
          success: true,
          source: 'message_reply_to_user',
          relatedMessageId: context.params.messageId,
        });

        return { success: true, messageId: response };
      } catch (error) {
        console.error('❌ Erreur notification utilisateur:', error);
        return { error: error.message };
      }
    } else {
      // === RÉPONSE DE L'UTILISATEUR → Notifier les admins ===
      console.log('Réponse de l\'utilisateur, notification aux admins');

      try {
        // Récupérer tous les admins avec leur token FCM (optimisé - évite N+1 query)
        const adminsSnapshot = await admin.firestore().collection('admins').get();

        if (adminsSnapshot.empty) {
          console.log('Aucun admin trouvé');
          return null;
        }

        const adminIds = adminsSnapshot.docs.map(doc => doc.id);

        // Batch query: récupérer tous les membres admins en une seule requête
        // Firestore limite 'in' à 30 éléments, donc on divise si nécessaire
        const adminTokens = [];
        const batchSize = 30;

        for (let i = 0; i < adminIds.length; i += batchSize) {
          const batchIds = adminIds.slice(i, i + batchSize);
          const membersSnapshot = await admin.firestore()
            .collection('members')
            .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
            .get();

          membersSnapshot.docs.forEach(memberDoc => {
            if (memberDoc.data().fcmToken) {
              adminTokens.push(memberDoc.data().fcmToken);
            }
          });
        }

        if (adminTokens.length === 0) {
          console.log('Aucun admin avec token FCM');
          return null;
        }

        const userName = sanitizeString(after.nom, 50) || 'Un utilisateur';
        const message = {
          notification: {
            title: '💬 Nouvelle réponse adhérent',
            body: `${userName} a répondu au message "${truncate(after.sujet, 25)}"`,
          },
          data: {
            type: 'admin_message_reply',
            messageId: context.params.messageId,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
          apns: {
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert',
            },
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'messages',
            },
          },
        };

        // Envoyer à tous les admins
        const responses = await admin.messaging().sendEachForMulticast({
          tokens: adminTokens,
          ...message,
        });

        console.log('🔔 Notifications admins envoyées:', responses.successCount, '/', adminTokens.length);

        // Enregistrer dans l'historique
        await admin.firestore().collection('notifications_history').add({
          title: 'Nouvelle réponse adhérent',
          body: `${userName} a répondu`,
          targetAdmins: true,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          successCount: responses.successCount,
          failureCount: responses.failureCount,
          success: responses.successCount > 0,
          source: 'message_reply_to_admins',
          relatedMessageId: context.params.messageId,
        });

        return { success: true, successCount: responses.successCount };
      } catch (error) {
        console.error('❌ Erreur notification admins:', error);
        return { error: error.message };
      }
    }
  });

// ==================== STRIPE PAYMENT ====================
// Créer un PaymentIntent pour les dons et cotisations

exports.createPaymentIntent = functions
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Vérifier l'authentification (optionnel pour les dons anonymes)
    // Mais on log l'uid si présent pour traçabilité
    const userId = context.auth?.uid || 'anonymous';

    const { amount, currency, description, metadata } = data;

    // Validation des paramètres - montant min 1€, max 10000€
    if (!amount || typeof amount !== 'number') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le montant est requis et doit être un nombre'
      );
    }

    if (amount < 100) { // minimum 1€ = 100 centimes
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le montant minimum est de 1€'
      );
    }

    if (amount > 1000000) { // maximum 10000€ = 1000000 centimes
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le montant maximum est de 10 000€'
      );
    }

    if (!currency) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'La devise est requise'
      );
    }

    // Rate limiting: max 5 paiements par 5 minutes
    // Utilise l'uid si auth, sinon hash basique sur IP (pas d'IP dispo donc 'anonymous')
    await checkRateLimit(userId, 'payment', 5, 300);

    try {
      // Créer le PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount, // déjà en centimes
        currency: currency,
        description: description || 'Don Mosquée El Mouhssinine',
        metadata: {
          ...metadata,
          userId: userId,
          source: 'app_mobile',
          createdAt: new Date().toISOString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      console.log('PaymentIntent créé:', paymentIntent.id);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('Erreur création PaymentIntent:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== WEBHOOK STRIPE ====================
// Pour confirmer les paiements et mettre à jour Firestore
// Avec idempotence et transactions atomiques

exports.stripeWebhook = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe?.webhook_secret;

    // SÉCURITÉ: Vérifier que le secret webhook est configuré
    if (!endpointSecret) {
      console.error('ERREUR CRITIQUE: stripe.webhook_secret non configuré');
      return res.status(500).send('Webhook not configured');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
      console.error('Erreur signature webhook:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer les différents événements
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;
        console.log('Paiement réussi:', paymentIntentId);

        try {
          const metadata = paymentIntent.metadata || {};
          const amountEuros = paymentIntent.amount / 100;

          // SÉCURITÉ: Valider que le montant metadata correspond au montant Stripe réel
          // Cela empêche la manipulation côté client des montants
          if (metadata.type === 'cotisation') {
            const declaredCotisation = parseFloat(metadata.montantCotisation) || 0;
            const declaredDon = parseFloat(metadata.montantDon) || 0;
            const declaredTotal = declaredCotisation + declaredDon;

            // Tolérance de 1 centime pour les erreurs d'arrondi
            if (Math.abs(declaredTotal - amountEuros) > 0.01) {
              console.error('⚠️ FRAUDE POTENTIELLE: Montant metadata (' + declaredTotal + '€) != montant Stripe (' + amountEuros + '€)');
              // Utiliser le montant Stripe réel, pas les metadata
              // On continue quand même le traitement mais avec le montant réel
            }
          }

          // ATOMICITÉ + IDEMPOTENCE: Tout dans une seule transaction
          await admin.firestore().runTransaction(async (transaction) => {
            // 1. Vérification idempotence DANS la transaction
            const processedRef = admin.firestore().collection('processed_payments').doc(paymentIntentId);
            const existingPayment = await transaction.get(processedRef);

            if (existingPayment.exists) {
              console.log('Paiement déjà traité (idempotence in-transaction):', paymentIntentId);
              // Throw pour sortir de la transaction sans erreur
              throw { alreadyProcessed: true };
            }

            // 2. Marquer comme traité (pour idempotence)
            transaction.set(processedRef, {
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              type: metadata.type || 'donation',
              amount: amountEuros,
            });

            // 3. Enregistrer le paiement selon le type
            if (metadata.type === 'cotisation') {
              // SÉCURITÉ: Utiliser le montant Stripe réel, pas les metadata client
              // Les metadata servent seulement à connaître la répartition cotisation/don
              const declaredCotisation = parseFloat(metadata.montantCotisation) || amountEuros;
              const declaredDon = parseFloat(metadata.montantDon) || 0;
              const declaredTotal = declaredCotisation + declaredDon;

              // Si les montants déclarés correspondent au total Stripe, on les utilise
              // Sinon, on considère tout comme cotisation (sécurité)
              let montantCotisation, montantDon;
              if (Math.abs(declaredTotal - amountEuros) <= 0.01) {
                montantCotisation = declaredCotisation;
                montantDon = declaredDon;
              } else {
                console.warn('Montants metadata non fiables, utilisation du montant Stripe total');
                montantCotisation = amountEuros;
                montantDon = 0;
              }

              // Créer le document payment (cotisation)
              const paymentRef = admin.firestore().collection('payments').doc();
              transaction.set(paymentRef, {
                stripePaymentIntentId: paymentIntentId,
                amount: montantCotisation,
                montant: montantCotisation, // Compatibilité: écrire les deux champs
                currency: paymentIntent.currency,
                status: 'succeeded',
                type: 'cotisation',
                description: paymentIntent.description,
                metadata: metadata,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              // Si don supplémentaire inclus, créer aussi un document donation
              if (montantDon > 0) {
                console.log('Don supplémentaire détecté:', montantDon, 'EUR');
                const donationRef = admin.firestore().collection('donations').doc();
                transaction.set(donationRef, {
                  stripePaymentIntentId: paymentIntentId,
                  amount: montantDon,
                  montant: montantDon,
                  currency: paymentIntent.currency,
                  status: 'succeeded',
                  type: 'donation',
                  description: 'Don supplémentaire lors de cotisation',
                  metadata: {
                    ...metadata,
                    linkedToCotisation: true,
                  },
                  projectId: null, // Don général à la mosquée
                  projectName: 'Don général',
                  isAnonymous: false,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }

              // Mettre à jour le membre si memberId fourni
              if (metadata.memberId) {
                const memberRef = admin.firestore().collection('members').doc(metadata.memberId);
                // SÉCURITÉ: Vérifier que le membre existe avant update
                const memberDoc = await transaction.get(memberRef);
                if (memberDoc.exists) {
                  transaction.update(memberRef, {
                    statut: 'actif',
                    status: 'actif', // Compatibilité: écrire les deux champs
                    datePaiement: admin.firestore.FieldValue.serverTimestamp(),
                    montantPaye: montantCotisation, // Seulement le montant de la cotisation
                    stripePaymentId: paymentIntentId,
                  });
                } else {
                  console.warn('Membre non trouvé pour update:', metadata.memberId);
                }
              }
            } else {
              // Don - Créer le document donation
              const donationRef = admin.firestore().collection('donations').doc();
              transaction.set(donationRef, {
                stripePaymentIntentId: paymentIntentId,
                amount: amountEuros,
                montant: amountEuros, // Compatibilité: écrire les deux champs
                currency: paymentIntent.currency,
                status: 'succeeded',
                type: 'donation',
                description: paymentIntent.description,
                metadata: metadata,
                projectId: metadata.projectId || null,
                projectName: metadata.projectName || null,
                isAnonymous: metadata.isAnonymous === 'true',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              // Mettre à jour le montant collecté du projet
              if (metadata.projectId) {
                const projectRef = admin.firestore().collection('projects').doc(metadata.projectId);
                // SÉCURITÉ: Vérifier que le projet existe avant update
                const projectDoc = await transaction.get(projectRef);
                if (projectDoc.exists) {
                  transaction.update(projectRef, {
                    montantCollecte: admin.firestore.FieldValue.increment(amountEuros),
                  });
                } else {
                  console.warn('Projet non trouvé pour update:', metadata.projectId);
                }
              }
            }
          });

          console.log('Paiement enregistré dans Firestore (transaction atomique)');
        } catch (dbError) {
          // Gérer le cas d'idempotence (pas une vraie erreur)
          if (dbError && dbError.alreadyProcessed) {
            console.log('Paiement déjà traité, retour OK');
            return res.json({ received: true, alreadyProcessed: true });
          }
          console.error('Erreur enregistrement Firestore:', dbError);
          // Retourner 500 pour que Stripe réessaie
          return res.status(500).send(`Database Error: ${dbError.message || 'Unknown error'}`);
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Paiement échoué:', failedPayment.id, failedPayment.last_payment_error?.message);

        // Enregistrer l'échec pour historique
        try {
          await admin.firestore().collection('failed_payments').add({
            stripePaymentIntentId: failedPayment.id,
            error: failedPayment.last_payment_error?.message || 'Unknown error',
            metadata: failedPayment.metadata || {},
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          console.error('Erreur enregistrement échec:', err);
        }
        break;

      default:
        console.log('Événement non géré:', event.type);
    }

    res.json({ received: true });
  });

// ==================== REÇUS FISCAUX ====================
// Génération et envoi des reçus fiscaux PDF

/**
 * Convertit un nombre en lettres (français)
 */
const numberToWords = (num) => {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

  if (num === 0) return 'zéro';
  if (num < 0) return 'moins ' + numberToWords(-num);

  let words = '';

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) {
      words += 'mille ';
    } else {
      words += numberToWords(thousands) + ' mille ';
    }
    num %= 1000;
  }

  if (num >= 100) {
    const hundreds = Math.floor(num / 100);
    if (hundreds === 1) {
      words += 'cent ';
    } else {
      words += units[hundreds] + ' cent ';
    }
    num %= 100;
  }

  if (num >= 20) {
    const ten = Math.floor(num / 10);
    const unit = num % 10;

    if (ten === 7 || ten === 9) {
      words += tens[ten - 1];
      if (unit === 1 && ten === 7) {
        words += ' et onze';
      } else {
        words += '-' + teens[unit];
      }
    } else if (ten === 8 && unit === 0) {
      words += 'quatre-vingts';
    } else {
      words += tens[ten];
      if (unit === 1 && ten < 8) {
        words += ' et un';
      } else if (unit > 0) {
        words += '-' + units[unit];
      }
    }
  } else if (num >= 10) {
    words += teens[num - 10];
  } else if (num > 0) {
    words += units[num];
  }

  return words.trim();
};

/**
 * Convertit un montant en euros en lettres
 */
const amountToWords = (amount) => {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  let result = numberToWords(euros) + ' euro' + (euros > 1 ? 's' : '');
  if (cents > 0) {
    result += ' et ' + numberToWords(cents) + ' centime' + (cents > 1 ? 's' : '');
  }
  return result;
};

/**
 * Génère le PDF CERFA pour un PARTICULIER (article 200 du CGI - 66%)
 */
const generateCERFAParticulier = async (data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { association, donateur, don, numeroRecu } = data;

    // En-tête CERFA
    doc.fontSize(16).font('Helvetica-Bold').text('REÇU AU TITRE DES DONS', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('À DES ORGANISMES D\'INTÉRÊT GÉNÉRAL', { align: 'center' });
    doc.fontSize(9).text('Article 200, 238 bis et 978 du code général des impôts (CGI)', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#666666').text('N° CERFA 11580*05', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1.5);

    // Numéro et date
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Reçu n° : ${numeroRecu}`, { align: 'right' });
    doc.font('Helvetica').text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(1.5);

    // Cadre 1 : Organisme bénéficiaire
    doc.rect(50, doc.y, 500, 110).stroke();
    const boxY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('1. ORGANISME BÉNÉFICIAIRE', 60, boxY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Nom : ${association.nom || '[À compléter]'}`, 60);
    doc.text(`Adresse : ${association.adresse || '[À compléter]'}`, 60);
    doc.text(`${association.codePostal || ''} ${association.ville || ''}`, 60);
    doc.text(`N° SIREN/RNA : ${association.siren || '[À compléter]'}`, 60);
    doc.text(`Statut juridique : ${association.statut || 'Association cultuelle loi 1905'}`, 60);
    doc.text(`Objet : ${association.objet || 'Exercice du culte musulman'}`, 60);
    doc.y = boxY + 120;

    // Cadre 2 : Donateur (particulier)
    doc.rect(50, doc.y, 500, 90).stroke();
    const donY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('2. DONATEUR (Particulier)', 60, donY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Nom : ${donateur.nom || ''}`, 60);
    doc.text(`Prénom : ${donateur.prenom || ''}`, 60);
    doc.text(`Adresse : ${donateur.adresse || 'Non renseignée'}`, 60);
    doc.text(`${donateur.codePostal || ''} ${donateur.ville || ''}`, 60);
    doc.y = donY + 100;

    // Cadre 3 : Don
    doc.rect(50, doc.y, 500, 130).stroke();
    const giftY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('3. DON', 60, giftY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Date du (des) versement(s) : ${don.date}`, 60);
    doc.text(`Mode de versement : ${don.mode}`, 60);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Montant : ${don.montant.toFixed(2)} €`, 60);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Soit en toutes lettres : ${amountToWords(don.montant)}`, 60);
    doc.moveDown(0.5);
    doc.text('Nature du don : Don en numéraire', 60);
    doc.text('Forme du don : Acte authentique / Acte sous seing privé / Don manuel / Autres', 60);
    doc.y = giftY + 140;

    // Cadre 4 : Article applicable
    doc.moveDown(0.5);
    doc.rect(50, doc.y, 500, 45).stroke();
    const artY = doc.y + 8;
    doc.fontSize(10).font('Helvetica-Bold').text('4. ARTICLE DU CGI APPLICABLE', 60, artY);
    doc.moveDown(0.3);
    doc.font('Helvetica');
    doc.text('[X] Article 200 du CGI (impôt sur le revenu)', 60);
    doc.text('[  ] Article 238 bis du CGI (impôt sur les sociétés)', 60);
    doc.y = artY + 55;

    // Mentions légales
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica');
    doc.text(
      'Le bénéficiaire certifie sur l\'honneur que les dons et versements qu\'il reçoit ouvrent droit à la réduction d\'impôt prévue à l\'article 200 du CGI.',
      50, doc.y, { width: 500, align: 'justify' }
    );
    doc.moveDown(0.5);
    doc.text(
      'Ce don ouvre droit à une réduction d\'impôt sur le revenu égale à 66% du montant versé, dans la limite de 20% du revenu imposable. Si le montant des dons dépasse cette limite, l\'excédent est reporté sur les 5 années suivantes.',
      50, doc.y, { width: 500, align: 'justify' }
    );

    // Signature
    doc.moveDown(1.5);
    doc.fontSize(10);
    doc.text(`Fait à ${association.ville || '[Ville]'}, le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(0.8);
    doc.text(`${association.signataire || 'Le Président'}`, { align: 'right' });
    doc.text(`${association.nomSignataire || '[Nom du signataire]'}`, { align: 'right' });

    // Pied de page
    doc.fontSize(7).text(
      'Document à conserver. Il vous permet de bénéficier d\'une réduction d\'impôt. Ne pas joindre à la déclaration de revenus.',
      50, 750, { align: 'center', width: 500 }
    );

    doc.end();
  });
};

/**
 * Génère le PDF CERFA pour une ENTREPRISE (article 238 bis du CGI - 60%)
 */
const generateCERFAEntreprise = async (data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { association, donateur, don, numeroRecu } = data;

    // En-tête CERFA
    doc.fontSize(16).font('Helvetica-Bold').text('REÇU AU TITRE DES DONS', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('À DES ORGANISMES D\'INTÉRÊT GÉNÉRAL', { align: 'center' });
    doc.fontSize(9).text('Article 200, 238 bis et 978 du code général des impôts (CGI)', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#666666').text('N° CERFA 16216*02', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1.5);

    // Numéro et date
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Reçu n° : ${numeroRecu}`, { align: 'right' });
    doc.font('Helvetica').text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(1.5);

    // Cadre 1 : Organisme bénéficiaire
    doc.rect(50, doc.y, 500, 110).stroke();
    const boxY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('1. ORGANISME BÉNÉFICIAIRE', 60, boxY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Nom : ${association.nom || '[À compléter]'}`, 60);
    doc.text(`Adresse : ${association.adresse || '[À compléter]'}`, 60);
    doc.text(`${association.codePostal || ''} ${association.ville || ''}`, 60);
    doc.text(`N° SIREN/RNA : ${association.siren || '[À compléter]'}`, 60);
    doc.text(`Statut juridique : ${association.statut || 'Association cultuelle loi 1905'}`, 60);
    doc.text(`Objet : ${association.objet || 'Exercice du culte musulman'}`, 60);
    doc.y = boxY + 120;

    // Cadre 2 : Donateur (entreprise)
    doc.rect(50, doc.y, 500, 110).stroke();
    const donY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('2. DONATEUR (Entreprise)', 60, donY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Raison sociale : ${donateur.companyName || donateur.nom || ''}`, 60);
    doc.text(`N° SIRET : ${donateur.siret || 'Non renseigné'}`, 60);
    doc.text(`Représentant légal : ${donateur.legalRepresentative || donateur.prenom || ''}`, 60);
    doc.text(`Adresse du siège : ${donateur.adresse || 'Non renseignée'}`, 60);
    doc.text(`${donateur.codePostal || ''} ${donateur.ville || ''}`, 60);
    doc.y = donY + 120;

    // Cadre 3 : Don
    doc.rect(50, doc.y, 500, 130).stroke();
    const giftY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('3. DON', 60, giftY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Date du (des) versement(s) : ${don.date}`, 60);
    doc.text(`Mode de versement : ${don.mode}`, 60);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Montant : ${don.montant.toFixed(2)} €`, 60);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Soit en toutes lettres : ${amountToWords(don.montant)}`, 60);
    doc.moveDown(0.5);
    doc.text('Nature du don : Don en numéraire', 60);
    doc.text('Forme du don : Acte authentique / Acte sous seing privé / Don manuel / Autres', 60);
    doc.y = giftY + 140;

    // Cadre 4 : Article applicable
    doc.moveDown(0.5);
    doc.rect(50, doc.y, 500, 45).stroke();
    const artY = doc.y + 8;
    doc.fontSize(10).font('Helvetica-Bold').text('4. ARTICLE DU CGI APPLICABLE', 60, artY);
    doc.moveDown(0.3);
    doc.font('Helvetica');
    doc.text('[  ] Article 200 du CGI (impôt sur le revenu)', 60);
    doc.text('[X] Article 238 bis du CGI (impôt sur les sociétés)', 60);
    doc.y = artY + 55;

    // Mentions légales
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica');
    doc.text(
      'Le bénéficiaire certifie sur l\'honneur que les dons et versements qu\'il reçoit ouvrent droit à la réduction d\'impôt prévue à l\'article 238 bis du CGI.',
      50, doc.y, { width: 500, align: 'justify' }
    );
    doc.moveDown(0.5);
    doc.text(
      'Ce don ouvre droit à une réduction d\'impôt sur les sociétés égale à 60% du montant versé, dans la limite de 20 000 € ou 5‰ du chiffre d\'affaires HT (le montant le plus élevé étant retenu). Si le montant des dons dépasse cette limite, l\'excédent est reporté sur les 5 exercices suivants.',
      50, doc.y, { width: 500, align: 'justify' }
    );

    // Signature
    doc.moveDown(1.5);
    doc.fontSize(10);
    doc.text(`Fait à ${association.ville || '[Ville]'}, le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(0.8);
    doc.text(`${association.signataire || 'Le Président'}`, { align: 'right' });
    doc.text(`${association.nomSignataire || '[Nom du signataire]'}`, { align: 'right' });

    // Pied de page
    doc.fontSize(7).text(
      'Document à conserver. Il vous permet de bénéficier d\'une réduction d\'impôt sur les sociétés.',
      50, 750, { align: 'center', width: 500 }
    );

    doc.end();
  });
};

/**
 * Génère le bon PDF CERFA selon le type de donateur
 * Rétrocompatible : si pas de donorType, utilise le template particulier
 */
const generateRecuFiscalPDF = async (data) => {
  const donorType = data.donorType || 'particulier';
  if (donorType === 'entreprise') {
    return generateCERFAEntreprise(data);
  }
  return generateCERFAParticulier(data);
};

/**
 * Cloud Function: Générer et envoyer un reçu fiscal par email
 */
exports.sendRecuFiscal = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB', // PDFKit nécessite plus de mémoire
  })
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Vérifier l'authentification
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Vous devez être connecté'
      );
    }

    const { email, annee } = data;

    if (!email || !annee) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email et année sont requis'
      );
    }

    // Vérifier que l'utilisateur demande son propre reçu fiscal
    const userEmail = context.auth.token.email;
    if (userEmail && userEmail.toLowerCase() !== email.toLowerCase()) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Vous ne pouvez demander que votre propre reçu fiscal'
      );
    }

    // Rate limiting: max 3 reçus fiscaux par heure (évite le spam d'emails)
    await checkRateLimit(context.auth.uid, 'recu', 3, 3600);

    try {
      // 1. Récupérer les paramètres de l'association
      const settingsDoc = await admin.firestore()
        .collection('settings')
        .doc('recusFiscaux')
        .get();

      if (!settingsDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Les paramètres des reçus fiscaux ne sont pas configurés'
        );
      }

      const association = settingsDoc.data();

      // 2. Récupérer les DONS de l'utilisateur pour l'année
      // IMPORTANT: Seuls les dons sont éligibles au reçu fiscal, PAS les cotisations
      // Les cotisations fixes (10€ mensuel, 100€ annuel) ne donnent pas droit à déduction
      const startDate = new Date(annee, 0, 1);
      const endDate = new Date(annee, 11, 31, 23, 59, 59);

      // Dons dans la collection donations (dons pour projets)
      const donationsSnapshot = await admin.firestore()
        .collection('donations')
        .where('metadata.donorEmail', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', '==', 'succeeded')
        .get();

      // Dons dans la collection payments (surplus au-dessus de la cotisation)
      // On ne compte que les paiements avec type='don' ou eligibleRecuFiscal=true
      const paymentsSnapshot = await admin.firestore()
        .collection('payments')
        .where('metadata.email', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', '==', 'succeeded')
        .get();

      // Combiner et calculer le total (seulement les dons, pas les cotisations)
      let totalDons = 0;
      const donsDetails = [];
      let detectedDonorType = 'particulier'; // par défaut
      let donorInfoFromDonation = null; // infos donateur depuis les dons (nouveaux champs)
      let latestDonorTimestamp = null; // pour prendre le plus récent

      // Les donations (pour projets) sont toujours des dons
      donationsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        totalDons += d.amount || 0;
        donsDetails.push({
          date: d.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A',
          montant: d.amount || 0,
          mode: d.metadata?.paymentMethod || 'Carte bancaire',
          type: 'Don projet',
        });
        // Détecter le type de donateur depuis le don le plus récent
        if (d.donorType || d.donorInfo) {
          const ts = d.createdAt?.toDate?.()?.getTime() || 0;
          if (!latestDonorTimestamp || ts > latestDonorTimestamp) {
            latestDonorTimestamp = ts;
            if (d.donorType) detectedDonorType = d.donorType;
            if (d.donorInfo) donorInfoFromDonation = d.donorInfo;
          }
        }
      });

      // Pour les payments, ne compter que ceux marqués comme don
      paymentsSnapshot.docs.forEach(doc => {
        const p = doc.data();
        // Vérifier si c'est un don (type='don' ou eligibleRecuFiscal=true)
        const isDon = p.type === 'don' || p.eligibleRecuFiscal === true;
        if (isDon) {
          totalDons += p.amount || 0;
          donsDetails.push({
            date: p.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A',
            montant: p.amount || 0,
            mode: p.metadata?.paymentMethod || 'Carte bancaire',
            type: 'Don libre',
          });
        }
        // Les cotisations (type='cotisation' ou sans type) ne sont PAS comptées
      });

      if (totalDons === 0) {
        throw new functions.https.HttpsError(
          'not-found',
          `Aucun don trouvé pour l'année ${annee}`
        );
      }

      // 3. Récupérer les infos du donateur
      // Priorité : donorInfo des donations > profil membre > vide
      let donateur = {
        nom: '',
        prenom: '',
        adresse: '',
        codePostal: '',
        ville: '',
        companyName: '',
        siret: '',
        legalRepresentative: '',
      };

      if (donorInfoFromDonation) {
        // Utiliser les infos renseignées lors du don
        if (detectedDonorType === 'entreprise') {
          donateur = {
            nom: donorInfoFromDonation.companyName || '',
            prenom: donorInfoFromDonation.legalRepresentative || '',
            adresse: donorInfoFromDonation.address || '',
            codePostal: donorInfoFromDonation.postalCode || '',
            ville: donorInfoFromDonation.city || '',
            companyName: donorInfoFromDonation.companyName || '',
            siret: donorInfoFromDonation.siret || '',
            legalRepresentative: donorInfoFromDonation.legalRepresentative || '',
          };
        } else {
          donateur = {
            nom: donorInfoFromDonation.lastName || '',
            prenom: donorInfoFromDonation.firstName || '',
            adresse: donorInfoFromDonation.address || '',
            codePostal: donorInfoFromDonation.postalCode || '',
            ville: donorInfoFromDonation.city || '',
            companyName: '',
            siret: '',
            legalRepresentative: '',
          };
        }
      } else {
        // Fallback : profil membre
        const memberSnapshot = await admin.firestore()
          .collection('members')
          .where('email', '==', email.toLowerCase())
          .limit(1)
          .get();

        if (!memberSnapshot.empty) {
          const member = memberSnapshot.docs[0].data();
          donateur = {
            nom: member.nom || '',
            prenom: member.prenom || '',
            adresse: member.adresse || '',
            codePostal: member.codePostal || '',
            ville: member.ville || '',
            companyName: '',
            siret: '',
            legalRepresentative: '',
          };
        }
      }

      // 4. Générer le numéro de reçu unique
      const recuCounterRef = admin.firestore().collection('counters').doc('recusFiscaux');
      const newNumber = await admin.firestore().runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(recuCounterRef);
        let currentNumber = 0;
        if (counterDoc.exists) {
          currentNumber = counterDoc.data()[`year_${annee}`] || 0;
        }
        const nextNumber = currentNumber + 1;
        transaction.set(recuCounterRef, { [`year_${annee}`]: nextNumber }, { merge: true });
        return nextNumber;
      });

      const numeroRecu = `RF-${annee}-${String(newNumber).padStart(5, '0')}`;

      // 5. Générer le PDF (template selon type donateur)
      const pdfBuffer = await generateRecuFiscalPDF({
        association,
        donateur,
        don: {
          date: `Année ${annee}`,
          montant: totalDons,
          mode: 'Divers (voir détails)',
        },
        numeroRecu,
        donorType: detectedDonorType,
      });

      // 6. Envoyer par email via Brevo SMTP
      const brevoUser = functions.config().brevo?.smtp_user;
      const brevoPass = functions.config().brevo?.smtp_pass;
      const fromEmail = functions.config().brevo?.from_email;
      const fromName = functions.config().brevo?.from_name || 'Mosquée El Mouhssinine';

      if (!brevoUser || !brevoPass || !fromEmail) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'La configuration email Brevo n\'est pas complète'
        );
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: brevoUser,
          pass: brevoPass,
        },
      });

      const reductionText = detectedDonorType === 'entreprise'
        ? 'Il vous permet de bénéficier d\'une réduction d\'impôt sur les sociétés de 60% du montant de vos dons (article 238 bis du CGI).'
        : 'Il vous permet de bénéficier d\'une réduction d\'impôt sur le revenu de 66% du montant de vos dons (article 200 du CGI).';
      const donateurLabel = detectedDonorType === 'entreprise'
        ? (donateur.companyName || donateur.nom || '')
        : `${donateur.prenom || ''} ${donateur.nom || ''}`.trim();

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: `Reçu fiscal ${annee} - ${association.nom || 'Mosquée El Mouhssinine'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Votre reçu fiscal ${annee}</h2>
            <p>Bonjour ${donateurLabel || ''},</p>
            <p>Veuillez trouver ci-joint votre reçu fiscal pour l'année ${annee}.</p>
            <p><strong>Montant total des dons :</strong> ${totalDons.toFixed(2)} €</p>
            <p><strong>Numéro du reçu :</strong> ${numeroRecu}</p>
            ${detectedDonorType === 'entreprise' ? '<p><strong>Type :</strong> Entreprise (CERFA 16216)</p>' : '<p><strong>Type :</strong> Particulier (CERFA 11580)</p>'}
            <br>
            <p>Ce document est à conserver.</p>
            <p>${reductionText}</p>
            <br>
            <p>Qu'Allah vous récompense pour votre générosité.</p>
            <p>${association.nom || 'Mosquée El Mouhssinine'}</p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
                Pour nous contacter, écrivez à :
                <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
              </p>
              <p style="color: #aaa; font-size: 11px; margin-top: 10px;">
                Mosquée El Mouhssinine - Bourg-en-Bresse
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `recu_fiscal_${annee}_${numeroRecu}.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      // 7. Enregistrer dans Firestore
      await admin.firestore().collection('recus_fiscaux').add({
        numeroRecu,
        annee,
        email,
        donateur,
        donorType: detectedDonorType,
        montantTotal: totalDons,
        donsDetails,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
      });

      // 8. Sauvegarder le PDF dans Storage
      const bucket = admin.storage().bucket();
      const filePath = `recus_fiscaux/${annee}/${numeroRecu}.pdf`;
      await bucket.file(filePath).save(pdfBuffer, {
        metadata: { contentType: 'application/pdf' },
      });

      console.log('Reçu fiscal envoyé:', numeroRecu, 'à', email);

      // Copie dans messagerie interne
      try {
        await admin.firestore().collection('messages').add({
          odUserId: context.auth.uid,
          userName: `${donateur.prenom || ''} ${donateur.nom || ''}`.trim(),
          userEmail: email,
          sujet: `Reçu fiscal ${annee}`,
          message: `Bonjour ${donateurLabel || ''},\n\nVotre reçu fiscal pour l'année ${annee} a été envoyé à ${email}.\n\nMontant total des dons : ${totalDons.toFixed(2)} €\nNuméro du reçu : ${numeroRecu}\nType : ${detectedDonorType === 'entreprise' ? 'Entreprise (art. 238 bis - 60%)' : 'Particulier (art. 200 - 66%)'}\n\nQu'Allah vous récompense pour votre générosité.\nMosquée El Mouhssinine`,
          status: 'resolu',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: 'mosquee',
          type: 'system',
          reponses: [],
        });
      } catch (msgError) {
        console.error('⚠️ Erreur copie message reçu fiscal:', msgError);
      }

      return {
        success: true,
        numeroRecu,
        montantTotal: totalDons,
        message: `Reçu fiscal envoyé à ${email}`,
      };

    } catch (error) {
      console.error('Erreur génération reçu fiscal:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Cloud Function: Récupérer les dons d'un utilisateur par année
 */
exports.getDonsByYear = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
    }

    const { email, annee } = data;

    if (!email || !annee) {
      throw new functions.https.HttpsError('invalid-argument', 'Email et année requis');
    }

    // Vérifier que l'utilisateur demande ses propres dons
    const userEmail = context.auth.token.email;
    if (userEmail && userEmail.toLowerCase() !== email.toLowerCase()) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Vous ne pouvez consulter que vos propres dons'
      );
    }

    try {
      const startDate = new Date(annee, 0, 1);
      const endDate = new Date(annee, 11, 31, 23, 59, 59);

      // Dons (pour projets)
      const donationsSnapshot = await admin.firestore()
        .collection('donations')
        .where('metadata.donorEmail', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', '==', 'succeeded')
        .get();

      // Paiements (cotisations + dons libres)
      const paymentsSnapshot = await admin.firestore()
        .collection('payments')
        .where('metadata.email', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', '==', 'succeeded')
        .get();

      let totalDonsEligibles = 0; // Total éligible au reçu fiscal
      let totalCotisations = 0;   // Total cotisations (non éligible)
      const dons = [];

      // Dons pour projets (toujours éligibles)
      donationsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        totalDonsEligibles += d.amount || 0;
        dons.push({
          id: doc.id,
          type: 'don_projet',
          montant: d.amount || 0,
          date: d.createdAt?.toDate?.()?.toISOString() || null,
          projet: d.projectName || null,
          eligibleRecuFiscal: true,
        });
      });

      // Paiements (distinguer cotisations et dons)
      paymentsSnapshot.docs.forEach(doc => {
        const p = doc.data();
        const isDon = p.type === 'don' || p.eligibleRecuFiscal === true;

        if (isDon) {
          totalDonsEligibles += p.amount || 0;
          dons.push({
            id: doc.id,
            type: 'don_libre',
            montant: p.amount || 0,
            date: p.createdAt?.toDate?.()?.toISOString() || null,
            eligibleRecuFiscal: true,
          });
        } else {
          totalCotisations += p.amount || 0;
          dons.push({
            id: doc.id,
            type: 'cotisation',
            montant: p.amount || 0,
            date: p.createdAt?.toDate?.()?.toISOString() || null,
            period: p.period || null,
            eligibleRecuFiscal: false,
          });
        }
      });

      return {
        totalEligible: totalDonsEligibles,
        totalCotisations,
        total: totalDonsEligibles + totalCotisations,
        dons,
        annee
      };

    } catch (error) {
      console.error('Erreur getDonsByYear:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== NOUVEAU MEMBRE SYMPATHISANT ====================
// Trigger : quand un nouveau membre est créé avec status 'sympathisant'

exports.onNewSympathisant = functions
  .region('europe-west1')
  .firestore
  .document('members/{memberId}')
  .onCreate(async (snap, context) => {
    const member = snap.data();

    // Seulement pour les sympathisants
    if (member.status !== 'sympathisant') {
      console.log('Nouveau membre mais pas sympathisant, status:', member.status);
      return null;
    }

    const email = member.email;
    const prenom = member.prenom || 'Membre';

    if (!email) {
      console.log('Pas d\'email pour le sympathisant, skip email de bienvenue');
      return null;
    }

    console.log('🎉 Nouveau sympathisant:', prenom, email);

    try {
      // Récupérer les infos de la mosquée
      const mosqueeDoc = await admin.firestore()
        .collection('settings')
        .doc('mosqueeInfo')
        .get();

      const mosquee = mosqueeDoc.exists ? mosqueeDoc.data() : {};
      const nomMosquee = mosquee.nom || 'Mosquée El Mouhssinine';
      const adresseMosquee = mosquee.adresse || '';
      const villeMosquee = mosquee.ville || 'Bourg-en-Bresse';
      const telephoneMosquee = mosquee.telephone || '';
      const emailMosquee = mosquee.email || '';

      // Configuration email Brevo
      const brevoUser = functions.config().brevo?.smtp_user;
      const brevoPass = functions.config().brevo?.smtp_pass;
      const fromEmail = functions.config().brevo?.from_email;
      const fromName = functions.config().brevo?.from_name || nomMosquee;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error('Configuration Brevo manquante, email non envoyé');
        return null;
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: brevoUser,
          pass: brevoPass,
        },
      });

      // Envoyer l'email de bienvenue
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: `Bienvenue à la ${nomMosquee} !`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6b4423 0%, #8b5a2b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🕌 Bienvenue</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Assalamu alaykum <strong>${prenom}</strong>,</p>

              <p style="font-size: 16px;">Bienvenue en tant que <strong>membre sympathisant</strong> de la ${nomMosquee} !</p>

              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b4423;">
                <h3 style="color: #6b4423; margin-top: 0;">🎁 En tant que sympathisant, vous avez accès à :</h3>
                <ul style="color: #444; line-height: 1.8;">
                  <li>📍 Les horaires de prière en temps réel</li>
                  <li>📖 Le Coran complet avec audio et traduction</li>
                  <li>📢 Les annonces et événements de la mosquée</li>
                  <li>🤲 Les invocations (adhkar)</li>
                  <li>📝 L'alphabet arabe et les leçons</li>
                  <li>💬 La messagerie avec le bureau</li>
                </ul>
              </div>

              <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2e7d32; margin-top: 0;">💳 Pour devenir membre actif (adhérent)</h3>
                <ol style="color: #444; line-height: 1.8;">
                  <li>Ouvrez l'application et allez dans "Membre"</li>
                  <li>Cliquez sur "Devenir Membre Actif"</li>
                  <li>Lisez et acceptez les statuts et règlement intérieur</li>
                  <li>Payez votre cotisation (mensuelle ou annuelle)</li>
                  <li>Votre adhésion sera validée par le bureau</li>
                </ol>
                <p style="font-size: 14px; color: #666; margin-bottom: 0;">
                  <em>En tant que membre actif, vous bénéficiez d'une carte de membre, du droit de vote en AG, et d'un reçu fiscal pour votre cotisation.</em>
                </p>
              </div>

              <p style="font-size: 16px; color: #444;">Qu'Allah vous bénisse et accepte vos bonnes actions.</p>

              <p style="font-size: 16px; color: #444;">Fraternellement,<br><strong>Le Bureau de la ${nomMosquee}</strong></p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

              <div style="font-size: 13px; color: #888; text-align: center;">
                ${adresseMosquee ? `<p style="margin: 5px 0;">📍 ${adresseMosquee}, ${villeMosquee}</p>` : ''}
                ${telephoneMosquee ? `<p style="margin: 5px 0;">📞 ${telephoneMosquee}</p>` : ''}
                ${emailMosquee ? `<p style="margin: 5px 0;">📧 ${emailMosquee}</p>` : ''}
              </div>

              <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center;">
                <p style="color: #888; font-size: 12px; margin: 0;">
                  ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
                  Pour nous contacter, écrivez à :
                  <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
                </p>
              </div>
            </div>
          </div>
        `,
      });

      console.log('✅ Email de bienvenue envoyé à', email);

      // Copie dans messagerie interne (ne bloque pas si erreur)
      try {
        await admin.firestore().collection('messages').add({
          odUserId: snap.id,
          userName: `${prenom} ${member.nom || ''}`.trim(),
          userEmail: email,
          sujet: 'Bienvenue à El Mouhssinine',
          message: `Assalamu alaykum ${prenom},\n\nBienvenue en tant que membre sympathisant de la ${nomMosquee} !\n\nVous avez accès à :\n- Les horaires de prière en temps réel\n- Le Coran complet avec audio et traduction\n- Les annonces et événements de la mosquée\n- Les invocations (adhkar)\n- L'alphabet arabe et les leçons\n- La messagerie avec le bureau\n\nPour devenir membre actif, ouvrez l'onglet "Membre" et cliquez sur "Devenir Membre Actif".\n\nQu'Allah vous bénisse.\n\nLe Bureau de la ${nomMosquee}`,
          status: 'resolu',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: 'mosquee',
          type: 'system',
          reponses: [],
        });
        console.log('✅ Message bienvenue copié dans messagerie');
      } catch (msgError) {
        console.error('⚠️ Erreur copie message bienvenue:', msgError);
      }

      // Mettre à jour le document membre
      await snap.ref.update({
        welcomeEmailSent: true,
        welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, email };

    } catch (error) {
      console.error('❌ Erreur envoi email bienvenue:', error);
      return { error: error.message };
    }
  });

// ==================== VALIDATION ADHÉSION PAR LE BUREAU ====================
// Callable function pour valider ou refuser une adhésion

exports.validateMembership = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Vérifier l'authentification
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
    }

    // Vérifier les droits admin
    const adminCheck = await isAdmin(context.auth.uid);
    if (!adminCheck) {
      throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs');
    }

    const { memberId, action, message } = data;

    if (!memberId || !action) {
      throw new functions.https.HttpsError('invalid-argument', 'memberId et action sont requis');
    }

    if (!['approve', 'reject', 'request_visit'].includes(action)) {
      throw new functions.https.HttpsError('invalid-argument', 'Action invalide');
    }

    try {
      // Récupérer le membre
      const memberRef = admin.firestore().collection('members').doc(memberId);
      const memberDoc = await memberRef.get();

      if (!memberDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Membre non trouvé');
      }

      const member = memberDoc.data();
      const email = member.email;
      const prenom = member.prenom || 'Membre';
      const nom = member.nom || '';

      // Récupérer les infos de la mosquée pour les emails
      const mosqueeDoc = await admin.firestore()
        .collection('settings')
        .doc('mosqueeInfo')
        .get();

      const mosquee = mosqueeDoc.exists ? mosqueeDoc.data() : {};
      const nomMosquee = mosquee.nom || 'Mosquée El Mouhssinine';

      // Configuration email
      const brevoUser = functions.config().brevo?.smtp_user;
      const brevoPass = functions.config().brevo?.smtp_pass;
      const fromEmail = functions.config().brevo?.from_email;
      const fromName = functions.config().brevo?.from_name || nomMosquee;

      let transporter = null;
      if (brevoUser && brevoPass && fromEmail) {
        transporter = nodemailer.createTransport({
          host: 'smtp-relay.brevo.com',
          port: 587,
          secure: false,
          auth: {
            user: brevoUser,
            pass: brevoPass,
          },
        });
      }

      // ========== APPROVAL ==========
      if (action === 'approve') {
        // Mettre à jour le statut
        await memberRef.update({
          status: 'actif',
          validatedAt: admin.firestore.FieldValue.serverTimestamp(),
          validatedBy: context.auth.uid,
        });

        // Envoyer email de confirmation
        if (transporter && email) {
          await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: email,
            subject: `🎉 Votre adhésion est validée - ${nomMosquee}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0;">✅ Adhésion Validée</h1>
                </div>

                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 16px;">Assalamu alaykum <strong>${prenom}</strong>,</p>

                  <p style="font-size: 16px;">Nous avons le plaisir de vous informer que votre adhésion à la ${nomMosquee} a été <strong style="color: #2e7d32;">validée</strong> !</p>

                  <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2e7d32; margin-top: 0;">Vous êtes maintenant membre actif</h3>
                    <ul style="color: #444; line-height: 1.8;">
                      <li>🎫 Carte de membre officielle</li>
                      <li>🗳️ Droit de vote en Assemblée Générale</li>
                      <li>📜 Reçu fiscal pour votre cotisation</li>
                    </ul>
                  </div>

                  <p style="font-size: 16px;">Votre carte de membre est disponible dans l'application.</p>

                  <p style="font-size: 16px; color: #444;">Qu'Allah vous récompense pour votre engagement.</p>

                  <p style="font-size: 16px; color: #444;">Fraternellement,<br><strong>Le Bureau de la ${nomMosquee}</strong></p>

                  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
                    <p style="color: #888; font-size: 12px; margin: 0;">
                      ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
                      Pour nous contacter, écrivez à :
                      <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
                    </p>
                    <p style="color: #aaa; font-size: 11px; margin-top: 10px;">
                      Mosquée El Mouhssinine - Bourg-en-Bresse
                    </p>
                  </div>
                </div>
              </div>
            `,
          });
        }

        // Envoyer notification push
        if (member.fcmToken) {
          await admin.messaging().send({
            token: member.fcmToken,
            notification: {
              title: '🎉 Adhésion validée !',
              body: 'Félicitations, vous êtes maintenant membre actif.',
            },
            data: {
              type: 'membership_approved',
              memberId: memberId,
            },
          });
        }

        // Copie dans messagerie interne
        try {
          await admin.firestore().collection('messages').add({
            odUserId: member.uid || memberId,
            userName: `${prenom} ${nom}`.trim(),
            userEmail: email || '',
            sujet: 'Adhésion validée',
            message: `Assalamu alaykum ${prenom},\n\nNous avons le plaisir de vous informer que votre adhésion à la ${nomMosquee} a été validée !\n\nVous êtes maintenant membre actif :\n- Carte de membre officielle\n- Droit de vote en Assemblée Générale\n- Reçu fiscal pour votre cotisation\n\nVotre carte de membre est disponible dans l'application.\n\nQu'Allah vous récompense pour votre engagement.\n\nLe Bureau de la ${nomMosquee}`,
            status: 'resolu',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'mosquee',
            type: 'system',
            reponses: [],
          });
        } catch (msgError) {
          console.error('⚠️ Erreur copie message adhésion validée:', msgError);
        }

        console.log('✅ Adhésion validée pour', prenom, nom);
        return { success: true, action: 'approved' };
      }

      // ========== REJECTION ==========
      if (action === 'reject') {
        const montant = member.cotisation?.montant || 0;

        // 1. Créer un don à partir du paiement
        if (montant > 0) {
          await admin.firestore().collection('donations').add({
            donateur: `${prenom} ${nom}`,
            email: email || '',
            telephone: member.telephone || '',
            montant: montant,
            projetId: null,
            projetNom: 'Don libre',
            modePaiement: member.modePaiement || 'autre',
            origine: 'conversion_adhesion_refusee',
            membreId: memberId,
            eligibleRecuFiscal: true,
            date: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // 2. Mettre à jour le membre en sympathisant
        await memberRef.update({
          status: 'sympathisant',
          adhesionRefuseeAt: admin.firestore.FieldValue.serverTimestamp(),
          adhesionRefuseeRaison: message || 'Décision du bureau',
          cotisation: {
            ...member.cotisation,
            dateDebut: null,
            dateFin: null,
          },
          aPaye: false,
          datePaiement: null,
        });

        // 3. Envoyer email d'information
        if (transporter && email) {
          await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: email,
            subject: `Information concernant votre demande d'adhésion - ${nomMosquee}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #f5f5f5; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: #333; margin: 0;">Information</h1>
                </div>

                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 16px;">Assalamu alaykum <strong>${prenom}</strong>,</p>

                  <p style="font-size: 16px;">Nous avons bien reçu votre demande d'adhésion.</p>

                  <p style="font-size: 16px;">Après examen par le bureau, nous ne sommes pas en mesure de valider votre adhésion en tant que membre actif.</p>

                  <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                    <p style="margin: 0; color: #e65100;">
                      <strong>Conformément à nos conditions :</strong><br>
                      Votre paiement de <strong>${montant}€</strong> a été converti en don au profit de la mosquée.
                    </p>
                  </div>

                  <p style="font-size: 16px;">Vous recevrez un reçu fiscal pour ce don.</p>

                  <p style="font-size: 16px;">Vous restez <strong>membre sympathisant</strong> et conservez l'accès à toutes les fonctionnalités de l'application.</p>

                  <p style="font-size: 16px;">Pour toute question, n'hésitez pas à nous contacter via l'application ou à passer au bureau de la mosquée.</p>

                  <p style="font-size: 16px; color: #444;">Fraternellement,<br><strong>Le Bureau de la ${nomMosquee}</strong></p>

                  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
                    <p style="color: #888; font-size: 12px; margin: 0;">
                      ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
                      Pour nous contacter, écrivez à :
                      <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
                    </p>
                    <p style="color: #aaa; font-size: 11px; margin-top: 10px;">
                      Mosquée El Mouhssinine - Bourg-en-Bresse
                    </p>
                  </div>
                </div>
              </div>
            `,
          });
        }

        // 4. Envoyer notification push
        if (member.fcmToken) {
          await admin.messaging().send({
            token: member.fcmToken,
            notification: {
              title: 'Information adhésion',
              body: `Votre paiement de ${montant}€ a été converti en don.`,
            },
            data: {
              type: 'membership_rejected',
              memberId: memberId,
            },
          });
        }

        // Copie dans messagerie interne
        try {
          await admin.firestore().collection('messages').add({
            odUserId: member.uid || memberId,
            userName: `${prenom} ${nom}`.trim(),
            userEmail: email || '',
            sujet: 'Information concernant votre adhésion',
            message: `Assalamu alaykum ${prenom},\n\nNous avons bien reçu votre demande d'adhésion.\n\nAprès examen par le bureau, nous ne sommes pas en mesure de valider votre adhésion en tant que membre actif.\n\nVotre paiement de ${montant}€ a été converti en don au profit de la mosquée. Vous recevrez un reçu fiscal pour ce don.\n\nVous restez membre sympathisant et conservez l'accès à toutes les fonctionnalités de l'application.\n\nPour toute question, n'hésitez pas à nous contacter via l'application.\n\nLe Bureau de la ${nomMosquee}`,
            status: 'non_lu',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'mosquee',
            type: 'system',
            reponses: [],
          });
        } catch (msgError) {
          console.error('⚠️ Erreur copie message adhésion refusée:', msgError);
        }

        console.log('❌ Adhésion refusée pour', prenom, nom, '- paiement converti en don');
        return { success: true, action: 'rejected', donAmount: montant };
      }

      // ========== REQUEST VISIT ==========
      if (action === 'request_visit') {
        // Créer un message dans la collection messages
        await admin.firestore().collection('messages').add({
          sujet: 'Votre adhésion',
          message: message || `Bonjour ${prenom},\n\nNous vous invitons à venir au bureau de la mosquée pour finaliser votre adhésion.\n\nCordialement,\nLe Bureau`,
          odUserId: member.uid || memberId,
          userName: `${prenom} ${nom}`.trim(),
          userEmail: email || '',
          status: 'non_lu',
          createdBy: 'mosquee',
          type: 'system',
          reponses: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Envoyer notification push
        if (member.fcmToken) {
          await admin.messaging().send({
            token: member.fcmToken,
            notification: {
              title: '📍 Passage au bureau demandé',
              body: 'La mosquée souhaite vous rencontrer pour votre adhésion.',
            },
            data: {
              type: 'visit_requested',
              memberId: memberId,
            },
          });
        }

        console.log('📍 Demande de passage au bureau pour', prenom, nom);
        return { success: true, action: 'visit_requested' };
      }

    } catch (error) {
      console.error('❌ Erreur validateMembership:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== CACHE HORAIRES DE PRIÈRE ====================
// Cache quotidien des horaires pour éviter les appels API directs
// Exécuté tous les jours à 0h05 (après minuit pour le nouveau jour)

exports.cachePrayerTimesDaily = functions
  .region('europe-west1')
  .pubsub
  .schedule('5 0 * * *') // 0h05 chaque jour
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    console.log('🕌 Début du cache quotidien des horaires de prière');

    try {
      // Récupérer les horaires depuis Aladhan API
      const timings = await fetchPrayerTimes();

      // Récupérer la date hégirien
      const today = new Date();
      const dateKey = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
      const hijriResponse = await fetch(`https://api.aladhan.com/v1/gToH/${dateKey}?adjustment=-1`);
      const hijriData = await hijriResponse.json();

      let hijriDate = null;
      if (hijriData.code === 200 && hijriData.data) {
        const h = hijriData.data.hijri;
        hijriDate = {
          day: h.day,
          month: h.month.number,
          monthAr: h.month.ar,
          monthEn: h.month.en,
          year: h.year,
          designation: h.designation?.abbreviated || 'H',
        };
      }

      // Sauvegarder dans Firestore
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      await admin.firestore()
        .collection('cached_prayer_times')
        .doc(todayStr)
        .set({
          timings: {
            Fajr: timings.Fajr,
            Sunrise: timings.Sunrise,
            Dhuhr: timings.Dhuhr,
            Asr: timings.Asr,
            Maghrib: timings.Maghrib,
            Isha: timings.Isha,
          },
          hijri: hijriDate,
          cachedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'aladhan_api',
        });

      console.log('✅ Cache horaires sauvegardé pour', todayStr);

      // Nettoyer les anciens caches (garder 7 jours)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const oldCacheSnapshot = await admin.firestore()
        .collection('cached_prayer_times')
        .where('cachedAt', '<', sevenDaysAgo)
        .get();

      if (!oldCacheSnapshot.empty) {
        const batch = admin.firestore().batch();
        oldCacheSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`🧹 ${oldCacheSnapshot.size} anciens caches supprimés`);
      }

      return null;
    } catch (error) {
      console.error('❌ Erreur cache horaires:', error);
      return null;
    }
  });

// Fonction pour forcer le cache (callable depuis le backoffice si besoin)
exports.forceCachePrayerTimes = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Vérifier admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
    }

    const adminCheck = await isAdmin(context.auth.uid);
    if (!adminCheck) {
      throw new functions.https.HttpsError('permission-denied', 'Réservé aux admins');
    }

    try {
      const timings = await fetchPrayerTimes();

      const today = new Date();
      const dateKey = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
      const hijriResponse = await fetch(`https://api.aladhan.com/v1/gToH/${dateKey}?adjustment=-1`);
      const hijriData = await hijriResponse.json();

      let hijriDate = null;
      if (hijriData.code === 200 && hijriData.data) {
        const h = hijriData.data.hijri;
        hijriDate = {
          day: h.day,
          month: h.month.number,
          monthAr: h.month.ar,
          monthEn: h.month.en,
          year: h.year,
          designation: h.designation?.abbreviated || 'H',
        };
      }

      const todayStr = today.toISOString().split('T')[0];
      await admin.firestore()
        .collection('cached_prayer_times')
        .doc(todayStr)
        .set({
          timings: {
            Fajr: timings.Fajr,
            Sunrise: timings.Sunrise,
            Dhuhr: timings.Dhuhr,
            Asr: timings.Asr,
            Maghrib: timings.Maghrib,
            Isha: timings.Isha,
          },
          hijri: hijriDate,
          cachedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'manual_refresh',
        });

      return { success: true, date: todayStr };
    } catch (error) {
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== GÉNÉRATION ANNUELLE REÇUS FISCAUX ====================

/**
 * Logique commune pour générer les reçus fiscaux d'une année
 * Utilisée par le cron annuel et le callable admin
 */
const processAnnualRecusFiscaux = async (year) => {
  console.log(`🧾 Début génération reçus fiscaux pour l'année ${year}`);

  // 1. Récupérer les paramètres de l'association
  const settingsDoc = await admin.firestore()
    .collection('settings')
    .doc('recusFiscaux')
    .get();

  if (!settingsDoc.exists) {
    console.error('❌ Paramètres recusFiscaux non configurés');
    return { success: false, error: 'Paramètres non configurés' };
  }

  const association = settingsDoc.data();

  // 2. Récupérer tous les dons de l'année
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const donationsSnapshot = await admin.firestore()
    .collection('donations')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .where('status', '==', 'succeeded')
    .get();

  const paymentsSnapshot = await admin.firestore()
    .collection('payments')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .where('status', '==', 'succeeded')
    .get();

  // 3. Grouper par email donateur
  const donorMap = {}; // { email: { total, donsDetails, donorType, donorInfo } }

  donationsSnapshot.docs.forEach(docSnap => {
    const d = docSnap.data();
    const donorEmail = (d.donorInfo?.email || d.metadata?.donorEmail || '').toLowerCase();
    if (!donorEmail) return;

    if (!donorMap[donorEmail]) {
      donorMap[donorEmail] = {
        total: 0,
        donsDetails: [],
        donorType: d.donorType || 'particulier',
        donorInfo: d.donorInfo || null,
      };
    }
    donorMap[donorEmail].total += d.amount || 0;
    donorMap[donorEmail].donsDetails.push({
      date: d.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A',
      montant: d.amount || 0,
      mode: d.metadata?.paymentMethod || 'Carte bancaire',
      type: 'Don projet',
    });
    // Mettre à jour donorType/donorInfo si plus récent (par timestamp)
    if (d.donorType || d.donorInfo) {
      const ts = d.createdAt?.toDate?.()?.getTime() || 0;
      const currentTs = donorMap[donorEmail]._latestTs || 0;
      if (ts > currentTs) {
        donorMap[donorEmail]._latestTs = ts;
        if (d.donorType) donorMap[donorEmail].donorType = d.donorType;
        if (d.donorInfo) donorMap[donorEmail].donorInfo = d.donorInfo;
      }
    }
  });

  paymentsSnapshot.docs.forEach(docSnap => {
    const p = docSnap.data();
    const isDon = p.type === 'don' || p.eligibleRecuFiscal === true;
    if (!isDon) return;

    const donorEmail = (p.metadata?.email || '').toLowerCase();
    if (!donorEmail) return;

    if (!donorMap[donorEmail]) {
      donorMap[donorEmail] = {
        total: 0,
        donsDetails: [],
        donorType: 'particulier',
        donorInfo: null,
      };
    }
    donorMap[donorEmail].total += p.amount || 0;
    donorMap[donorEmail].donsDetails.push({
      date: p.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A',
      montant: p.amount || 0,
      mode: p.metadata?.paymentMethod || 'Carte bancaire',
      type: 'Don libre',
    });
  });

  const emails = Object.keys(donorMap);
  console.log(`📊 ${emails.length} donateur(s) trouvé(s) pour ${year}`);

  if (emails.length === 0) {
    return { success: true, count: 0, message: 'Aucun donateur trouvé' };
  }

  // 4. Configuration email
  const brevoUser = functions.config().brevo?.smtp_user;
  const brevoPass = functions.config().brevo?.smtp_pass;
  const fromEmail = functions.config().brevo?.from_email;
  const fromName = functions.config().brevo?.from_name || 'Mosquée El Mouhssinine';

  let transporter = null;
  if (brevoUser && brevoPass && fromEmail) {
    transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    });
  }

  // 5. Générer et envoyer pour chaque donateur
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const email of emails) {
    try {
      const donor = donorMap[email];
      if (donor.total <= 0) continue;

      // Construire l'objet donateur
      let donateur;
      if (donor.donorInfo) {
        if (donor.donorType === 'entreprise') {
          donateur = {
            nom: donor.donorInfo.companyName || '',
            prenom: donor.donorInfo.legalRepresentative || '',
            adresse: donor.donorInfo.address || '',
            codePostal: donor.donorInfo.postalCode || '',
            ville: donor.donorInfo.city || '',
            companyName: donor.donorInfo.companyName || '',
            siret: donor.donorInfo.siret || '',
            legalRepresentative: donor.donorInfo.legalRepresentative || '',
          };
        } else {
          donateur = {
            nom: donor.donorInfo.lastName || '',
            prenom: donor.donorInfo.firstName || '',
            adresse: donor.donorInfo.address || '',
            codePostal: donor.donorInfo.postalCode || '',
            ville: donor.donorInfo.city || '',
          };
        }
      } else {
        // Fallback membre
        const memberSnap = await admin.firestore()
          .collection('members')
          .where('email', '==', email)
          .limit(1)
          .get();
        if (!memberSnap.empty) {
          const m = memberSnap.docs[0].data();
          donateur = { nom: m.nom || '', prenom: m.prenom || '', adresse: m.adresse || '', codePostal: m.codePostal || '', ville: m.ville || '' };
        } else {
          donateur = { nom: '', prenom: '', adresse: '', codePostal: '', ville: '' };
        }
      }

      // Numéro de reçu
      const recuCounterRef = admin.firestore().collection('counters').doc('recusFiscaux');
      const newNumber = await admin.firestore().runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(recuCounterRef);
        let currentNumber = 0;
        if (counterDoc.exists) {
          currentNumber = counterDoc.data()[`year_${year}`] || 0;
        }
        const nextNumber = currentNumber + 1;
        transaction.set(recuCounterRef, { [`year_${year}`]: nextNumber }, { merge: true });
        return nextNumber;
      });
      const numeroRecu = `RF-${year}-${String(newNumber).padStart(5, '0')}`;

      // Générer PDF
      const pdfBuffer = await generateRecuFiscalPDF({
        association,
        donateur,
        don: {
          date: `Année ${year}`,
          montant: donor.total,
          mode: 'Divers (voir détails)',
        },
        numeroRecu,
        donorType: donor.donorType,
      });

      // Upload Storage
      const bucket = admin.storage().bucket();
      const typeSuffix = donor.donorType === 'entreprise' ? 'entreprise' : 'particulier';
      const filePath = `recus-fiscaux/${year}/${email.replace(/[^a-z0-9]/gi, '_')}_${typeSuffix}.pdf`;
      await bucket.file(filePath).save(pdfBuffer, {
        metadata: { contentType: 'application/pdf' },
      });

      // Envoyer email
      if (transporter) {
        const donateurLabel = donor.donorType === 'entreprise'
          ? (donateur.companyName || donateur.nom || '')
          : `${donateur.prenom || ''} ${donateur.nom || ''}`.trim();
        const reductionText = donor.donorType === 'entreprise'
          ? '60% (article 238 bis du CGI)'
          : '66% (article 200 du CGI)';

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: email,
          subject: `Reçu fiscal ${year} - ${association.nom || 'Mosquée El Mouhssinine'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Votre reçu fiscal ${year}</h2>
              <p>Bonjour ${donateurLabel},</p>
              <p>Veuillez trouver ci-joint votre reçu fiscal pour l'année ${year}.</p>
              <p><strong>Montant total des dons :</strong> ${donor.total.toFixed(2)} €</p>
              <p><strong>Réduction fiscale :</strong> ${reductionText}</p>
              <p><strong>Numéro du reçu :</strong> ${numeroRecu}</p>
              <br>
              <p>Qu'Allah vous récompense pour votre générosité.</p>
              <p>${association.nom || 'Mosquée El Mouhssinine'}</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
                <p style="color: #888; font-size: 12px;">
                  ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
                  Pour nous contacter : <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
                </p>
              </div>
            </div>
          `,
          attachments: [{ filename: `recu_fiscal_${year}_${numeroRecu}.pdf`, content: pdfBuffer }],
        });
      }

      // Sauvegarder dans Firestore
      await admin.firestore().collection('recus_fiscaux').add({
        numeroRecu,
        annee: year,
        email,
        donateur,
        donorType: donor.donorType,
        montantTotal: donor.total,
        donsDetails: donor.donsDetails,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        source: 'auto_annual',
      });

      // Message in-app
      try {
        // Trouver l'uid du donateur
        const userRecord = await admin.auth().getUserByEmail(email).catch(() => null);
        if (userRecord) {
          await admin.firestore().collection('messages').add({
            odUserId: userRecord.uid,
            userName: donor.donorType === 'entreprise'
              ? (donateur.companyName || donateur.nom || '')
              : `${donateur.prenom || ''} ${donateur.nom || ''}`.trim(),
            userEmail: email,
            sujet: `Reçu fiscal ${year}`,
            message: `Bonjour,\n\nVotre reçu fiscal pour l'année ${year} a été généré et envoyé à ${email}.\n\nMontant : ${donor.total.toFixed(2)} €\nNuméro : ${numeroRecu}\n\nMosquée El Mouhssinine`,
            status: 'resolu',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'mosquee',
            type: 'system',
            reponses: [],
          });
        }
      } catch (msgErr) {
        console.error(`⚠️ Erreur message in-app pour ${email}:`, msgErr.message);
      }

      // Marquer les donations comme ayant un reçu généré
      const donDocs = donationsSnapshot.docs.filter(d => {
        const dEmail = (d.data().donorInfo?.email || d.data().metadata?.donorEmail || '').toLowerCase();
        return dEmail === email;
      });
      for (const donDoc of donDocs) {
        await donDoc.ref.update({
          recuFiscalGenerated: true,
          recuFiscalYear: year,
        });
      }

      // Marquer aussi les payments comme ayant un reçu généré
      const payDocs = paymentsSnapshot.docs.filter(p => {
        const pData = p.data();
        const isDon = pData.type === 'don' || pData.eligibleRecuFiscal === true;
        if (!isDon) return false;
        const pEmail = (pData.metadata?.email || '').toLowerCase();
        return pEmail === email;
      });
      for (const payDoc of payDocs) {
        await payDoc.ref.update({
          recuFiscalGenerated: true,
          recuFiscalYear: year,
        });
      }

      successCount++;
      console.log(`✅ Reçu ${numeroRecu} envoyé à ${email} (${donor.total.toFixed(2)}€, ${donor.donorType})`);

    } catch (err) {
      errorCount++;
      errors.push({ email, error: err.message });
      console.error(`❌ Erreur reçu pour ${email}:`, err.message);
    }
  }

  const result = {
    success: true,
    year,
    totalDonors: emails.length,
    successCount,
    errorCount,
    errors: errors.length > 0 ? errors : undefined,
  };

  console.log(`🧾 Fin génération : ${successCount} succès, ${errorCount} erreur(s)`);
  return result;
};

/**
 * Cloud Function: Génération automatique annuelle des reçus fiscaux
 * Schedule: 2 janvier à 06:00 (Europe/Paris)
 */
exports.generateAnnualRecusFiscaux = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '512MB',
  })
  .region('europe-west1')
  .pubsub.schedule('0 6 2 1 *')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const lastYear = new Date().getFullYear() - 1;
    console.log(`🗓️ Cron annuel reçus fiscaux - Génération pour ${lastYear}`);

    try {
      const result = await processAnnualRecusFiscaux(lastYear);
      console.log('Résultat cron:', JSON.stringify(result));
      return null;
    } catch (error) {
      console.error('❌ Erreur cron reçus fiscaux:', error);
      return null;
    }
  });

/**
 * Cloud Function: Forcer la génération des reçus fiscaux (callable admin)
 */
exports.forceGenerateRecusFiscaux = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '512MB',
  })
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Vérifier authentification
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
    }

    // Vérifier admin
    const adminCheck = await isAdmin(context.auth.uid);
    if (!adminCheck) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux administrateurs');
    }

    const { year } = data;
    if (!year || year < 2020 || year > new Date().getFullYear()) {
      throw new functions.https.HttpsError('invalid-argument', 'Année invalide');
    }

    console.log(`🔧 Génération forcée reçus fiscaux pour ${year} par admin ${context.auth.uid}`);

    try {
      const result = await processAnnualRecusFiscaux(year);
      return result;
    } catch (error) {
      console.error('❌ Erreur génération forcée:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== CONFIRMATION DON PAR EMAIL ====================
// Trigger : quand un nouveau don est créé dans donations/{donationId}
// Envoie un email de confirmation avec récap et info fiscale
// Gère deux templates : particulier (66% art. 200 CGI) et entreprise (60% art. 238 bis)

exports.onDonationConfirmation = functions
  .region('europe-west1')
  .firestore
  .document('donations/{donationId}')
  .onCreate(async (snap, context) => {
    const donation = snap.data();
    const donationId = context.params.donationId;

    // 1. Idempotence
    if (donation.emailConfirmationSent === true) {
      console.log('Email déjà envoyé pour don', donationId);
      return null;
    }

    // 2. Vérifier statut (double nommage app/webhook)
    const isCompleted = donation.statut === 'completed' || donation.status === 'succeeded';
    if (!isCompleted) {
      console.log('Don non complété, skip:', donationId);
      return null;
    }

    // 3. Skip conversions adhésion refusée
    if (donation.origine === 'conversion_adhesion_refusee') {
      console.log('Conversion adhésion refusée, skip email:', donationId);
      return null;
    }

    // 4. Skip dons anonymes
    if (donation.isAnonymous === true || donation.isAnonymous === 'true') {
      console.log('Don anonyme, skip email:', donationId);
      return null;
    }

    // 5. Trouver l'email
    const email = donation.donorInfo?.email || donation.donateurEmail || donation.metadata?.donorEmail || null;
    if (!email) {
      console.log('Pas d\'email pour le don, skip:', donationId);
      return null;
    }

    // 6. Données du don
    const donorType = donation.donorType || 'particulier';
    const montant = donation.amount || donation.montant || 0;
    const projetNom = donation.projetNom || donation.projectName || donation.metadata?.projectName || 'Don général';
    const dateStr = donation.createdAt?.toDate?.()?.toLocaleDateString('fr-FR')
      || donation.date?.toDate?.()?.toLocaleDateString('fr-FR')
      || new Date().toLocaleDateString('fr-FR');
    const reference = donationId;
    const anneSuivante = new Date().getFullYear() + 1;

    // Infos donateur
    const donorFirstName = donation.donorInfo?.firstName || donation.donateur || 'Donateur';
    const donorLastName = donation.donorInfo?.lastName || '';
    const companyName = donation.donorInfo?.companyName || '';
    const siret = donation.donorInfo?.siret || '';
    const legalRep = donation.donorInfo?.legalRepresentative || '';

    console.log(`📧 Email confirmation don ${donorType} pour ${email} (${montant}€)`);

    try {
      // Récupérer infos association
      const settingsDoc = await admin.firestore().collection('settings').doc('recusFiscaux').get();
      const association = settingsDoc.exists ? settingsDoc.data() : {};
      const nomAssociation = association.nom || 'Centre Culturel Islamique de Bourg-en-Bresse';
      const adresseAssociation = association.adresse || '';
      const villeAssociation = association.ville || 'Bourg-en-Bresse';
      const codePostalAssociation = association.codePostal || '';
      const siretAssociation = association.siren || '';

      // Infos mosquée
      const mosqueeDoc = await admin.firestore().collection('settings').doc('mosqueeInfo').get();
      const mosquee = mosqueeDoc.exists ? mosqueeDoc.data() : {};
      const telephoneMosquee = mosquee.telephone || '';

      // Config Brevo
      const brevoUser = functions.config().brevo?.smtp_user;
      const brevoPass = functions.config().brevo?.smtp_pass;
      const fromEmail = functions.config().brevo?.from_email;
      const fromName = functions.config().brevo?.from_name || nomAssociation;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error('Configuration Brevo manquante, email non envoyé');
        return null;
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: brevoUser, pass: brevoPass },
      });

      let subject, htmlContent;

      if (donorType === 'entreprise') {
        // ===== EMAIL CONFIRMATION DON ENTREPRISE =====
        const montantDeductible = (montant * 0.60).toFixed(2);
        subject = `Reçu de don entreprise - El Mouhssinine`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1565c0 0%, #42a5f5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🏢 Reçu de don entreprise</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Salam alaykoum,</p>
              <p style="font-size: 16px;">Nous accusons bonne réception du don de <strong>${montant.toFixed(2)} €</strong> effectué par <strong>${companyName}</strong> au profit de l'association ${nomAssociation}.</p>
              <p style="font-size: 16px;">Qu'Allah vous récompense pour votre générosité.</p>

              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1565c0;">
                <h3 style="color: #1565c0; margin-top: 0;">📋 Récapitulatif du don</h3>
                <table style="width: 100%; color: #444; font-size: 15px;">
                  <tr><td style="padding: 8px 0; font-weight: bold;">Raison sociale</td><td style="padding: 8px 0;">${companyName}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">SIRET</td><td style="padding: 8px 0;">${siret}</td></tr>
                  ${legalRep ? `<tr><td style="padding: 8px 0; font-weight: bold;">Représentant légal</td><td style="padding: 8px 0;">${legalRep}</td></tr>` : ''}
                  <tr><td style="padding: 8px 0; font-weight: bold;">Montant</td><td style="padding: 8px 0;"><strong>${montant.toFixed(2)} €</strong></td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Date</td><td style="padding: 8px 0;">${dateStr}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Projet</td><td style="padding: 8px 0;">${projetNom}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Référence</td><td style="padding: 8px 0; font-size: 12px;">${reference}</td></tr>
                </table>
              </div>

              <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1565c0; margin-top: 0;">📋 Avantage fiscal entreprise</h3>
                <p style="color: #444; line-height: 1.6;">Ce don ouvre droit à une réduction d'impôt de <strong>60%</strong> de son montant, dans la limite de 20 000 € ou 0,5% du chiffre d'affaires HT (article 238 bis du Code Général des Impôts).</p>
                <p style="background: white; padding: 12px; border-radius: 6px; text-align: center; font-size: 18px; color: #1565c0; font-weight: bold;">Montant déductible : ${montantDeductible} €</p>
                <p style="color: #666; font-size: 13px; margin-bottom: 0;">Un reçu fiscal (CERFA) vous sera automatiquement adressé en <strong>janvier ${anneSuivante}</strong>.</p>
              </div>

              <p style="font-size: 16px; color: #444;">Cordialement,<br><strong>Le Bureau de ${nomAssociation}</strong></p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              <div style="font-size: 13px; color: #888; text-align: center;">
                <p style="margin: 5px 0;"><strong>${nomAssociation}</strong></p>
                <p style="margin: 5px 0;">Association loi 1901</p>
                ${adresseAssociation ? `<p style="margin: 5px 0;">📍 ${adresseAssociation}, ${codePostalAssociation} ${villeAssociation}</p>` : ''}
                ${siretAssociation ? `<p style="margin: 5px 0;">SIRET : ${siretAssociation}</p>` : ''}
                ${telephoneMosquee ? `<p style="margin: 5px 0;">📞 ${telephoneMosquee}</p>` : ''}
              </div>
              <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center;">
                <p style="color: #888; font-size: 12px; margin: 0;">
                  ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
                  Pour nous contacter : <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
                </p>
              </div>
            </div>
          </div>
        `;
      } else {
        // ===== EMAIL CONFIRMATION DON PARTICULIER =====
        const montantDeductible = (montant * 0.66).toFixed(2);
        subject = `Reçu de don - El Mouhssinine`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🤲 Reçu de don</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Salam alaykoum <strong>${donorFirstName}</strong>,</p>
              <p style="font-size: 16px;">Nous vous remercions chaleureusement pour votre généreux don de <strong>${montant.toFixed(2)} €</strong> à l'association ${nomAssociation}.</p>
              <p style="font-size: 16px;">Qu'Allah accepte votre don et vous en récompense.</p>

              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2e7d32;">
                <h3 style="color: #2e7d32; margin-top: 0;">📋 Récapitulatif de votre don</h3>
                <table style="width: 100%; color: #444; font-size: 15px;">
                  <tr><td style="padding: 8px 0; font-weight: bold;">Montant</td><td style="padding: 8px 0;"><strong>${montant.toFixed(2)} €</strong></td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Date</td><td style="padding: 8px 0;">${dateStr}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Projet</td><td style="padding: 8px 0;">${projetNom}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Référence</td><td style="padding: 8px 0; font-size: 12px;">${reference}</td></tr>
                </table>
              </div>

              <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2e7d32; margin-top: 0;">📋 Avantage fiscal</h3>
                <p style="color: #444; line-height: 1.6;">En tant que particulier, votre don ouvre droit à une réduction d'impôt de <strong>66%</strong> de son montant, dans la limite de 20% de votre revenu imposable (article 200 du Code Général des Impôts).</p>
                <p style="background: white; padding: 12px; border-radius: 6px; text-align: center; font-size: 18px; color: #2e7d32; font-weight: bold;">Montant déductible : ${montantDeductible} €</p>
                <p style="color: #666; font-size: 13px; margin-bottom: 0;">Un reçu fiscal (CERFA n°11580*05) vous sera automatiquement adressé en <strong>janvier ${anneSuivante}</strong>, vous permettant de déclarer votre don lors de votre déclaration de revenus.</p>
              </div>

              <p style="font-size: 16px; color: #444;">Barakallahou fikoum,<br><strong>Le Bureau de ${nomAssociation}</strong></p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              <div style="font-size: 13px; color: #888; text-align: center;">
                <p style="margin: 5px 0;"><strong>${nomAssociation}</strong></p>
                <p style="margin: 5px 0;">Association loi 1901</p>
                ${adresseAssociation ? `<p style="margin: 5px 0;">📍 ${adresseAssociation}, ${codePostalAssociation} ${villeAssociation}</p>` : ''}
                ${siretAssociation ? `<p style="margin: 5px 0;">SIRET : ${siretAssociation}</p>` : ''}
                ${telephoneMosquee ? `<p style="margin: 5px 0;">📞 ${telephoneMosquee}</p>` : ''}
              </div>
              <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center;">
                <p style="color: #888; font-size: 12px; margin: 0;">
                  ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
                  Pour nous contacter : <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
                </p>
              </div>
            </div>
          </div>
        `;
      }

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: subject,
        html: htmlContent,
      });

      console.log(`✅ Email confirmation don ${donorType} envoyé à ${email}`);

      // Marquer comme envoyé
      await snap.ref.update({
        emailConfirmationSent: true,
        emailConfirmationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, email };

    } catch (error) {
      console.error('❌ Erreur envoi email confirmation don:', error);
      return { error: error.message };
    }
  });

// ==================== CONFIRMATION ADHÉSION PAR EMAIL ====================
// Trigger : quand un nouveau paiement de cotisation est créé dans payments/{paymentId}
// Envoie un email de bienvenue membre actif avec récap adhésion et avantages

exports.onCotisationConfirmation = functions
  .region('europe-west1')
  .firestore
  .document('payments/{paymentId}')
  .onCreate(async (snap, context) => {
    const payment = snap.data();
    const paymentId = context.params.paymentId;

    // 1. Idempotence
    if (payment.emailConfirmationSent === true) {
      console.log('Email déjà envoyé pour paiement', paymentId);
      return null;
    }

    // 2. Seulement les cotisations
    if (payment.type !== 'cotisation') {
      return null;
    }

    // 3. Vérifier statut
    const isCompleted = payment.statut === 'completed' || payment.status === 'succeeded';
    if (!isCompleted) {
      console.log('Paiement non complété, skip:', paymentId);
      return null;
    }

    console.log(`📧 Email confirmation cotisation pour paiement ${paymentId}`);

    try {
      // 4. Trouver le membre
      let memberData = null;
      let email = payment.metadata?.email || null;
      let prenom = payment.memberName || payment.metadata?.memberName || 'Membre';

      // Essai 1 : UID depuis metadata (webhook)
      const memberUid = payment.metadata?.memberId || null;
      if (memberUid) {
        const memberRef = await admin.firestore().collection('members').doc(memberUid).get();
        if (memberRef.exists) {
          memberData = memberRef.data();
        }
      }

      // Essai 2 : memberId format ELM-XXXX (app)
      if (!memberData && payment.memberId) {
        const memberQuery = await admin.firestore().collection('members')
          .where('memberId', '==', payment.memberId).limit(1).get();
        if (!memberQuery.empty) {
          memberData = memberQuery.docs[0].data();
        }
      }

      // Extraire données du membre
      if (memberData) {
        email = email || memberData.email;
        prenom = memberData.prenom || prenom;
      }

      if (!email) {
        console.log('Pas d\'email pour la cotisation, skip:', paymentId);
        return null;
      }

      // 5. Données du paiement
      const montant = payment.amount || payment.montant || 0;
      const period = payment.period || payment.metadata?.period || 'annuel';
      const periodLabel = period === 'mensuel' ? 'Mensuelle' : 'Annuelle';
      const dateDebut = memberData?.cotisation?.dateDebut?.toDate?.() || new Date();
      const dateDebutStr = dateDebut.toLocaleDateString('fr-FR');

      // Calculer prochaine échéance
      const prochaineEcheance = new Date(dateDebut);
      if (period === 'mensuel') {
        prochaineEcheance.setMonth(prochaineEcheance.getMonth() + 1);
      } else {
        prochaineEcheance.setFullYear(prochaineEcheance.getFullYear() + 1);
      }
      const prochaineEcheanceStr = prochaineEcheance.toLocaleDateString('fr-FR');

      const anneSuivante = new Date().getFullYear() + 1;

      // 6. Infos association + mosquée
      const settingsDoc = await admin.firestore().collection('settings').doc('recusFiscaux').get();
      const association = settingsDoc.exists ? settingsDoc.data() : {};
      const nomAssociation = association.nom || 'Centre Culturel Islamique de Bourg-en-Bresse';
      const adresseAssociation = association.adresse || '';
      const villeAssociation = association.ville || 'Bourg-en-Bresse';
      const codePostalAssociation = association.codePostal || '';

      const mosqueeDoc = await admin.firestore().collection('settings').doc('mosqueeInfo').get();
      const mosquee = mosqueeDoc.exists ? mosqueeDoc.data() : {};
      const telephoneMosquee = mosquee.telephone || '';

      // 7. Config Brevo
      const brevoUser = functions.config().brevo?.smtp_user;
      const brevoPass = functions.config().brevo?.smtp_pass;
      const fromEmail = functions.config().brevo?.from_email;
      const fromName = functions.config().brevo?.from_name || nomAssociation;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error('Configuration Brevo manquante, email non envoyé');
        return null;
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: brevoUser, pass: brevoPass },
      });

      // 8. Email HTML
      const subject = `Bienvenue parmi les membres actifs - El Mouhssinine`;
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🎉 Bienvenue parmi les membres actifs</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Salam alaykoum <strong>${prenom}</strong>,</p>
            <p style="font-size: 16px;">Merci pour votre adhésion au ${nomAssociation} !</p>
            <p style="font-size: 16px;">Vous êtes désormais <strong>membre actif</strong> de notre association.</p>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2e7d32;">
              <h3 style="color: #2e7d32; margin-top: 0;">✨ Vos avantages en tant que membre actif</h3>
              <ul style="color: #444; line-height: 1.8; font-size: 15px;">
                <li>✨ Vous soutenez activement votre mosquée et gagnez des hassanates</li>
                <li>🗳️ Droit de vote aux assemblées générales et élections</li>
                <li>🎫 Accès à votre carte de membre numérique</li>
                <li>📧 Reçu fiscal automatique pour réduction d'impôts</li>
              </ul>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C9A227;">
              <h3 style="color: #C9A227; margin-top: 0;">📋 Récapitulatif de votre adhésion</h3>
              <table style="width: 100%; color: #444; font-size: 15px;">
                <tr><td style="padding: 8px 0; font-weight: bold;">Type</td><td style="padding: 8px 0;">${periodLabel} (${montant.toFixed(2)} €)</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Date de début</td><td style="padding: 8px 0;">${dateDebutStr}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Prochaine échéance</td><td style="padding: 8px 0;">${prochaineEcheanceStr}</td></tr>
              </table>
            </div>

            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2e7d32; margin-top: 0;">🎫 Votre carte de membre</h3>
              <p style="color: #444; line-height: 1.6;">Votre carte de membre est disponible dans l'application :<br><strong>Onglet Adhérent → Voir ma carte de membre</strong></p>
              <p style="color: #666; font-size: 13px; margin-bottom: 0;">Vous recevrez votre reçu fiscal (CERFA) en début d'année <strong>${anneSuivante}</strong>.</p>
            </div>

            <p style="font-size: 16px; color: #444;">Qu'Allah vous récompense pour votre soutien.</p>
            <p style="font-size: 16px; color: #444;">Barakallahou fikoum,<br><strong>Le Bureau de ${nomAssociation}</strong></p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <div style="font-size: 13px; color: #888; text-align: center;">
              <p style="margin: 5px 0;"><strong>${nomAssociation}</strong></p>
              ${adresseAssociation ? `<p style="margin: 5px 0;">📍 ${adresseAssociation}, ${codePostalAssociation} ${villeAssociation}</p>` : ''}
              ${telephoneMosquee ? `<p style="margin: 5px 0;">📞 ${telephoneMosquee}</p>` : ''}
            </div>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
                Pour nous contacter : <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
              </p>
            </div>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: subject,
        html: htmlContent,
      });

      console.log(`✅ Email confirmation cotisation envoyé à ${email}`);

      // Marquer comme envoyé
      await snap.ref.update({
        emailConfirmationSent: true,
        emailConfirmationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, email };

    } catch (error) {
      console.error('❌ Erreur envoi email confirmation cotisation:', error);
      return { error: error.message };
    }
  });

