/**
 * Cloud Functions pour El Mouhssinine
 * Gestion des notifications push via Firebase Cloud Messaging
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ==================== HELPERS ====================

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
  });

// ==================== NOTIFICATION ÉVÉNEMENT ====================
// Trigger : quand un nouvel événement est créé

exports.onNewEvent = functions
  .region('europe-west1')
  .firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
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
  });

// ==================== NOTIFICATION JANAZA ====================
// Trigger : quand une nouvelle Salat Janaza est créée (URGENT)

exports.onNewJanaza = functions
  .region('europe-west1')
  .firestore
  .document('janaza/{janazaId}')
  .onCreate(async (snap, context) => {
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
  });

// ==================== NOTIFICATION POPUP ====================
// Trigger : quand un nouveau popup est créé et actif

exports.onNewPopup = functions
  .region('europe-west1')
  .firestore
  .document('popups/{popupId}')
  .onCreate(async (snap, context) => {
    const popup = snap.data();

    if (!popup.actif) {
      console.log('Popup inactif, pas de notification');
      return null;
    }

    // Vérifier les dates de validité
    const today = new Date().toISOString().split('T')[0];
    if (popup.dateDebut && popup.dateDebut > today) {
      console.log('Popup pas encore actif');
      return null;
    }
    if (popup.dateFin && popup.dateFin < today) {
      console.log('Popup expiré');
      return null;
    }

    const message = {
      notification: {
        title: popup.titre || 'Information importante',
        body: truncate(popup.contenu || popup.message, 150),
      },
      data: {
        type: 'popup',
        id: context.params.popupId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      topic: 'general',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification popup envoyée:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Erreur notification popup:', error);
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
      console.log('Impossible de récupérer l\'heure Jumu\'a, utilisation par défaut');
    }

    const message = {
      notification: {
        title: "Jumu'a aujourd'hui",
        body: `N'oubliez pas la prière du vendredi à ${jumuaTime}. Arrivez en avance !`,
      },
      data: {
        type: 'jumua_reminder',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      topic: 'jumua',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Rappel Jumu\'a envoyé:', response);
      return null;
    } catch (error) {
      console.error('Erreur rappel Jumu\'a:', error);
      return null;
    }
  });

// ==================== RAPPEL QUOTIDIEN FAJR ====================
// Tous les jours à 5h30 (avant Fajr généralement)

exports.scheduledFajrReminder = functions
  .region('europe-west1')
  .pubsub
  .schedule('30 5 * * *') // 5h30 chaque jour
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const message = {
      notification: {
        title: 'Salat Fajr',
        body: 'La prière de Fajr approche. Bon réveil !',
      },
      data: {
        type: 'fajr_reminder',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      topic: 'fajr_reminders',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Rappel Fajr envoyé:', response);
      return null;
    } catch (error) {
      console.error('Erreur rappel Fajr:', error);
      return null;
    }
  });

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
