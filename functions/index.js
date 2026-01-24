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
const stripe = new Stripe(functions.config().stripe?.secret_key || 'sk_test_placeholder', {
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
        // Récupérer tous les admins avec leur token FCM
        const adminsSnapshot = await admin.firestore().collection('admins').get();
        const adminTokens = [];

        for (const adminDoc of adminsSnapshot.docs) {
          const adminId = adminDoc.id;
          const memberDoc = await admin.firestore().collection('members').doc(adminId).get();
          if (memberDoc.exists && memberDoc.data().fcmToken) {
            adminTokens.push(memberDoc.data().fcmToken);
          }
        }

        if (adminTokens.length === 0) {
          console.log('Aucun admin avec token FCM');
          return null;
        }

        const userName = after.nom || 'Un utilisateur';
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
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe?.webhook_secret;

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

        // IDEMPOTENCE: Vérifier si ce paiement a déjà été traité
        try {
          const existingPayment = await admin.firestore()
            .collection('processed_payments')
            .doc(paymentIntentId)
            .get();

          if (existingPayment.exists) {
            console.log('Paiement déjà traité (idempotence):', paymentIntentId);
            return res.json({ received: true, alreadyProcessed: true });
          }

          const metadata = paymentIntent.metadata || {};
          const amountEuros = paymentIntent.amount / 100;

          // ATOMICITÉ: Utiliser une transaction Firestore
          await admin.firestore().runTransaction(async (transaction) => {
            // 1. Marquer comme traité (pour idempotence)
            const processedRef = admin.firestore().collection('processed_payments').doc(paymentIntentId);
            transaction.set(processedRef, {
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              type: metadata.type || 'donation',
              amount: amountEuros,
            });

            // 2. Enregistrer le paiement selon le type
            if (metadata.type === 'cotisation') {
              // Créer le document payment
              const paymentRef = admin.firestore().collection('payments').doc();
              transaction.set(paymentRef, {
                stripePaymentIntentId: paymentIntentId,
                amount: amountEuros,
                currency: paymentIntent.currency,
                status: 'succeeded',
                type: 'cotisation',
                description: paymentIntent.description,
                metadata: metadata,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              // Mettre à jour le membre si memberId fourni
              if (metadata.memberId) {
                const memberRef = admin.firestore().collection('members').doc(metadata.memberId);
                transaction.update(memberRef, {
                  statut: 'actif',
                  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
                  montantPaye: amountEuros,
                  stripePaymentId: paymentIntentId,
                });
              }
            } else {
              // Don - Créer le document donation
              const donationRef = admin.firestore().collection('donations').doc();
              transaction.set(donationRef, {
                stripePaymentIntentId: paymentIntentId,
                amount: amountEuros,
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
                transaction.update(projectRef, {
                  montantCollecte: admin.firestore.FieldValue.increment(amountEuros),
                });
              }
            }
          });

          console.log('Paiement enregistré dans Firestore (transaction atomique)');
        } catch (dbError) {
          console.error('Erreur enregistrement Firestore:', dbError);
          // Retourner 500 pour que Stripe réessaie
          return res.status(500).send(`Database Error: ${dbError.message}`);
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
 * Génère le PDF du reçu fiscal
 */
const generateRecuFiscalPDF = async (data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { association, donateur, don, numeroRecu } = data;

    // En-tête
    doc.fontSize(18).font('Helvetica-Bold').text('REÇU AU TITRE DES DONS', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Article 200 du Code Général des Impôts', { align: 'center' });
    doc.moveDown(2);

    // Numéro et date
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Reçu n° : ${numeroRecu}`, { align: 'right' });
    doc.font('Helvetica').text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(2);

    // Cadre Association
    doc.rect(50, doc.y, 500, 100).stroke();
    const boxY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('ORGANISME BÉNÉFICIAIRE', 60, boxY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Nom : ${association.nom || '[À compléter]'}`, 60);
    doc.text(`Adresse : ${association.adresse || '[À compléter]'}`, 60);
    doc.text(`${association.codePostal || ''} ${association.ville || ''}`, 60);
    doc.text(`N° SIREN/RNA : ${association.siren || '[À compléter]'}`, 60);
    doc.text(`Statut : ${association.statut || 'Association cultuelle loi 1905'}`, 60);
    doc.y = boxY + 110;

    // Cadre Donateur
    doc.rect(50, doc.y, 500, 80).stroke();
    const donY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('DONATEUR', 60, donY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Nom : ${donateur.nom} ${donateur.prenom}`, 60);
    doc.text(`Adresse : ${donateur.adresse || 'Non renseignée'}`, 60);
    doc.text(`${donateur.codePostal || ''} ${donateur.ville || ''}`, 60);
    doc.y = donY + 90;

    // Cadre Don
    doc.moveDown(1);
    doc.rect(50, doc.y, 500, 120).stroke();
    const giftY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').text('NATURE DU DON', 60, giftY);
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Date du versement : ${don.date}`, 60);
    doc.text(`Mode de versement : ${don.mode}`, 60);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold');
    doc.text(`Montant : ${don.montant.toFixed(2)} €`, 60);
    doc.font('Helvetica');
    doc.text(`Soit en toutes lettres : ${amountToWords(don.montant)}`, 60);
    doc.moveDown(0.5);
    doc.text(`Forme du don : Versement (numéraire)`, 60);
    doc.y = giftY + 130;

    // Mentions légales
    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica');
    doc.text(
      'Le bénéficiaire certifie sur l\'honneur que les dons et versements qu\'il reçoit ouvrent droit à la réduction d\'impôt prévue à l\'article 200 du CGI.',
      50,
      doc.y,
      { width: 500, align: 'justify' }
    );
    doc.moveDown(1);
    doc.text(
      'Ce don ouvre droit à une réduction d\'impôt sur le revenu égale à 66% du montant versé, dans la limite de 20% du revenu imposable.',
      50,
      doc.y,
      { width: 500, align: 'justify' }
    );

    // Signature
    doc.moveDown(2);
    doc.fontSize(10);
    doc.text(`Fait à ${association.ville || '[Ville]'}, le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(1);
    doc.text(`${association.signataire || 'Le Président'}`, { align: 'right' });
    doc.text(`${association.nomSignataire || '[Nom du signataire]'}`, { align: 'right' });

    // Pied de page
    doc.fontSize(8).text(
      'Document à conserver et à joindre à votre déclaration de revenus',
      50,
      750,
      { align: 'center', width: 500 }
    );

    doc.end();
  });
};

/**
 * Cloud Function: Générer et envoyer un reçu fiscal par email
 */
exports.sendRecuFiscal = functions
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

      // 2. Récupérer les dons de l'utilisateur pour l'année
      const startDate = new Date(annee, 0, 1);
      const endDate = new Date(annee, 11, 31, 23, 59, 59);

      const donationsSnapshot = await admin.firestore()
        .collection('donations')
        .where('metadata.donorEmail', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', '==', 'succeeded')
        .get();

      // Aussi chercher les cotisations
      const paymentsSnapshot = await admin.firestore()
        .collection('payments')
        .where('metadata.email', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', '==', 'succeeded')
        .get();

      // Combiner et calculer le total
      let totalDons = 0;
      const donsDetails = [];

      donationsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        totalDons += d.amount || 0;
        donsDetails.push({
          date: d.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A',
          montant: d.amount || 0,
          mode: d.metadata?.paymentMethod || 'Carte bancaire',
        });
      });

      paymentsSnapshot.docs.forEach(doc => {
        const p = doc.data();
        totalDons += p.amount || 0;
        donsDetails.push({
          date: p.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A',
          montant: p.amount || 0,
          mode: p.metadata?.paymentMethod || 'Carte bancaire',
        });
      });

      if (totalDons === 0) {
        throw new functions.https.HttpsError(
          'not-found',
          `Aucun don trouvé pour l'année ${annee}`
        );
      }

      // 3. Récupérer les infos du donateur
      const memberSnapshot = await admin.firestore()
        .collection('members')
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();

      let donateur = {
        nom: '',
        prenom: '',
        adresse: '',
        codePostal: '',
        ville: '',
      };

      if (!memberSnapshot.empty) {
        const member = memberSnapshot.docs[0].data();
        donateur = {
          nom: member.nom || '',
          prenom: member.prenom || '',
          adresse: member.adresse || '',
          codePostal: member.codePostal || '',
          ville: member.ville || '',
        };
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

      // 5. Générer le PDF
      const pdfBuffer = await generateRecuFiscalPDF({
        association,
        donateur,
        don: {
          date: `Année ${annee}`,
          montant: totalDons,
          mode: 'Divers (voir détails)',
        },
        numeroRecu,
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

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: `Reçu fiscal ${annee} - ${association.nom || 'Mosquée El Mouhssinine'}`,
        html: `
          <h2>Votre reçu fiscal ${annee}</h2>
          <p>Bonjour ${donateur.prenom || ''} ${donateur.nom || ''},</p>
          <p>Veuillez trouver ci-joint votre reçu fiscal pour l'année ${annee}.</p>
          <p><strong>Montant total des dons :</strong> ${totalDons.toFixed(2)} €</p>
          <p><strong>Numéro du reçu :</strong> ${numeroRecu}</p>
          <br>
          <p>Ce document est à joindre à votre déclaration de revenus.</p>
          <p>Il vous permet de bénéficier d'une réduction d'impôt de 66% du montant de vos dons.</p>
          <br>
          <p>Qu'Allah vous récompense pour votre générosité.</p>
          <p>${association.nom || 'Mosquée El Mouhssinine'}</p>
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

      // Dons
      const donationsSnapshot = await admin.firestore()
        .collection('donations')
        .where('metadata.donorEmail', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', '==', 'succeeded')
        .get();

      // Cotisations
      const paymentsSnapshot = await admin.firestore()
        .collection('payments')
        .where('metadata.email', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', '==', 'succeeded')
        .get();

      let total = 0;
      const dons = [];

      donationsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        total += d.amount || 0;
        dons.push({
          id: doc.id,
          type: 'don',
          montant: d.amount || 0,
          date: d.createdAt?.toDate?.()?.toISOString() || null,
          projet: d.projectName || null,
        });
      });

      paymentsSnapshot.docs.forEach(doc => {
        const p = doc.data();
        total += p.amount || 0;
        dons.push({
          id: doc.id,
          type: 'cotisation',
          montant: p.amount || 0,
          date: p.createdAt?.toDate?.()?.toISOString() || null,
        });
      });

      return { total, dons, annee };

    } catch (error) {
      console.error('Erreur getDonsByYear:', error);
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

