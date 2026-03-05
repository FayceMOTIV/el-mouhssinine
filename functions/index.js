/**
 * Cloud Functions pour El Mohsinine
 * Gestion des notifications push via Firebase Cloud Messaging
 * Paiements Stripe
 */

const functions = require('firebase-functions');
const { defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const https = require('https');

admin.initializeApp();

// ==================== PARAMÈTRES (migration functions.config → defineString) ====================
const STRIPE_SECRET_KEY = defineString('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineString('STRIPE_WEBHOOK_SECRET');
const BREVO_SMTP_USER = defineString('BREVO_SMTP_USER');
const BREVO_SMTP_PASS = defineString('BREVO_SMTP_PASS');
const BREVO_FROM_EMAIL = defineString('BREVO_FROM_EMAIL');
const BREVO_FROM_NAME = defineString('BREVO_FROM_NAME', { default: 'Mosquée El Mohsinine' });

// Initialiser Stripe de manière lazy (évite le warning "value() invoked during deployment")
let _stripe;
const getStripe = () => {
  if (!_stripe) {
    _stripe = new Stripe(STRIPE_SECRET_KEY.value() || 'sk_test_not_configured', {
      apiVersion: '2023-10-16',
    });
  }
  return _stripe;
};
// Proxy: accès à stripe.* délègue à getStripe().* — aucun changement dans le code métier
const stripe = new Proxy({}, {
  get: (_, prop) => {
    const instance = getStripe();
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  }
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

// ==================== EMAIL TEMPLATE HELPERS ====================

/**
 * Charge un template email depuis Firestore et remplace les variables
 * @param {string} templateId - ID du document dans email_templates
 * @param {Object} variables - Objet clé:valeur des variables à remplacer
 * @returns {Promise<{subject: string, body: string}|null>}
 */
// Échapper les caractères HTML pour éviter les injections XSS dans les emails
const escapeHtml = (text) => {
  if (!text || typeof text !== 'string') return text || '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
};

const loadEmailTemplate = async (templateId, variables = {}) => {
  try {
    const doc = await admin.firestore().collection('email_templates').doc(templateId).get();
    if (!doc.exists) {
      console.log(`Template email ${templateId} non trouvé dans Firestore, fallback hardcodé`);
      return null;
    }
    const data = doc.data();
    let subject = data.subject || '';
    let body = data.body || '';

    // Remplacer les variables {nom_variable} avec échappement HTML
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      const escaped = escapeHtml(value || '');
      subject = subject.replace(regex, escaped);
      body = body.replace(regex, escaped);
    }

    return { subject, body };
  } catch (error) {
    console.error(`Erreur chargement template ${templateId}:`, error);
    return null;
  }
};

/**
 * Convertit un texte brut en HTML email stylisé
 * @param {string} body - Texte brut du corps de l'email
 * @param {Object} options - Options de style
 * @param {string} options.headerTitle - Titre du header
 * @param {string} options.headerGradient - Gradient CSS du header (ex: '#2e7d32, #4caf50')
 * @param {string} options.footerAssociation - Nom de l'association pour le footer
 * @param {string} options.footerAdresse - Adresse pour le footer
 * @param {string} options.footerTelephone - Téléphone pour le footer
 * @returns {string} HTML email complet
 */
const textToEmailHtml = (body, options = {}) => {
  const {
    headerTitle = '',
    headerGradient = '#2e7d32, #4caf50',
    footerAssociation = '',
    footerAdresse = '',
    footerTelephone = '',
  } = options;

  // Convertir le texte brut en HTML avec paragraphes
  const htmlBody = body
    .split('\n\n')
    .map(paragraph => {
      // Gérer les listes à puces
      const lines = paragraph.split('\n');
      const listItems = lines.filter(l => l.startsWith('- '));
      const numberedItems = lines.filter(l => /^\d+\.\s/.test(l));

      // Bug 16 Fix: escapeHtml sur le contenu des listes et paragraphes (prévention injection HTML)
      if (listItems.length > 0 && listItems.length === lines.length) {
        return `<ul style="color: #444; line-height: 1.8; margin: 10px 0;">${listItems.map(l => `<li>${escapeHtml(l.substring(2))}</li>`).join('')}</ul>`;
      }
      if (numberedItems.length > 0 && numberedItems.length === lines.length) {
        return `<ol style="color: #444; line-height: 1.8; margin: 10px 0;">${numberedItems.map(l => `<li>${escapeHtml(l.replace(/^\d+\.\s/, ''))}</li>`).join('')}</ol>`;
      }

      // Paragraphe normal (avec retours à la ligne simples préservés)
      const text = escapeHtml(paragraph).replace(/\n/g, '<br>');
      return `<p style="font-size: 16px; color: #444; margin: 10px 0;">${text}</p>`;
    })
    .join('');

  // Mettre en gras les textes entre **...**
  const htmlBodyBold = htmlBody.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  let headerHtml = '';
  if (headerTitle) {
    headerHtml = `
      <div style="background: linear-gradient(135deg, ${headerGradient}); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${headerTitle}</h1>
      </div>`;
  }

  let footerHtml = '';
  if (footerAssociation) {
    footerHtml = `
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <div style="font-size: 13px; color: #888; text-align: center;">
        <p style="margin: 5px 0;"><strong>${footerAssociation}</strong></p>
        ${footerAdresse ? `<p style="margin: 5px 0;">📍 ${footerAdresse}</p>` : ''}
        ${footerTelephone ? `<p style="margin: 5px 0;">📞 ${footerTelephone}</p>` : ''}
      </div>`;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${headerHtml}
      <div style="background: #f9f9f9; padding: 30px; border-radius: ${headerTitle ? '0 0 10px 10px' : '10px'};">
        ${htmlBodyBold}
        ${footerHtml}
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center;">
          <p style="color: #888; font-size: 12px; margin: 0;">
            ⚠️ <strong>Cette adresse email n'est pas relevée.</strong><br>
            Pour nous contacter : <a href="mailto:centreculturelislamique@orange.fr" style="color: #C9A227;">centreculturelislamique@orange.fr</a>
          </p>
        </div>
      </div>
    </div>`;
};

// ==================== NOTIFICATION ANNONCE ====================
// Trigger : quand une nouvelle annonce est créée

// NOTE: Pas d'envoi push auto ici — l'admin envoie manuellement via le bouton backoffice
// (évite les notifications en double : onCreate auto + bouton manuel)
exports.onNewAnnouncement = functions
  .region('europe-west1')
  .firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snap, context) => {
    const announcement = snap.data();
    console.log('Nouvelle annonce créée:', context.params.announcementId, '- actif:', announcement.actif);
    return null;
  });

// ==================== NOTIFICATION ÉVÉNEMENT ====================
// Trigger : quand un nouvel événement est créé

// NOTE: Pas d'envoi push auto — l'admin envoie via le bouton backoffice
exports.onNewEvent = functions
  .region('europe-west1')
  .firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    console.log('Nouvel événement créé:', context.params.eventId, '- actif:', event.actif);
    return null;
  });

// ==================== NOTIFICATION JANAZA ====================
// Trigger : quand une nouvelle Salat Janaza est créée (URGENT)

// NOTE: Pas d'envoi push auto — l'admin envoie via le bouton backoffice
exports.onNewJanaza = functions
  .region('europe-west1')
  .firestore
  .document('janaza/{janazaId}')
  .onCreate(async (snap, context) => {
    const janaza = snap.data();
    console.log('Nouvelle janaza créée:', context.params.janazaId, '- actif:', janaza.actif);
    return null;
  });

// ==================== NOTIFICATION POPUP ====================
// Envoie une notification push quand une popup active est créée
// La popup s'affiche aussi dans l'app à l'ouverture

exports.onNewPopup = functions
  .region('europe-west1')
  .firestore
  .document('popups/{popupId}')
  .onCreate(async (snap, context) => {
    const popup = snap.data();

    if (!popup.actif) {
      console.log('Popup inactive, pas de notification');
      return null;
    }

    if (popup.notificationSent) {
      console.log('Notification déjà envoyée pour cette popup');
      return null;
    }

    const message = {
      notification: {
        title: '🕌 ' + (popup.titre || 'Nouveau message'),
        body: truncate(popup.contenu || popup.message, 150),
      },
      data: {
        type: 'popup',
        id: context.params.popupId,
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
          channelId: 'general',
        },
      },
      topic: 'general',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification popup envoyée:', response);

      await snap.ref.update({
        notificationSent: true,
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await admin.firestore().collection('notifications_history').add({
        titre: message.notification.title,
        message: message.notification.body,
        topic: 'general',
        type: 'auto_popup',
        envoyeePar: 'system',
        envoyeeA: new Date(),
        messageId: response,
      });

      return { success: true, messageId: response };
    } catch (error) {
      console.error('Erreur notification popup:', error);
      return { error: error.message };
    }
  });

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
      // B5.1 Fix: Jumu'a est gérée par les notifications locales (Notifee) côté app.
      // Supprimer le mapping FCM pour éviter les doublons.
      // 'prayer_reminders': 'jumua',
      'membres': 'members', // Topic specifique aux adherents
      'non_membres': 'non_members', // Topic pour les non-adherents
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
// DESACTIVE: La notification Jumu'a est maintenant geree uniquement par
// prayerNotifications.ts cote client pour eviter la triple notification
// (notifications.ts local + prayerNotifications.ts + Cloud Function)
//
// exports.scheduledJumuaReminder = functions
//   .region('europe-west1')
//   .pubsub
//   .schedule('30 11 * * 5')
//   .timeZone('Europe/Paris')
//   .onRun(async (context) => { ... });

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

      // Bug 12 Fix: Supprimer par chunks de 500 (limite Firestore batch)
      const docs = snapshot.docs;
      const chunkSize = 500;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        const batch = admin.firestore().batch();
        chunk.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
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

// ==================== NOTIFICATION NOUVEAU MESSAGE ====================
// Trigger : quand un utilisateur envoie un nouveau message à la mosquée

exports.onNewMessage = functions
  .region('europe-west1')
  .firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const messageId = context.params.messageId;

    // Skip messages système (créés par Cloud Functions, ex: bienvenue)
    if (data.createdBy === 'mosquee' || data.type === 'system') {
      console.log('Message système, skip notification:', messageId);
      return null;
    }

    const userName = sanitizeString(data.userName, 50) || 'Un utilisateur';
    const userEmail = data.userEmail || '';
    const sujet = sanitizeString(data.sujet, 100) || 'Sans sujet';
    const messageText = sanitizeString(data.message, 300) || '';

    console.log('📩 Nouveau message de', userName, '- sujet:', sujet);

    // === 1. Push notification aux admins ===
    try {
      const adminsSnapshot = await admin.firestore().collection('admins').get();

      if (!adminsSnapshot.empty) {
        const adminIds = adminsSnapshot.docs.map(doc => doc.id);
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

        if (adminTokens.length > 0) {
          const pushMessage = {
            notification: {
              title: '📩 Nouveau message',
              body: `${userName} : ${sujet}`,
            },
            data: {
              type: 'new_message',
              messageId: messageId,
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
            apns: {
              headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
              payload: { aps: { sound: 'default', badge: 1 } },
            },
            android: {
              priority: 'high',
              notification: { sound: 'default', channelId: 'messages' },
            },
          };

          const responses = await admin.messaging().sendEachForMulticast({
            tokens: adminTokens,
            ...pushMessage,
          });

          console.log('🔔 Push admins:', responses.successCount, '/', adminTokens.length);
        }
      }
    } catch (pushError) {
      console.error('⚠️ Erreur push nouveau message:', pushError.message);
    }

    // === 2. Email aux admins ===
    try {
      const brevoUser = BREVO_SMTP_USER.value();
      const brevoPass = BREVO_SMTP_PASS.value();
      const fromEmail = BREVO_FROM_EMAIL.value();
      const fromName = BREVO_FROM_NAME.value();
      const adminEmail = fromEmail || 'centreculturelislamique@orange.fr';

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error(`[EMAIL ERROR] Config Brevo manquante. Email non envoyé à ${userEmail || 'inconnu'}`);
        return null;
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: brevoUser, pass: brevoPass },
      });

      const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #1565c0, #42a5f5); padding: 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">📩 Nouveau message</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Un adhérent vous a envoyé un message</p>
        </div>
        <div style="padding: 30px;">
          <div style="background: #fff; border-left: 4px solid #1565c0; padding: 15px 20px; margin: 0 0 20px; border-radius: 0 8px 8px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #888; font-size: 13px; width: 80px;">De</td>
                <td style="padding: 6px 0; color: #333; font-size: 15px; font-weight: 600;">${escapeHtml(userName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #888; font-size: 13px;">Email</td>
                <td style="padding: 6px 0; color: #333; font-size: 15px;">${escapeHtml(userEmail)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #888; font-size: 13px;">Sujet</td>
                <td style="padding: 6px 0; color: #333; font-size: 15px; font-weight: 600;">${escapeHtml(sujet)}</td>
              </tr>
            </table>
          </div>
          <div style="background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0;">
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${escapeHtml(messageText)}</p>
          </div>
          <p style="color: #888; font-size: 13px; margin-top: 20px; text-align: center;">
            Répondez depuis le <a href="https://el-mouhssinine.web.app" style="color: #1565c0;">backoffice</a> → Messages
          </p>
        </div>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          <p style="margin: 0;">Association El Mohsinine</p>
        </div>
      </div>`;

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: adminEmail,
        subject: `Nouveau message de ${userName} - ${sujet}`,
        html: emailHtml,
      });

      console.log('📧 Email nouveau message envoyé aux admins');

      // === 3. Email de confirmation à l'utilisateur ===
      if (userEmail) {
        const prenom = userName.split(' ')[0] || 'Membre';

        const userEmailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9;">
          <div style="background: linear-gradient(135deg, #2e7d32, #4caf50); padding: 30px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">🕌 Message bien reçu</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Votre message a été envoyé à la mosquée</p>
          </div>
          <div style="padding: 30px;">
            <p style="color: #333; font-size: 16px;">Salam alaykoum ${escapeHtml(prenom)},</p>
            <p style="color: #555; font-size: 15px; line-height: 1.6;">
              Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais insha'Allah.
            </p>
            <div style="background: #fff; border-left: 4px solid #4caf50; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="color: #888; font-size: 13px; margin: 0 0 8px;">Sujet</p>
              <p style="color: #333; font-size: 15px; font-weight: 600; margin: 0 0 12px;">${escapeHtml(sujet)}</p>
              <p style="color: #888; font-size: 13px; margin: 0 0 8px;">Votre message</p>
              <p style="color: #555; font-size: 14px; margin: 0; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(messageText)}</p>
            </div>
            <p style="color: #555; font-size: 15px; line-height: 1.6;">
              Vous recevrez une notification et un email dès que nous aurons répondu. Vous pouvez aussi consulter vos messages dans l'application.
            </p>
          </div>
          <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0;">Association El Mohsinine</p>
            <p style="margin: 4px 0;">centreculturelislamique@orange.fr</p>
          </div>
        </div>`;

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: userEmail,
          subject: `Message bien reçu - El Mohsinine`,
          html: userEmailHtml,
        });

        console.log('📧 Email confirmation envoyé à', userEmail.replace(/(.{2}).*(@.*)/, '$1***$2'));
      }

      // Enregistrer dans l'historique
      await admin.firestore().collection('notifications_history').add({
        title: 'Nouveau message adhérent',
        body: `${userName} : ${sujet}`,
        targetAdmins: true,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        success: true,
        source: 'new_message_email',
        relatedMessageId: messageId,
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Erreur email nouveau message:', error.message);
      return { error: error.message };
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

        // === EMAIL à l'utilisateur ===
        try {
          const memberData = memberDoc.exists ? memberDoc.data() : null;
          const userEmail = memberData?.email || after.userEmail;
          const prenom = memberData?.prenom || after.userName || 'Membre';

          if (userEmail) {
            const brevoUser = BREVO_SMTP_USER.value();
            const brevoPass = BREVO_SMTP_PASS.value();
            const fromEmail = BREVO_FROM_EMAIL.value();
            const fromName = BREVO_FROM_NAME.value();

            if (brevoUser && brevoPass && fromEmail) {
              const transporter = nodemailer.createTransport({
                host: 'smtp-relay.brevo.com',
                port: 587,
                secure: false,
                auth: { user: brevoUser, pass: brevoPass },
              });

              const sujet = sanitizeString(after.sujet, 100) || 'votre message';
              const replyPreview = sanitizeString(newReply.message, 200) || '';

              // Charger template depuis Firestore
              const replyTemplate = await loadEmailTemplate('message_reply', {
                prenom,
                sujet,
                reponse: replyPreview,
              });

              let emailHtml;
              let emailSubject;

              if (replyTemplate) {
                emailSubject = replyTemplate.subject || `Réponse à votre message - El Mohsinine`;
                emailHtml = textToEmailHtml(replyTemplate.body, {
                  headerTitle: '🕌 Nouvelle réponse',
                  headerGradient: '#2e7d32, #4caf50',
                });
              } else {
                // Fallback hardcodé
                emailSubject = `Réponse à votre message - El Mohsinine`;
                emailHtml = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9;">
                  <div style="background: linear-gradient(135deg, #2e7d32, #4caf50); padding: 30px; text-align: center;">
                    <h1 style="color: #fff; margin: 0; font-size: 22px;">🕌 Nouvelle réponse</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">La mosquée a répondu à votre message</p>
                  </div>
                  <div style="padding: 30px;">
                    <p style="color: #333; font-size: 16px;">Salam alaykoum ${escapeHtml(prenom)},</p>
                    <p style="color: #555; font-size: 15px; line-height: 1.6;">
                      Nous avons répondu à votre message concernant <strong>"${escapeHtml(sujet)}"</strong>.
                    </p>
                    <div style="background: #fff; border-left: 4px solid #4caf50; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                      <p style="color: #333; font-size: 15px; margin: 0; line-height: 1.6; font-style: italic;">
                        "${escapeHtml(replyPreview)}"
                      </p>
                    </div>
                    <p style="color: #555; font-size: 15px; line-height: 1.6;">
                      Pour consulter la réponse complète et continuer la conversation, ouvrez l'application El Mohsinine dans la section <strong>Messages</strong>.
                    </p>
                    <div style="text-align: center; margin: 25px 0;">
                      <span style="display: inline-block; background: #2e7d32; color: #fff; padding: 12px 30px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none;">
                        Ouvrir l'application
                      </span>
                    </div>
                  </div>
                  <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #999;">
                    <p style="margin: 0;">Association El Mohsinine</p>
                    <p style="margin: 4px 0;">centreculturelislamique@orange.fr</p>
                  </div>
                </div>`;
              }

              await transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: userEmail,
                subject: emailSubject,
                html: emailHtml,
              });

              console.log('📧 Email réponse envoyé à', userEmail.replace(/(.{2}).*(@.*)/, '$1***$2'));
            }
          }
        } catch (emailError) {
          // Ne pas bloquer la fonction si l'email échoue
          console.error('⚠️ Erreur envoi email réponse (non bloquant):', emailError.message);
        }

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

    // Validation stricte des paramètres côté serveur
    if (!amount || typeof amount !== 'number' || isNaN(amount)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le montant est requis et doit être un nombre valide'
      );
    }

    if (!Number.isInteger(amount)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le montant doit être en centimes entiers'
      );
    }

    if (amount < 100) { // minimum 1€ = 100 centimes
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le montant minimum est de 1€'
      );
    }

    if (amount > 10000000) { // maximum 100000€ = 10000000 centimes
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le montant maximum est de 100 000€'
      );
    }

    // Validation montant minimum cotisation (ne concerne pas les dons)
    // Minimum 1€ pour les tests — remettre 10€/100€ en production
    if (metadata && metadata.type === 'cotisation') {
      if (metadata.period === 'mensuel' && amount < 100) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Montant minimum : 1€ pour une cotisation mensuelle.'
        );
      }
      if (metadata.period === 'annuel' && amount < 100) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Montant minimum : 1€ pour une cotisation annuelle.'
        );
      }
    }

    if (!currency) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'La devise est requise'
      );
    }

    // BUG 6 FIX: Valider que la devise est EUR (seule devise acceptée)
    if (currency !== 'eur') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Seule la devise EUR est acceptée'
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
        description: description || 'Don Mosquée El Mohsinine',
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

// ==================== CREATE SUBSCRIPTION ====================
// Créer un abonnement Stripe récurrent pour les cotisations mensuelles
// Retourne clientSecret pour Payment Sheet

exports.createSubscription = functions
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // SÉCURITÉ: Authentification requise pour les abonnements
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentification requise pour créer un abonnement'
      );
    }

    const uid = context.auth.uid;
    const { amount, description, metadata } = data;

    // Validation
    if (!amount || typeof amount !== 'number' || amount < 100 || amount > 10000000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Montant invalide (minimum 1€, maximum 100 000€)'
      );
    }

    const email = metadata?.email;
    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email requis pour créer un abonnement'
      );
    }

    // Rate limiting: max 3 tentatives de création d'abonnement par 5 minutes
    await checkRateLimit(uid, 'subscription', 3, 300);

    try {
      console.log('Création abonnement Stripe pour:', email);

      // 1. Trouver ou créer le Customer Stripe
      let customer;
      const existingCustomers = await stripe.customers.list({ email: email, limit: 1 });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        console.log('Customer Stripe existant:', customer.id);
      } else {
        customer = await stripe.customers.create({
          email: email,
          metadata: {
            firebaseUid: uid,
            memberName: metadata?.memberName || '',
          },
        });
        console.log('Nouveau Customer Stripe créé:', customer.id);
      }

      // 2. Chercher ou créer un Price Stripe pour le montant de l'abonnement
      const lookupKey = `cotisation_mensuelle_${amount}_eur`;
      let price;
      const existingPrices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      if (existingPrices.data.length > 0) {
        price = existingPrices.data[0];
        console.log('Price Stripe réutilisé:', price.id);
      } else {
        price = await stripe.prices.create({
          unit_amount: amount,
          currency: 'eur',
          recurring: { interval: 'month' },
          lookup_key: lookupKey,
          product_data: {
            name: description || 'Cotisation mensuelle - El Mohsinine',
          },
        });
        console.log('Nouveau Price Stripe créé:', price.id);
      }

      // 3. Créer la Subscription avec payment_behavior 'default_incomplete'
      // Cela permet de récupérer le payment_intent pour Payment Sheet
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card'],
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          ...metadata,
          userId: uid,
          source: 'app_mobile',
          type: 'cotisation',
          period: 'mensuel',
        },
      });

      console.log('Subscription créée:', subscription.id);

      // Récupérer le PaymentIntent de la première invoice
      const invoice = subscription.latest_invoice;
      if (!invoice) {
        throw new functions.https.HttpsError('internal', 'Invoice non créée par Stripe. Veuillez réessayer.');
      }
      const paymentIntent = invoice.payment_intent;

      if (!paymentIntent || !paymentIntent.client_secret) {
        throw new functions.https.HttpsError('internal', 'Impossible de récupérer le client_secret du PaymentIntent');
      }

      // 4. Stocker les IDs dans le document membre
      // FIX BUG 4: set({merge:true}) au lieu de update() — évite crash si le doc n'existe pas encore
      const memberRef = admin.firestore().collection('members').doc(uid);
      await memberRef.set({
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        cotisationType: 'mensuel',
        status: 'en_attente_paiement',
      }, { merge: true });

      console.log('IDs Stripe sauvegardés dans Firestore');

      return {
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('Erreur création subscription:', error);
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
    const endpointSecret = STRIPE_WEBHOOK_SECRET.value();

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
              // FIX BUG 3: Créer un document dispute pour investigation admin
              try {
                await admin.firestore().collection('disputes').add({
                  type: 'amount_mismatch',
                  paymentIntentId: paymentIntentId,
                  declaredAmount: declaredTotal,
                  actualAmount: amountEuros,
                  declaredCotisation: declaredCotisation,
                  declaredDon: declaredDon,
                  metadata: metadata,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  status: 'pending_review',
                  source: 'webhook_fraud_detection',
                });
                console.log('Document dispute créé pour investigation');
              } catch (disputeErr) {
                console.error('Erreur création dispute doc:', disputeErr.message);
              }
              // Continue processing with ACTUAL Stripe amount (not declared)
            }
          }

          // FIX G2: Valider le montant de la cotisation par rapport aux tarifs attendus
          if (metadata.type === 'cotisation' && metadata.montantCotisation) {
            const declaredCotisation = parseFloat(metadata.montantCotisation) || 0;
            // Vérifier que le montant est cohérent (au moins 1€ pour une cotisation)
            if (declaredCotisation < 1) {
              console.error(`⚠️ MONTANT SUSPECT: cotisation de ${declaredCotisation}€ (PI: ${paymentIntentId})`);
              // On flag le paiement mais on continue le traitement (l'argent est déjà encaissé)
              metadata._montantSuspect = true;
            }
          }

          // ATOMICITÉ + IDEMPOTENCE: Tout dans une seule transaction
          // IMPORTANT: Firestore exige que TOUS les reads soient AVANT tous les writes
          await admin.firestore().runTransaction(async (transaction) => {
            // ========== PHASE 1: TOUS LES READS ==========
            const processedRef = admin.firestore().collection('processed_payments').doc(paymentIntentId);
            const existingPayment = await transaction.get(processedRef);

            if (existingPayment.exists) {
              console.log('Paiement déjà traité (idempotence in-transaction):', paymentIntentId);
              throw { alreadyProcessed: true };
            }

            // Pré-lire le membre (cotisation) ou le projet (donation) AVANT les writes
            let memberDoc = null;
            let memberRef = null;
            let projectDoc = null;
            let projectRef = null;

            if (metadata.type === 'cotisation' && metadata.memberId) {
              memberRef = admin.firestore().collection('members').doc(metadata.memberId);
              memberDoc = await transaction.get(memberRef);
              // Fallback: si le doc n'existe pas, chercher par uid
              if (!memberDoc.exists && metadata.uid) {
                memberRef = admin.firestore().collection('members').doc(metadata.uid);
                memberDoc = await transaction.get(memberRef);
              }
            }

            if (metadata.type !== 'cotisation' && metadata.projectId) {
              projectRef = admin.firestore().collection('projects').doc(metadata.projectId);
              projectDoc = await transaction.get(projectRef);
            }

            // ========== PHASE 2: TOUS LES WRITES ==========
            // Marquer comme traité (idempotence)
            transaction.set(processedRef, {
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              type: metadata.type || 'donation',
              amount: amountEuros,
            });

            if (metadata.type === 'cotisation') {
              const declaredCotisation = parseFloat(metadata.montantCotisation) || amountEuros;
              const declaredDon = parseFloat(metadata.montantDon) || 0;
              const declaredTotal = declaredCotisation + declaredDon;

              let montantCotisation, montantDon;
              if (Math.abs(declaredTotal - amountEuros) <= 0.01) {
                montantCotisation = declaredCotisation;
                montantDon = declaredDon;
              } else {
                console.warn('Montants metadata non fiables, utilisation du montant Stripe total');
                montantCotisation = amountEuros;
                montantDon = 0;
              }

              const paymentRef = admin.firestore().collection('payments').doc(paymentIntentId);
              transaction.set(paymentRef, {
                stripePaymentIntentId: paymentIntentId,
                amount: montantCotisation,
                montant: montantCotisation,
                currency: paymentIntent.currency,
                status: metadata._montantSuspect ? 'montant_suspect' : 'succeeded',
                type: 'cotisation',
                description: paymentIntent.description,
                membreId: metadata.memberId || null,
                metadata: metadata,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });

              if (montantDon > 0) {
                console.log('Don supplémentaire détecté:', montantDon, 'EUR');
                const donationRef = admin.firestore().collection('donations').doc(paymentIntentId + '-extra');
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
                  donateur: metadata.memberName || metadata.donorName || metadata.donorEmail || 'Anonyme',
                  donateurEmail: (metadata.email || metadata.donorEmail || '').toLowerCase() || null,
                  userId: metadata.memberId || metadata.userId || '',
                  donorType: metadata.donorType || 'particulier',
                  donorInfo: (() => { try { return metadata.donorInfo ? JSON.parse(metadata.donorInfo) : null; } catch (e) { console.warn('donorInfo JSON invalide (cotisation don):', e.message); return null; } })(),
                  projectId: null,
                  projectName: 'Don général',
                  projetId: null,
                  projetNom: 'Don général',
                  isAnonymous: false,
                  source: 'webhook_stripe',
                  date: admin.firestore.FieldValue.serverTimestamp(),
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
                  recuFiscalGenerated: false,
                  recuFiscalYear: null,
                  recuFiscalUrl: null,
                }, { merge: true });
              }

              // Mettre à jour le membre (déjà lu en phase 1)
              // Status → en_attente_validation (l'admin valide via backoffice → actif)
              if (memberRef && memberDoc && memberDoc.exists) {
                transaction.update(memberRef, {
                  status: 'en_attente_validation',
                  aPaye: true,
                  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
                  montantPaye: montantCotisation,
                  stripePaymentId: paymentIntentId,
                });
              } else if (metadata.memberId) {
                console.warn('Membre non trouvé pour update:', metadata.memberId);
              }
            } else {
              const donationRef = admin.firestore().collection('donations').doc(paymentIntentId);
              transaction.set(donationRef, {
                stripePaymentIntentId: paymentIntentId,
                amount: amountEuros,
                montant: amountEuros,
                currency: paymentIntent.currency,
                status: 'succeeded',
                type: 'donation',
                description: paymentIntent.description,
                metadata: metadata,
                // BUG 3 FIX: Sauvegarder nom donateur + userId depuis metadata Stripe
                donateur: metadata.donorName || metadata.donorEmail || 'Anonyme',
                donateurEmail: metadata.donorEmail ? metadata.donorEmail.toLowerCase() : null,
                userId: metadata.userId || metadata.donorUid || '',
                donorType: metadata.donorType || 'particulier',
                donorInfo: (() => { try { return metadata.donorInfo ? JSON.parse(metadata.donorInfo) : null; } catch (e) { console.warn('donorInfo JSON invalide (donation):', e.message); return null; } })(),
                projectId: metadata.projectId || null,
                projectName: metadata.projectName || null,
                projetId: metadata.projectId || null,
                projetNom: metadata.projectName || null,
                isAnonymous: metadata.isAnonymous === 'true',
                source: 'webhook_stripe',
                date: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });

              // Mettre à jour le projet (déjà lu en phase 1)
              if (projectRef && projectDoc && projectDoc.exists) {
                transaction.update(projectRef, {
                  montantActuel: admin.firestore.FieldValue.increment(amountEuros),
                });
              } else if (metadata.projectId) {
                console.warn('Projet non trouvé pour update:', metadata.projectId);
              }
            }
          });

          console.log('Paiement enregistré dans Firestore (transaction atomique)');

          // Email A : "Demande d'adhésion reçue" pour les cotisations
          if (metadata.type === 'cotisation' && metadata.memberId) {
            try {
              const memberSnap = await admin.firestore().collection('members').doc(metadata.memberId).get();
              const memberData = memberSnap.exists ? memberSnap.data() : {};
              const memberEmail = (memberData.email || metadata.email || '').toLowerCase();
              const memberPrenom = memberData.prenom || metadata.memberName || 'Membre';

              if (memberEmail) {
                const brevoUser = BREVO_SMTP_USER.value();
                const brevoPass = BREVO_SMTP_PASS.value();
                const fromEmail = BREVO_FROM_EMAIL.value();
                const fromName = BREVO_FROM_NAME.value() || 'Mosquée El Mouhssinine';

                if (brevoUser && brevoPass && fromEmail) {
                  const transporter = nodemailer.createTransport({
                    host: 'smtp-relay.brevo.com',
                    port: 587,
                    secure: false,
                    auth: { user: brevoUser, pass: brevoPass },
                  });

                  await transporter.sendMail({
                    from: `"${fromName}" <${fromEmail}>`,
                    to: memberEmail,
                    subject: `✅ Votre demande d'adhésion a bien été reçue`,
                    html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: linear-gradient(135deg, #1a5276 0%, #2e86c1 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">✅ Demande reçue</h1>
                      </div>
                      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px;">Assalamu alaykum <strong>${escapeHtml(memberPrenom)}</strong>,</p>
                        <p style="font-size: 16px;">Nous avons bien reçu votre paiement de cotisation de <strong>${amountEuros}€</strong>.</p>
                        <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2e86c1;">
                          <p style="margin: 0; font-size: 16px;">Votre demande d'adhésion est <strong>en cours de traitement</strong> par le bureau de la mosquée.</p>
                        </div>
                        <p style="font-size: 16px;">Vous recevrez un email de confirmation dès validation de votre dossier.</p>
                        <p style="font-size: 16px; color: #444;">Barakallahu fik,<br><strong>L'équipe El Mouhssinine</strong></p>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
                          <p style="color: #aaa; font-size: 11px;">Mosquée El Mouhssinine - Bourg-en-Bresse</p>
                        </div>
                      </div>
                    </div>`,
                  });
                  console.log('📧 Email "demande adhésion reçue" envoyé à', memberEmail.substring(0, 3) + '***');
                }
              }
            } catch (emailErr) {
              console.error('[EMAIL ERROR] Email demande adhésion reçue échoué:', emailErr.message);
            }
          }
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

      case 'invoice.payment_succeeded':
        // Événement déclenché pour chaque paiement récurrent réussi d'un abonnement
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        console.log('Paiement récurrent réussi pour subscription:', subscriptionId);

        try {
          // Récupérer la subscription pour avoir les metadata
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const customerId = subscription.customer;
          const metadata = subscription.metadata || {};
          const amountEuros = invoice.amount_paid / 100;

          // Récupérer l'email du customer
          const customer = await stripe.customers.retrieve(customerId);
          const email = customer.email;

          // Trouver le membre par stripeCustomerId
          const membersSnapshot = await admin.firestore()
            .collection('members')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();

          if (membersSnapshot.empty) {
            console.warn('Membre non trouvé pour customer:', customerId);
            break;
          }

          const memberDoc = membersSnapshot.docs[0];
          const memberId = memberDoc.id;
          const memberData = memberDoc.data();

          // Étendre la date de fin de cotisation de 1 mois
          const now = new Date();
          let newEndDate;

          if (memberData.cotisation?.dateFin) {
            const currentEnd = memberData.cotisation.dateFin.toDate();
            if (currentEnd > now) {
              newEndDate = new Date(currentEnd);
              const origDay1 = newEndDate.getDate();
              newEndDate.setMonth(newEndDate.getMonth() + 1);
              if (newEndDate.getDate() !== origDay1) newEndDate.setDate(0);
            } else {
              newEndDate = new Date(now);
              const origDay2 = newEndDate.getDate();
              newEndDate.setMonth(newEndDate.getMonth() + 1);
              if (newEndDate.getDate() !== origDay2) newEndDate.setDate(0);
            }
          } else {
            newEndDate = new Date(now);
            const origDay3 = newEndDate.getDate();
            newEndDate.setMonth(newEndDate.getMonth() + 1);
            if (newEndDate.getDate() !== origDay3) newEndDate.setDate(0);
          }

          // FIX BUG 2: Idempotence check INSIDE transaction (atomique)
          // Avant: check hors transaction = race condition si 2 webhooks simultanés
          const invoiceProcessedRef = admin.firestore().collection('processed_payments').doc(invoice.id);
          const paymentRef = admin.firestore().collection('payments').doc(invoice.id);
          const memberRefTx = memberDoc.ref;
          await admin.firestore().runTransaction(async (t) => {
            // Read idempotence doc INSIDE transaction
            const invoiceProcessedDoc = await t.get(invoiceProcessedRef);
            if (invoiceProcessedDoc.exists) {
              console.log('Invoice déjà traitée (idempotent in-transaction):', invoice.id);
              throw { alreadyProcessed: true };
            }

            t.set(paymentRef, {
              stripePaymentIntentId: invoice.payment_intent,
              stripeSubscriptionId: subscriptionId,
              stripeInvoiceId: invoice.id,
              amount: amountEuros,
              montant: amountEuros,
              currency: invoice.currency,
              status: 'succeeded',
              type: 'cotisation',
              description: 'Renouvellement cotisation mensuelle',
              memberId: metadata.memberIdDisplay || '',
              membreId: memberId || null,
              memberName: memberData.prenom + ' ' + memberData.nom,
              period: 'mensuel',
              modePaiement: 'carte',
              source: 'stripe_subscription',
              metadata: {
                memberId: memberId,
                memberIdDisplay: metadata.memberIdDisplay || '',
                memberName: memberData.prenom + ' ' + memberData.nom,
                email: email,
                period: 'mensuel',
              },
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            t.update(memberRefTx, {
              status: 'actif',
              aPaye: true,
              datePaiement: admin.firestore.FieldValue.serverTimestamp(),
              montantPaye: amountEuros,
              stripePaymentId: invoice.payment_intent,
              cotisation: {
                type: 'mensuel',
                montant: amountEuros,
                dateDebut: memberData.cotisation?.dateDebut || admin.firestore.Timestamp.fromDate(now),
                dateFin: admin.firestore.Timestamp.fromDate(newEndDate),
              },
            });

            t.set(invoiceProcessedRef, {
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              type: 'invoice_payment',
              invoiceId: invoice.id,
              subscriptionId: subscriptionId,
            });
          });

          console.log('Cotisation renouvelée jusqu\'au:', newEndDate.toISOString());
        } catch (err) {
          // Gérer le cas d'idempotence (pas une vraie erreur)
          if (err && err.alreadyProcessed) {
            console.log('Invoice déjà traitée, skip');
            break;
          }
          console.error('Erreur traitement invoice.payment_succeeded:', err);
        }
        break;

      case 'invoice.payment_failed':
        // Événement déclenché quand un paiement récurrent d'abonnement échoue
        const failedInvoice = event.data.object;
        const failedSubId = failedInvoice.subscription;
        const attemptCount = failedInvoice.attempt_count || 1;

        console.log('Paiement récurrent échoué pour subscription:', failedSubId, 'tentative:', attemptCount);

        try {
          if (!failedSubId) {
            console.log('Pas de subscription associée, skip');
            break;
          }

          const failedSubscription = await stripe.subscriptions.retrieve(failedSubId);
          const failedCustomerId = failedSubscription.customer;
          const failedCustomer = await stripe.customers.retrieve(failedCustomerId);
          const failedEmail = failedCustomer.email;

          const failedMembersSnapshot = await admin.firestore()
            .collection('members')
            .where('stripeCustomerId', '==', failedCustomerId)
            .limit(1)
            .get();

          let failedMemberPrenom = '';
          let failedMemberDoc = null;

          if (!failedMembersSnapshot.empty) {
            failedMemberDoc = failedMembersSnapshot.docs[0];
            const failedMemberData = failedMemberDoc.data();
            failedMemberPrenom = failedMemberData.prenom || '';

            const statusUpdate = {
              paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
              paymentFailedCount: attemptCount,
            };

            if (attemptCount >= 3) {
              statusUpdate.status = 'expire';
              console.log('3 tentatives échouées, membre passé en expire pour renouvellement');
            }

            await failedMemberDoc.ref.update(statusUpdate);
          }

          await admin.firestore().collection('failed_payments').add({
            stripeInvoiceId: failedInvoice.id,
            stripeSubscriptionId: failedSubId,
            stripeCustomerId: failedCustomerId,
            attemptCount: attemptCount,
            amountDue: (failedInvoice.amount_due || 0) / 100,
            error: failedInvoice.last_finalization_error?.message || 'Paiement refusé',
            memberId: failedMemberDoc ? failedMemberDoc.id : null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (failedEmail) {
            const brevoUser = BREVO_SMTP_USER.value();
            const brevoPass = BREVO_SMTP_PASS.value();
            const fromEmail = BREVO_FROM_EMAIL.value();
            const fromName = BREVO_FROM_NAME.value();

            if (brevoUser && brevoPass && fromEmail) {
              const amountDue = ((failedInvoice.amount_due || 0) / 100).toFixed(2);

              const pfTemplate = await loadEmailTemplate('payment_failed', {
                prenom: failedMemberPrenom,
                montant: amountDue + ' €',
                tentative: String(attemptCount),
                date: new Date().toLocaleDateString('fr-FR'),
              });

              const pfSubject = pfTemplate?.subject || 'Échec de paiement - El Mohsinine';
              let pfHtmlBody;

              if (pfTemplate?.body) {
                const settingsDoc = await admin.firestore().collection('settings').doc('association').get();
                const assocData = settingsDoc.exists ? settingsDoc.data() : {};
                pfHtmlBody = textToEmailHtml(pfTemplate.body, {
                  headerTitle: '⚠️ Échec de paiement',
                  headerGradient: '#e65100, #ff9800',
                  footerAssociation: assocData.nom || 'Mosquée El Mohsinine',
                  footerAdresse: assocData.adresse || '',
                  footerTelephone: assocData.telephone || '',
                });
              } else {
                const settingsDoc = await admin.firestore().collection('settings').doc('association').get();
                const assocData = settingsDoc.exists ? settingsDoc.data() : {};
                pfHtmlBody = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #e65100, #ff9800); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                      <h1 style="color: white; margin: 0;">⚠️ Échec de paiement</h1>
                    </div>
                    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                      <p style="font-size: 16px; color: #444;">Salam alaykoum${failedMemberPrenom ? ' ' + failedMemberPrenom : ''},</p>
                      <p style="font-size: 16px; color: #444;">Votre paiement de cotisation mensuelle de <strong>${amountDue} €</strong> a été <strong>refusé par votre banque</strong>.</p>
                      <div style="background: #fff3e0; border-left: 4px solid #e65100; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0; color: #e65100; font-weight: bold;">Tentative ${attemptCount}/3</p>
                        <p style="margin: 5px 0 0; color: #444;">${attemptCount >= 3
                          ? 'Toutes les tentatives ont échoué. Votre abonnement a été suspendu et votre statut est repassé en sympathisant.'
                          : 'Stripe réessaiera automatiquement dans quelques jours. Veuillez vérifier votre carte bancaire.'}</p>
                      </div>
                      <p style="font-size: 16px; color: #444;"><strong>Que faire ?</strong></p>
                      <ul style="color: #444; line-height: 1.8;">
                        <li>Vérifiez que votre carte bancaire est valide</li>
                        <li>Assurez-vous que votre compte dispose de fonds suffisants</li>
                        <li>Si le problème persiste, contactez votre banque</li>
                        <li>Vous pouvez renouveler votre cotisation depuis l'application</li>
                      </ul>
                      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                      <div style="font-size: 13px; color: #888; text-align: center;">
                        <p style="margin: 5px 0;"><strong>${assocData.nom || 'Mosquée El Mohsinine'}</strong></p>
                        ${assocData.adresse ? '<p style="margin: 5px 0;">📍 ' + assocData.adresse + '</p>' : ''}
                        ${assocData.telephone ? '<p style="margin: 5px 0;">📞 ' + assocData.telephone + '</p>' : ''}
                      </div>
                    </div>
                  </div>`;
              }

              const pfTransporter = nodemailer.createTransport({
                host: 'smtp-relay.brevo.com',
                port: 587,
                secure: false,
                auth: { user: brevoUser, pass: brevoPass },
              });

              // FIX BUG 6: try-catch local — l'échec email ne doit pas crasher le webhook
              try {
                await pfTransporter.sendMail({
                  from: `"${fromName}" <${fromEmail}>`,
                  to: failedEmail,
                  subject: pfSubject,
                  html: pfHtmlBody,
                });
                console.log('Email échec de paiement envoyé à:', failedEmail.substring(0, 3) + '***');
              } catch (emailErr) {
                console.error('Email non-bloquant (payment_failed):', emailErr.message);
              }
            }
          }
        } catch (err) {
          console.error('Erreur traitement invoice.payment_failed:', err);
        }
        break;

      case 'customer.subscription.deleted':
        // Événement déclenché quand un abonnement est annulé ou expire
        const deletedSubscription = event.data.object;
        const deletedSubId = deletedSubscription.id;

        console.log('Subscription supprimée:', deletedSubId);

        try {
          // Trouver le membre par stripeSubscriptionId
          const subMembersSnapshot = await admin.firestore()
            .collection('members')
            .where('stripeSubscriptionId', '==', deletedSubId)
            .limit(1)
            .get();

          if (!subMembersSnapshot.empty) {
            const subMemberDoc = subMembersSnapshot.docs[0];
            const subMemberData = subMemberDoc.data();
            await subMemberDoc.ref.update({
              status: 'sympathisant',
              cotisationType: null,
              stripeSubscriptionId: null,
              aPaye: false,
              subscriptionCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('Membre passé en sympathisant suite à suppression abonnement Stripe');

            // Envoyer email de confirmation d'annulation
            const cancelEmail = subMemberData.email;
            const cancelPrenom = subMemberData.prenom || subMemberData.nom || 'Membre';
            if (cancelEmail) {
              try {
                const brevoUser = BREVO_SMTP_USER.value();
                const brevoPass = BREVO_SMTP_PASS.value();
                const fromEmail = BREVO_FROM_EMAIL.value();
                const fromName = BREVO_FROM_NAME.value();

                if (brevoUser && brevoPass && fromEmail) {
                  // Charger les infos association
                  const cancelSettingsDoc = await admin.firestore().collection('settings').doc('association').get();
                  const cancelAssocData = cancelSettingsDoc.exists ? cancelSettingsDoc.data() : {};
                  const nomAssociation = cancelAssocData.nom || 'Mosquée El Mohsinine';

                  const cancelTemplate = await loadEmailTemplate('cotisation_cancelled', {
                    prenom: cancelPrenom,
                    nom_association: nomAssociation,
                    date: new Date().toLocaleDateString('fr-FR'),
                  });

                  let cancelSubject, cancelHtmlBody;
                  if (cancelTemplate) {
                    cancelSubject = cancelTemplate.subject;
                    cancelHtmlBody = textToEmailHtml(cancelTemplate.body, {
                      headerTitle: '📋 Annulation de cotisation',
                      headerGradient: '#455a64, #78909c',
                      footerAssociation: nomAssociation,
                      footerAdresse: cancelAssocData.adresse ? `${cancelAssocData.adresse}, ${cancelAssocData.codePostal || ''} ${cancelAssocData.ville || ''}` : '',
                      footerTelephone: cancelAssocData.telephone || '',
                    });
                  } else {
                    // Fallback hardcodé
                    cancelSubject = 'Confirmation d\'annulation de cotisation - ' + nomAssociation;
                    cancelHtmlBody = textToEmailHtml(
                      `Salam alaykoum {prenom},\n\nNous vous confirmons que votre cotisation mensuelle auprès de ${nomAssociation} a bien été annulée.\n\nVotre statut est désormais "sympathisant". Vous ne serez plus prélevé automatiquement.\n\nSi cette annulation est une erreur ou si vous souhaitez reprendre votre adhésion, vous pouvez à tout moment vous réinscrire depuis l'application dans l'onglet "Adhérent".\n\nNous vous remercions pour votre soutien passé et espérons vous revoir bientôt parmi nos membres actifs.\n\nBaraka Allahou fikoum,\nL'équipe ${nomAssociation}`
                        .replace(/\{prenom\}/g, cancelPrenom),
                      {
                        headerTitle: '📋 Annulation de cotisation',
                        headerGradient: '#455a64, #78909c',
                        footerAssociation: nomAssociation,
                        footerAdresse: cancelAssocData.adresse ? `${cancelAssocData.adresse}, ${cancelAssocData.codePostal || ''} ${cancelAssocData.ville || ''}` : '',
                        footerTelephone: cancelAssocData.telephone || '',
                      }
                    );
                  }

                  const cancelTransporter = nodemailer.createTransport({
                    host: 'smtp-relay.brevo.com',
                    port: 587,
                    secure: false,
                    auth: { user: brevoUser, pass: brevoPass },
                  });

                  await cancelTransporter.sendMail({
                    from: `"${fromName}" <${fromEmail}>`,
                    to: cancelEmail,
                    subject: cancelSubject,
                    html: cancelHtmlBody,
                  });

                  console.log(`✅ Email annulation cotisation envoyé à ${cancelEmail.substring(0, 3)}***`);
                }
              } catch (emailErr) {
                console.error('Erreur envoi email annulation:', emailErr);
                // Ne pas bloquer le flux principal si l'email échoue
              }
            }
          }
        } catch (err) {
          console.error('Erreur traitement customer.subscription.deleted:', err);
        }
        break;

      case 'customer.subscription.updated':
        // Événement déclenché quand un abonnement est modifié
        const updatedSubscription = event.data.object;
        console.log('Subscription mise à jour:', updatedSubscription.id, 'status:', updatedSubscription.status);

        try {
          // Si l'abonnement passe en cancel_at_period_end, on peut logger ou notifier
          if (updatedSubscription.cancel_at_period_end) {
            console.log('Abonnement marqué pour annulation à la fin de la période:', updatedSubscription.cancel_at);
          }

          // Trouver le membre et mettre à jour son statut si nécessaire
          const updatedSubMembersSnapshot = await admin.firestore()
            .collection('members')
            .where('stripeSubscriptionId', '==', updatedSubscription.id)
            .limit(1)
            .get();

          if (!updatedSubMembersSnapshot.empty) {
            const updatedSubMemberDoc = updatedSubMembersSnapshot.docs[0];
            const updateData = {};

            // Mettre à jour le statut selon le statut Stripe
            if (updatedSubscription.status === 'active') {
              updateData.status = 'actif';
            } else if (updatedSubscription.status === 'canceled' || updatedSubscription.status === 'unpaid') {
              updateData.status = 'expire';
            }

            if (Object.keys(updateData).length > 0) {
              await updatedSubMemberDoc.ref.update(updateData);
              console.log('Membre mis à jour suite à changement de statut abonnement');
            }
          }
        } catch (err) {
          console.error('Erreur traitement customer.subscription.updated:', err);
        }
        break;

      // FIX D4: Handler litiges Stripe (disputes)
      case 'charge.dispute.created': {
        const dispute = event.data.object;
        console.log('⚠️ LITIGE STRIPE créé:', dispute.id, 'montant:', dispute.amount / 100, dispute.currency);

        try {
          // 1. Créer doc dans collection "disputes"
          await admin.firestore().collection('disputes').doc(dispute.id).set({
            disputeId: dispute.id,
            paymentIntentId: dispute.payment_intent,
            chargeId: dispute.charge,
            amount: dispute.amount / 100,
            currency: dispute.currency,
            reason: dispute.reason,
            status: dispute.status,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            evidenceDueBy: dispute.evidence_details?.due_by
              ? new Date(dispute.evidence_details.due_by * 1000)
              : null,
          });

          // 2. Envoyer email alerte admin
          const brevoUser = BREVO_SMTP_USER.value();
          const brevoPass = BREVO_SMTP_PASS.value();
          const fromEmail = BREVO_FROM_EMAIL.value();
          const fromName = BREVO_FROM_NAME.value();

          if (brevoUser && brevoPass && fromEmail) {
            const disputeTransporter = nodemailer.createTransport({
              host: 'smtp-relay.brevo.com',
              port: 587,
              secure: false,
              auth: { user: brevoUser, pass: brevoPass },
            });

            const evidenceDate = dispute.evidence_details?.due_by
              ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString('fr-FR')
              : 'Non précisé';

            // FIX BUG 6: try-catch local — l'échec email ne doit pas crasher le webhook
            try {
            await disputeTransporter.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: fromEmail,
              subject: `⚠️ LITIGE STRIPE — Un paiement de ${dispute.amount / 100}€ est contesté`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #d32f2f, #f44336); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">⚠️ Litige Stripe</h1>
                  </div>
                  <div style="padding: 20px; background: #fff;">
                    <p>Un paiement a été contesté par le titulaire de la carte.</p>
                    <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0;">
                      <p><strong>Montant contesté :</strong> ${dispute.amount / 100} ${dispute.currency?.toUpperCase()}</p>
                      <p><strong>Raison :</strong> ${dispute.reason || 'Non spécifiée'}</p>
                      <p><strong>ID litige :</strong> ${dispute.id}</p>
                      <p><strong>ID paiement :</strong> ${dispute.payment_intent}</p>
                      <p><strong>Date limite preuve :</strong> ${evidenceDate}</p>
                    </div>
                    <p style="color: #d32f2f; font-weight: bold;">
                      Action requise : Connectez-vous au Dashboard Stripe pour soumettre des preuves avant la date limite.
                    </p>
                    <a href="https://dashboard.stripe.com/disputes/${dispute.id}" style="display: inline-block; padding: 10px 20px; background: #d32f2f; color: white; text-decoration: none; border-radius: 5px;">
                      Voir le litige sur Stripe
                    </a>
                  </div>
                </div>
              `,
            });
            console.log('Email alerte litige envoyé à l\'admin');
            } catch (emailErr) {
              console.error('Email non-bloquant (dispute alert):', emailErr.message);
            }
          }
        } catch (err) {
          console.error('Erreur traitement charge.dispute.created:', err);
        }
        break;
      }

      case 'charge.dispute.closed': {
        const closedDispute = event.data.object;
        console.log('Litige Stripe fermé:', closedDispute.id, 'status:', closedDispute.status);

        try {
          await admin.firestore().collection('disputes').doc(closedDispute.id).update({
            status: closedDispute.status,
            closedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log('Litige mis à jour dans Firestore');
        } catch (err) {
          console.error('Erreur traitement charge.dispute.closed:', err);
        }
        break;
      }

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
 * Télécharge une image depuis une URL et retourne un Buffer
 */
const fetchImageBuffer = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
};

/**
 * Génère le PDF CERFA pour un PARTICULIER (article 200 du CGI - 66%)
 */
const generateCERFAParticulier = async (data) => {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 25, left: 40, right: 40 } });
    const chunks = [];
    const pageWidth = 595.28; // A4
    const contentLeft = 40;
    const contentRight = pageWidth - 40;
    const contentWidth = contentRight - contentLeft;
    const boxLeft = contentLeft;
    const boxInner = contentLeft + 10;

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { association, donateur, don, numeroRecu } = data;

    // Charger images signature et cachet si disponibles
    let signatureBuffer = null;
    let cachetBuffer = null;
    try {
      if (association.signatureUrl) {
        signatureBuffer = await fetchImageBuffer(association.signatureUrl);
      }
      if (association.cachetUrl) {
        cachetBuffer = await fetchImageBuffer(association.cachetUrl);
      }
    } catch (imgErr) {
      console.warn('Impossible de charger signature/cachet:', imgErr.message);
    }

    // === EN-TÊTE CERFA ===
    doc.fontSize(14).font('Helvetica-Bold').text('REÇU AU TITRE DES DONS', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('À DES ORGANISMES D\'INTÉRÊT GÉNÉRAL', { align: 'center' });
    doc.fontSize(8).text('Article 200 du code général des impôts (CGI)', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(7).fillColor('#666666').text('N° CERFA 11580*05', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(0.4);

    // Numéro et date (sur une seule ligne)
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(`Reçu n° : ${numeroRecu}`, boxLeft, doc.y, { continued: true, width: contentWidth });
    doc.font('Helvetica').text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(0.6);

    // === CADRE 1 : Organisme bénéficiaire ===
    const box1H = 150;
    doc.rect(boxLeft, doc.y, contentWidth, box1H).stroke();
    const box1Y = doc.y + 6;
    doc.fontSize(9).font('Helvetica-Bold').text('1. ORGANISME BÉNÉFICIAIRE', boxInner, box1Y);
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Nom : ${association.nom || '[À compléter]'}`, boxInner);
    doc.text(`Adresse : ${association.adresse || '[À compléter]'}  ${association.codePostal || ''} ${association.ville || ''}`, boxInner);
    doc.text(`N° SIREN/RNA : ${association.siren || '[À compléter]'}  —  Statut : ${association.statut || 'Association cultuelle loi 1905'}`, boxInner);
    doc.text(`Objet : ${association.objet || 'Exercice du culte musulman'}`, boxInner);
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica-Bold').text('Catégorie au regard de l\'article 200 du CGI :', boxInner);
    doc.font('Helvetica');
    doc.text('[  ] Œuvre ou organisme d\'intérêt général   [  ] Fondation ou association reconnue d\'utilité publique', boxInner);
    doc.text('[  ] Fondation d\'entreprise   [  ] Établissement d\'enseignement supérieur ou artistique', boxInner);
    doc.text('[X] Association cultuelle ou de bienfaisance autorisée à recevoir des dons et legs', boxInner);
    doc.y = box1Y + box1H + 4;

    // === CADRE 2 : Donateur (particulier) ===
    const box2H = 70;
    doc.rect(boxLeft, doc.y, contentWidth, box2H).stroke();
    const box2Y = doc.y + 6;
    doc.fontSize(9).font('Helvetica-Bold').text('2. DONATEUR (Particulier)', boxInner, box2Y);
    doc.moveDown(0.2);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Nom : ${donateur.nom || ''}   Prénom : ${donateur.prenom || ''}`, boxInner);
    doc.text(`Adresse : ${donateur.adresse || 'Non renseignée'}  ${donateur.codePostal || ''} ${donateur.ville || ''}`, boxInner);
    doc.y = box2Y + box2H + 4;

    // === CADRE 3 : Don ===
    const box3H = 115;
    doc.rect(boxLeft, doc.y, contentWidth, box3H).stroke();
    const box3Y = doc.y + 6;
    doc.fontSize(9).font('Helvetica-Bold').text('3. DON', boxInner, box3Y);
    doc.moveDown(0.2);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Date du (des) versement(s) : ${don.date}     Mode de versement : ${don.mode}`, boxInner);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Montant : ${don.montant.toFixed(2)} €`, boxInner);
    doc.font('Helvetica').fontSize(8);
    doc.text(`Soit en toutes lettres : ${amountToWords(don.montant)}`, boxInner);
    doc.moveDown(0.2);
    doc.text('Nature du don : Don en numéraire', boxInner);
    doc.moveDown(0.2);
    doc.text('Forme du don :   [  ] Acte authentique   [  ] Acte sous seing privé   [X] Don manuel   [  ] Autres', boxInner);
    doc.y = box3Y + box3H + 4;

    // === CADRE 4 : Dispositif légal applicable (art. 200 + 978 pour particulier) ===
    const box4H = 55;
    doc.rect(boxLeft, doc.y, contentWidth, box4H).stroke();
    const box4Y = doc.y + 6;
    doc.fontSize(9).font('Helvetica-Bold').text('4. DISPOSITIF LÉGAL APPLICABLE', boxInner, box4Y);
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica');
    doc.text('Le bénéficiaire certifie sur l\'honneur que les dons et versements qu\'il reçoit ouvrent droit à la réduction d\'impôt prévue à l\'article :', boxInner);
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica');
    doc.text('[X] 200 du CGI (impôt sur le revenu)     [  ] 978 du CGI (IFI — impôt sur la fortune immobilière)', boxInner);
    doc.y = box4Y + box4H + 4;

    // === Mentions légales ===
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica');
    doc.text(
      'Ce don ouvre droit à une réduction d\'impôt sur le revenu égale à 66% du montant versé, dans la limite de 20% du revenu imposable. Si le montant des dons dépasse cette limite, l\'excédent est reporté sur les 5 années suivantes.',
      boxLeft, doc.y, { width: contentWidth, align: 'justify' }
    );
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#333333');
    doc.text(
      'Le don a été effectué sans aucune contrepartie directe ou indirecte au profit du donateur.',
      boxLeft, doc.y, { width: contentWidth, align: 'center' }
    );
    doc.font('Helvetica').fillColor('#000000');

    // === BLOC SIGNATURE (bas-droite, position fixe) ===
    const sigBlockX = contentRight - 200; // aligné à droite
    const sigBlockY = 610; // position fixe en bas de page (après contrepartie, avant tampon)

    doc.fontSize(9).font('Helvetica');
    doc.text(`Fait à ${association.ville || '[Ville]'}, le ${new Date().toLocaleDateString('fr-FR')}`, sigBlockX, sigBlockY, { width: 200, align: 'right' });
    doc.moveDown(0.3);
    doc.text(`${association.signataire || 'Le Président'}`, sigBlockX, doc.y, { width: 200, align: 'right' });
    doc.text(`${association.nomSignataire || '[Nom du signataire]'}`, sigBlockX, doc.y, { width: 200, align: 'right' });

    // Tampon (cachet image ou cachet simulé)
    const cachetY = doc.y + 4;
    const cachetX = contentRight - 140;
    const cachetSize = 100;
    if (cachetBuffer) {
      try {
        doc.image(cachetBuffer, cachetX, cachetY, { width: cachetSize, height: cachetSize });
      } catch (e) {
        console.warn('Erreur ajout cachet PDF:', e.message);
      }
    } else {
      // Cachet simulé (rond officiel) si pas d'image
      const cx = cachetX + cachetSize / 2;
      const cy = cachetY + cachetSize / 2;
      const r = cachetSize / 2;
      doc.save();
      doc.circle(cx, cy, r).lineWidth(2).stroke('#1a1a1a');
      doc.circle(cx, cy, r - 6).lineWidth(0.5).stroke('#1a1a1a');
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#1a1a1a');
      doc.text('CENTRE CULTUREL', cachetX + 10, cy - 22, { width: cachetSize - 20, align: 'center' });
      doc.text('ISLAMIQUE', cachetX + 10, doc.y, { width: cachetSize - 20, align: 'center' });
      doc.fontSize(7).font('Helvetica-Bold');
      doc.text('El Mohsinine', cachetX + 10, doc.y + 2, { width: cachetSize - 20, align: 'center' });
      doc.fontSize(5).font('Helvetica');
      doc.text('Bourg-en-Bresse', cachetX + 10, doc.y + 2, { width: cachetSize - 20, align: 'center' });
      doc.text(association.siren || 'W012004130', cachetX + 10, doc.y, { width: cachetSize - 20, align: 'center' });
      doc.restore();
      doc.fillColor('#000000');
    }

    // Signature par-dessus le tampon si disponible
    if (signatureBuffer) {
      try {
        doc.image(signatureBuffer, cachetX + 10, cachetY + 10, { width: 80, height: 40 });
      } catch (e) {
        console.warn('Erreur ajout signature PDF:', e.message);
      }
    }

    // === FOOTER (tout en bas de la page 1) ===
    doc.fontSize(6).font('Helvetica').text(
      'Document à conserver. Il vous permet de bénéficier d\'une réduction d\'impôt. Ne pas joindre à la déclaration de revenus.',
      boxLeft, 790, { align: 'center', width: contentWidth }
    );

    doc.end();
  });
};

/**
 * Génère le PDF CERFA pour une ENTREPRISE (article 238 bis du CGI - 60%)
 */
const generateCERFAEntreprise = async (data) => {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 25, left: 40, right: 40 } });
    const chunks = [];
    const pageWidth = 595.28;
    const contentLeft = 40;
    const contentRight = pageWidth - 40;
    const contentWidth = contentRight - contentLeft;
    const boxLeft = contentLeft;
    const boxInner = contentLeft + 10;

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { association, donateur, don, numeroRecu } = data;

    // Charger images signature et cachet si disponibles
    let signatureBuffer = null;
    let cachetBuffer = null;
    try {
      if (association.signatureUrl) {
        signatureBuffer = await fetchImageBuffer(association.signatureUrl);
      }
      if (association.cachetUrl) {
        cachetBuffer = await fetchImageBuffer(association.cachetUrl);
      }
    } catch (imgErr) {
      console.warn('Impossible de charger signature/cachet:', imgErr.message);
    }

    // === EN-TÊTE CERFA ===
    doc.fontSize(14).font('Helvetica-Bold').text('REÇU AU TITRE DES DONS', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('À DES ORGANISMES D\'INTÉRÊT GÉNÉRAL', { align: 'center' });
    doc.fontSize(8).text('Article 200 et 238 bis du code général des impôts (CGI)', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(7).fillColor('#666666').text('N° CERFA 16216*02', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(0.4);

    // Numéro et date (sur une seule ligne)
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(`Reçu n° : ${numeroRecu}`, boxLeft, doc.y, { continued: true, width: contentWidth });
    doc.font('Helvetica').text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(0.6);

    // === CADRE 1 : Organisme bénéficiaire ===
    const box1H = 155;
    doc.rect(boxLeft, doc.y, contentWidth, box1H).stroke();
    const box1Y = doc.y + 6;
    doc.fontSize(9).font('Helvetica-Bold').text('1. ORGANISME BÉNÉFICIAIRE', boxInner, box1Y);
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Nom : ${association.nom || '[À compléter]'}`, boxInner);
    doc.text(`Adresse : ${association.adresse || '[À compléter]'}  ${association.codePostal || ''} ${association.ville || ''}`, boxInner);
    doc.text(`N° SIREN/RNA : ${association.siren || '[À compléter]'}  —  Statut : ${association.statut || 'Association cultuelle loi 1905'}`, boxInner);
    doc.text(`Objet : ${association.objet || 'Exercice du culte musulman'}`, boxInner);
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica-Bold').text('Catégorie au regard des articles 200 et 238 bis du CGI :', boxInner);
    doc.font('Helvetica');
    doc.text('[  ] Œuvre ou organisme d\'intérêt général   [  ] Fondation ou association reconnue d\'utilité publique', boxInner);
    doc.text('[  ] Fondation d\'entreprise   [  ] Établissement d\'enseignement supérieur ou artistique', boxInner);
    doc.text('[X] Association cultuelle ou de bienfaisance autorisée à recevoir des dons et legs', boxInner);
    doc.y = box1Y + box1H + 4;

    // === CADRE 2 : Donateur (entreprise) ===
    const box2H = 80;
    doc.rect(boxLeft, doc.y, contentWidth, box2H).stroke();
    const box2Y = doc.y + 6;
    doc.fontSize(9).font('Helvetica-Bold').text('2. DONATEUR (Entreprise)', boxInner, box2Y);
    doc.moveDown(0.2);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Raison sociale : ${donateur.companyName || donateur.nom || ''}   SIRET : ${donateur.siret || 'Non renseigné'}`, boxInner);
    doc.text(`Représentant légal : ${donateur.legalRepresentative || donateur.prenom || ''}`, boxInner);
    doc.text(`Adresse : ${donateur.adresse || 'Non renseignée'}  ${donateur.codePostal || ''} ${donateur.ville || ''}`, boxInner);
    doc.y = box2Y + box2H + 4;

    // === CADRE 3 : Don ===
    const box3H = 115;
    doc.rect(boxLeft, doc.y, contentWidth, box3H).stroke();
    const box3Y = doc.y + 6;
    doc.fontSize(9).font('Helvetica-Bold').text('3. DON', boxInner, box3Y);
    doc.moveDown(0.2);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Date du (des) versement(s) : ${don.date}     Mode de versement : ${don.mode}`, boxInner);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Montant : ${don.montant.toFixed(2)} €`, boxInner);
    doc.font('Helvetica').fontSize(8);
    doc.text(`Soit en toutes lettres : ${amountToWords(don.montant)}`, boxInner);
    doc.moveDown(0.2);
    doc.text('Nature du don : Don en numéraire', boxInner);
    doc.moveDown(0.2);
    doc.text('Forme du don :   [  ] Acte authentique   [  ] Acte sous seing privé   [X] Don manuel   [  ] Autres', boxInner);
    doc.y = box3Y + box3H + 4;

    // === CADRE 4 : Dispositif légal applicable (art. 238 bis) ===
    const box4H = 55;
    doc.rect(boxLeft, doc.y, contentWidth, box4H).stroke();
    const box4Y = doc.y + 6;
    doc.fontSize(9).font('Helvetica-Bold').text('4. DISPOSITIF LÉGAL APPLICABLE', boxInner, box4Y);
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica');
    doc.text('Le bénéficiaire certifie sur l\'honneur que les dons et versements qu\'il reçoit ouvrent droit à la réduction d\'impôt prévue à l\'article :', boxInner);
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica');
    doc.text('[  ] 200 du CGI (impôt sur le revenu)     [X] 238 bis du CGI (impôt sur les sociétés)', boxInner);
    doc.y = box4Y + box4H + 4;

    // === Mentions légales ===
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica');
    doc.text(
      'Ce don ouvre droit à une réduction d\'impôt sur les sociétés égale à 60% du montant versé, dans la limite de 20 000 € ou 5‰ du chiffre d\'affaires HT (le montant le plus élevé étant retenu). Si le montant des dons dépasse cette limite, l\'excédent est reporté sur les 5 exercices suivants.',
      boxLeft, doc.y, { width: contentWidth, align: 'justify' }
    );
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#333333');
    doc.text(
      'Le don a été effectué sans aucune contrepartie directe ou indirecte au profit du donateur.',
      boxLeft, doc.y, { width: contentWidth, align: 'center' }
    );
    doc.font('Helvetica').fillColor('#000000');

    // === BLOC SIGNATURE (bas-droite, position fixe) ===
    const sigBlockX = contentRight - 200;
    const sigBlockY = 610;

    doc.fontSize(9).font('Helvetica');
    doc.text(`Fait à ${association.ville || '[Ville]'}, le ${new Date().toLocaleDateString('fr-FR')}`, sigBlockX, sigBlockY, { width: 200, align: 'right' });
    doc.moveDown(0.3);
    doc.text(`${association.signataire || 'Le Président'}`, sigBlockX, doc.y, { width: 200, align: 'right' });
    doc.text(`${association.nomSignataire || '[Nom du signataire]'}`, sigBlockX, doc.y, { width: 200, align: 'right' });

    // Tampon (cachet image ou cachet simulé)
    const cachetY = doc.y + 4;
    const cachetX = contentRight - 140;
    const cachetSize = 100;
    if (cachetBuffer) {
      try {
        doc.image(cachetBuffer, cachetX, cachetY, { width: cachetSize, height: cachetSize });
      } catch (e) {
        console.warn('Erreur ajout cachet PDF:', e.message);
      }
    } else {
      // Cachet simulé (rond officiel) si pas d'image
      const cx = cachetX + cachetSize / 2;
      const cy = cachetY + cachetSize / 2;
      const r = cachetSize / 2;
      doc.save();
      doc.circle(cx, cy, r).lineWidth(2).stroke('#1a1a1a');
      doc.circle(cx, cy, r - 6).lineWidth(0.5).stroke('#1a1a1a');
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#1a1a1a');
      doc.text('CENTRE CULTUREL', cachetX + 10, cy - 22, { width: cachetSize - 20, align: 'center' });
      doc.text('ISLAMIQUE', cachetX + 10, doc.y, { width: cachetSize - 20, align: 'center' });
      doc.fontSize(7).font('Helvetica-Bold');
      doc.text('El Mohsinine', cachetX + 10, doc.y + 2, { width: cachetSize - 20, align: 'center' });
      doc.fontSize(5).font('Helvetica');
      doc.text('Bourg-en-Bresse', cachetX + 10, doc.y + 2, { width: cachetSize - 20, align: 'center' });
      doc.text(association.siren || 'W012004130', cachetX + 10, doc.y, { width: cachetSize - 20, align: 'center' });
      doc.restore();
      doc.fillColor('#000000');
    }

    // Signature par-dessus le tampon si disponible
    if (signatureBuffer) {
      try {
        doc.image(signatureBuffer, cachetX + 10, cachetY + 10, { width: 80, height: 40 });
      } catch (e) {
        console.warn('Erreur ajout signature PDF:', e.message);
      }
    }

    // === FOOTER (tout en bas de la page 1) ===
    doc.fontSize(6).font('Helvetica').text(
      'Document à conserver. Il vous permet de bénéficier d\'une réduction d\'impôt sur les sociétés. Ne pas joindre à la déclaration de revenus.',
      boxLeft, 790, { align: 'center', width: contentWidth }
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
    if (!userEmail) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Votre compte n\'a pas d\'email associé'
      );
    }
    if (userEmail.toLowerCase() !== email.toLowerCase()) {
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

      // Charger également les paramètres association pour signatureUrl et cachetUrl
      const associationDoc = await admin.firestore()
        .collection('settings')
        .doc('association')
        .get();

      if (associationDoc.exists) {
        const associationData = associationDoc.data();
        if (associationData.signatureUrl) {
          association.signatureUrl = associationData.signatureUrl;
        }
        if (associationData.cachetUrl) {
          association.cachetUrl = associationData.cachetUrl;
        }
        if (associationData.nomSignataire) {
          association.nomSignataire = associationData.nomSignataire;
        }
      }

      // Vérifier que le nom du signataire est configuré (obligatoire pour validité CERFA)
      if (!association.nomSignataire || !association.nomSignataire.trim()) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Le nom du signataire n\'est pas configuré. Rendez-vous dans Paramètres > Association pour le renseigner.'
        );
      }

      // 2. Récupérer les DONS de l'utilisateur pour l'année
      // IMPORTANT: Seuls les dons sont éligibles au reçu fiscal, PAS les cotisations
      // Les cotisations fixes (10€ mensuel, 100€ annuel) ne donnent pas droit à déduction
      const startDate = new Date(annee, 0, 1);
      const endDate = new Date(annee, 11, 31, 23, 59, 59);

      // Dons dans la collection donations (dons pour projets)
      // Utilise donateurEmail (champ normalisé app + webhook)
      const donationsSnapshot = await admin.firestore()
        .collection('donations')
        .where('donateurEmail', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
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
        // Filtrer : accepter status=succeeded OU statut=completed
        if (d.status !== 'succeeded' && d.statut !== 'completed') return;
        const montantDon = d.amount || d.montant || 0;
        totalDons += montantDon;
        donsDetails.push({
          date: d.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A',
          montant: montantDon,
          mode: d.modePaiement || d.metadata?.paymentMethod || 'Carte bancaire',
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
      const brevoUser = BREVO_SMTP_USER.value();
      const brevoPass = BREVO_SMTP_PASS.value();
      const fromEmail = BREVO_FROM_EMAIL.value();
      const fromName = BREVO_FROM_NAME.value();

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

      // Charger template CERFA depuis Firestore
      const cerfaTemplate = await loadEmailTemplate('annual_cerfa', {
        nom: donateurLabel || '',
        annee: String(annee),
        montant_total: totalDons.toFixed(2),
        reference: numeroRecu,
        nom_association: association.nom || 'Mosquée El Mohsinine',
      });

      let cerfaSubject, cerfaHtml;
      if (cerfaTemplate) {
        cerfaSubject = cerfaTemplate.subject;
        cerfaHtml = textToEmailHtml(cerfaTemplate.body, {
          footerAssociation: association.nom || 'Mosquée El Mohsinine',
        });
      } else {
        cerfaSubject = `Reçu fiscal ${annee} - ${association.nom || 'Mosquée El Mohsinine'}`;
        cerfaHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>Votre reçu fiscal ${annee}</h2><p>Bonjour ${donateurLabel || ''},</p><p>Veuillez trouver ci-joint votre reçu fiscal pour l'année ${annee}.</p><p><strong>Montant total des dons :</strong> ${totalDons.toFixed(2)} €</p><p><strong>Numéro du reçu :</strong> ${numeroRecu}</p><p>Qu'Allah vous récompense pour votre générosité.</p><p>${association.nom || 'Mosquée El Mohsinine'}</p></div>`;
      }

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: cerfaSubject,
        html: cerfaHtml,
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

      console.log('Reçu fiscal envoyé:', numeroRecu, 'à', email.replace(/(.{2}).*(@.*)/, '$1***$2'));

      // Copie dans messagerie interne
      try {
        await admin.firestore().collection('messages').add({
          odUserId: context.auth.uid,
          userName: `${donateur.prenom || ''} ${donateur.nom || ''}`.trim(),
          userEmail: email,
          sujet: `Reçu fiscal ${annee}`,
          message: `Bonjour ${donateurLabel || ''},\n\nVotre reçu fiscal pour l'année ${annee} a été envoyé à ${email}.\n\nMontant total des dons : ${totalDons.toFixed(2)} €\nNuméro du reçu : ${numeroRecu}\nType : ${detectedDonorType === 'entreprise' ? 'Entreprise (art. 238 bis - 60%)' : 'Particulier (art. 200 - 66%)'}\n\nQu'Allah vous récompense pour votre générosité.\nMosquée El Mohsinine`,
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

    console.log('🎉 Nouveau sympathisant:', prenom, email.replace(/(.{2}).*(@.*)/, '$1***$2'));

    try {
      // Récupérer les infos de la mosquée
      const mosqueeDoc = await admin.firestore()
        .collection('settings')
        .doc('mosqueeInfo')
        .get();

      const mosquee = mosqueeDoc.exists ? mosqueeDoc.data() : {};
      const nomMosquee = mosquee.nom || 'Mosquée El Mohsinine';
      const adresseMosquee = mosquee.adresse || '';
      const villeMosquee = mosquee.ville || 'Bourg-en-Bresse';
      const telephoneMosquee = mosquee.telephone || '';
      const emailMosquee = mosquee.email || '';

      // Configuration email Brevo
      const brevoUser = BREVO_SMTP_USER.value();
      const brevoPass = BREVO_SMTP_PASS.value();
      const fromEmail = BREVO_FROM_EMAIL.value();
      const fromName = BREVO_FROM_NAME.value() || nomMosquee;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error(`[EMAIL ERROR] Config Brevo manquante. Email non envoyé à ${email || 'inconnu'}`);
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

      // Charger le template depuis Firestore
      const template = await loadEmailTemplate('welcome_member', {
        prenom,
        nom_mosquee: nomMosquee,
      });

      let emailSubject, emailHtml;
      if (template) {
        emailSubject = template.subject;
        emailHtml = textToEmailHtml(template.body, {
          headerTitle: '🕌 Bienvenue',
          headerGradient: '#6b4423, #8b5a2b',
          footerAssociation: nomMosquee,
          footerAdresse: adresseMosquee ? `${adresseMosquee}, ${villeMosquee}` : '',
          footerTelephone: telephoneMosquee,
        });
      } else {
        // Fallback hardcodé
        emailSubject = `Bienvenue à la ${nomMosquee} !`;
        emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #6b4423 0%, #8b5a2b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="color: white; margin: 0;">🕌 Bienvenue</h1></div><div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;"><p style="font-size: 16px;">Assalamu alaykum <strong>${prenom}</strong>,</p><p style="font-size: 16px;">Bienvenue en tant que <strong>membre sympathisant</strong> de la ${nomMosquee} !</p><p style="font-size: 16px; color: #444;">Qu'Allah vous bénisse et accepte vos bonnes actions.</p><p style="font-size: 16px; color: #444;">Fraternellement,<br><strong>Le Bureau de la ${nomMosquee}</strong></p></div></div>`;
      }

      // Envoyer l'email de bienvenue
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: emailSubject,
        html: emailHtml,
      });

      console.log('✅ Email de bienvenue envoyé à', email.replace(/(.{2}).*(@.*)/, '$1***$2'));

      // Copie dans messagerie interne (ne bloque pas si erreur)
      try {
        await admin.firestore().collection('messages').add({
          odUserId: snap.id,
          userName: `${prenom} ${member.nom || ''}`.trim(),
          userEmail: email,
          sujet: 'Bienvenue à El Mohsinine',
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
      const nomMosquee = mosquee.nom || 'Mosquée El Mohsinine';

      // Configuration email
      const brevoUser = BREVO_SMTP_USER.value();
      const brevoPass = BREVO_SMTP_PASS.value();
      const fromEmail = BREVO_FROM_EMAIL.value();
      const fromName = BREVO_FROM_NAME.value() || nomMosquee;

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
          const validationTemplate = await loadEmailTemplate('membership_manual_validation', {
            prenom,
            nom_mosquee: nomMosquee,
          });

          let validationSubject, validationHtml;
          if (validationTemplate) {
            validationSubject = validationTemplate.subject;
            validationHtml = textToEmailHtml(validationTemplate.body, {
              headerTitle: '✅ Adhésion Validée',
              headerGradient: '#2e7d32, #4caf50',
              footerAssociation: nomMosquee,
            });
          } else {
            validationSubject = `🎉 Votre adhésion est validée - ${nomMosquee}`;
            validationHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="color: white; margin: 0;">✅ Adhésion Validée</h1></div><div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;"><p>Assalamu alaykum ${prenom},</p><p>Votre adhésion a été validée ! Vous êtes maintenant membre actif.</p><p>Fraternellement, Le Bureau de la ${nomMosquee}</p></div></div>`;
          }

          try {
            await transporter.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: email,
              subject: validationSubject,
              html: validationHtml,
            });
          } catch (emailError) {
            console.error('[EMAIL ERROR] validateMembership email échoué:', emailError.message);
          }
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

        // 1+2. Créer don + mettre à jour membre en batch atomique
        const batch = admin.firestore().batch();
        if (montant > 0) {
          const donRef = admin.firestore().collection('donations').doc();
          batch.set(donRef, {
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
        batch.update(memberRef, {
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
        await batch.commit();

        // 3. Envoyer email d'information
        if (transporter && email) {
          try {
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
                      Mosquée El Mohsinine - Bourg-en-Bresse
                    </p>
                  </div>
                </div>
              </div>
            `,
            });
          } catch (emailError) {
            console.error('[EMAIL ERROR] validateMembership email échoué:', emailError.message);
          }
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

      // Récupérer la date hégirien (en heure Paris pour cohérence avec le client)
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
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

      // Sauvegarder dans Firestore (clé = date Paris YYYY-MM-DD)
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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

      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
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

      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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

  // Charger également les paramètres association pour signatureUrl et cachetUrl
  const associationDoc = await admin.firestore()
    .collection('settings')
    .doc('association')
    .get();

  if (associationDoc.exists) {
    const associationData = associationDoc.data();
    if (associationData.signatureUrl) {
      association.signatureUrl = associationData.signatureUrl;
    }
    if (associationData.cachetUrl) {
      association.cachetUrl = associationData.cachetUrl;
    }
    if (associationData.nomSignataire) {
      association.nomSignataire = associationData.nomSignataire;
    }
  }

  // Vérifier que le nom du signataire est configuré (obligatoire pour validité CERFA)
  if (!association.nomSignataire || !association.nomSignataire.trim()) {
    console.error('❌ Nom du signataire non configuré — Reçus fiscaux CERFA non valides sans signature');
    return { success: false, error: 'Nom du signataire non configuré dans Paramètres > Association' };
  }

  // 2. Récupérer tous les dons de l'année
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  // Récupérer donations (sans filtre status car app=completed, webhook=succeeded)
  const donationsSnapshot = await admin.firestore()
    .collection('donations')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .get();

  // Récupérer payments avec type=don uniquement
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
    // Filtrer : accepter status=succeeded OU statut=completed
    if (d.status !== 'succeeded' && d.statut !== 'completed') return;
    // Chercher email dans tous les champs possibles (app: donateurEmail, webhook: metadata.donorEmail)
    const donorEmail = (d.donateurEmail || d.donorInfo?.email || d.metadata?.donorEmail || '').toLowerCase();
    if (!donorEmail) return;

    if (!donorMap[donorEmail]) {
      donorMap[donorEmail] = {
        total: 0,
        donsDetails: [],
        donorType: d.donorType || 'particulier',
        donorInfo: d.donorInfo || null,
      };
    }
    const montantDon = d.amount || d.montant || 0;
    donorMap[donorEmail].total += montantDon;
    donorMap[donorEmail].donsDetails.push({
      date: d.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A',
      montant: montantDon,
      mode: d.modePaiement || d.metadata?.paymentMethod || 'Carte bancaire',
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
  const brevoUser = BREVO_SMTP_USER.value();
  const brevoPass = BREVO_SMTP_PASS.value();
  const fromEmail = BREVO_FROM_EMAIL.value();
  const fromName = BREVO_FROM_NAME.value();

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

  // Bug 13 Fix: Traiter par batch de 3 en parallèle (au lieu de séquentiel)
  // Promise.allSettled = chaque erreur est isolée, pas de crash global
  // Batch de 3 pour éviter les conflits sur le compteur de numéros de reçus
  const processDonor = async (email) => {
    const donor = donorMap[email];
    if (donor.total <= 0) return 'skipped';

    // Vérifier si un reçu fiscal existe déjà pour cet email et cette année
    const existingRecu = await admin.firestore()
      .collection('recus_fiscaux')
      .where('email', '==', email)
      .where('annee', '==', year)
      .limit(1)
      .get();

    if (!existingRecu.empty) {
      console.log(`⏭️ Reçu fiscal déjà existant pour ${email} (${year}), skip`);
      return 'already_exists';
    }

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

    // Numéro de reçu (transaction atomique sur le compteur)
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

      const annualTemplate = await loadEmailTemplate('annual_cerfa', {
        nom: donateurLabel,
        annee: String(year),
        montant_total: donor.total.toFixed(2),
        reference: numeroRecu,
        nom_association: association.nom || 'Mosquée El Mohsinine',
      });

      let annualSubject, annualHtml;
      if (annualTemplate) {
        annualSubject = annualTemplate.subject;
        annualHtml = textToEmailHtml(annualTemplate.body, {
          footerAssociation: association.nom || 'Mosquée El Mohsinine',
        });
      } else {
        annualSubject = `Reçu fiscal ${year} - ${association.nom || 'Mosquée El Mohsinine'}`;
        annualHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>Votre reçu fiscal ${year}</h2><p>Bonjour ${donateurLabel},</p><p>Veuillez trouver ci-joint votre reçu fiscal pour l'année ${year}.</p><p><strong>Montant total :</strong> ${donor.total.toFixed(2)} €</p><p>Qu'Allah vous récompense.</p><p>${association.nom || 'Mosquée El Mohsinine'}</p></div>`;
      }

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: annualSubject,
        html: annualHtml,
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
      const userRecord = await admin.auth().getUserByEmail(email).catch(() => null);
      if (userRecord) {
        await admin.firestore().collection('messages').add({
          odUserId: userRecord.uid,
          userName: donor.donorType === 'entreprise'
            ? (donateur.companyName || donateur.nom || '')
            : `${donateur.prenom || ''} ${donateur.nom || ''}`.trim(),
          userEmail: email,
          sujet: `Reçu fiscal ${year}`,
          message: `Bonjour,\n\nVotre reçu fiscal pour l'année ${year} a été généré et envoyé à ${email}.\n\nMontant : ${donor.total.toFixed(2)} €\nNuméro : ${numeroRecu}\n\nMosquée El Mohsinine`,
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

    console.log(`✅ Reçu ${numeroRecu} envoyé à ${email} (${donor.total.toFixed(2)}€, ${donor.donorType})`);
    return 'success';
  };

  // Traiter par batch de 3 en parallèle
  const batchSize = 3;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(email => processDonor(email)));

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value === 'success') {
        successCount++;
      } else if (result.status === 'rejected') {
        errorCount++;
        errors.push({ email: batch[idx], error: result.reason?.message || 'Unknown error' });
        console.error(`❌ Erreur reçu pour ${batch[idx]}:`, result.reason?.message);
      }
    });
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
      // Sauvegarder le résultat pour suivi admin
      await admin.firestore().collection('settings').doc('cron_logs').set({
        lastRecusFiscauxRun: admin.firestore.FieldValue.serverTimestamp(),
        lastRecusFiscauxYear: lastYear,
        lastRecusFiscauxResult: result || {},
        lastRecusFiscauxStatus: 'success',
      }, { merge: true });
      return null;
    } catch (error) {
      console.error('❌ Erreur cron reçus fiscaux:', error);
      // Sauvegarder l'erreur pour suivi admin
      try {
        await admin.firestore().collection('settings').doc('cron_logs').set({
          lastRecusFiscauxRun: admin.firestore.FieldValue.serverTimestamp(),
          lastRecusFiscauxYear: lastYear,
          lastRecusFiscauxStatus: 'error',
          lastRecusFiscauxError: error?.message || String(error),
        }, { merge: true });
      } catch (logErr) {
        console.error('Erreur sauvegarde log cron:', logErr);
      }
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
      const brevoUser = BREVO_SMTP_USER.value();
      const brevoPass = BREVO_SMTP_PASS.value();
      const fromEmail = BREVO_FROM_EMAIL.value();
      const fromName = BREVO_FROM_NAME.value() || nomAssociation;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error(`[EMAIL ERROR] Config Brevo manquante. Email non envoyé à ${email || 'inconnu'}`);
        return null;
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: brevoUser, pass: brevoPass },
      });

      let subject, htmlContent;
      const footerOpts = {
        footerAssociation: nomAssociation,
        footerAdresse: adresseAssociation ? `${adresseAssociation}, ${codePostalAssociation} ${villeAssociation}` : '',
        footerTelephone: telephoneMosquee,
      };

      if (donorType === 'entreprise') {
        // ===== EMAIL CONFIRMATION DON ENTREPRISE =====
        const montantDeductible = (montant * 0.60).toFixed(2);
        const template = await loadEmailTemplate('donation_confirmation_company', {
          raison_sociale: companyName,
          siret,
          nom_association: nomAssociation,
          montant: montant.toFixed(2),
          date: dateStr,
          projet: projetNom,
          reference,
          montant_deductible: montantDeductible,
          annee_suivante: String(anneSuivante),
        });

        if (template) {
          subject = template.subject;
          htmlContent = textToEmailHtml(template.body, {
            headerTitle: '🏢 Reçu de don entreprise',
            headerGradient: '#1565c0, #42a5f5',
            ...footerOpts,
          });
        } else {
          subject = `Reçu de don entreprise - El Mohsinine`;
          htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #1565c0 0%, #42a5f5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="color: white; margin: 0;">🏢 Reçu de don entreprise</h1></div><div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;"><p>Salam alaykoum,</p><p>Don de ${montant.toFixed(2)} € reçu de ${companyName}.</p><p>Cordialement, Le Bureau de ${nomAssociation}</p></div></div>`;
        }
      } else {
        // ===== EMAIL CONFIRMATION DON PARTICULIER =====
        const montantDeductible = (montant * 0.66).toFixed(2);
        const template = await loadEmailTemplate('donation_confirmation_individual', {
          prenom: donorFirstName,
          nom_association: nomAssociation,
          montant: montant.toFixed(2),
          date: dateStr,
          projet: projetNom,
          reference,
          montant_deductible: montantDeductible,
          annee_suivante: String(anneSuivante),
        });

        if (template) {
          subject = template.subject;
          htmlContent = textToEmailHtml(template.body, {
            headerTitle: '🤲 Reçu de don',
            headerGradient: '#2e7d32, #4caf50',
            ...footerOpts,
          });
        } else {
          subject = `Reçu de don - El Mohsinine`;
          htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="color: white; margin: 0;">🤲 Reçu de don</h1></div><div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;"><p>Salam alaykoum ${donorFirstName},</p><p>Merci pour votre don de ${montant.toFixed(2)} €.</p><p>Barakallahou fikoum, Le Bureau de ${nomAssociation}</p></div></div>`;
        }
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
      const brevoUser = BREVO_SMTP_USER.value();
      const brevoPass = BREVO_SMTP_PASS.value();
      const fromEmail = BREVO_FROM_EMAIL.value();
      const fromName = BREVO_FROM_NAME.value() || nomAssociation;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error(`[EMAIL ERROR] Config Brevo manquante. Email non envoyé à ${email || 'inconnu'}`);
        return null;
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: brevoUser, pass: brevoPass },
      });

      // 8. Email HTML - Charger template depuis Firestore
      const template = await loadEmailTemplate('membership_confirmation', {
        prenom,
        nom_association: nomAssociation,
        montant: montant.toFixed(2),
        type_cotisation: periodLabel,
        date_debut: dateDebutStr,
        date_prochaine_echeance: prochaineEcheanceStr,
        annee_suivante: String(anneSuivante),
      });

      let subject, htmlContent;
      if (template) {
        subject = template.subject;
        htmlContent = textToEmailHtml(template.body, {
          headerTitle: '🎉 Bienvenue parmi les membres actifs',
          headerGradient: '#2e7d32, #4caf50',
          footerAssociation: nomAssociation,
          footerAdresse: adresseAssociation ? `${adresseAssociation}, ${codePostalAssociation} ${villeAssociation}` : '',
          footerTelephone: telephoneMosquee,
        });
      } else {
        subject = `Bienvenue parmi les membres actifs - El Mohsinine`;
        htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="color: white; margin: 0;">🎉 Bienvenue parmi les membres actifs</h1></div><div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;"><p>Salam alaykoum ${prenom},</p><p>Merci pour votre adhésion ! Vous êtes maintenant membre actif.</p><p>Barakallahou fikoum, Le Bureau de ${nomAssociation}</p></div></div>`;
      }

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

// ========================================================================
// REFUND PAYMENT - Rembourser un paiement via Stripe
// ========================================================================
exports.refundPayment = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // Vérifier admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux admins');
    }

    // FIX D3: Ajout paramètre amount optionnel pour remboursement partiel
    const { memberId, reason, amount } = data;
    if (!memberId) {
      throw new functions.https.HttpsError('invalid-argument', 'memberId requis');
    }

    try {
      const db = admin.firestore();
      const memberRef = db.collection('members').doc(memberId);

      // ÉTAPE 1 : Lock atomique via transaction Firestore
      let stripePaymentId;
      let memberData;
      await db.runTransaction(async (transaction) => {
        const memberDoc = await transaction.get(memberRef);
        if (!memberDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'Membre non trouvé');
        }
        memberData = memberDoc.data();
        stripePaymentId = memberData.stripePaymentId;

        if (memberData.refunded === true) {
          throw new functions.https.HttpsError(
            'already-exists',
            'Ce paiement a déjà été remboursé'
          );
        }
        if (memberData.refundProcessing === true) {
          throw new functions.https.HttpsError(
            'already-exists',
            'Un remboursement est déjà en cours'
          );
        }
        // Poser le lock immédiatement
        transaction.update(memberRef, { refundProcessing: true });
      });

      // ÉTAPE 2 : Call Stripe HORS transaction (évite double call si retry)
      let refundResult = null;
      if (stripePaymentId) {
        try {
          const refundParams = {
            payment_intent: stripePaymentId,
            reason: 'requested_by_customer',
          };
          // FIX D3: Si montant fourni, remboursement partiel
          if (amount && amount > 0) {
            refundParams.amount = Math.round(amount * 100);
          }
          refundResult = await stripe.refunds.create(refundParams);
          console.log(`💰 Remboursement Stripe effectué: ${refundResult.id} pour ${refundResult.amount / 100}€`);
        } catch (stripeError) {
          console.error('⚠️ Erreur remboursement Stripe:', stripeError.message);
          // Annuler le lock si Stripe échoue
          await memberRef.update({ refundProcessing: false });
          if (stripeError.code !== 'charge_already_refunded') {
            throw new functions.https.HttpsError('internal', `Erreur Stripe: ${stripeError.message}`);
          }
        }
      }

      // ÉTAPE 3 : Confirmer le remboursement dans Firestore
      const refundedAmount = refundResult ? refundResult.amount / 100 : 0;
      const paidAmount = memberData.montantPaye || 0;
      const isPartialRefund = amount && amount > 0 && amount < paidAmount;

      const memberUpdate = {
        refundProcessing: false,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundedBy: context.auth.uid,
        refundReason: reason || 'Annulation admin',
        refundStripeId: refundResult?.id || null,
        refundAmount: refundedAmount,
      };

      if (isPartialRefund) {
        memberUpdate.partialRefund = true;
      } else {
        memberUpdate.refunded = true;
        memberUpdate.aPaye = false;
        memberUpdate.datePaiement = null;
        memberUpdate.stripePaymentId = null;
        memberUpdate.status = 'en_attente_paiement';
        memberUpdate.statut = 'en_attente_paiement';
      }

      await memberRef.update(memberUpdate);

      // Marquer le paiement comme remboursé dans la collection payments
      if (stripePaymentId) {
        const paymentQuery = await db
          .collection('payments')
          .where('stripePaymentIntentId', '==', stripePaymentId)
          .limit(1)
          .get();

        if (!paymentQuery.empty) {
          await paymentQuery.docs[0].ref.update({
            status: isPartialRefund ? 'partially_refunded' : 'refunded',
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            refundStripeId: refundResult?.id || null,
            refundAmount: refundedAmount,
          });
        }
      }

      console.log(`✅ Remboursement effectué pour membre ${memberId}: ${refundedAmount}€ (${isPartialRefund ? 'partiel' : 'total'})`);
      return {
        success: true,
        refunded: !!refundResult,
        stripeRefundId: refundResult?.id || null,
        refundedAmount: refundedAmount,
        isPartial: isPartialRefund,
        message: stripePaymentId
          ? `Paiement Stripe remboursé${isPartialRefund ? ' partiellement' : ''} (${refundedAmount}€)`
          : 'Paiement annulé (pas de remboursement Stripe - paiement manuel)',
      };
    } catch (error) {
      console.error('❌ Erreur refundPayment:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ========================================================================
// CANCEL SUBSCRIPTION - Annuler un abonnement mensuel
// ========================================================================
exports.cancelSubscription = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }

    const uid = context.auth.uid;

    try {
      const memberRef = admin.firestore().collection('members').doc(uid);
      const memberDoc = await memberRef.get();

      if (!memberDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Profil membre non trouvé');
      }

      const memberData = memberDoc.data();
      const stripeSubscriptionId = memberData.stripeSubscriptionId;

      // Vérifier qu'il y a un abonnement mensuel actif
      // Bug 6 Fix: || au lieu de && (bloquer si PAS mensuel OU PAS de subscriptionId)
      if (memberData.cotisationType !== 'mensuel' || !stripeSubscriptionId) {
        throw new functions.https.HttpsError('failed-precondition', 'Pas d\'abonnement mensuel actif');
      }

      // Annuler l'abonnement Stripe si un ID est présent
      if (stripeSubscriptionId) {
        try {
          // Option 1: Annulation immédiate
          // await stripe.subscriptions.cancel(stripeSubscriptionId);

          // Option 2: Annulation à la fin de la période (recommandé)
          // Le membre garde l'accès jusqu'à la fin de la période payée
          await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: true,
          });

          console.log('Abonnement Stripe annulé à la fin de la période:', stripeSubscriptionId);
        } catch (stripeError) {
          console.error('Erreur annulation Stripe:', stripeError);
          // On continue quand même pour mettre à jour Firestore
          // (l'abonnement pourrait déjà être annulé côté Stripe)
        }
      }

      // BUG 3 FIX: Ne PAS changer le status immédiatement
      // Le membre garde son statut actif jusqu'à la fin de la période payée
      // Le webhook customer.subscription.deleted gèrera le passage en sympathisant
      await memberRef.update({
        abonnementActif: false,
        subscriptionCancelPending: true,
        subscriptionCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        subscriptionCancelReason: data?.reason || 'Annulé par le membre',
        // NE PAS modifier status/statut ici - le webhook s'en chargera à expiration
      });

      console.log(`✅ Abonnement mensuel annulé (fin de période) pour ${uid}`);

      // Envoyer email de confirmation d'annulation programmée immédiatement
      const cancelEmail = memberData.email;
      const cancelPrenom = memberData.prenom || memberData.nom || 'Membre';
      if (cancelEmail) {
        try {
          const brevoUser = BREVO_SMTP_USER.value();
          const brevoPass = BREVO_SMTP_PASS.value();
          const fromEmail = BREVO_FROM_EMAIL.value();
          const fromName = BREVO_FROM_NAME.value();

          if (brevoUser && brevoPass && fromEmail) {
            const cancelSettingsDoc = await admin.firestore().collection('settings').doc('association').get();
            const cancelAssocData = cancelSettingsDoc.exists ? cancelSettingsDoc.data() : {};
            const nomAssociation = cancelAssocData.nom || 'Mosquée El Mohsinine';

            const cancelTemplate = await loadEmailTemplate('cotisation_cancel_pending', {
              prenom: cancelPrenom,
              nom_association: nomAssociation,
              date: new Date().toLocaleDateString('fr-FR'),
            });

            let cancelSubject, cancelHtmlBody;
            if (cancelTemplate) {
              cancelSubject = cancelTemplate.subject;
              cancelHtmlBody = textToEmailHtml(cancelTemplate.body, {
                headerTitle: '🔔 Annulation programmée',
                headerGradient: '#f57c00, #ffb74d',
                footerAssociation: nomAssociation,
                footerAdresse: cancelAssocData.adresse ? `${cancelAssocData.adresse}, ${cancelAssocData.codePostal || ''} ${cancelAssocData.ville || ''}` : '',
                footerTelephone: cancelAssocData.telephone || '',
              });
            } else {
              cancelSubject = 'Confirmation d\'annulation programmée - ' + nomAssociation;
              cancelHtmlBody = textToEmailHtml(
                `Salam alaykoum ${cancelPrenom},\n\nNous vous confirmons que votre demande d'annulation de cotisation mensuelle a bien été prise en compte.\n\nVotre accès membre reste actif jusqu'à la fin de votre période en cours. Vous ne serez plus prélevé automatiquement après cette date.\n\nSi vous changez d'avis, vous pouvez à tout moment vous réabonner depuis l'application dans l'onglet "Adhérent".\n\nBaraka Allahou fikoum,\nL'équipe ${nomAssociation}`,
                {
                  headerTitle: '🔔 Annulation programmée',
                  headerGradient: '#f57c00, #ffb74d',
                  footerAssociation: nomAssociation,
                  footerAdresse: cancelAssocData.adresse ? `${cancelAssocData.adresse}, ${cancelAssocData.codePostal || ''} ${cancelAssocData.ville || ''}` : '',
                  footerTelephone: cancelAssocData.telephone || '',
                }
              );
            }

            const cancelTransporter = nodemailer.createTransport({
              host: 'smtp-relay.brevo.com',
              port: 587,
              secure: false,
              auth: { user: brevoUser, pass: brevoPass },
            });

            await cancelTransporter.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: cancelEmail,
              subject: cancelSubject,
              html: cancelHtmlBody,
            });

            console.log(`✅ Email annulation programmée envoyé à ${cancelEmail.substring(0, 3)}***`);
          }
        } catch (emailErr) {
          console.error('Erreur envoi email annulation programmée:', emailErr);
          // Ne pas bloquer le flux principal si l'email échoue
        }
      }

      return {
        success: true,
        message: 'Votre abonnement mensuel sera annulé à la fin de la période en cours. Vous gardez votre accès membre actif jusque-là.',
      };
    } catch (error) {
      console.error('❌ Erreur cancelSubscription:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ========================================================================
// FIX C6: ADMIN CANCEL SUBSCRIPTION - Annuler un abonnement depuis le backoffice
// ========================================================================
exports.adminCancelSubscription = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // Vérifier admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux admins');
    }

    const { memberId, reason } = data;
    if (!memberId) {
      throw new functions.https.HttpsError('invalid-argument', 'memberId requis');
    }

    try {
      const memberRef = admin.firestore().collection('members').doc(memberId);
      const memberDoc = await memberRef.get();

      if (!memberDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Membre non trouvé');
      }

      const memberData = memberDoc.data();
      const stripeSubscriptionId = memberData.stripeSubscriptionId;

      if (!stripeSubscriptionId) {
        throw new functions.https.HttpsError('failed-precondition', 'Ce membre n\'a pas d\'abonnement actif');
      }

      // Annuler immédiatement sur Stripe (pas cancel_at_period_end, car c'est l'admin qui décide)
      try {
        await stripe.subscriptions.cancel(stripeSubscriptionId);
        console.log('Abonnement Stripe annulé immédiatement par admin:', stripeSubscriptionId);
      } catch (stripeError) {
        console.error('Erreur annulation Stripe:', stripeError.message);
        // Continuer quand même pour mettre à jour Firestore
      }

      // Mettre à jour Firestore
      await memberRef.update({
        subscriptionStatus: 'canceled',
        subscriptionCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        subscriptionCancelReason: reason || 'Annulé par admin',
        subscriptionCancelledBy: 'admin',
        cancelledByAdminId: context.auth.uid,
      });

      console.log(`✅ Abonnement annulé par admin pour membre ${memberId}`);
      return {
        success: true,
        message: `Abonnement de ${memberData.prenom} ${memberData.nom} annulé`,
      };
    } catch (error) {
      console.error('❌ Erreur adminCancelSubscription:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ========================================================================
// FIX D1: REFUND DONATION - Rembourser un don via Stripe
// ========================================================================
exports.refundDonation = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // Vérifier admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux admins');
    }

    const { donationId, amount } = data; // amount optionnel pour remboursement partiel
    if (!donationId) {
      throw new functions.https.HttpsError('invalid-argument', 'donationId requis');
    }

    try {
      const db = admin.firestore();
      const donRef = db.collection('donations').doc(donationId);

      // ÉTAPE 1 : Lock atomique via transaction Firestore
      let paymentIntentId;
      let donationData;
      await db.runTransaction(async (transaction) => {
        const donDoc = await transaction.get(donRef);
        if (!donDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'Don introuvable');
        }
        donationData = donDoc.data();
        paymentIntentId = donationData.stripePaymentIntentId || donationData.paymentIntentId;

        if (!paymentIntentId) {
          throw new functions.https.HttpsError('failed-precondition', 'Pas de paiement Stripe associé à ce don');
        }

        if (donationData.statut === 'remboursé' || donationData.status === 'refunded') {
          throw new functions.https.HttpsError(
            'already-exists',
            'Ce don a déjà été remboursé'
          );
        }
        if (donationData.refundProcessing === true) {
          throw new functions.https.HttpsError(
            'already-exists',
            'Un remboursement est déjà en cours pour ce don'
          );
        }
        // Poser le lock immédiatement
        transaction.update(donRef, { refundProcessing: true });
      });

      // ÉTAPE 2 : Call Stripe HORS transaction (évite double call si retry)
      let refundResult = null;
      try {
        const refundParams = { payment_intent: paymentIntentId };
        if (amount && amount > 0) {
          refundParams.amount = Math.round(amount * 100); // remboursement partiel
        }
        refundResult = await stripe.refunds.create(refundParams);
        console.log(`💰 Remboursement don Stripe effectué: ${refundResult.id} pour ${refundResult.amount / 100}€`);
      } catch (stripeError) {
        console.error('⚠️ Erreur remboursement Stripe:', stripeError.message);
        // Annuler le lock si Stripe échoue
        await donRef.update({ refundProcessing: false });
        throw new functions.https.HttpsError('internal', `Erreur Stripe: ${stripeError.message}`);
      }

      // ÉTAPE 3 : Confirmer le remboursement dans Firestore
      const refundedAmount = refundResult.amount / 100;
      const donationTotal = donationData.amount || donationData.montant || 0;
      const isPartial = amount && amount > 0 && amount < donationTotal;

      const donationUpdate = {
        refundProcessing: false,
        status: isPartial ? 'partially_refunded' : 'refunded',
        refundId: refundResult.id,
        refundAmount: refundedAmount,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundedBy: context.auth.uid,
      };

      await donRef.update(donationUpdate);

      // Si don affecté à un projet, décrémenter montantActuel
      const projectId = donationData.projectId || donationData.projetId;
      if (projectId) {
        try {
          const projectRef = db.collection('projects').doc(projectId);
          const projectDoc = await projectRef.get();
          if (projectDoc.exists) {
            await projectRef.update({
              montantActuel: admin.firestore.FieldValue.increment(-refundedAmount),
            });
          }
        } catch (projErr) {
          console.warn('Erreur mise à jour projet:', projErr.message);
        }
      }

      console.log(`✅ Don ${donationId} remboursé: ${refundedAmount}€ (${isPartial ? 'partiel' : 'total'})`);
      return {
        success: true,
        refundId: refundResult.id,
        refundedAmount: refundedAmount,
        isPartial: isPartial,
        message: `Don remboursé${isPartial ? ' partiellement' : ''}: ${refundedAmount}€`,
      };
    } catch (error) {
      console.error('❌ Erreur refundDonation:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== CREATE ADMIN ====================
// Crée un utilisateur Firebase Auth + document admin en une seule étape
// Appelé depuis le backoffice pour simplifier la création d'administrateurs

exports.createAdmin = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Vérifier que l'appelant est un admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
    }
    const callerDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Seuls les administrateurs peuvent créer des admins');
    }
    const callerRole = callerDoc.data().role;
    if (callerRole !== 'super_admin') {
      throw new functions.https.HttpsError('permission-denied', 'Seul un super_admin peut créer des admins');
    }

    const { email, password, nom, role, permissions, actif } = data;

    if (!email || !password || !nom) {
      throw new functions.https.HttpsError('invalid-argument', 'Email, mot de passe et nom sont requis');
    }
    if (password.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'Le mot de passe doit contenir au moins 6 caractères');
    }

    try {
      // 1. Créer l'utilisateur Firebase Auth
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: nom,
      });

      console.log('Utilisateur Firebase Auth créé:', userRecord.uid);

      // 2. Créer le document admin dans Firestore avec l'UID comme ID
      await admin.firestore().collection('admins').doc(userRecord.uid).set({
        nom: nom,
        email: email,
        role: role || 'editeur',
        permissions: permissions || {},
        actif: actif !== false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: context.auth.token.email || 'admin',
      });

      console.log('Document admin créé dans Firestore:', userRecord.uid);

      return {
        success: true,
        uid: userRecord.uid,
        message: `Admin "${nom}" créé avec succès`,
      };
    } catch (error) {
      console.error('Erreur création admin:', error);
      if (error.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError('already-exists', 'Un compte avec cet email existe déjà');
      }
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== VÉRIFICATION COTISATIONS EXPIRANTES ====================
// Cron quotidien à 08h00 : vérifie les cotisations qui expirent bientôt ou déjà expirées
// Envoie des emails de rappel à 30 jours, 7 jours, et le jour de l'expiration

exports.checkExpiringCotisations = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('0 8 * * *')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    try {
      console.log('=== Vérification des cotisations expirantes ===');

      const brevoUser = BREVO_SMTP_USER.value();
      const brevoPass = BREVO_SMTP_PASS.value();
      const fromEmail = BREVO_FROM_EMAIL.value();
      const fromName = BREVO_FROM_NAME.value();

    if (!brevoUser || !brevoPass || !fromEmail) {
      console.error('[EMAIL ERROR] Config Brevo manquante. Email de rappel cotisation non envoyé');
      return null;
    }

    const settingsDoc = await admin.firestore().collection('settings').doc('association').get();
    const assocData = settingsDoc.exists ? settingsDoc.data() : {};

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    });

    // Récupérer tous les membres actifs
    const membersSnapshot = await admin.firestore()
      .collection('members')
      .where('status', 'in', ['actif'])
      .get();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let emailsSent = { remind30: 0, remind7: 0, expired: 0 };

    for (const memberDoc of membersSnapshot.docs) {
      const member = memberDoc.data();
      const dateFin = member.cotisation?.dateFin;

      if (!dateFin) continue;

      // Ne pas envoyer de rappels aux abonnés mensuels (gérés automatiquement par Stripe)
      if (member.cotisationType === 'mensuel' || member.cotisation?.type === 'mensuel') continue;

      const expiryDate = dateFin.toDate ? dateFin.toDate() : new Date(dateFin);
      const diffMs = expiryDate.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      const email = member.email;
      if (!email) continue;

      const prenom = member.prenom || '';
      const montant = member.cotisation?.montant || member.montantPaye || '';
      const dateFinStr = expiryDate.toLocaleDateString('fr-FR');

      // FIX BUG 5: Plages au lieu d'égalité stricte — le cron peut ne pas tourner pile le bon jour
      let templateId = null;
      let emailType = null;
      let reminderKey = null;

      if (diffDays >= 28 && diffDays <= 32) {
        templateId = 'cotisation_expiring_30';
        emailType = 'remind30';
        reminderKey = 'reminder_30d_sent';
      } else if (diffDays >= 5 && diffDays <= 9) {
        templateId = 'cotisation_expiring_7';
        emailType = 'remind7';
        reminderKey = 'reminder_7d_sent';
      } else if (diffDays >= -1 && diffDays <= 1) {
        templateId = 'cotisation_expired';
        emailType = 'expired';
        reminderKey = 'reminder_expired_sent';
      } else {
        continue;
      }

      // Idempotence: vérifier via flag dédié sur le doc membre
      if (member[reminderKey]) {
        continue;
      }

      // Fallback: vérifier aussi l'ancien format de clé (rétrocompatibilité)
      const legacyReminderKey = `${emailType}_${expiryDate.getFullYear()}_${expiryDate.getMonth()}_${expiryDate.getDate()}`;
      if (member[`reminder_${legacyReminderKey}`]) {
        continue;
      }

      try {
        const template = await loadEmailTemplate(templateId, {
          prenom: prenom,
          montant: String(montant) + ' €',
          date_expiration: dateFinStr,
          jours_restants: String(diffDays),
        });

        let subject, htmlBody;

        // FIX BUG 5 (suite): Utiliser emailType au lieu de diffDays exact pour le choix du template
        if (emailType === 'remind30') {
          subject = template?.subject || 'Votre cotisation expire dans 30 jours - El Mohsinine';
          const body = template?.body || `Salam alaykoum${prenom ? ' ' + prenom : ''},\n\nVotre cotisation annuelle auprès de la mosquée **El Mohsinine** expire le **${dateFinStr}**, soit dans environ **30 jours**.\n\nNous vous invitons à renouveler votre adhésion depuis l'application pour continuer à bénéficier de vos avantages de membre actif :\n\n- ✨ Multiplier vos hassanates\n- 🗳️ Droit de vote en Assemblée Générale\n- 🎫 Carte de membre digitale\n- 📄 Reçu fiscal annuel\n\nPour renouveler, ouvrez l'application El Mohsinine et rendez-vous dans l'onglet **Adhérent**.`;
          htmlBody = textToEmailHtml(body, {
            headerTitle: '📋 Rappel de cotisation',
            headerGradient: '#1565c0, #42a5f5',
            footerAssociation: assocData.nom || 'Mosquée El Mohsinine',
            footerAdresse: assocData.adresse || '',
            footerTelephone: assocData.telephone || '',
          });
        } else if (emailType === 'remind7') {
          subject = template?.subject || 'Votre cotisation expire dans 7 jours - El Mohsinine';
          const body = template?.body || `Salam alaykoum${prenom ? ' ' + prenom : ''},\n\n⚠️ Votre cotisation annuelle expire le **${dateFinStr}**, soit dans **7 jours** seulement.\n\nSans renouvellement, votre statut passera de **membre actif** à **sympathisant** et vous perdrez vos avantages (vote AG, carte membre, reçu fiscal).\n\n**Renouvelez maintenant** depuis l'application El Mohsinine → onglet **Adhérent**.`;
          htmlBody = textToEmailHtml(body, {
            headerTitle: '⚠️ Cotisation bientôt expirée',
            headerGradient: '#e65100, #ff9800',
            footerAssociation: assocData.nom || 'Mosquée El Mohsinine',
            footerAdresse: assocData.adresse || '',
            footerTelephone: assocData.telephone || '',
          });
        } else {
          subject = template?.subject || 'Votre cotisation a expiré - El Mohsinine';
          const body = template?.body || `Salam alaykoum${prenom ? ' ' + prenom : ''},\n\nVotre cotisation annuelle auprès de la mosquée **El Mohsinine** a **expiré aujourd'hui** (${dateFinStr}).\n\nVotre statut est désormais **sympathisant**. Pour redevenir membre actif et retrouver vos avantages, renouvelez votre cotisation depuis l'application.\n\nNous espérons vous revoir bientôt parmi nos membres actifs. Qu'Allah vous récompense pour votre soutien passé. 🤲`;
          htmlBody = textToEmailHtml(body, {
            headerTitle: '❌ Cotisation expirée',
            headerGradient: '#c62828, #ef5350',
            footerAssociation: assocData.nom || 'Mosquée El Mohsinine',
            footerAdresse: assocData.adresse || '',
            footerTelephone: assocData.telephone || '',
          });

          // Passer le membre en sympathisant
          await memberDoc.ref.update({
            status: 'sympathisant',
            aPaye: false,
            cotisationExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: email,
          subject: subject,
          html: htmlBody,
        });

        // Marquer le rappel comme envoyé (idempotence — nouveau format + ancien format)
        await memberDoc.ref.update({
          [reminderKey]: true,
          [`${reminderKey}_sentAt`]: admin.firestore.FieldValue.serverTimestamp(),
          // Ancien format pour rétrocompatibilité
          [`reminder_${legacyReminderKey}`]: true,
          [`reminder_${legacyReminderKey}_sentAt`]: admin.firestore.FieldValue.serverTimestamp(),
        });

        emailsSent[emailType]++;
        console.log(`Email ${emailType} envoyé à ${email.substring(0, 3)}*** (expire: ${dateFinStr})`);
      } catch (err) {
        console.error(`Erreur envoi email ${emailType}:`, err.message);
      }
    }

    console.log(`=== Résultat: 30j=${emailsSent.remind30}, 7j=${emailsSent.remind7}, expirés=${emailsSent.expired} ===`);
    return null;
    } catch (globalError) {
      console.error('[CRON ERROR] checkExpiringCotisations échoué:', globalError.message || globalError);
      return null;
    }
  });

// ==================== RÉCONCILIATION STRIPE/FIRESTORE ====================
// FIX G5: Cron hebdomadaire pour détecter les paiements Stripe non tracés dans Firestore

exports.reconcileStripePayments = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('every sunday 03:00')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    console.log('=== Réconciliation Stripe/Firestore ===');

    try {
      const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
      const startTime = Date.now();
      const mismatches = [];

      // FIX PAY3: Pagination PaymentIntents pour éviter limite 100 items
      let hasMorePI = true;
      let startingAfterPI = undefined;
      let totalPICount = 0;

      while (hasMorePI && (Date.now() - startTime < 100000)) {
        const paymentIntents = await stripe.paymentIntents.list({
          created: { gte: sevenDaysAgo },
          limit: 100,
          ...(startingAfterPI && { starting_after: startingAfterPI })
        });

        totalPICount += paymentIntents.data.length;

        for (const pi of paymentIntents.data) {
          if (pi.status !== 'succeeded') continue;

          // Vérifier si ce paiement existe dans Firestore (donations OU payments OU processed_payments)
          const [donSnap, paySnap, processedSnap] = await Promise.all([
            admin.firestore().collection('donations').where('stripePaymentIntentId', '==', pi.id).limit(1).get(),
            admin.firestore().collection('payments').where('stripePaymentIntentId', '==', pi.id).limit(1).get(),
            admin.firestore().collection('processed_payments').doc(pi.id).get(),
          ]);

          // Vérifier aussi par docId (donations/{paymentIntentId})
          let donByDocId = { exists: false };
          try {
            donByDocId = await admin.firestore().collection('donations').doc(pi.id).get();
          } catch (e) { /* ignore */ }

          if (donSnap.empty && paySnap.empty && !processedSnap.exists && !donByDocId.exists) {
            mismatches.push({
              paymentIntentId: pi.id,
              amount: pi.amount / 100,
              currency: pi.currency,
              created: new Date(pi.created * 1000).toLocaleDateString('fr-FR'),
              metadata: pi.metadata,
            });
          }
        }

        hasMorePI = paymentIntents.has_more;
        if (paymentIntents.data.length > 0) {
          startingAfterPI = paymentIntents.data[paymentIntents.data.length - 1].id;
        }
      }

      // FIX PAY3: Pagination Invoices pour éviter limite 100 items
      let hasMoreInv = true;
      let startingAfterInv = undefined;
      let totalInvCount = 0;

      while (hasMoreInv && (Date.now() - startTime < 100000)) {
        const invoices = await stripe.invoices.list({
          created: { gte: sevenDaysAgo },
          status: 'paid',
          limit: 100,
          ...(startingAfterInv && { starting_after: startingAfterInv })
        });

        totalInvCount += invoices.data.length;

        for (const inv of invoices.data) {
          if (!inv.payment_intent) continue;

          const [donSnap, paySnap] = await Promise.all([
            admin.firestore().collection('donations').where('stripePaymentIntentId', '==', inv.payment_intent).limit(1).get(),
            admin.firestore().collection('payments').where('stripePaymentIntentId', '==', inv.payment_intent).limit(1).get(),
          ]);

          if (donSnap.empty && paySnap.empty) {
            // Vérifier que ce n'est pas déjà dans les mismatches
            if (!mismatches.find(m => m.paymentIntentId === inv.payment_intent)) {
              mismatches.push({
                paymentIntentId: inv.payment_intent,
                invoiceId: inv.id,
                amount: inv.amount_paid / 100,
                currency: inv.currency,
                created: new Date(inv.created * 1000).toLocaleDateString('fr-FR'),
                metadata: inv.subscription ? { source: 'subscription', subscriptionId: inv.subscription } : {},
              });
            }
          }
        }

        hasMoreInv = invoices.has_more;
        if (invoices.data.length > 0) {
          startingAfterInv = invoices.data[invoices.data.length - 1].id;
        }
      }

      console.log(`Réconciliation terminée: ${totalPICount} PI + ${totalInvCount} invoices vérifiés, ${mismatches.length} décalages`);

      // 4. Si des décalages trouvés, envoyer email alerte admin
      if (mismatches.length > 0) {
        console.error('⚠️ RECONCILIATION MISMATCH:', JSON.stringify(mismatches));

        const brevoUser = BREVO_SMTP_USER.value();
        const brevoPass = BREVO_SMTP_PASS.value();
        const fromEmail = BREVO_FROM_EMAIL.value();
        const fromName = BREVO_FROM_NAME.value();

        if (brevoUser && brevoPass && fromEmail) {
          const reconTransporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: { user: brevoUser, pass: brevoPass },
          });

          const rows = mismatches.map(m => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${m.paymentIntentId}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${m.amount} ${m.currency?.toUpperCase() || 'EUR'}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${m.created}</td>
            </tr>
          `).join('');

          await reconTransporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: fromEmail,
            subject: `⚠️ RÉCONCILIATION — ${mismatches.length} paiement(s) Stripe non trouvé(s) dans Firestore`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #ff9800, #f57c00); padding: 20px; text-align: center;">
                  <h1 style="color: white; margin: 0;">⚠️ Réconciliation hebdomadaire</h1>
                </div>
                <div style="padding: 20px; background: #fff;">
                  <p><strong>${mismatches.length} paiement(s) trouvé(s) dans Stripe mais absents de Firestore</strong> (7 derniers jours).</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr style="background: #f5f5f5;">
                      <th style="padding: 8px; border: 1px solid #ddd;">PaymentIntent ID</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Montant</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Date</th>
                    </tr>
                    ${rows}
                  </table>
                  <p>Cela peut indiquer un webhook qui a échoué silencieusement. Vérifiez dans le Dashboard Stripe.</p>
                  <a href="https://dashboard.stripe.com/payments" style="display: inline-block; padding: 10px 20px; background: #ff9800; color: white; text-decoration: none; border-radius: 5px;">
                    Voir les paiements Stripe
                  </a>
                </div>
              </div>
            `,
          });
          console.log('Email réconciliation envoyé à l\'admin');
        }
      } else {
        console.log('✅ Aucun décalage détecté — Stripe et Firestore sont synchronisés');
      }
    } catch (error) {
      console.error('❌ Erreur réconciliation:', error);
    }

    return null;
  });

// ========================================================================
// DELETE MEMBER BY ADMIN - Suppression membre (RGPD)
// - Données financières (donations, payments, recus_fiscaux) : ANONYMISÉES (comptabilité préservée)
// - Données personnelles (messages, member doc, Auth) : SUPPRIMÉES
// - Stripe : abonnement annulé
// ========================================================================
exports.deleteMemberByAdmin = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // 1. Vérifier authentification + admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }

    const adminUid = context.auth.uid;
    const adminCheck = await isAdmin(adminUid);
    if (!adminCheck) {
      throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs');
    }

    const { memberId } = data;
    if (!memberId || typeof memberId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'memberId requis');
    }

    console.log(`=== SUPPRESSION MEMBRE ${memberId} par admin ${adminUid} ===`);

    const db = admin.firestore();
    const log = {
      memberId,
      adminUid,
      deletedAt: new Date().toISOString(),
      steps: [],
    };

    try {
      // 2. Récupérer le document membre
      const memberRef = db.collection('members').doc(memberId);
      const memberDoc = await memberRef.get();

      if (!memberDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Membre non trouvé');
      }

      const memberData = memberDoc.data();
      log.memberName = `${memberData.prenom || ''} ${memberData.nom || ''}`.trim();
      log.memberEmail = memberData.email || '';
      const memberUid = memberData.uid || memberId;

      // 3. Annuler l'abonnement Stripe si actif
      const stripeSubscriptionId = memberData.stripeSubscriptionId;
      if (stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(stripeSubscriptionId);
          log.steps.push({ action: 'stripe_subscription_cancelled', id: stripeSubscriptionId });
          console.log(`Abonnement Stripe annulé: ${stripeSubscriptionId}`);
        } catch (stripeErr) {
          log.steps.push({ action: 'stripe_subscription_cancel_skipped', reason: stripeErr.message });
          console.warn(`Abonnement Stripe déjà annulé ou erreur: ${stripeErr.message}`);
        }
      } else {
        log.steps.push({ action: 'stripe_subscription_none' });
      }

      // 4. ANONYMISER les données financières (préserve les montants pour la comptabilité)
      const anonymizeLabel = 'Membre supprimé';

      // 4a. Anonymiser donations (garder montant, date, projet — effacer identité)
      try {
        const donSnap = await db.collection('donations')
          .where('userId', '==', memberUid)
          .get();

        if (!donSnap.empty) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;

          donSnap.docs.forEach((doc) => {
            batch.update(doc.ref, {
              donateur: anonymizeLabel,
              email: '',
              telephone: '',
              donateurEmail: '',
              userId: 'deleted',
              anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            count++;
            if (count % 500 === 0) {
              chunks.push(batch);
              batch = db.batch();
            }
          });
          chunks.push(batch);

          for (const b of chunks) {
            await b.commit();
          }

          log.steps.push({ action: 'anonymized_donations', count: donSnap.size });
          console.log(`${donSnap.size} donation(s) anonymisée(s)`);
        } else {
          log.steps.push({ action: 'anonymized_donations', count: 0 });
        }
      } catch (err) {
        log.steps.push({ action: 'error_donations', error: err.message });
        console.error('Erreur anonymisation donations:', err.message);
      }

      // 4b. Anonymiser payments (garder montant, date, type — effacer identité)
      try {
        const paySnap = await db.collection('payments')
          .where('metadata.memberId', '==', memberUid)
          .get();

        if (!paySnap.empty) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;

          paySnap.docs.forEach((doc) => {
            const docData = doc.data();
            batch.update(doc.ref, {
              membreNom: anonymizeLabel,
              email: '',
              userId: 'deleted',
              metadata: {
                ...docData.metadata,
                memberId: 'deleted',
                memberName: anonymizeLabel,
                memberEmail: '',
              },
              anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            count++;
            if (count % 500 === 0) {
              chunks.push(batch);
              batch = db.batch();
            }
          });
          chunks.push(batch);

          for (const b of chunks) {
            await b.commit();
          }

          log.steps.push({ action: 'anonymized_payments', count: paySnap.size });
          console.log(`${paySnap.size} paiement(s) anonymisé(s)`);
        } else {
          log.steps.push({ action: 'anonymized_payments', count: 0 });
        }
      } catch (err) {
        log.steps.push({ action: 'error_payments', error: err.message });
        console.error('Erreur anonymisation payments:', err.message);
      }

      // 4c. Anonymiser reçus fiscaux (garder montant, année — effacer identité)
      try {
        const recuSnap = await db.collection('recus_fiscaux')
          .where('userId', '==', memberUid)
          .get();

        if (!recuSnap.empty) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;

          recuSnap.docs.forEach((doc) => {
            batch.update(doc.ref, {
              nom: anonymizeLabel,
              prenom: '',
              email: '',
              adresse: '',
              userId: 'deleted',
              anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            count++;
            if (count % 500 === 0) {
              chunks.push(batch);
              batch = db.batch();
            }
          });
          chunks.push(batch);

          for (const b of chunks) {
            await b.commit();
          }

          log.steps.push({ action: 'anonymized_recus_fiscaux', count: recuSnap.size });
          console.log(`${recuSnap.size} reçu(s) fiscal(aux) anonymisé(s)`);
        } else {
          log.steps.push({ action: 'anonymized_recus_fiscaux', count: 0 });
        }
      } catch (err) {
        log.steps.push({ action: 'error_recus_fiscaux', error: err.message });
        console.error('Erreur anonymisation recus_fiscaux:', err.message);
      }

      // 5. SUPPRIMER les messages (pas de valeur comptable)
      try {
        const msgSnap = await db.collection('messages')
          .where('odUserId', '==', memberUid)
          .get();

        if (!msgSnap.empty) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;

          msgSnap.docs.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
            if (count % 500 === 0) {
              chunks.push(batch);
              batch = db.batch();
            }
          });
          chunks.push(batch);

          for (const b of chunks) {
            await b.commit();
          }

          log.steps.push({ action: 'deleted_messages', count: msgSnap.size });
          console.log(`${msgSnap.size} message(s) supprimé(s)`);
        } else {
          log.steps.push({ action: 'deleted_messages', count: 0 });
        }
      } catch (err) {
        log.steps.push({ action: 'error_messages', error: err.message });
        console.error('Erreur suppression messages:', err.message);
      }

      // 6. Supprimer le document membre
      await memberRef.delete();
      log.steps.push({ action: 'member_doc_deleted' });
      console.log('Document membre supprimé');

      // 7. Supprimer l'utilisateur Firebase Auth
      if (memberUid) {
        try {
          await admin.auth().deleteUser(memberUid);
          log.steps.push({ action: 'auth_user_deleted', uid: memberUid });
          console.log(`Utilisateur Auth supprimé: ${memberUid}`);
        } catch (authErr) {
          log.steps.push({ action: 'auth_user_delete_skipped', reason: authErr.message });
          console.warn(`Auth user non trouvé ou erreur: ${authErr.message}`);
        }
      }

      // 8. Log RGPD — Enregistrer la trace de suppression
      await db.collection('deletion_logs').add({
        ...log,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Log RGPD enregistré');

      console.log(`=== SUPPRESSION MEMBRE ${memberId} TERMINÉE ===`);

      return {
        success: true,
        message: `Membre ${log.memberName} supprimé. Données financières anonymisées (comptabilité préservée).`,
        details: log.steps,
      };
    } catch (error) {
      console.error('❌ Erreur deleteMemberByAdmin:', error);

      log.steps.push({ action: 'FAILED', error: error.message });
      try {
        await db.collection('deletion_logs').add({
          ...log,
          failed: true,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (logErr) {
        console.error('Erreur log RGPD:', logErr);
      }

      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== DELETE MY ACCOUNT (SELF-SERVICE RGPD) ====================
exports.deleteMyAccount = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // 1. Auth obligatoire
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }
    const uid = context.auth.uid;
    console.log(`=== AUTO-SUPPRESSION COMPTE ${uid} ===`);

    const db = admin.firestore();
    const log = {
      uid,
      selfDeletion: true,
      deletedAt: new Date().toISOString(),
      steps: [],
    };

    try {
      // 2. Trouver le document membre par uid
      const memberSnap = await db.collection('members')
        .where('uid', '==', uid).limit(1).get();

      let memberRef = null;
      let memberData = null;

      if (!memberSnap.empty) {
        memberRef = memberSnap.docs[0].ref;
        memberData = memberSnap.docs[0].data();
        log.memberName = `${memberData.prenom || ''} ${memberData.nom || ''}`.trim();
      } else {
        const directRef = db.collection('members').doc(uid);
        const directDoc = await directRef.get();
        if (directDoc.exists) {
          memberRef = directRef;
          memberData = directDoc.data();
          log.memberName = `${memberData.prenom || ''} ${memberData.nom || ''}`.trim();
        } else {
          log.steps.push({ action: 'no_member_doc_found' });
        }
      }

      // 3. Annuler abonnement Stripe si actif
      if (memberData && memberData.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(memberData.stripeSubscriptionId);
          log.steps.push({ action: 'stripe_subscription_cancelled', id: memberData.stripeSubscriptionId });
        } catch (stripeErr) {
          log.steps.push({ action: 'stripe_subscription_cancel_skipped', reason: stripeErr.message });
        }
      }

      const anonymizeLabel = 'Membre supprimé';

      // 4a. Anonymiser donations
      try {
        const donSnap = await db.collection('donations').where('userId', '==', uid).get();
        if (!donSnap.empty) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;
          donSnap.docs.forEach((doc) => {
            batch.update(doc.ref, {
              donateur: anonymizeLabel, email: '', telephone: '', donateurEmail: '',
              userId: 'deleted', anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            count++;
            if (count % 500 === 0) { chunks.push(batch); batch = db.batch(); }
          });
          chunks.push(batch);
          for (const b of chunks) { await b.commit(); }
          log.steps.push({ action: 'anonymized_donations', count: donSnap.size });
        }
      } catch (err) {
        log.steps.push({ action: 'error_donations', error: err.message });
      }

      // 4b. Anonymiser payments
      try {
        const paySnap = await db.collection('payments').where('metadata.memberId', '==', uid).get();
        if (!paySnap.empty) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;
          paySnap.docs.forEach((doc) => {
            const docData = doc.data();
            batch.update(doc.ref, {
              membreNom: anonymizeLabel, email: '', userId: 'deleted',
              metadata: { ...docData.metadata, memberId: 'deleted', memberName: anonymizeLabel, memberEmail: '' },
              anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            count++;
            if (count % 500 === 0) { chunks.push(batch); batch = db.batch(); }
          });
          chunks.push(batch);
          for (const b of chunks) { await b.commit(); }
          log.steps.push({ action: 'anonymized_payments', count: paySnap.size });
        }
      } catch (err) {
        log.steps.push({ action: 'error_payments', error: err.message });
      }

      // 4c. Anonymiser messages (ne pas supprimer, anonymiser)
      try {
        const msgSnap = await db.collection('messages').where('userId', '==', uid).get();
        if (!msgSnap.empty) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;
          msgSnap.docs.forEach((doc) => {
            batch.update(doc.ref, {
              senderName: anonymizeLabel, userId: 'deleted',
              anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            count++;
            if (count % 500 === 0) { chunks.push(batch); batch = db.batch(); }
          });
          chunks.push(batch);
          for (const b of chunks) { await b.commit(); }
          log.steps.push({ action: 'anonymized_messages', count: msgSnap.size });
        }
      } catch (err) {
        log.steps.push({ action: 'error_messages', error: err.message });
      }

      // 5. Supprimer photo de profil dans Storage
      try {
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({ prefix: `members/${uid}/` });
        for (const file of files) {
          await file.delete();
        }
        if (files.length > 0) {
          log.steps.push({ action: 'storage_files_deleted', count: files.length });
        }
      } catch (err) {
        log.steps.push({ action: 'error_storage', error: err.message });
      }

      // 6. Supprimer le document membre
      if (memberRef) {
        await memberRef.delete();
        log.steps.push({ action: 'member_doc_deleted' });
      }

      // 7. Supprimer l'utilisateur Firebase Auth
      try {
        await admin.auth().deleteUser(uid);
        log.steps.push({ action: 'auth_user_deleted' });
      } catch (authErr) {
        log.steps.push({ action: 'auth_user_delete_error', reason: authErr.message });
      }

      // 8. Log RGPD
      await db.collection('deletion_logs').add({
        ...log,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`=== AUTO-SUPPRESSION ${uid} TERMINÉE ===`);
      return { success: true, message: 'Votre compte a été supprimé avec succès.' };

    } catch (error) {
      console.error('❌ Erreur deleteMyAccount:', error);
      log.steps.push({ action: 'FAILED', error: error.message });
      try {
        await db.collection('deletion_logs').add({
          ...log, failed: true,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (logErr) {
        console.error('Erreur log RGPD (self):', logErr);
      }
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ==================== RGPD — Export données utilisateur ====================
exports.exportMyData = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Connexion requise');
    }
    const uid = context.auth.uid;
    const db = admin.firestore();

    const [memberDoc, donationsSnap, paymentsSnap, messagesSnap] = await Promise.all([
      db.collection('members').doc(uid).get(),
      db.collection('donations').where('userId', '==', uid).get(),
      db.collection('payments').where('metadata.memberId', '==', uid).get(),
      db.collection('messages').where('odUserId', '==', uid).get(),
    ]);

    const sanitizeTimestamp = (val) => {
      if (!val) return null;
      if (val.toDate) return val.toDate().toISOString();
      return val;
    };

    const sanitizeDoc = (doc) => {
      const d = doc.data();
      const result = { id: doc.id };
      for (const [key, val] of Object.entries(d)) {
        result[key] = sanitizeTimestamp(val);
      }
      return result;
    };

    return {
      exportedAt: new Date().toISOString(),
      profil: memberDoc.exists ? sanitizeDoc(memberDoc) : {},
      donations: donationsSnap.docs.map(sanitizeDoc),
      paiements: paymentsSnap.docs.map(sanitizeDoc),
      messages: messagesSnap.docs.map(sanitizeDoc),
    };
  });

