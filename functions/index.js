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

// ─── Helper logging erreurs serveur vers errors_log ────────────────────────
async function logServerError(message, context, extra = {}) {
  try {
    await admin.firestore().collection('errors_log').add({
      message: String(message).slice(0, 500),
      stack: extra.stack ? String(extra.stack).slice(0, 500) : '',
      context,
      screen: 'CloudFunction',
      uid: extra.uid ?? 'server',
      alerted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (_) {}
}

// ==================== PARAMÈTRES (migration functions.config → defineString) ====================
const STRIPE_SECRET_KEY = defineString('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineString('STRIPE_WEBHOOK_SECRET');
// OpenAI key optionnelle — via .env ou firebase functions:secrets:set
const OPENAI_API_KEY_ENV = process.env.OPENAI_API_KEY || '';
const MISTRAL_API_KEY_ENV = process.env.MISTRAL_API_KEY || '';
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER || '';
const BREVO_SMTP_PASS = process.env.BREVO_SMTP_PASS || '';
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || '';
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Mosquée El Mouhssinine';

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
 * Masque un email pour les logs (RGPD/hygiène)
 * @param {string} email
 * @returns {string} ex: "fa***@gm***.com"
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '***';
  return email.replace(/(.{2}).*(@.*)/, '$1***$2');
};

/**
 * Vérifie si l'utilisateur est admin
 * @param {string} uid - L'ID de l'utilisateur Firebase Auth
 * @returns {Promise<boolean>}
 */
const isAdmin = async (uid) => {
  if (!uid) return false;
  try {
    const adminDoc = await admin.firestore().collection('admins').doc(uid).get();
    if (!adminDoc.exists) return false;
    return adminDoc.data()?.actif === true;
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
 * Crée une notification backoffice temps réel
 * @param {Object} params
 * @param {string} params.type - Type de notification
 * @param {string} params.titre - Titre affiché
 * @param {string} params.message - Message détaillé
 * @param {string|null} params.membreId - UID membre concerné
 * @param {string|null} params.membreNom - Nom du membre
 * @param {number|null} params.montant - Montant en euros
 */
const createNotifBO = async ({ type, titre, message, membreId = null, membreNom = null, montant = null }) => {
  try {
    await admin.firestore().collection('notifications_bo').add({
      type,
      titre,
      message,
      membreId,
      membreNom,
      montant,
      lu: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[NotifBO] Erreur création notif:', e.message);
    // Ne jamais bloquer le flux principal
  }
};

/**
 * Envoie un push aux ADMINS actifs (patron + équipe) sur leurs appareils.
 * Utilisé pour les événements business (don reçu, etc.). Ne bloque jamais le flux.
 */
const sendPushToAdmins = async (title, body, data = {}, apnsOptions = {}) => {
  try {
    const adminsSnap = await admin.firestore().collection('admins').where('actif', '==', true).get();
    if (adminsSnap.empty) return;
    const adminIds = adminsSnap.docs.map((d) => d.id);
    const tokens = [];
    for (let i = 0; i < adminIds.length; i += 30) {
      const batchIds = adminIds.slice(i, i + 30);
      const membersSnap = await admin.firestore()
        .collection('members')
        .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
        .get();
      membersSnap.docs.forEach((mDoc) => {
        const md = mDoc.data();
        if (Array.isArray(md.fcmTokens)) tokens.push(...md.fcmTokens);
        else if (md.fcmToken) tokens.push(md.fcmToken);
      });
    }
    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) {
      console.log('[PushAdmins] Aucun token admin — skip (normal si app non installée)');
      return;
    }
    const apsPayload = { sound: 'default', badge: 1 };
    if (apnsOptions.category) apsPayload.category = apnsOptions.category;
    if (apnsOptions.threadId) apsPayload['thread-id'] = apnsOptions.threadId;
    const response = await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title, body },
      data: { ...data },
      apns: { payload: { aps: apsPayload } },
      android: { priority: 'high' },
    });
    console.log(`[PushAdmins] Push envoyé à ${uniqueTokens.length} appareil(s) admin`);
    // Nettoyage des tokens FCM invalides (sinon accumulation indéfinie)
    const invalidAdminTokens = [];
    response.responses.forEach((resp, i) => {
      if (!resp.success) {
        const code = resp.error && resp.error.code;
        if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
          invalidAdminTokens.push(uniqueTokens[i]);
        }
      }
    });
    if (invalidAdminTokens.length > 0) {
      await Promise.all(adminIds.map((id) =>
        admin.firestore().collection('members').doc(id)
          .update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidAdminTokens) })
          .catch(() => {})
      ));
      console.log(`[PushAdmins] ${invalidAdminTokens.length} token(s) invalide(s) nettoyé(s)`);
    }
  } catch (err) {
    console.log('[PushAdmins] Push admin non envoyé:', err.message);
  }
};

/**
 * Envoie une notification push à un membre via ses tokens FCM (multi-device)
 * Supporte le fallback depuis l'ancien champ fcmToken (string) vers fcmTokens (array)
 * Auto-cleanup des tokens invalides
 * @param {string} uid - L'ID du document membre
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {Object} data - Données supplémentaires (optionnel)
 */
/**
 * Écrit une notification dans le centre de notifications (Firestore).
 * target = { uid } pour un utilisateur précis, ou { audience: 'all' } pour un broadcast.
 * Permet à l'app mobile d'afficher l'historique des notifs même app fermée (contourne limite iOS).
 */
const writeUserNotif = async (target, { title, body, type = 'other', data = {} }) => {
  try {
    await admin.firestore().collection('user_notifications').add({
      userId: target.uid || null,
      audience: target.audience || (target.uid ? 'user' : 'all'),
      title: title || '',
      body: body || '',
      type,
      data: data || {},
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('writeUserNotif error:', e.message);
  }
};

const sendPushToMember = async (uid, title, body, data = {}, apnsOptions = {}) => {
  if (!uid) return;
  try {
    const memberDoc = await admin.firestore().collection('members').doc(uid).get();
    if (!memberDoc.exists) return;

    // Centre de notifications in-app : enregistrer la notif (visible même app fermée)
    await writeUserNotif({ uid }, { title, body, type: data.type || 'other', data });

    const memberData = memberDoc.data();
    // Multi-device: utiliser fcmTokens (array) avec fallback fcmToken (string rétrocompat)
    let tokens = [];
    if (Array.isArray(memberData.fcmTokens) && memberData.fcmTokens.length > 0) {
      tokens = [...memberData.fcmTokens];
    } else if (memberData.fcmToken) {
      tokens = [memberData.fcmToken];
    }

    if (tokens.length === 0) {
      // Condition NORMALE (membre sans app / notifs non activées / donateur web).
      // Le centre de notifs in-app a déjà enregistré la notif via writeUserNotif.
      // -> simple log, surtout pas une alerte bug.
      console.log(`[FCM] Pas de token pour ${uid.substring(0, 8)}... (${title}) — notif in-app uniquement`);
      return;
    }

    // Build APNs payload with category/thread-id/interruption-level support
    const apsPayload = {
      sound: apnsOptions.sound || 'default',
      badge: 1,
    };
    if (apnsOptions.category) apsPayload.category = apnsOptions.category;
    if (apnsOptions.threadId) apsPayload['thread-id'] = apnsOptions.threadId;
    if (apnsOptions.interruptionLevel) apsPayload['interruption-level'] = apnsOptions.interruptionLevel;

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { ...data },
      apns: {
        payload: {
          aps: apsPayload,
        },
      },
    });

    // Auto-cleanup tokens invalides
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await admin.firestore().collection('members').doc(uid).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
      console.log(`[FCM] ${invalidTokens.length} token(s) invalide(s) nettoyé(s) pour ${uid.substring(0, 8)}...`);
    }
  } catch (err) {
    console.log(`[FCM] Push non envoyé à ${uid.substring(0, 8)}...:`, err.message);
  }
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
        <h1 style="color: white; margin: 0;">${escapeHtml(headerTitle)}</h1>
      </div>`;
  }

  let footerHtml = '';
  if (footerAssociation) {
    footerHtml = `
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <div style="font-size: 13px; color: #888; text-align: center;">
        <p style="margin: 5px 0;"><strong>${escapeHtml(footerAssociation)}</strong></p>
        ${footerAdresse ? `<p style="margin: 5px 0;">📍 ${escapeHtml(footerAdresse)}</p>` : ''}
        ${footerTelephone ? `<p style="margin: 5px 0;">📞 ${escapeHtml(footerTelephone)}</p>` : ''}
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
    const docId = context.params.announcementId;
    console.log('Nouvelle annonce créée:', docId, '- actif:', announcement.actif);

    if (!announcement.actif) {
      console.log('Annonce inactive, pas de notification push');
      return null;
    }

    const title = '🕌 ' + (announcement.titre || 'Nouvelle annonce');
    const fullBody = String(announcement.contenu || announcement.message || '').slice(0, 1000);
    const body = truncate(fullBody, 150);

    const message = {
      notification: { title, body },
      data: { type: 'announcement', id: docId, fullBody },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: 'ANNOUNCEMENT',
            'thread-id': 'announcements',
          },
        },
      },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'announcements' },
      },
      topic: 'announcements',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification annonce envoyée:', response);
      await writeUserNotif({ audience: 'all' }, { title, body: String(announcement.contenu || announcement.message || '').slice(0, 2000), type: 'announcement', data: { type: 'announcement', id: docId } });

      await snap.ref.update({
        notificationSent: true,
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await admin.firestore().collection('notifications_history').add({
        titre: title,
        message: body,
        topic: 'announcements',
        type: 'auto_announcement',
        envoyeePar: 'system',
        envoyeeA: new Date(),
        messageId: response,
      });
    } catch (error) {
      console.error('Erreur notification annonce:', error);
    }

    return null;
  });

// ==================== NOTIFICATION ÉVÉNEMENT ====================
// Trigger : quand un nouvel événement est créé

exports.onNewEvent = functions
  .region('europe-west1')
  .firestore
  .document('events/{eventId}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const docId = context.params.eventId;
    console.log('Nouvel événement créé:', docId, '- actif:', event.actif);

    if (!event.actif) {
      console.log('Événement inactif, pas de notification push');
      return null;
    }

    const title = '📅 ' + (event.titre || 'Nouvel événement');
    const fullBody = String(event.description || event.contenu || '').slice(0, 1000);
    const body = truncate(fullBody, 150);

    const message = {
      notification: { title, body },
      data: { type: 'event', id: docId, fullBody },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: 'EVENT',
            'thread-id': 'events',
          },
        },
      },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'events' },
      },
      topic: 'events',
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification événement envoyée:', response);
      await writeUserNotif({ audience: 'all' }, { title, body: String(event.description || event.contenu || '').slice(0, 2000), type: 'event', data: { type: 'event', id: docId } });

      await snap.ref.update({
        notificationSent: true,
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await admin.firestore().collection('notifications_history').add({
        titre: title,
        message: body,
        topic: 'events',
        type: 'auto_event',
        envoyeePar: 'system',
        envoyeeA: new Date(),
        messageId: response,
      });
    } catch (error) {
      console.error('Erreur notification événement:', error);
    }

    return null;
  });

// ==================== NOTIFICATION JANAZA ====================
// Trigger : quand une nouvelle Salat Janaza est créée (URGENT)

// Helper partage : envoie le push janaza vers le topic + ecrit l'historique.
// Pose un garde idempotent via notificationSent (evite tout double envoi /
// toute recursion sur le onUpdate ci-dessous).
async function sendJanazaPush(ref, docId, janaza) {
  const title = '🕌 Salat Janaza' + (janaza.nomDefunt ? ' — ' + janaza.nomDefunt : '');
  const bodyParts = [];
  if (janaza.nomDefunt) bodyParts.push(janaza.nomDefunt);
  if (janaza.heurePriere) bodyParts.push('à ' + janaza.heurePriere);
  if (janaza.lieu) bodyParts.push(janaza.lieu);
  const fullBody = bodyParts.length > 0 ? bodyParts.join(' · ') : 'Un avis de Janaza a été publié';

  const message = {
    notification: { title, body: truncate(fullBody, 150) },
    data: { type: 'janaza', id: docId, fullBody },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          category: 'JANAZA',
          'thread-id': 'janaza',
          'interruption-level': 'time-sensitive',
        },
      },
    },
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'janaza_channel' },
    },
    topic: 'janaza',
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification janaza envoyée:', response);
    await writeUserNotif({ audience: 'all' }, { title, body: String(fullBody).slice(0, 2000), type: 'janaza', data: { type: 'janaza', id: docId } });

    await ref.update({
      notificationSent: true,
      notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.firestore().collection('notifications_history').add({
      titre: title,
      message: fullBody,
      topic: 'janaza',
      type: 'auto_janaza',
      envoyeePar: 'system',
      envoyeeA: new Date(),
      messageId: response,
    });
  } catch (error) {
    console.error('Erreur notification janaza:', error);
  }
}

exports.onNewJanaza = functions
  .region('europe-west1')
  .firestore
  .document('janaza/{janazaId}')
  .onCreate(async (snap, context) => {
    const janaza = snap.data();
    const docId = context.params.janazaId;
    console.log('Nouvelle janaza créée:', docId, '- actif:', janaza.actif);

    await createNotifBO({
      type: 'janaza',
      titre: '🕌 Avis de Janaza',
      message: `Un avis de Janaza a été publié${janaza.nomDefunt ? ' (' + janaza.nomDefunt + ')' : ''}`,
    });

    if (!janaza.actif) {
      console.log('Janaza inactive, pas de notification push');
      return null;
    }

    await sendJanazaPush(snap.ref, docId, janaza);
    return null;
  });

// Trigger : quand une janaza existante est ACTIVEE (actif false -> true).
// Couvre le cas "creee en masque puis affichee", ou editee/republiee :
// onCreate ne se declenche pas sur un update, donc la notif n'etait jamais
// envoyee. Le garde notificationSent !== true evite tout double envoi et
// toute recursion (l'update notificationSent=true repasse ici mais sort).
exports.onJanazaActivated = functions
  .region('europe-west1')
  .firestore
  .document('janaza/{janazaId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const docId = context.params.janazaId;

    const becameActive = before.actif !== true && after.actif === true;
    const alreadyNotified = after.notificationSent === true;

    if (!becameActive || alreadyNotified) {
      return null;
    }

    console.log('Janaza activée (update), envoi notif:', docId);
    await sendJanazaPush(change.after.ref, docId, after);
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

    const popupFullBody = String(popup.contenu || popup.message || '').slice(0, 1000);
    const message = {
      notification: {
        title: '🕌 ' + (popup.titre || 'Nouveau message'),
        body: truncate(popupFullBody, 150),
      },
      data: {
        type: 'popup',
        id: context.params.popupId,
        fullBody: popupFullBody,
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: 'ANNOUNCEMENT',
            'thread-id': 'announcements',
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
      await writeUserNotif({ audience: 'all' }, { title: '🕌 ' + (popup.titre || 'Nouveau message'), body: String(popup.contenu || popup.message || '').slice(0, 2000), type: 'popup', data: { type: 'popup', id: context.params.popupId } });

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
    const notifBody = truncate(notification.message, 120); // PUSH (ecran verrouille) : apercu court
    const notifBodyFull = String(notification.message || '').slice(0, 2000); // IN-APP : message complet developpe (affiche au tap)

    // Map topic to APNs category + thread-id for Apple Watch actions
    const categoryMapping = {
      announcements: { category: 'ANNOUNCEMENT', threadId: 'announcements' },
      events: { category: 'EVENT', threadId: 'events' },
      janaza: { category: 'JANAZA', threadId: 'janaza', interruptionLevel: 'time-sensitive' },
      members: { category: 'MEMBERSHIP', threadId: 'membership' },
      non_members: { category: 'ANNOUNCEMENT', threadId: 'announcements' },
      general: { category: 'ANNOUNCEMENT', threadId: 'announcements' },
    };
    const apnsMeta = categoryMapping[fcmTopic] || categoryMapping.general;

    const message = {
      notification: {
        title: notifTitle,
        body: notifBody,
      },
      data: {
        type: 'backoffice_notification',
        id: context.params.notificationId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        fullBody: notifBodyFull,
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
            ...(apnsMeta.category && { category: apnsMeta.category }),
            ...(apnsMeta.threadId && { 'thread-id': apnsMeta.threadId }),
            ...(apnsMeta.interruptionLevel && { 'interruption-level': apnsMeta.interruptionLevel }),
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
      await writeUserNotif({ audience: 'all' }, { title: notifTitle, body: notifBodyFull, type: notification.topic || 'other' });

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

    // SECURITE: whitelist des topics FCM autorisés (empêche l'envoi sur un topic arbitraire)
    const ALLOWED_TOPICS = new Set(['general', 'announcements', 'events', 'janaza', 'members', 'non_members']);
    const safeTopic = (topic && ALLOWED_TOPICS.has(topic)) ? topic : 'general';
    const safeTitle = sanitizeString(title, 100);
    const safeBody = sanitizeString(body, 500);

    // SECURITE: whitelist des clés customData autorisées dans le payload FCM
    const ALLOWED_DATA_KEYS = new Set(['screen', 'eventId', 'announcementId', 'url', 'category', 'type', 'id', 'fullBody']);
    const safeCustomData = {};
    if (customData && typeof customData === 'object') {
      for (const [k, v] of Object.entries(customData)) {
        const maxLen = k === 'fullBody' ? 1000 : 200;
        if (ALLOWED_DATA_KEYS.has(k) && typeof v === 'string' && v.length <= maxLen) {
          safeCustomData[k] = v;
        }
      }
    }

    // Un avis de décès (janaza) doit partir en priorité haute / time-sensitive,
    // pas comme une annonce banale (sinon silencé en mode Focus iOS / mauvais channel Android).
    // Les autres sujets gardent le comportement existant.
    const isJanaza = safeTopic === 'janaza';
    const manualFullBody = String(safeBody).slice(0, 1000);
    const message = {
      notification: {
        title: safeTitle,
        body: truncate(safeBody, 200),
      },
      data: {
        type: isJanaza ? 'janaza' : 'manual',
        sentBy: context.auth.uid,
        sentAt: new Date().toISOString(),
        fullBody: manualFullBody,
        ...safeCustomData,
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: isJanaza ? 'JANAZA' : 'ANNOUNCEMENT',
            'thread-id': isJanaza ? 'janaza' : 'announcements',
            ...(isJanaza && { 'interruption-level': 'time-sensitive' }),
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: isJanaza ? 'janaza_channel' : 'general',
        },
      },
      topic: safeTopic,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Notification manuelle envoyée:', response);
      await writeUserNotif({ audience: 'all' }, { title, body: String(body || '').slice(0, 2000), type: 'manual', data: safeCustomData });

      // Enregistrer dans Firestore pour historique
      await admin.firestore().collection('notifications_history').add({
        title,
        body,
        topic: safeTopic,
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
        topic: safeTopic,
        sentBy: context.auth.uid,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
        success: false,
      });

      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ==================== NOTIFICATION NOUVEAU MESSAGE ====================
// Trigger : quand un utilisateur envoie un nouveau message à la mosquée

exports.onNewMessage = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'] })
  .firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const messageId = context.params.messageId;

    // Idempotence : skip si déjà traité (at-least-once delivery Firebase)
    if (data.notificationSent === true) {
      console.log('onNewMessage: déjà traité, skip:', messageId);
      return null;
    }

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

    // === 1. Notification backoffice (cloche) — PAS de push mobile (option B) ===
    // Les messages des usagers sont privés : les admins les consultent uniquement
    // depuis le backoffice (cloche + page Messages), pas de push sur leur téléphone perso.
    try {
      await createNotifBO({
        type: 'message',
        titre: '📩 Nouveau message',
        message: `${userName} a envoyé un message : ${sujet}`,
        membreNom: userName,
      });
    } catch (notifErr) {
      console.error('⚠️ Erreur notif BO nouveau message:', notifErr.message);
    }

    // Notif PUSH sur l'iPhone/desktop des admins (aperçu seulement, contenu privé non inclus)
    try {
      await require('./pushNotif').sendAdminPush(
        '📩 Nouveau message',
        `${userName} : ${sujet}`,
        'https://el-mouhssinine.web.app',
      );
    } catch (e) { console.error('sendAdminPush message:', e.message); }

    // === 2. Email aux admins ===
    try {
      const brevoUser = BREVO_SMTP_USER;
      const brevoPass = BREVO_SMTP_PASS;
      const fromEmail = BREVO_FROM_EMAIL;
      const fromName = BREVO_FROM_NAME;
      const adminEmail = fromEmail || 'centreculturelislamique@orange.fr';

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error(`[EMAIL ERROR] Config Brevo manquante. Email non envoyé à ${maskEmail(userEmail)}`);
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

      // Marquer comme traité (idempotence)
      await snap.ref.update({ notificationSent: true }).catch(() => {});

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
  .runWith({ secrets: ['BREVO_SMTP_PASS'] })
  .firestore
  .document('messages/{messageId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Idempotency: comparer le compteur de réponses notifiées
    const notifiedReplyCount = after.notifiedReplyCount || 0;

    // Vérifier si une nouvelle réponse a été ajoutée
    const beforeReplies = before.reponses || [];
    const afterReplies = after.reponses || [];

    if (afterReplies.length <= beforeReplies.length) {
      console.log('Pas de nouvelle réponse');
      return null;
    }

    // Idempotency: si on a déjà notifié pour ce nombre de réponses, skip
    if (notifiedReplyCount >= afterReplies.length) {
      console.log('onMessageReply: déjà notifié pour', afterReplies.length, 'réponses, skip');
      return null;
    }

    // Marquer comme notifié AVANT le traitement (at-least-once safe)
    await change.after.ref.update({ notifiedReplyCount: afterReplies.length }).catch(() => {});

    // Trouver la nouvelle réponse
    const newReply = afterReplies[afterReplies.length - 1];

    if (newReply.createdBy === 'mosquee') {
      // === RÉPONSE DE LA MOSQUÉE → Notifier l'utilisateur ===
      const userId = after.odUserId;
      if (!userId) {
        console.log('Pas de userId trouvé');
        return null;
      }

      // Envoyer push au membre (multi-device)
      try {
        await sendPushToMember(userId, '🕌 Nouvelle réponse',
          `La mosquée a répondu à votre message "${truncate(after.sujet, 30)}"`,
          { type: 'message_reply', messageId: context.params.messageId, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
          { category: 'MESSAGE', threadId: 'messages' }
        );
        console.log('🔔 Notification envoyée à l\'utilisateur:', userId);

        // Enregistrer dans l'historique
        await admin.firestore().collection('notifications_history').add({
          title: 'Nouvelle réponse',
          body: `Réponse au message: ${after.sujet}`,
          targetUserId: userId,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          success: true,
          source: 'message_reply_to_user',
          relatedMessageId: context.params.messageId,
        });

        // Charger le member doc pour l'email
        const memberDoc = await admin.firestore().collection('members').doc(userId).get();

        // === EMAIL à l'utilisateur ===
        try {
          const memberData = memberDoc.exists ? memberDoc.data() : null;
          const userEmail = memberData?.email || after.userEmail;
          const prenom = memberData?.prenom || after.userName || 'Membre';

          if (userEmail) {
            const brevoUser = BREVO_SMTP_USER;
            const brevoPass = BREVO_SMTP_PASS;
            const fromEmail = BREVO_FROM_EMAIL;
            const fromName = BREVO_FROM_NAME;

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

        return { success: true };
      } catch (error) {
        console.error('❌ Erreur notification utilisateur:', error);
        return { error: error.message };
      }
    } else {
      // === RÉPONSE DE L'UTILISATEUR → Notifier les admins ===
      console.log('Réponse de l\'utilisateur, notification aux admins');

      try {
        // Récupérer tous les admins avec leur token FCM (optimisé - évite N+1 query)
        const adminsSnapshot = await admin.firestore().collection('admins')
          .where('actif', '==', true)
          .get();

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
            const md = memberDoc.data();
            if (Array.isArray(md.fcmTokens)) {
              adminTokens.push(...md.fcmTokens);
            } else if (md.fcmToken) {
              adminTokens.push(md.fcmToken);
            }
          });
        }

        if (adminTokens.length === 0) {
          console.log('Aucun admin avec token FCM');
          return null;
        }

        const userName = sanitizeString(after.userName || after.nom, 50) || 'Un utilisateur';
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
                category: 'MESSAGE',
                'thread-id': 'messages',
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

    const { amount, currency, description, metadata, idempotencyKey } = data;

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

    // SECURITE: cotisations requièrent une authentification (dons peuvent être anonymes)
    if (metadata && metadata.type === 'cotisation' && !context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Connexion requise pour les cotisations');
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

      // SECURITE: Vérifier le montant contre le prix officiel Firestore
      try {
        const settingsDoc = await admin.firestore()
          .collection('settings')
          .doc('cotisation')
          .get();

        if (settingsDoc.exists) {
          const officialPrices = settingsDoc.data();
          const period = metadata.period || 'annuel';
          const officialUnitPrice = period === 'mensuel'
            ? Math.round((officialPrices.mensuel || 10) * 100)
            : Math.round((officialPrices.annuel || 100) * 100);

          // Nombre de membres (famille = plusieurs, individuel = 1)
          const membersCount = parseInt(metadata.membersCount || '1', 10) || 1;
          const expectedAmount = officialUnitPrice * membersCount;

          // Tolérance ±1% pour éviter les erreurs d'arrondi
          const tolerance = Math.ceil(expectedAmount * 0.01);
          if (Math.abs(amount - expectedAmount) > tolerance) {
            throw new functions.https.HttpsError(
              'invalid-argument',
              `Montant cotisation invalide. Attendu: ${expectedAmount} centimes, reçu: ${amount}`
            );
          }
        }
      } catch (priceCheckErr) {
        if (priceCheckErr.code === 'functions/invalid-argument') throw priceCheckErr;
        // Fail-closed : si Firestore est indisponible, on bloque le paiement cotisation
        // Un attaquant ne peut pas exploiter une panne Firestore pour payer 1€
        throw new functions.https.HttpsError(
          'unavailable',
          'Vérification du montant impossible. Réessayez dans quelques instants.'
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
      // Créer le PaymentIntent (avec idempotency key si fournie par l'app)
      const piOptions = idempotencyKey
        ? { idempotencyKey: `pi_${idempotencyKey}` }
        : {};
      // SECURITE [22]: ne propager que les clés metadata attendues (pas de spread brut du client)
      const ALLOWED_PI_META = ['type','memberId','memberIdDisplay','memberName','email','period','montantCotisation','montantDon','donorType','donorInfo','donorName','donorEmail','donateurEmail','donorUid','isAnonymous','projectId','projectName','membersCount','uid'];
      const safeMeta = {};
      if (metadata && typeof metadata === 'object') {
        for (const k of ALLOWED_PI_META) {
          if (metadata[k] !== undefined && metadata[k] !== null) safeMeta[k] = String(metadata[k]).slice(0, 500);
        }
      }
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amount, // déjà en centimes
          currency: currency,
          description: description || 'Don Mosquée El Mohsinine',
          metadata: {
            ...safeMeta,
            userId: userId,
            source: 'app_mobile',
            createdAt: new Date().toISOString(),
          },
          automatic_payment_methods: {
            enabled: true,
          },
        },
        piOptions
      );

      console.log('PaymentIntent créé:', paymentIntent.id);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('Erreur création PaymentIntent:', error);
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
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
    const { amount, description, metadata, idempotencyKey } = data;

    // Validation
    if (!amount || typeof amount !== 'number' || amount < 100 || amount > 10000000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Montant invalide (minimum 1€, maximum 100 000€)'
      );
    }

    // SECURITE: Vérifier montant cotisation mensuelle contre prix officiel
    try {
      const settingsDoc = await admin.firestore()
        .collection('settings')
        .doc('cotisation')
        .get();

      if (settingsDoc.exists) {
        const officialPrices = settingsDoc.data();
        const officialMonthlyPrice = Math.round((officialPrices.mensuel || 10) * 100);
        const membersCount = parseInt(metadata?.membersCount || '1', 10) || 1;
        const expectedAmount = officialMonthlyPrice * membersCount;
        const tolerance = Math.ceil(expectedAmount * 0.01);

        if (Math.abs(amount - expectedAmount) > tolerance) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            `Montant abonnement invalide. Attendu: ${expectedAmount} centimes, reçu: ${amount}`
          );
        }
      }
    } catch (priceCheckErr) {
      if (priceCheckErr.code === 'functions/invalid-argument') throw priceCheckErr;
      // Fail-closed (cohérent avec createPaymentIntent) : ne jamais laisser passer un montant non vérifié
      console.error('createSubscription: vérification prix impossible:', priceCheckErr.message);
      throw new functions.https.HttpsError('failed-precondition', 'Vérification du montant impossible. Veuillez réessayer.');
    }

    // SECURITE: utiliser l'email Firebase Auth (vérifié) au lieu du client
    const authEmail = context.auth.token?.email;
    const email = authEmail || metadata?.email;
    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email requis pour créer un abonnement'
      );
    }

    // Rate limiting: max 3 tentatives de création d'abonnement par 5 minutes
    await checkRateLimit(uid, 'subscription', 3, 300);

    try {
      console.log('Création abonnement Stripe pour UID:', uid);

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

      // 2b. Vérifier et annuler l'ancien abonnement Stripe s'il existe (évite orphelins)
      const memberRefCheck = admin.firestore().collection('members').doc(uid);
      const memberDocCheck = await memberRefCheck.get();
      if (memberDocCheck.exists) {
        const existingSub = memberDocCheck.data().stripeSubscriptionId;
        if (existingSub) {
          try {
            const oldSub = await stripe.subscriptions.retrieve(existingSub);
            if (oldSub.status === 'active' || oldSub.status === 'past_due') {
              await stripe.subscriptions.cancel(existingSub);
              console.log('Ancien abonnement Stripe annulé (orphelin):', existingSub);
            }
          } catch (subErr) {
            // Subscription introuvable ou déjà annulée — on continue
            console.log('Ancien abonnement Stripe ignoré:', subErr.message);
          }
        }
      }

      // 3. Créer la Subscription avec payment_behavior 'default_incomplete'
      // Cela permet de récupérer le payment_intent pour Payment Sheet
      const subOptions = idempotencyKey
        ? { idempotencyKey: `sub_${idempotencyKey}` }
        : {};
      const subscription = await stripe.subscriptions.create(
        {
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
        },
        subOptions
      );

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

      // FIX CRITIQUE: Propager les metadata sur le PaymentIntent
      // stripe.subscriptions.create() ne propage PAS les metadata sur le PI de l'invoice
      // Sans ça, le webhook payment_intent.succeeded voit metadata={} → traite comme donation
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          type: 'cotisation',
          memberId: uid,
          memberIdDisplay: metadata.memberIdDisplay || '',
          memberName: metadata.memberName || '',
          email: metadata.email || '',
          period: 'mensuel',
          montantCotisation: String(metadata.montantCotisation || (amount / 100)),
          montantDon: String(metadata.montantDon || 0),
          source: 'app_mobile',
          subscriptionId: subscription.id,
        },
      });
      console.log('Metadata propagé sur PaymentIntent:', paymentIntent.id);

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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ==================== WEBHOOK STRIPE ====================
// Pour confirmer les paiements et mettre à jour Firestore
// Avec idempotence et transactions atomiques

exports.stripeWebhook = functions
  .runWith({ secrets: ['BREVO_SMTP_PASS'],
    timeoutSeconds: 60,
    memory: '256MB',
    minInstances: 1,
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
      await logServerError(err.message ?? String(err), 'stripeWebhook', { stack: err.stack });
      return res.status(400).send('Webhook Error');
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

          // FIX CRITIQUE: Fallback — récupérer metadata depuis la subscription
          // Si le PaymentIntent n'a pas de memberId (cas subscription: metadata sur sub, pas sur PI)
          if (!metadata.memberId && paymentIntent.invoice) {
            try {
              const inv = await stripe.invoices.retrieve(paymentIntent.invoice);
              if (inv.subscription) {
                const sub = await stripe.subscriptions.retrieve(inv.subscription);
                if (sub.metadata && sub.metadata.memberId) {
                  Object.assign(metadata, sub.metadata);
                  console.log('✅ Metadata récupéré depuis subscription:', sub.id, 'memberId:', sub.metadata.memberId);
                }
              }
            } catch (fallbackErr) {
              console.warn('⚠️ Impossible de récupérer metadata depuis subscription:', fallbackErr.message);
            }
          }

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
                memberId: metadata.memberIdDisplay || '',
                memberName: metadata.memberName || '',
                period: metadata.period || 'annuel',
                modePaiement: 'carte',
                metadata: metadata,
                date: admin.firestore.FieldValue.serverTimestamp(),
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
                  donateurEmail: (metadata.email || metadata.donorEmail || metadata.donateurEmail || '').toLowerCase() || null,
                  userId: (() => {
                    const uid = metadata.memberId || metadata.userId || metadata.donorUid || paymentIntent.metadata?.memberId || paymentIntent.metadata?.userId || '';
                    if (!uid) console.log('[Don web] Don ' + paymentIntentId + ' sans userId (donateur web/anonyme) — normal');
                    return uid;
                  })(),
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
              // BUG A FIX: Le webhook est la source unique de vérité pour payments/ + member update
              // L'app ne doit PLUS écrire dans payments/ ni modifier les champs critiques du membre
              if (memberRef && memberDoc && memberDoc.exists) {
                const memberData = memberDoc.data() || {};
                const period = metadata.period || 'annuel';

                // Calculer dateFin (même logique que l'ancien addCotisation côté app)
                const now = new Date();
                let baseDate = now;
                // Si le membre a une dateFin dans le futur, prolonger à partir de celle-ci
                const existingExpiry = memberData.cotisation?.dateFin;
                if (existingExpiry) {
                  const expiryDate = existingExpiry.toDate ? existingExpiry.toDate() : new Date(existingExpiry);
                  if (expiryDate > now) {
                    baseDate = expiryDate;
                  }
                }
                let dateFin;
                if (period === 'mensuel') {
                  dateFin = new Date(baseDate);
                  dateFin.setMonth(dateFin.getMonth() + 1);
                  if (dateFin.getDate() !== baseDate.getDate()) {
                    dateFin.setDate(0); // Dernier jour du mois voulu
                  }
                } else {
                  dateFin = new Date(baseDate);
                  dateFin.setFullYear(dateFin.getFullYear() + 1);
                  if (dateFin.getDate() !== baseDate.getDate()) {
                    dateFin.setDate(0); // Fix débordement mois
                  }
                }

                transaction.update(memberRef, {
                  status: 'en_attente_validation',
                  aPaye: true,
                  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
                  montantPaye: montantCotisation,
                  stripePaymentId: paymentIntentId,
                  formule: period,
                  cotisation: {
                    type: period,
                    montant: montantCotisation,
                    dateDebut: admin.firestore.Timestamp.fromDate(now),
                    dateFin: admin.firestore.Timestamp.fromDate(dateFin),
                  },
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
                // Race condition fix: ne pas écraser donateurEmail si déjà mis par checkout.session.completed
                // On utilise undefined pour exclure le champ si aucun email dispo (merge:true preserve la valeur existante)
                donateur: metadata.donorName || metadata.donorEmail || paymentIntent.receipt_email || 'Anonyme',
                ...((() => {
                  const e = (metadata.donorEmail || metadata.email || metadata.donateurEmail || paymentIntent.receipt_email || '').toLowerCase() || undefined;
                  return e ? { donateurEmail: e } : {};
                })()),
                userId: (() => {
                  const uid = metadata.userId || metadata.donorUid || metadata.memberId || paymentIntent.metadata?.userId || paymentIntent.metadata?.memberId || '';
                  if (!uid) console.log('[Don web] Don ' + paymentIntentId + ' sans userId (donateur web/anonyme) — normal');
                  return uid;
                })(),
                donorType: metadata.donorType || 'particulier',
                donorInfo: (() => { try { return metadata.donorInfo ? JSON.parse(metadata.donorInfo) : null; } catch (e) { console.warn('donorInfo JSON invalide (donation):', e.message); return null; } })(),
                projectId: metadata.projectId || null,
                projectName: metadata.projectName || null,
                projetId: metadata.projectId || null,
                projetNom: metadata.projectName || null,
                isAnonymous: metadata.isAnonymous === 'true',
                modePaiement: 'carte',
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

          // S3: Alerter si cotisation sans memberId dans metadata
          if (metadata.type === 'cotisation' && !metadata.memberId) {
            await logServerError(
              'Subscription Stripe sans memberId dans metadata — statut membre non mis à jour',
              'stripeWebhook_subscription_no_memberId',
              { paymentIntentId, customerId: paymentIntent.customer }
            );
          }

          // Email A supprimé (doublon) — onCotisationConfirmation trigger gère l'envoi
          // via le trigger Firestore payments/{paymentId}.onCreate
        } catch (dbError) {
          // Gérer le cas d'idempotence (pas une vraie erreur)
          if (dbError && dbError.alreadyProcessed) {
            console.log('Paiement déjà traité, retour OK');
            return res.json({ received: true, alreadyProcessed: true });
          }
          console.error('Erreur enregistrement Firestore:', dbError);
          // Retourner 500 pour que Stripe réessaie
          return res.status(500).send('Database Error');
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

        // Guard: ignorer les invoices sans subscription (one-off invoices, premier paiement géré par payment_intent.succeeded)
        if (!subscriptionId) {
          console.log('Invoice sans subscription (premier paiement ou one-off), skip — géré par payment_intent.succeeded');
          break;
        }
        // Guard: le PREMIER paiement d'un abonnement (billing_reason=subscription_create) est déjà
        // traité par payment_intent.succeeded (qui récupère les metadata de la subscription).
        // Sans ce guard, le 1er paiement serait compté DEUX fois (clés d'idempotence différentes).
        if (invoice.billing_reason === 'subscription_create') {
          console.log('Première invoice (subscription_create) — déjà gérée par payment_intent.succeeded, skip');
          break;
        }

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

            // Lire le membre DANS la transaction pour éviter la race condition
            const memberDocTx = await t.get(memberRefTx);
            const memberDataTx = memberDocTx.exists ? memberDocTx.data() : memberData;
            const nowTx = new Date();
            let newEndDate;

            if (memberDataTx.cotisation?.dateFin) {
              const currentEnd = memberDataTx.cotisation.dateFin.toDate
                ? memberDataTx.cotisation.dateFin.toDate()
                : new Date(memberDataTx.cotisation.dateFin);
              const baseDate = currentEnd > nowTx ? currentEnd : nowTx;
              newEndDate = new Date(baseDate);
              const origDay = newEndDate.getDate();
              newEndDate.setMonth(newEndDate.getMonth() + 1);
              if (newEndDate.getDate() !== origDay) newEndDate.setDate(0);
            } else {
              newEndDate = new Date(nowTx);
              const origDay = newEndDate.getDate();
              newEndDate.setMonth(newEndDate.getMonth() + 1);
              if (newEndDate.getDate() !== origDay) newEndDate.setDate(0);
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
              date: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Si le membre a demandé l'annulation, ce paiement est le dernier
            // de la période en cours. On l'enregistre mais on NE prolonge PAS.
            if (memberDataTx.subscriptionCancelPending) {
              console.log('⚠️ Paiement reçu pour membre avec annulation pending — enregistrement sans prolongation');
              // On enregistre le payment doc (déjà fait ci-dessus via t.set(paymentRef))
              // mais on ne met PAS à jour le membre (pas de prolongation dateFin)
              t.set(invoiceProcessedRef, {
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                type: 'invoice_payment_cancel_pending',
                invoiceId: invoice.id,
                subscriptionId: subscriptionId,
                note: 'Paiement enregistré mais non prolongé (annulation en cours)',
              });
              throw { alreadyProcessed: true }; // Sort de la transaction proprement
            }

            // Ne PAS forcer status: 'actif' — respecter le statut existant
            // Un renouvellement mensuel ne doit PAS bypasser la validation admin
            // Seul un membre déjà 'actif' (validé par admin) reste 'actif'
            const renewalUpdate = {
              aPaye: true,
              datePaiement: admin.firestore.FieldValue.serverTimestamp(),
              montantPaye: amountEuros,
              stripePaymentId: invoice.payment_intent,
              cotisation: {
                type: 'mensuel',
                montant: amountEuros,
                dateDebut: memberDataTx.cotisation?.dateDebut || admin.firestore.Timestamp.fromDate(nowTx),
                dateFin: admin.firestore.Timestamp.fromDate(newEndDate),
              },
            };
            // Seulement si déjà actif (validé par admin), on maintient actif
            if (memberDataTx.status === 'actif') {
              renewalUpdate.status = 'actif';
            }
            // Sinon on ne touche PAS au status (reste en_attente_validation, etc.)

            t.update(memberRefTx, renewalUpdate);

            t.set(invoiceProcessedRef, {
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              type: 'invoice_payment',
              invoiceId: invoice.id,
              subscriptionId: subscriptionId,
            });
          });

          console.log('Cotisation mensuelle renouvelée avec succès');
        } catch (err) {
          // Gérer le cas d'idempotence (pas une vraie erreur)
          if (err && err.alreadyProcessed) {
            console.log('Invoice déjà traitée, skip');
            break;
          }
          console.error('Erreur traitement invoice.payment_succeeded:', err);
          // Fail-closed : renvoyer 500 pour que Stripe réessaie (sinon paiement récurrent perdu)
          return res.status(500).send('Internal Error');
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

            if (attemptCount >= 3 && failedMemberDoc.data()?.status === 'actif') {
              // Ne passer en 'expire' que si le membre était réellement actif
              // (évite qu'un membre en attente de validation devienne 'expire' sans avoir été actif)
              statusUpdate.status = 'expire';
              statusUpdate.paymentFailed = true;
              console.log('3 tentatives échouées, membre actif passé en expire pour renouvellement');
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
            const brevoUser = BREVO_SMTP_USER;
            const brevoPass = BREVO_SMTP_PASS;
            const fromEmail = BREVO_FROM_EMAIL;
            const fromName = BREVO_FROM_NAME;

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

          // Push notification au membre
          if (failedMemberDoc) {
            const pushMsg = attemptCount >= 3
              ? 'Votre cotisation a expiré après 3 échecs de paiement. Renouvelez depuis l\'app.'
              : `Tentative ${attemptCount}/3 échouée. Vérifiez votre carte bancaire.`;
            await sendPushToMember(failedMemberDoc.id, '⚠️ Prélèvement échoué', pushMsg, {}, { category: 'MEMBERSHIP', threadId: 'membership' });
          }

          // Notification backoffice
          const notifTitre = attemptCount >= 3
            ? '🚨 Cotisation expirée (3 échecs)'
            : `⚠️ Paiement échoué (${attemptCount}/3)`;
          const notifMessage = `${failedMemberPrenom || 'Membre'} — ${((failedInvoice.amount_due || 0) / 100).toFixed(2)} €`;
          await createNotifBO({ type: 'paiement', titre: notifTitre, message: notifMessage, membreId: failedMemberDoc ? failedMemberDoc.id : null });

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
              statut: 'sympathisant', // Compatibilité ancien champ
              cotisationType: null,
              stripeSubscriptionId: null,
              aPaye: false,
              abonnementActif: false,
              subscriptionCancelPending: false, // Nettoyage flag annulation
              subscriptionCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('Membre passé en sympathisant suite à suppression abonnement Stripe');

            // Envoyer email de confirmation d'annulation
            const cancelEmail = subMemberData.email;
            const cancelPrenom = subMemberData.prenom || subMemberData.nom || 'Membre';
            if (cancelEmail) {
              try {
                const brevoUser = BREVO_SMTP_USER;
                const brevoPass = BREVO_SMTP_PASS;
                const fromEmail = BREVO_FROM_EMAIL;
                const fromName = BREVO_FROM_NAME;

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
            const updatedSubMemberData = updatedSubMemberDoc.data();
            const updateData = {};

            // Si annulation programmée (cancel_at_period_end), ne PAS toucher au statut
            // Le webhook customer.subscription.deleted gèrera le passage en sympathisant
            if (updatedSubMemberData.subscriptionCancelPending) {
              console.log('Annulation programmée détectée, statut non modifié par subscription.updated');
            } else if (updatedSubscription.status === 'active') {
              // Ne remettre 'actif' que si le membre était déjà 'actif' (validé par admin)
              // Un membre en_attente_validation ne doit PAS passer actif automatiquement
              if (updatedSubMemberData.status === 'actif') {
                updateData.status = 'actif';
              }
            } else if (updatedSubscription.status === 'canceled' || updatedSubscription.status === 'unpaid') {
              updateData.status = 'sympathisant';
              updateData.statut = 'sympathisant';
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
          const brevoUser = BREVO_SMTP_USER;
          const brevoPass = BREVO_SMTP_PASS;
          const fromEmail = BREVO_FROM_EMAIL;
          const fromName = BREVO_FROM_NAME;

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

          // 3. Trouver le membre via payment_intent → payments collection
          let disputeMemberId = null;
          let disputeMemberName = '';
          if (dispute.payment_intent) {
            const paymentsSnap = await admin.firestore()
              .collection('payments')
              .where('stripePaymentIntentId', '==', dispute.payment_intent)
              .limit(1)
              .get();

            if (!paymentsSnap.empty) {
              const paymentData = paymentsSnap.docs[0].data();
              disputeMemberId = paymentData.membreId || null;
            }
          }

          // 4. Suspendre le membre si trouvé
          if (disputeMemberId) {
            const disputeMemberRef = admin.firestore().collection('members').doc(disputeMemberId);
            const disputeMemberDoc = await disputeMemberRef.get();
            if (disputeMemberDoc.exists) {
              disputeMemberName = disputeMemberDoc.data().prenom || disputeMemberDoc.data().nom || '';
              await disputeMemberRef.update({
                status: 'suspendu',
                disputeId: dispute.id,
                suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log('Membre suspendu suite au litige:', disputeMemberId);
            }
          }

          // 5. Notification backoffice
          await createNotifBO({
            type: 'remboursement',
            titre: '🚨 Dispute bancaire !',
            message: `${disputeMemberName || 'Membre inconnu'} — ${dispute.amount / 100} € contestés (${dispute.reason || 'non spécifié'})`,
            membreId: disputeMemberId,
          });

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

      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object;
        const siMetadata = setupIntent.metadata || {};
        console.log('SetupIntent succeeded:', setupIntent.id, 'metadata:', siMetadata);

        try {
          // Mise à jour de la carte par défaut sur l'abonnement
          if (siMetadata.subscriptionId && setupIntent.payment_method) {
            await stripe.subscriptions.update(siMetadata.subscriptionId, {
              default_payment_method: setupIntent.payment_method,
            });
            console.log('Carte mise à jour sur subscription:', siMetadata.subscriptionId);

            // Notifier le membre
            if (siMetadata.uid) {
              await sendPushToMember(siMetadata.uid, '✅ Carte mise à jour', 'Votre nouvelle carte bancaire a été enregistrée.', {}, { category: 'MEMBERSHIP', threadId: 'membership' });

              // Email confirmation
              const siMemberDoc = await admin.firestore().collection('members').doc(siMetadata.uid).get();
              if (siMemberDoc.exists) {
                const siMember = siMemberDoc.data();
                const siEmail = siMember.email;
                if (siEmail) {
                  const siBrevoUser = BREVO_SMTP_USER;
                  const siBrevoPass = BREVO_SMTP_PASS;
                  const siFromEmail = BREVO_FROM_EMAIL;
                  const siFromName = BREVO_FROM_NAME;
                  if (siBrevoUser && siBrevoPass && siFromEmail) {
                    const siTransporter = nodemailer.createTransport({
                      host: 'smtp-relay.brevo.com', port: 587, secure: false,
                      auth: { user: siBrevoUser, pass: siBrevoPass },
                    });
                    try {
                      await siTransporter.sendMail({
                        from: `"${siFromName}" <${siFromEmail}>`,
                        to: siEmail,
                        subject: '✅ Carte bancaire mise à jour — El Mohsinine',
                        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                          <div style="background:linear-gradient(135deg,#2e7d32,#4caf50);padding:20px;text-align:center;border-radius:10px 10px 0 0;">
                            <h1 style="color:white;margin:0;">✅ Carte mise à jour</h1>
                          </div>
                          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;">
                            <p>Salam alaykoum${siMember.prenom ? ' ' + siMember.prenom : ''},</p>
                            <p>Votre nouvelle carte bancaire a bien été enregistrée pour votre cotisation mensuelle.</p>
                            <p>Les prochains prélèvements seront effectués sur cette carte.</p>
                          </div>
                        </div>`,
                      });
                    } catch (emailErr) {
                      console.error('Email non-bloquant (setup_intent):', emailErr.message);
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('Erreur traitement setup_intent.succeeded:', err);
        }
        break;
      }

      case 'checkout.session.completed': {
        // Checkout Session (page /don publique) : l'email est dans session.customer_details
        // SECURITE: Ne PAS attribuer userId par lookup email — l'email n'est pas vérifié
        // (un donateur web peut entrer l'email de quelqu'un d'autre)
        // Le lien userId sera fait côté app uniquement si l'email matche l'auth Firebase
        try {
          const session = event.data.object;
          const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
          const donorEmail = (session.customer_details?.email || session.customer_email || '').toLowerCase() || null;
          const donorName = session.customer_details?.name || donorEmail || 'Anonyme';
          if (piId && donorEmail) {
            try {
              // set+merge : crée le doc s'il n'existe pas, complète s'il existe déjà.
              // Résout la race condition : checkout.session.completed peut arriver
              // avant ou après payment_intent.succeeded — dans les deux cas l'email est sauvé.
              // NOTE: userId volontairement NON attribué ici (email non vérifié sur dons publics)
              await admin.firestore().collection('donations').doc(piId).set(
                {
                  donateurEmail: donorEmail,
                  donateur: donorName,
                  source: session.metadata?.source || 'web_don_public',
                  stripeSessionId: session.id,
                  webhookSessionProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              console.log(`checkout.session.completed: donations/${piId} set+merge OK — email enregistré`);
            } catch (setErr) {
              console.error('checkout.session.completed: set+merge échoué:', setErr.message);
            }
          } else {
            console.log(`checkout.session.completed: pas d'email pour ${piId || 'PI inconnu'}`);
          }
        } catch (err) {
          console.error('Erreur checkout.session.completed:', err.message);
        }
        break;
      }

      default: {
        const criticalUnhandled = [
          'customer.subscription.deleted',
          'payment_intent.payment_failed',
          'invoice.payment_failed',
          'charge.dispute.created',
        ];
        if (criticalUnhandled.includes(event.type)) {
          await logServerError(
            `Événement Stripe critique non géré: ${event.type}`,
            'stripeWebhook_unhandled',
            { eventType: event.type, eventId: event.id }
          );
        } else {
          console.log('Événement non géré (non critique):', event.type);
        }
        break;
      }
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
    doc.font('Helvetica').text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`, { align: 'right' });
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
    doc.text(`Fait à ${association.ville || '[Ville]'}, le ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`, sigBlockX, sigBlockY, { width: 200, align: 'right' });
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
    doc.font('Helvetica').text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`, { align: 'right' });
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
    doc.text(`Fait à ${association.ville || '[Ville]'}, le ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`, sigBlockX, sigBlockY, { width: 200, align: 'right' });
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
  .runWith({ secrets: ['BREVO_SMTP_PASS'],
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

    // Un ADMIN peut générer le reçu de n'importe quel donateur (envoi manuel backoffice).
    // Un utilisateur normal ne peut demander que son propre reçu.
    const callerIsAdmin = await isAdmin(context.auth.uid);
    if (!callerIsAdmin) {
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

      // 3bis. Override adresse fiscale corrigée depuis le backoffice (priorité MAX)
      try {
        const ovSnap = await admin.firestore()
          .collection('members')
          .where('email', '==', email.toLowerCase())
          .limit(1)
          .get();
        if (!ovSnap.empty) {
          const mo = ovSnap.docs[0].data();
          if (mo.recuFiscalAdresse && String(mo.recuFiscalAdresse).trim()) {
            donateur.adresse = String(mo.recuFiscalAdresse).trim();
            donateur.codePostal = String(mo.recuFiscalCP || donateur.codePostal || '').trim();
            donateur.ville = String(mo.recuFiscalVille || donateur.ville || '').trim();
            console.log('🏠 Adresse fiscale corrigée (override backoffice) appliquée');
          }
        }
      } catch (ovErr) {
        console.error('override adresse fiscale (send):', ovErr.message);
      }

      // CERFA: l'adresse du donateur est OBLIGATOIRE (art. 200 CGI / BOFiP).
      // Un reçu sans adresse n'est pas valable -> on bloque et on demande de la compléter.
      if (!donateur.adresse || !String(donateur.adresse).trim()) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          "Adresse du donateur manquante. Renseigne-la dans la fiche du membre (bloc « Adresse pour le reçu fiscal ») avant d'envoyer le reçu fiscal."
        );
      }

      // 4. Numéro de reçu + création du document DANS la même transaction.
      // Garantit qu'un numéro consommé est TOUJOURS associé à un document (aucun trou possible).
      const recuCounterRef = admin.firestore().collection('counters').doc('recusFiscaux');
      const recuDocRef = admin.firestore().collection('recus_fiscaux').doc();
      const newNumber = await admin.firestore().runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(recuCounterRef);
        let currentNumber = 0;
        if (counterDoc.exists) {
          currentNumber = counterDoc.data()[`year_${annee}`] || 0;
        }
        const nextNumber = currentNumber + 1;
        const numero = `RF-${annee}-${String(nextNumber).padStart(5, '0')}`;
        transaction.set(recuCounterRef, { [`year_${annee}`]: nextNumber }, { merge: true });
        transaction.set(recuDocRef, {
          numeroRecu: numero,
          annee,
          userId: context.auth.uid,
          email,
          donateur,
          donorType: detectedDonorType,
          montantTotal: totalDons,
          donsDetails,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'generating', // passera à 'sent' une fois PDF + email OK
          source: 'manual',
        });
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
      const brevoUser = BREVO_SMTP_USER;
      const brevoPass = BREVO_SMTP_PASS;
      const fromEmail = BREVO_FROM_EMAIL;
      const fromName = BREVO_FROM_NAME;

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

      // 7. (Le document a déjà été créé dans la transaction du numéro — voir étape 4)

      // 8. Sauvegarder le PDF dans Storage
      const bucket = admin.storage().bucket();
      const filePath = `recus_fiscaux/${annee}/${numeroRecu}.pdf`;
      await bucket.file(filePath).save(pdfBuffer, {
        metadata: { contentType: 'application/pdf' },
      });

      // 8bis. Finaliser : le reçu passe de 'generating' à 'sent'
      await recuDocRef.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        recuFiscalUrl: filePath,
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

      // Push notification reçu fiscal (multi-device)
      await sendPushToMember(context.auth.uid, '📄 Votre reçu fiscal est disponible',
        'Votre reçu fiscal a été envoyé par email. Conservez-le pour votre déclaration d\'impôts.',
        { type: 'recu_fiscal', annee: String(annee) },
        { category: 'DONATION', threadId: 'donations' }
      );

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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
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
    // SÉCURITÉ: Si pas d'email vérifié dans le token, refuser (empêche bypass via phone auth)
    const userEmail = context.auth.token.email;
    if (!userEmail) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Email vérifié requis pour consulter les dons'
      );
    }
    if (userEmail.toLowerCase() !== email.toLowerCase()) {
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
        .where('donateurEmail', '==', email.toLowerCase())
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .where('status', 'in', ['succeeded', 'completed'])
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
        totalDonsEligibles += d.amount || d.montant || 0;
        dons.push({
          id: doc.id,
          type: 'don_projet',
          montant: d.amount || d.montant || 0,
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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ==================== NOUVEAU MEMBRE SYMPATHISANT ====================
// Trigger : quand un nouveau membre est créé avec status 'sympathisant'

exports.onNewSympathisant = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'] })
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
      await logServerError(
        'Nouveau sympathisant sans email — email de bienvenue non envoyé',
        'onNewSympathisant_no_email',
        { memberId: snap.id, prenom }
      );
      return null;
    }

    console.log('🎉 Nouveau sympathisant:', prenom, email.replace(/(.{2}).*(@.*)/, '$1***$2'));

    // S13: Vérifier doublon email
    try {
      const existingMembers = await admin.firestore()
        .collection('members')
        .where('email', '==', email)
        .limit(2)
        .get();

      const otherDocs = existingMembers.docs.filter(d => d.id !== snap.id);
      if (otherDocs.length > 0) {
        console.log('⚠️ Double compte détecté pour email:', email.replace(/(.{2}).*(@.*)/, '$1***$2'));
        // Transférer le FCM token vers le compte existant
        if (member.fcmTokens && Array.isArray(member.fcmTokens)) {
          await otherDocs[0].ref.update({
            fcmTokens: admin.firestore.FieldValue.arrayUnion(...member.fcmTokens),
          });
        } else if (member.fcmToken) {
          await otherDocs[0].ref.update({
            fcmTokens: admin.firestore.FieldValue.arrayUnion(member.fcmToken),
          });
        }
        // Supprimer le doublon
        await snap.ref.delete();
        await createNotifBO({
          type: 'nouveau_membre',
          titre: '⚠️ Double compte détecté',
          message: `${prenom} (${email.replace(/(.{2}).*(@.*)/, '$1***$2')}) — doublon supprimé, FCM transféré`,
        });
        return null;
      }
    } catch (dupErr) {
      console.warn('⚠️ Vérif doublon non bloquante:', dupErr.message);
    }

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
      const brevoUser = BREVO_SMTP_USER;
      const brevoPass = BREVO_SMTP_PASS;
      const fromEmail = BREVO_FROM_EMAIL;
      const fromName = BREVO_FROM_NAME || nomMosquee;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error(`[EMAIL ERROR] Config Brevo manquante. Email non envoyé à ${maskEmail(email)}`);
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
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: email,
          subject: emailSubject,
          html: emailHtml,
        });
        console.log('✅ Email de bienvenue envoyé à', email.replace(/(.{2}).*(@.*)/, '$1***$2'));
      } catch (emailError) {
        await logServerError(
          'Nouveau sympathisant mais email de bienvenue non envoyé',
          'onNewSympathisant_email_failed',
          { memberId: snap.id, prenom, error: emailError.message }
        );
      }

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

      // Notif backoffice
      await createNotifBO({
        type: 'nouveau_membre',
        titre: '🆕 Nouvelle inscription',
        message: `${prenom} ${member.nom || ''} vient de créer son compte`.trim(),
        membreId: snap.id,
        membreNom: `${prenom} ${member.nom || ''}`.trim(),
      });

      // Notif PUSH sur l'iPhone/desktop des admins (Web Push)
      try {
        await require('./pushNotif').sendAdminPush(
          '🆕 Nouvelle inscription',
          `${prenom} ${member.nom || ''} vient de s'inscrire`.trim(),
        );
      } catch (e) { console.error('sendAdminPush:', e.message); }

      // Push notification bienvenue (multi-device)
      await sendPushToMember(snap.id, '🕌 Bienvenue chez El Mouhssinine !',
        'Votre compte a bien été créé. Complétez votre adhésion en réglant votre cotisation.',
        { type: 'welcome_sympathisant', memberId: snap.id },
        { category: 'MEMBERSHIP', threadId: 'membership' }
      );

      return { success: true, email };

    } catch (error) {
      console.error('❌ Erreur envoi email bienvenue:', error);
      await logServerError(
        'Erreur inattendue dans onNewSympathisant',
        'onNewSympathisant_error',
        { memberId: snap.id, prenom, error: error.message }
      );
      return { error: error.message };
    }
  });

// ==================== VALIDATION ADHÉSION PAR LE BUREAU ====================
// Callable function pour valider ou refuser une adhésion

exports.validateMembership = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'] })
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

    // SECURITE: Rate limiting — max 20 validations par heure par admin
    await checkRateLimit(context.auth.uid, 'validateMembership', 20, 3600);

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
      const brevoUser = BREVO_SMTP_USER;
      const brevoPass = BREVO_SMTP_PASS;
      const fromEmail = BREVO_FROM_EMAIL;
      const fromName = BREVO_FROM_NAME || nomMosquee;

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
        // Transaction atomique pour éviter race condition (membre expiré entre-temps)
        await admin.firestore().runTransaction(async (t) => {
          const freshDoc = await t.get(memberRef);
          if (!freshDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Membre non trouvé');
          }
          const freshData = freshDoc.data();

          // Vérifier que le membre est toujours en attente de validation
          if (freshData.status !== 'en_attente_validation' && freshData.status !== 'en_attente_paiement' && freshData.status !== 'en_attente_signature' && freshData.status !== 'sympathisant') {
            throw new functions.https.HttpsError('failed-precondition', `Statut actuel "${freshData.status}" — validation impossible`);
          }

          const updateData = {
            status: 'actif',
            validatedAt: admin.firestore.FieldValue.serverTimestamp(),
            validatedBy: context.auth.uid,
          };

          // S'assurer que cotisation.dateFin est défini (sinon carte membre cassée)
          if (!freshData.cotisation || !freshData.cotisation.dateFin) {
            const now = new Date();
            const type = freshData.cotisation?.type || freshData.formule || 'annuel';
            let dateFin;
            if (type === 'mensuel') {
              dateFin = new Date(now);
              dateFin.setMonth(dateFin.getMonth() + 1);
            } else {
              dateFin = new Date(now);
              dateFin.setFullYear(dateFin.getFullYear() + 1);
            }
            updateData.cotisation = {
              ...(freshData.cotisation || {}),
              type: type,
              dateDebut: freshData.cotisation?.dateDebut || admin.firestore.Timestamp.fromDate(now),
              dateFin: admin.firestore.Timestamp.fromDate(dateFin),
              montant: freshData.cotisation?.montant || freshData.montantPaye || 0,
            };
          }

          t.update(memberRef, updateData);
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
            await logServerError(
              'Membre validé mais email de validation non envoyé',
              'validateMembership_email_failed',
              { memberId, error: emailError.message }
            );
            // NE PAS throw — la validation est faite, seulement l'email a échoué
          }
        }

        // Envoyer notification push (multi-device)
        await sendPushToMember(memberId, '🎉 Adhésion validée !',
          'Félicitations, vous êtes maintenant membre actif.',
          { type: 'membership_approved', memberId },
          { category: 'MEMBERSHIP', threadId: 'membership' }
        );

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
        await createNotifBO({
          type: 'paiement',
          titre: '✅ Membre validé',
          message: `${context.auth.uid.substring(0, 8)}... a validé ${prenom} ${nom}`,
          membreId: memberId,
          membreNom: `${prenom} ${nom}`.trim(),
        });
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
            donateurEmail: (email || '').toLowerCase(),
            status: 'succeeded',
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
            await logServerError(
              'Membre validé (reject→don) mais email non envoyé',
              'validateMembership_email_failed',
              { memberId, error: emailError.message }
            );
          }
        }

        // 4. Envoyer notification push (multi-device)
        await sendPushToMember(memberId, 'Information adhésion',
          `Votre paiement de ${montant}€ a été converti en don.`,
          { type: 'membership_rejected', memberId },
          { category: 'MEMBERSHIP', threadId: 'membership' }
        );

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
        await createNotifBO({
          type: 'refus_admin',
          titre: '❌ Membre refusé',
          message: `${context.auth.uid.substring(0, 8)}... a refusé ${prenom} ${nom}`,
          membreId: memberId,
          membreNom: `${prenom} ${nom}`.trim(),
        });
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

        // Envoyer notification push (multi-device)
        await sendPushToMember(memberId, '📍 Passage au bureau demandé',
          'La mosquée souhaite vous rencontrer pour votre adhésion.',
          { type: 'visit_requested', memberId },
          { category: 'MEMBERSHIP', threadId: 'membership' }
        );

        console.log('📍 Demande de passage au bureau pour', prenom, nom);
        return { success: true, action: 'visit_requested' };
      }

    } catch (error) {
      console.error('❌ Erreur validateMembership:', error);
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ========================================================================
// UNDO VALIDATION - Annuler une validation admin (dans l'heure)
// ========================================================================
exports.undoValidation = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }

    const adminCheck = await isAdmin(context.auth.uid);
    if (!adminCheck) {
      throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs');
    }

    // SECURITE: Rate limiting — max 10 annulations de validation par heure
    await checkRateLimit(context.auth.uid, 'undoValidation', 10, 3600);

    const { memberId } = data;
    if (!memberId) {
      throw new functions.https.HttpsError('invalid-argument', 'memberId requis');
    }

    try {
      const memberRef = admin.firestore().collection('members').doc(memberId);
      const memberDoc = await memberRef.get();

      if (!memberDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Membre non trouvé');
      }

      const member = memberDoc.data();

      if (member.status !== 'actif') {
        throw new functions.https.HttpsError('failed-precondition', 'Le membre n\'est pas actif');
      }

      // Vérifier que la validation date de moins d'1 heure
      if (!member.validatedAt) {
        throw new functions.https.HttpsError('failed-precondition', 'Pas de date de validation trouvée');
      }

      const validatedAt = member.validatedAt.toDate ? member.validatedAt.toDate() : new Date(member.validatedAt);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      if (validatedAt < oneHourAgo) {
        throw new functions.https.HttpsError('failed-precondition', 'Annulation possible uniquement dans l\'heure suivant la validation');
      }

      await memberRef.update({
        status: 'en_attente_validation',
        validatedAt: admin.firestore.FieldValue.delete(),
        validatedBy: admin.firestore.FieldValue.delete(),
        undoneAt: admin.firestore.FieldValue.serverTimestamp(),
        undoneBy: context.auth.uid,
      });

      // Push notification au membre
      await sendPushToMember(memberId, 'Validation annulée', 'Votre validation a été annulée par un administrateur. Contactez la mosquée pour plus d\'informations.', {}, { category: 'MEMBERSHIP', threadId: 'membership' });

      await createNotifBO({
        type: 'validation_requise',
        titre: '↩️ Validation annulée',
        message: `${member.prenom || ''} ${member.nom || ''} — validation annulée par admin`.trim(),
        membreId: memberId,
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Erreur undoValidation:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
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
  .runWith({ secrets: ['BREVO_SMTP_PASS'] })
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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
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

  // Vérifier les infos essentielles de l'association (obligatoires pour validité CERFA)
  // Évite d'envoyer en masse des reçus avec "[À compléter]" si les paramètres sont vides
  if (!association.nom || !association.nom.trim()
      || !association.adresse || !association.adresse.trim()
      || !association.siren || !association.siren.trim()) {
    console.error('❌ Infos association incomplètes (nom/adresse/SIREN) — Reçus fiscaux non générés');
    return { success: false, error: 'Infos association incomplètes (nom, adresse ou SIREN) dans Paramètres > Reçus fiscaux' };
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

    const donorEmail = (p.donateurEmail || p.metadata?.donorEmail || p.metadata?.email || '').toLowerCase();
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

  // Traitement PROGRESSIF (scalable 5000+) : on ne (re)génère que les reçus PAS encore
  // émis cette année, par paquets de MAX_PER_RUN. Le cron tourne chaque jour de janvier
  // et reprend là où il s'est arrêté (idempotent) → tout est couvert avant fin janvier.
  const MAX_PER_RUN = 300;
  const alreadyDone = new Set();
  try {
    const doneSnap = await admin.firestore().collection('recus_fiscaux')
      .where('annee', '==', year).get();
    doneSnap.forEach((d) => { const dd = d.data() || {}; if (dd.status === 'sent' && dd.email) alreadyDone.add(String(dd.email).toLowerCase()); });
  } catch (e) { console.error('lecture recus_fiscaux existants:', e.message); }
  const pending = emails.filter((e) => !alreadyDone.has(String(e).toLowerCase()));
  const toProcess = pending.slice(0, MAX_PER_RUN);
  console.log(`🧾 ${alreadyDone.size} déjà émis · ${pending.length} en attente · ${toProcess.length} traités ce run`);

  if (emails.length === 0) {
    return { success: true, count: 0, message: 'Aucun donateur trouvé' };
  }

  // 4. Configuration email
  const brevoUser = BREVO_SMTP_USER;
  const brevoPass = BREVO_SMTP_PASS;
  const fromEmail = BREVO_FROM_EMAIL;
  const fromName = BREVO_FROM_NAME;

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
  const skippedNoAddress = []; // CERFA: adresse donateur obligatoire (art. 200 CGI / BOFiP)

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
      .get();
    // Ne bloquer que si un reçu FINALISÉ (sent) existe — un doc 'generating'/'failed' d'un essai raté doit pouvoir être réessayé (auto-guérison).
    if (existingRecu.docs.some((d) => (d.data() || {}).status === 'sent')) {
      console.log(`⏭️ Reçu fiscal déjà émis pour ${maskEmail(email)} (${year}), skip`);
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

    // Override adresse fiscale corrigée depuis le backoffice (priorité MAX)
    try {
      const ovSnap = await admin.firestore()
        .collection('members')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!ovSnap.empty) {
        const mo = ovSnap.docs[0].data();
        if (mo.recuFiscalAdresse && String(mo.recuFiscalAdresse).trim()) {
          donateur.adresse = String(mo.recuFiscalAdresse).trim();
          donateur.codePostal = String(mo.recuFiscalCP || donateur.codePostal || '').trim();
          donateur.ville = String(mo.recuFiscalVille || donateur.ville || '').trim();
          console.log('🏠 [annuel] Adresse fiscale corrigée (override) appliquée pour', email);
        }
      }
    } catch (ovErr) {
      console.error('override adresse fiscale (annuel):', ovErr.message);
    }

    // CERFA: adresse obligatoire -> on saute ce donateur (pas de reçu invalide) et on le signale.
    if (!donateur.adresse || !String(donateur.adresse).trim()) {
      console.warn('CERFA sauté (adresse manquante) pour', maskEmail(email));
      skippedNoAddress.push(email);
      return 'skipped_no_address';
    }

    // Numéro de reçu + création du document DANS la même transaction (zéro trou).
    const annualUserRecord = await admin.auth().getUserByEmail(email).catch(() => null);
    const recuCounterRef = admin.firestore().collection('counters').doc('recusFiscaux');
    const recuDocRef = admin.firestore().collection('recus_fiscaux').doc();
    const newNumber = await admin.firestore().runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(recuCounterRef);
      let currentNumber = 0;
      if (counterDoc.exists) {
        currentNumber = counterDoc.data()[`year_${year}`] || 0;
      }
      const nextNumber = currentNumber + 1;
      const numero = `RF-${year}-${String(nextNumber).padStart(5, '0')}`;
      transaction.set(recuCounterRef, { [`year_${year}`]: nextNumber }, { merge: true });
      transaction.set(recuDocRef, {
        numeroRecu: numero,
        annee: year,
        email,
        userId: annualUserRecord ? annualUserRecord.uid : null,
        donateur,
        donorType: donor.donorType,
        montantTotal: donor.total,
        donsDetails: donor.donsDetails,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'generating',
        source: 'auto_annual',
      });
      return nextNumber;
    });
    const numeroRecu = `RF-${year}-${String(newNumber).padStart(5, '0')}`;

    // Générer PDF (+ storage + email + finalisation) avec gestion d'échec : marque 'failed' (réessai au prochain run).
    try {
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

    // Le document a déjà été créé dans la transaction du numéro -> on le finalise en 'sent'.
    await recuDocRef.update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      recuFiscalUrl: filePath,
    });
    } catch (genErr) {
      await recuDocRef.update({ status: 'failed', failedAt: admin.firestore.FieldValue.serverTimestamp(), error: String((genErr && genErr.message) || genErr).slice(0, 200) }).catch(() => {});
      throw genErr;
    }

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

    console.log(`✅ Reçu ${numeroRecu} envoyé à ${maskEmail(email)} (${donor.total.toFixed(2)}€, ${donor.donorType})`);
    return 'success';
  };

  // Traiter par batch de 3 en parallèle
  const batchSize = 3;
  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
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
    processedThisRun: toProcess.length,
    remaining: Math.max(0, pending.length - successCount),
    successCount,
    errorCount,
    errors: errors.length > 0 ? errors : undefined,
    skippedNoAddress: skippedNoAddress.length > 0 ? skippedNoAddress : undefined,
    skippedNoAddressCount: skippedNoAddress.length,
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
  .pubsub.schedule('0 6 2-31 1 *')
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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ==================== CONFIRMATION DON PAR EMAIL ====================
// Trigger : quand un nouveau don est créé dans donations/{donationId}
// Envoie un email de confirmation avec récap et info fiscale
// Gère deux templates : particulier (66% art. 200 CGI) et entreprise (60% art. 238 bis)

exports.onDonationConfirmation = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'] })
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
    // FIX: L'app écrit status:'completed', le webhook écrit statut:'completed'
    // Il faut accepter les deux variantes
    const isCompleted = donation.statut === 'completed' || donation.status === 'succeeded' || donation.status === 'completed';
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

    // 5. Trouver l'email — fallback lookup membre par userId si champs email absents
    const donorEmail = (
      donation.donateurEmail
      || donation.email
      || donation.donorEmail
      || donation.donorInfo?.email
      || donation.metadata?.donorEmail
      || donation.metadata?.email
      || ''
    ).toLowerCase() || null;

    let finalEmail = donorEmail;
    if (!finalEmail && donation.userId) {
      try {
        const memberDoc = await admin.firestore().collection('members').doc(donation.userId).get();
        if (memberDoc.exists) {
          finalEmail = memberDoc.data()?.email || null;
          console.log(`📧 Email récupéré depuis membre ${donation.userId}: ${maskEmail(finalEmail)}`);
        }
      } catch (e) {
        console.error('onDonationConfirmation — lookup member failed:', e);
      }
    }

    // Fallback Stripe : receipt_email ou customer.email (Payment Links sans metadata)
    if (!finalEmail && donation.stripePaymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(donation.stripePaymentIntentId);
        if (pi.receipt_email) {
          finalEmail = pi.receipt_email.toLowerCase();
          console.log(`📧 Email récupéré depuis Stripe receipt_email: ${maskEmail(finalEmail)}`);
        } else if (pi.customer && typeof pi.customer === 'string') {
          const cust = await stripe.customers.retrieve(pi.customer);
          if (cust.email) {
            finalEmail = cust.email.toLowerCase();
            console.log(`📧 Email récupéré depuis Stripe customer: ${finalEmail}`);
          }
        }
        // Dernier recours : checkout session (Payment Links)
        if (!finalEmail) {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: donation.stripePaymentIntentId,
            limit: 1,
          });
          if (sessions.data.length > 0) {
            const sess = sessions.data[0];
            const sessEmail = (sess.customer_details?.email || sess.customer_email || '').toLowerCase() || null;
            if (sessEmail) {
              finalEmail = sessEmail;
              console.log(`📧 Email récupéré depuis Checkout Session: ${maskEmail(finalEmail)}`);
            }
          }
        }
        if (finalEmail) {
          // Mettre à jour le doc pour que l'historique fonctionne
          snap.ref.update({ donateurEmail: finalEmail }).catch(() => {});
        }
      } catch (e) {
        console.error('onDonationConfirmation — Stripe lookup failed:', e.message);
      }
    }

    if (!finalEmail) {
      await logServerError(
        'Don sans email récupérable — email de confirmation non envoyé',
        'onDonationConfirmation_no_email',
        { donationId, userId: donation.userId || 'inconnu' }
      );
      return null;
    }
    // Alias pour compatibilité avec le reste de la fonction
    const email = finalEmail;

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

    console.log(`📧 Email confirmation don ${donorType} pour ${maskEmail(email)} (${montant}€)`);

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
      const brevoUser = BREVO_SMTP_USER;
      const brevoPass = BREVO_SMTP_PASS;
      const fromEmail = BREVO_FROM_EMAIL;
      const fromName = BREVO_FROM_NAME || nomAssociation;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error(`[EMAIL ERROR] Config Brevo manquante. Email non envoyé à ${maskEmail(email)}`);
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

      console.log(`✅ Email confirmation don ${donorType} envoyé à ${maskEmail(email)}`);

      // Notif backoffice don reçu
      await createNotifBO({
        type: 'don',
        titre: '🤲 Don reçu',
        message: `${donorFirstName} ${donorLastName} a fait un don de ${montant.toFixed(0)}€`,
        membreId: donation.userId || null,
        membreNom: `${donorFirstName} ${donorLastName}`.trim() || 'Anonyme',
        montant: montant,
      });

      // Push notification FCM (multi-device)
      let donorUid = donation.userId || donation.metadata?.userId;
      // Fallback dons web (page /don sans connexion) : retrouver le membre par email
      // pour pouvoir lui envoyer le push de remerciement même sans userId sur le don.
      if (!donorUid && email) {
        try {
          const memberByEmail = await admin.firestore()
            .collection('members')
            .where('email', '==', email)
            .limit(1)
            .get();
          if (!memberByEmail.empty) {
            donorUid = memberByEmail.docs[0].id;
            console.log(`📲 Push don : membre retrouvé par email ${maskEmail(email)} → ${donorUid}`);
          }
        } catch (e) {
          console.error('onDonationConfirmation — lookup membre (push) échoué:', e.message);
        }
      }
      if (donorUid) {
        const pushMontant = montant > 0 ? `${montant.toFixed(0)}€` : '';
        await sendPushToMember(donorUid, '✅ Don reçu — Merci !',
          `Votre don${pushMontant ? ' de ' + pushMontant : ''} a bien été reçu. Barak Allahu fik.`,
          { type: 'don_received', donationId },
          { category: 'DONATION', threadId: 'donations' }
        );
      }

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
// Envoie un email de confirmation paiement cotisation (demande en attente de validation bureau)

exports.onCotisationConfirmation = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'] })
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
    // FIX: L'app écrit status:'completed', le webhook écrit status:'succeeded'
    // Il faut accepter les deux variantes
    const isCompleted = payment.statut === 'completed' || payment.status === 'succeeded' || payment.status === 'completed';
    if (!isCompleted) {
      console.log('Paiement non complété, skip:', paymentId);
      return null;
    }

    // 4. Ne pas envoyer l'email "Bienvenue" pour les renouvellements mensuels
    // Les docs créés par invoice.payment_succeeded ont source:'stripe_subscription'
    const isRenewal = payment.source === 'stripe_subscription';
    if (isRenewal) {
      console.log('Renouvellement mensuel, skip email bienvenue:', paymentId);
      // Marquer comme traité pour éviter les retries
      try {
        await snap.ref.update({ emailConfirmationSent: true });
      } catch (e) { /* ignore */ }
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
        await logServerError(
          'Cotisation confirmée mais email de confirmation non envoyé — email absent',
          'onCotisationConfirmation_no_email',
          { memberId: memberUid || payment.memberId || payment.membreId || 'inconnu', paymentId }
        );
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
      const brevoUser = BREVO_SMTP_USER;
      const brevoPass = BREVO_SMTP_PASS;
      const fromEmail = BREVO_FROM_EMAIL;
      const fromName = BREVO_FROM_NAME || nomAssociation;

      if (!brevoUser || !brevoPass || !fromEmail) {
        console.error(`[EMAIL ERROR] Config Brevo manquante. Email non envoyé à ${maskEmail(email)}`);
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
        // Override: le subject du template peut dire "Bienvenue membre actif"
        // mais le membre n'est PAS encore actif — il est en attente de validation
        subject = `Cotisation reçue - En attente de validation - ${nomAssociation}`;
        htmlContent = textToEmailHtml(template.body, {
          headerTitle: '📋 Demande d\'adhésion reçue',
          headerGradient: '#1565c0, #42a5f5',
          footerAssociation: nomAssociation,
          footerAdresse: adresseAssociation ? `${adresseAssociation}, ${codePostalAssociation} ${villeAssociation}` : '',
          footerTelephone: telephoneMosquee,
        });
      } else {
        subject = `Cotisation reçue - En attente de validation - ${nomAssociation}`;
        htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #1565c0 0%, #42a5f5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="color: white; margin: 0;">📋 Demande d'adhésion reçue</h1></div><div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;"><p>Salam alaykoum ${prenom},</p><p>Nous avons bien reçu votre paiement de cotisation. Votre demande d'adhésion est <strong>en cours d'examen par le bureau</strong>.</p><p>Vous recevrez un email de confirmation dès que votre adhésion sera validée.</p><p>Barakallahou fikoum,<br/>Le Bureau de ${nomAssociation}</p></div></div>`;
      }

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: subject,
        html: htmlContent,
      });

      console.log(`✅ Email confirmation cotisation envoyé à ${maskEmail(email)}`);

      // Notifs backoffice : cotisation reçue + validation requise
      const memberUidForNotif = payment.metadata?.memberId || '';
      const memberNameForNotif = prenom || payment.metadata?.memberName || 'Membre';
      await createNotifBO({
        type: 'paiement',
        titre: '💳 Cotisation reçue',
        message: `${memberNameForNotif} a payé ${montant.toFixed(0)}€ (${period === 'mensuel' ? 'mensuel' : 'annuel'})`,
        membreId: memberUidForNotif,
        membreNom: memberNameForNotif,
        montant: montant,
      });
      await createNotifBO({
        type: 'validation_requise',
        titre: '⏳ Validation requise',
        message: `${memberNameForNotif} attend votre validation`,
        membreId: memberUidForNotif,
        membreNom: memberNameForNotif,
      });

      // Push notification FCM (multi-device)
      let memberUidForPush = payment.metadata?.memberId || payment.membreId || payment.memberId || '';
      // Fallback : retrouver le membre par email si aucun identifiant sur le paiement
      if (!memberUidForPush && email) {
        try {
          const memberByEmail = await admin.firestore()
            .collection('members')
            .where('email', '==', email.toLowerCase())
            .limit(1)
            .get();
          if (!memberByEmail.empty) {
            memberUidForPush = memberByEmail.docs[0].id;
            console.log(`📲 Push cotisation : membre retrouvé par email ${maskEmail(email)} → ${memberUidForPush}`);
          }
        } catch (e) {
          console.error('onCotisationConfirmation — lookup membre (push) échoué:', e.message);
        }
      }
      if (memberUidForPush) {
        const pushMontant = montant > 0 ? `${montant.toFixed(0)}€` : '';
        await sendPushToMember(memberUidForPush, '✅ Paiement reçu — Merci !',
          `Votre cotisation${pushMontant ? ' de ' + pushMontant : ''} a bien été enregistrée. Votre adhésion est en cours de validation.`,
          { type: 'cotisation_received', paymentId },
          { category: 'MEMBERSHIP', threadId: 'membership' }
        );
      }

      // Marquer comme envoyé
      await snap.ref.update({
        emailConfirmationSent: true,
        emailConfirmationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, email };

    } catch (error) {
      console.error('❌ Erreur envoi email confirmation cotisation:', error);
      const uid = payment.metadata?.memberId ?? 'unknown';
      await logServerError(error.message ?? String(error), 'sendEmail', { stack: error.stack, uid });
      return { error: error.message };
    }
  });

// ========================================================================
// REFUND PAYMENT - Rembourser un paiement via Stripe
// ========================================================================
exports.refundPayment = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // Vérifier admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.actif !== true) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux admins actifs');
    }

    // SECURITE: Rate limiting — max 10 remboursements par heure
    await checkRateLimit(context.auth.uid, 'refundPayment', 10, 3600);

    // FIX D3: Ajout paramètre amount optionnel pour remboursement partiel
    const { memberId, reason, amount } = data;
    if (!memberId) {
      throw new functions.https.HttpsError('invalid-argument', 'memberId requis');
    }
    // Validation amount si fourni (remboursement partiel)
    if (amount !== undefined && amount !== null) {
      if (typeof amount !== 'number' || amount <= 0 || amount > 100000) {
        throw new functions.https.HttpsError('invalid-argument', 'Montant de remboursement invalide (1-100000)');
      }
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
            throw new functions.https.HttpsError('internal', 'Erreur lors du remboursement. Vérifiez le tableau de bord Stripe.');
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
      await createNotifBO({
        type: 'remboursement',
        titre: '💸 Remboursement',
        message: `Remboursement de ${refundedAmount}€ initié pour ${memberData.prenom || ''} ${memberData.nom || ''}`.trim(),
        membreId: memberId,
        membreNom: `${memberData.prenom || ''} ${memberData.nom || ''}`.trim(),
        montant: refundedAmount,
      });

      // Envoyer email de confirmation de remboursement au membre
      try {
        const memberEmail = memberData.email;
        if (memberEmail) {
          const fromEmail = BREVO_FROM_EMAIL;
          const fromName = BREVO_FROM_NAME;
          const refundTransporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS },
          });
          await refundTransporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: memberEmail,
            subject: 'Remboursement confirmé - El Mouhssinine',
            html: `
              <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #e65100, #ff9800); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Remboursement confirmé</h1>
                </div>
                <div style="padding: 30px; background: white;">
                  <p>Votre remboursement de <strong>${refundedAmount}€</strong> a bien été traité.</p>
                  <p>Il apparaîtra sur votre compte bancaire sous 5 à 10 jours ouvrés.</p>
                  <p style="margin-top: 20px;">L'équipe El Mouhssinine</p>
                </div>
                <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #999;">
                  <p style="margin: 0;">Association El Mohsinine</p>
                </div>
              </div>`,
          });
          console.log(`📧 Email remboursement envoyé à ${memberEmail.substring(0, 3)}***`);
        }
      } catch (emailError) {
        console.warn('⚠️ Email remboursement non envoyé (non bloquant):', emailError.message);
      }

      // Push notification remboursement (multi-device)
      await sendPushToMember(memberId, '💸 Remboursement en cours',
        `Votre remboursement de ${refundedAmount}€ a été initié. Comptez 5 à 10 jours ouvrés.`,
        { type: 'refund_initiated', memberId },
        { category: 'MEMBERSHIP', threadId: 'membership' }
      );

      // S11: Invalider le reçu fiscal lié si existant
      try {
        const recuQuery = await db.collection('recus_fiscaux')
          .where('stripePaymentIntentId', '==', stripePaymentId)
          .limit(1)
          .get();

        if (!recuQuery.empty) {
          await recuQuery.docs[0].ref.update({
            annule: true,
            dateAnnulation: admin.firestore.FieldValue.serverTimestamp(),
            raisonAnnulation: 'Remboursement',
          });
          console.log('📄 Reçu fiscal invalidé suite au remboursement');
          await createNotifBO({
            type: 'remboursement',
            titre: '📄 Reçu fiscal invalidé',
            message: `Reçu fiscal annulé suite au remboursement de ${refundedAmount}€ pour ${memberData.prenom || ''} ${memberData.nom || ''}`.trim(),
            membreId: memberId,
          });
        }
      } catch (recuErr) {
        console.warn('⚠️ Invalidation reçu fiscal non bloquante:', recuErr.message);
      }

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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ========================================================================
// UPDATE PAYMENT METHOD - Changer de carte bancaire
// ========================================================================
exports.updatePaymentMethod = functions
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

      if (!memberData.stripeCustomerId || !memberData.stripeSubscriptionId) {
        throw new functions.https.HttpsError('failed-precondition', 'Pas d\'abonnement actif');
      }

      if (memberData.cotisationType !== 'mensuel') {
        throw new functions.https.HttpsError('failed-precondition', 'Changement de carte disponible uniquement pour les cotisations mensuelles');
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: memberData.stripeCustomerId,
        usage: 'off_session',
        metadata: {
          subscriptionId: memberData.stripeSubscriptionId,
          uid: uid,
        },
      });

      return { clientSecret: setupIntent.client_secret };
    } catch (error) {
      console.error('❌ Erreur updatePaymentMethod:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Erreur lors de la mise à jour du moyen de paiement');
    }
  });

// ========================================================================
// CHECK PENDING PAYMENT - Vérifier paiement interrompu (3DS)
// ========================================================================
exports.checkPendingPayment = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }

    const { paymentIntentId } = data;
    if (!paymentIntentId) {
      throw new functions.https.HttpsError('invalid-argument', 'paymentIntentId requis');
    }

    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

      // SÉCURITÉ: Vérifier que le PaymentIntent appartient à l'utilisateur
      // Si pas de metadata userId, on refuse (sauf admin) — empêche l'accès à des PI sans ownership
      const piUserId = pi.metadata?.memberId || pi.metadata?.userId;
      if (!piUserId) {
        const isAdminUser = await isAdmin(context.auth.uid);
        if (!isAdminUser) {
          throw new functions.https.HttpsError('permission-denied', 'Paiement non attribué');
        }
      } else if (piUserId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Ce paiement ne vous appartient pas');
      }

      if (pi.status === 'succeeded') {
        // Vérifier si le webhook l'a déjà traité
        const existingPayment = await admin.firestore()
          .collection('payments')
          .where('stripePaymentIntentId', '==', paymentIntentId)
          .limit(1)
          .get();

        if (!existingPayment.empty) {
          return { status: 'already_processed' };
        }

        // Le webhook va le traiter — retourner succeeded pour que l'app sache
        return { status: 'succeeded' };
      } else if (pi.status === 'canceled' || pi.status === 'requires_payment_method') {
        return { status: 'expired' };
      } else if (pi.status === 'requires_action' || pi.status === 'requires_confirmation') {
        return { status: 'pending', clientSecret: pi.client_secret };
      } else {
        return { status: pi.status };
      }
    } catch (error) {
      console.error('❌ Erreur checkPendingPayment:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Erreur vérification paiement');
    }
  });

// ========================================================================
// SYNC PROFILE TO STRIPE - Synchroniser email/adresse vers Stripe
// ========================================================================
exports.syncProfileToStripe = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }

    const uid = context.auth.uid;

    try {
      const memberDoc = await admin.firestore().collection('members').doc(uid).get();
      if (!memberDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Profil non trouvé');
      }

      const memberData = memberDoc.data();
      if (!memberData.stripeCustomerId) {
        return { synced: false, reason: 'Pas de client Stripe' };
      }

      const updateFields = {};
      if (memberData.email) updateFields.email = memberData.email;
      if (memberData.nom || memberData.prenom) {
        updateFields.name = `${memberData.prenom || ''} ${memberData.nom || ''}`.trim();
      }
      if (memberData.adresse || memberData.ville || memberData.codePostal) {
        updateFields.address = {
          line1: memberData.adresse || '',
          city: memberData.ville || '',
          postal_code: memberData.codePostal || '',
          country: 'FR',
        };
      }

      await stripe.customers.update(memberData.stripeCustomerId, updateFields);
      console.log('Profil Stripe synchronisé pour:', uid.substring(0, 8));

      return { synced: true };
    } catch (error) {
      console.error('❌ Erreur syncProfileToStripe:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Erreur synchronisation Stripe');
    }
  });

// ========================================================================
// CANCEL SUBSCRIPTION - Annuler un abonnement mensuel
// ========================================================================
exports.cancelSubscription = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 30, memory: '256MB' })
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

      // Annuler l'abonnement Stripe — DOIT réussir, sinon on ne touche pas Firestore
      if (stripeSubscriptionId) {
        // Vérifier l'état réel de la subscription avant d'agir
        let sub;
        try {
          sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        } catch (retrieveErr) {
          console.error('Subscription introuvable sur Stripe:', stripeSubscriptionId, retrieveErr.message);
          throw new functions.https.HttpsError('not-found',
            'Abonnement introuvable sur Stripe. Contactez la mosquée.');
        }

        // Si déjà annulé ou expiré, on met juste à jour Firestore
        if (sub.status === 'canceled' || sub.cancel_at_period_end) {
          console.log('Subscription déjà annulée sur Stripe:', stripeSubscriptionId, 'status:', sub.status);
        } else {
          // Annulation à la fin de la période (le membre garde l'accès)
          await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
          console.log('Abonnement Stripe annulé à la fin de la période:', stripeSubscriptionId);

          // Vérifier que Stripe a bien pris en compte l'annulation
          const verified = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          if (!verified.cancel_at_period_end) {
            console.error('CRITIQUE: Stripe n\'a pas enregistré cancel_at_period_end pour:', stripeSubscriptionId);
            throw new functions.https.HttpsError('internal',
              'L\'annulation n\'a pas été confirmée par Stripe. Réessayez ou contactez la mosquée.');
          }
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
      await createNotifBO({
        type: 'annulation',
        titre: '📋 Annulation abonnement',
        message: `${memberData.prenom || ''} ${memberData.nom || ''} a annulé son abonnement mensuel`.trim(),
        membreId: uid,
        membreNom: `${memberData.prenom || ''} ${memberData.nom || ''}`.trim(),
      });

      // Envoyer email de confirmation d'annulation programmée immédiatement
      const cancelEmail = memberData.email;
      const cancelPrenom = memberData.prenom || memberData.nom || 'Membre';
      if (cancelEmail) {
        try {
          const brevoUser = BREVO_SMTP_USER;
          const brevoPass = BREVO_SMTP_PASS;
          const fromEmail = BREVO_FROM_EMAIL;
          const fromName = BREVO_FROM_NAME;

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

      // Push notification annulation (multi-device)
      const dateFin = memberData.cotisation?.dateFin;
      const dateFinStr = dateFin?.toDate ? dateFin.toDate().toLocaleDateString('fr-FR') : '';
      await sendPushToMember(uid, '📋 Annulation confirmée',
        `Votre abonnement mensuel sera actif jusqu'au ${dateFinStr || 'fin de période'}. Vous passerez ensuite en sympathisant.`,
        { type: 'subscription_cancelled' },
        { category: 'MEMBERSHIP', threadId: 'membership' }
      );

      return {
        success: true,
        message: 'Votre abonnement mensuel sera annulé à la fin de la période en cours. Vous gardez votre accès membre actif jusque-là.',
      };
    } catch (error) {
      console.error('❌ Erreur cancelSubscription:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
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
    if (!adminDoc.exists || adminDoc.data()?.actif !== true) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux admins actifs');
    }

    // SECURITE: Rate limiting — max 10 annulations abo par heure
    await checkRateLimit(context.auth.uid, 'adminCancelSubscription', 10, 3600);

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
        // Si l'abonnement est DÉJÀ annulé/terminé/inexistant côté Stripe, on autorise le nettoyage Firestore.
        let alreadyGone = false;
        try {
          const subCheck = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          alreadyGone = (subCheck.status === 'canceled' || subCheck.status === 'incomplete_expired');
        } catch (retrErr) {
          if (retrErr.code === 'resource_missing') alreadyGone = true;
        }
        if (!alreadyGone) {
          // Fail-closed : Stripe encore actif et annulation échouée -> NE PAS marquer annulé (sinon prélèvements invisibles)
          throw new functions.https.HttpsError('internal', 'L\'annulation Stripe a échoué. Réessayez ou vérifiez le tableau de bord Stripe.');
        }
        console.log('Abonnement déjà annulé/inexistant côté Stripe — nettoyage Firestore autorisé:', stripeSubscriptionId);
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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ========================================================================
// FIX D1: REFUND DONATION - Rembourser un don via Stripe
// ========================================================================
exports.refundDonation = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // Vérifier admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.actif !== true) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux admins actifs');
    }

    // SECURITE: Rate limiting — max 10 remboursements don par heure
    await checkRateLimit(context.auth.uid, 'refundDonation', 10, 3600);

    const { donationId, amount } = data; // amount optionnel pour remboursement partiel
    if (!donationId) {
      throw new functions.https.HttpsError('invalid-argument', 'donationId requis');
    }
    if (amount !== undefined && amount !== null) {
      if (typeof amount !== 'number' || amount <= 0 || amount > 100000) {
        throw new functions.https.HttpsError('invalid-argument', 'Montant de remboursement invalide (1-100000)');
      }
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
        throw new functions.https.HttpsError('internal', 'Erreur lors du remboursement. Vérifiez le tableau de bord Stripe.');
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

      // Envoyer email de confirmation de remboursement au donateur
      try {
        const donorEmail = donationData.donateurEmail || donationData.email;
        if (donorEmail) {
          const fromEmail = BREVO_FROM_EMAIL;
          const fromName = BREVO_FROM_NAME;
          const refundTransporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS },
          });
          await refundTransporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: donorEmail,
            subject: 'Remboursement de votre don confirmé - El Mouhssinine',
            html: `
              <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #e65100, #ff9800); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Remboursement confirmé</h1>
                </div>
                <div style="padding: 30px; background: white;">
                  <p>Le remboursement de votre don de <strong>${refundedAmount}€</strong> a bien été traité.</p>
                  <p>Il apparaîtra sur votre compte bancaire sous 5 à 10 jours ouvrés.</p>
                  <p style="margin-top: 20px;">L'équipe El Mouhssinine</p>
                </div>
                <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #999;">
                  <p style="margin: 0;">Association El Mohsinine</p>
                </div>
              </div>`,
          });
          console.log(`📧 Email remboursement don envoyé à ${donorEmail.substring(0, 3)}***`);
        }
      } catch (emailError) {
        console.warn('⚠️ Email remboursement don non envoyé (non bloquant):', emailError.message);
      }

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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
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
    const callerData = callerDoc.data();
    if (callerData.role !== 'super_admin' || callerData.actif !== true) {
      throw new functions.https.HttpsError('permission-denied', 'Seul un super_admin actif peut créer des admins');
    }
    // Anti-abus : limiter la création de comptes admin
    await checkRateLimit(context.auth.uid, 'createAdmin', 10, 3600);

    const { email, password, nom, role, permissions, actif } = data;

    if (!email || !password || !nom) {
      throw new functions.https.HttpsError('invalid-argument', 'Email, mot de passe et nom sont requis');
    }
    if (password.length < 8) {
      throw new functions.https.HttpsError('invalid-argument', 'Le mot de passe doit contenir au moins 8 caractères');
    }
    // Whitelist des rôles autorisés
    const allowedRoles = ['super_admin', 'admin', 'moderator'];
    if (role && !allowedRoles.includes(role)) {
      throw new functions.https.HttpsError('invalid-argument', `Rôle invalide. Autorisés: ${allowedRoles.join(', ')}`);
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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ==================== SUPPRESSION ADMIN ====================
// Supprime le document Firestore ET le compte Firebase Auth (evite les comptes orphelins).
exports.deleteAdmin = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
    }
    const callerDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'super_admin' || callerDoc.data().actif !== true) {
      throw new functions.https.HttpsError('permission-denied', 'Seul un super_admin actif peut supprimer un admin');
    }
    await checkRateLimit(context.auth.uid, 'deleteAdmin', 10, 3600);

    const { uid } = data;
    if (!uid || typeof uid !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'UID requis');
    }
    if (uid === context.auth.uid) {
      throw new functions.https.HttpsError('failed-precondition', 'Vous ne pouvez pas supprimer votre propre compte');
    }

    // Garde-fou : ne pas supprimer le dernier super_admin
    const targetDoc = await admin.firestore().collection('admins').doc(uid).get();
    if (targetDoc.exists && targetDoc.data().role === 'super_admin') {
      const supers = await admin.firestore().collection('admins').where('role', '==', 'super_admin').get();
      if (supers.size <= 1) {
        throw new functions.https.HttpsError('failed-precondition', 'Impossible de supprimer le dernier super administrateur');
      }
    }

    // 1. Supprimer le document Firestore
    await admin.firestore().collection('admins').doc(uid).delete();
    // 2. Supprimer le compte Firebase Auth (ignore si deja absent)
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') {
        console.error('deleteAdmin: echec suppression Auth', authErr.message);
      }
    }
    console.log('Admin supprime (doc + Auth):', uid);
    return { success: true };
  });

// ==================== VÉRIFICATION COTISATIONS EXPIRANTES ====================
// Cron quotidien à 08h00 : vérifie les cotisations qui expirent bientôt ou déjà expirées
// Envoie des emails de rappel à 30 jours, 7 jours, et le jour de l'expiration

exports.checkExpiringCotisations = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 300, memory: '512MB' })
  .pubsub.schedule('0 8 * * *')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    try {
      console.log('=== Vérification des cotisations expirantes ===');

      const brevoUser = BREVO_SMTP_USER;
      const brevoPass = BREVO_SMTP_PASS;
      const fromEmail = BREVO_FROM_EMAIL;
      const fromName = BREVO_FROM_NAME;

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

          // P1-5: Période de grâce 7 jours au lieu de passage immédiat à sympathisant
          const gracePeriodEnd = new Date(today);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
          await memberDoc.ref.update({
            gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodEnd),
            cotisationExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: email,
          subject: subject,
          html: htmlBody,
        });

        // Push notification FCM (multi-device, ne bloque pas le cron si échec)
        {
          let pushTitle, pushBody;
          if (emailType === 'remind30') {
            pushTitle = '⏰ Votre adhésion expire dans 30 jours';
            pushBody = 'Renouvelez votre cotisation pour rester membre actif.';
          } else if (emailType === 'remind7') {
            pushTitle = '⚠️ Votre adhésion expire dans 7 jours';
            pushBody = 'Plus que 7 jours — pensez à renouveler votre cotisation.';
          } else {
            pushTitle = '❌ Votre adhésion a expiré';
            pushBody = 'Votre statut est maintenant sympathisant. Renouvelez pour retrouver vos avantages.';
          }
          await sendPushToMember(memberDoc.id, pushTitle, pushBody,
            { type: 'expiration_reminder', emailType },
            { category: 'MEMBERSHIP', threadId: 'membership' }
          );
        }

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

    // Notif BO résumé expirations
    if (emailsSent.remind7 > 0) {
      await createNotifBO({
        type: 'expiration_proche',
        titre: '⚠️ Expiration imminente',
        message: `${emailsSent.remind7} membre(s) expirent dans 7 jours`,
      });
    }
    if (emailsSent.expired > 0) {
      await createNotifBO({
        type: 'expiration_proche',
        titre: '❌ Cotisations expirées',
        message: `${emailsSent.expired} cotisation(s) ont expiré aujourd'hui (grâce 7j activée)`,
      });
    }

    // ========== P1-5: Fin de période de grâce (J+7) ==========
    // Membres actifs avec gracePeriodEnd dans le passé → passer en sympathisant
    let graceExpired = 0;
    try {
      const graceSnapshot = await admin.firestore()
        .collection('members')
        .where('status', '==', 'actif')
        .where('gracePeriodEnd', '<=', admin.firestore.Timestamp.fromDate(today))
        .get();

      for (const gDoc of graceSnapshot.docs) {
        const gMember = gDoc.data();
        const gEmail = gMember.email;
        const gPrenom = gMember.prenom || '';

        // Passer en sympathisant
        await gDoc.ref.update({
          status: 'sympathisant',
          aPaye: false,
          gracePeriodExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Email relance J+7
        if (gEmail && !gMember.reminder_grace_expired_sent) {
          try {
            const graceBody = `Salam alaykoum${gPrenom ? ' ' + gPrenom : ''},\n\nVotre adhésion a expiré et la période de grâce est terminée.\n\nVotre statut est désormais **sympathisant**. Renouvelez votre cotisation depuis l'application pour retrouver votre statut de membre actif.\n\nNous espérons vous revoir bientôt parmi nos membres actifs.`;
            await transporter.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: gEmail,
              subject: 'Votre adhésion a expiré — Revenez !',
              html: textToEmailHtml(graceBody, {
                headerTitle: '🔔 Adhésion expirée',
                headerGradient: '#c62828, #ef5350',
                footerAssociation: assocData.nom || 'Mosquée El Mohsinine',
                footerAdresse: assocData.adresse || '',
                footerTelephone: assocData.telephone || '',
              }),
            });
            // Push
            await sendPushToMember(gDoc.id, '🔔 Votre adhésion El Mouhssinine a expiré',
              'Renouvelez maintenant pour retrouver votre statut de membre actif.',
              { type: 'grace_period_expired' },
              { category: 'MEMBERSHIP', threadId: 'membership' }
            );
            await gDoc.ref.update({ reminder_grace_expired_sent: true });
          } catch (eErr) {
            console.error('Erreur email/push grâce expirée:', eErr.message);
          }
        }
        graceExpired++;
      }
      if (graceExpired > 0) console.log(`Grâce expirée: ${graceExpired} membres passés en sympathisant`);
    } catch (graceErr) {
      console.error('Erreur traitement grâce:', graceErr.message);
    }

    // ========== P1-6: Relance J+30 (sympathisants récents) ==========
    let relance30 = 0;
    try {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const twentyEightDaysAgo = new Date(today);
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

      const relanceSnapshot = await admin.firestore()
        .collection('members')
        .where('status', '==', 'sympathisant')
        .where('cotisationExpiredAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .where('cotisationExpiredAt', '<=', admin.firestore.Timestamp.fromDate(twentyEightDaysAgo))
        .get();

      for (const rDoc of relanceSnapshot.docs) {
        const rMember = rDoc.data();
        const rEmail = rMember.email;
        const rPrenom = rMember.prenom || '';

        if (!rEmail || rMember.reminder_30d_relance_sent) continue;

        try {
          const relanceBody = `Salam alaykoum${rPrenom ? ' ' + rPrenom : ''},\n\nCela fait 30 jours que votre adhésion a expiré. Vous nous manquez !\n\nRenouvelez votre cotisation pour retrouver tous vos avantages :\n\n- ✨ Multiplier vos hassanates\n- 🗳️ Droit de vote en Assemblée Générale\n- 🎫 Carte de membre digitale\n- 📄 Reçu fiscal annuel\n\nUn an de cotisation = accès complet + reçu fiscal.`;
          await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: rEmail,
            subject: 'Vous nous manquez — Renouvelez votre adhésion',
            html: textToEmailHtml(relanceBody, {
              headerTitle: '💚 Rejoignez-nous à nouveau',
              headerGradient: '#2e7d32, #4caf50',
              footerAssociation: assocData.nom || 'Mosquée El Mohsinine',
              footerAdresse: assocData.adresse || '',
              footerTelephone: assocData.telephone || '',
            }),
          });
          // Push
          await sendPushToMember(rDoc.id, '💚 Rejoignez-nous à nouveau !',
            'Un an de cotisation = accès complet + reçu fiscal.',
            { type: 'relance_30d' },
            { category: 'MEMBERSHIP', threadId: 'membership' }
          );
          await rDoc.ref.update({ reminder_30d_relance_sent: true });
          relance30++;
        } catch (rErr) {
          console.error('Erreur relance J+30:', rErr.message);
        }
      }
      if (relance30 > 0) console.log(`Relance J+30: ${relance30} emails envoyés`);
    } catch (relanceErr) {
      console.error('Erreur relance J+30:', relanceErr.message);
    }

    console.log(`=== Cron terminé ===`);
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
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 120, memory: '256MB' })
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
        await logServerError(
          `Divergence Stripe/Firestore: ${mismatches.length} paiement(s) non trouvé(s)`,
          'reconcileStripePayments_divergence',
          { count: mismatches.length, mismatches: mismatches.slice(0, 3) }
        );

        const brevoUser = BREVO_SMTP_USER;
        const brevoPass = BREVO_SMTP_PASS;
        const fromEmail = BREVO_FROM_EMAIL;
        const fromName = BREVO_FROM_NAME;

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

    // SECURITE: Rate limiting — max 5 suppressions par heure (action destructive)
    await checkRateLimit(adminUid, 'deleteMemberByAdmin', 5, 3600);

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

      // S12: Protection dernier admin
      const targetAdminDoc = await db.collection('admins').doc(memberId).get();
      if (targetAdminDoc.exists) {
        const allAdmins = await db.collection('admins').get();
        if (allAdmins.size <= 1) {
          throw new functions.https.HttpsError('failed-precondition', 'Impossible de supprimer le dernier administrateur');
        }
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
      // Query par userId ET par email pour couvrir les dons publics sans userId
      try {
        const memberEmail = (memberData.email || '').toLowerCase();
        const [donByUid, donByEmail] = await Promise.all([
          db.collection('donations').where('userId', '==', memberUid).get(),
          memberEmail
            ? db.collection('donations').where('donateurEmail', '==', memberEmail).get()
            : Promise.resolve({ empty: true, docs: [] }),
        ]);

        const donDocsMap = new Map();
        [...(donByUid.docs || []), ...(donByEmail.docs || [])].forEach(d => donDocsMap.set(d.id, d));
        const donDocs = Array.from(donDocsMap.values());

        if (donDocs.length > 0) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;

          donDocs.forEach((doc) => {
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

          log.steps.push({ action: 'anonymized_donations', count: donDocs.length });
          console.log(`${donDocs.length} donation(s) anonymisée(s)`);
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
      await createNotifBO({
        type: 'compte_supprime',
        titre: '🗑️ Compte supprimé par admin',
        message: `Admin a supprimé le compte de ${log.memberName || memberId}`,
        membreId: memberId,
        membreNom: log.memberName || null,
      });

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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
    }
  });

// ==================== DELETE MY ACCOUNT (SELF-SERVICE RGPD) ====================
exports.deleteMyAccount = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 120, memory: '256MB' })
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
      // S12: Protection dernier admin
      const selfAdminDoc = await db.collection('admins').doc(uid).get();
      if (selfAdminDoc.exists) {
        const allAdmins = await db.collection('admins').get();
        if (allAdmins.size <= 1) {
          throw new functions.https.HttpsError('failed-precondition', 'Impossible de supprimer le dernier administrateur');
        }
      }

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

      // 4a. Anonymiser donations (par userId ET par email pour couvrir les dons publics)
      try {
        const memberEmail = (memberData?.email || '').toLowerCase();
        const [donByUid, donByEmail] = await Promise.all([
          db.collection('donations').where('userId', '==', uid).get(),
          memberEmail
            ? db.collection('donations').where('donateurEmail', '==', memberEmail).get()
            : Promise.resolve({ empty: true, docs: [] }),
        ]);

        const donDocsMap = new Map();
        [...(donByUid.docs || []), ...(donByEmail.docs || [])].forEach(d => donDocsMap.set(d.id, d));
        const donDocs = Array.from(donDocsMap.values());

        if (donDocs.length > 0) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;
          donDocs.forEach((doc) => {
            batch.update(doc.ref, {
              donateur: anonymizeLabel, email: '', telephone: '', donateurEmail: '',
              userId: 'deleted', anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            count++;
            if (count % 500 === 0) { chunks.push(batch); batch = db.batch(); }
          });
          chunks.push(batch);
          for (const b of chunks) { await b.commit(); }
          log.steps.push({ action: 'anonymized_donations', count: donDocs.length });
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
        const msgSnap = await db.collection('messages').where('odUserId', '==', uid).get();
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

      // 4d. Anonymiser reçus fiscaux (garder montant, année — effacer identité, obligation fiscale 10 ans)
      try {
        // Query par userId ET par email pour couvrir les anciens reçus sans userId
        const [recuByUid, recuByEmail] = await Promise.all([
          db.collection('recus_fiscaux').where('userId', '==', uid).get(),
          memberData?.email
            ? db.collection('recus_fiscaux').where('email', '==', memberData.email).get()
            : Promise.resolve({ empty: true, docs: [] }),
        ]);

        const recuDocsMap = new Map();
        [...(recuByUid.docs || []), ...(recuByEmail.docs || [])].forEach(d => recuDocsMap.set(d.id, d));
        const recuDocs = Array.from(recuDocsMap.values());

        const recuSnap = { empty: recuDocs.length === 0, docs: recuDocs, size: recuDocs.length };

        if (!recuSnap.empty) {
          const chunks = [];
          let batch = db.batch();
          let count = 0;

          recuSnap.docs.forEach((doc) => {
            batch.update(doc.ref, {
              nom: 'Donateur anonyme',
              prenom: '',
              email: 'supprime@supprime.fr',
              adresse: '',
              userId: 'deleted_' + uid,
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
        }
      } catch (err) {
        log.steps.push({ action: 'error_recus_fiscaux', error: err.message });
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

      // 6b. Email confirmation suppression AVANT destruction du compte Auth
      if (memberData && memberData.email) {
        try {
          const brevoUser = BREVO_SMTP_USER;
          const brevoPass = BREVO_SMTP_PASS;
          const fromEmail = BREVO_FROM_EMAIL;
          const fromName = BREVO_FROM_NAME;
          if (brevoUser && brevoPass && fromEmail) {
            const delTransporter = nodemailer.createTransport({
              host: 'smtp-relay.brevo.com',
              port: 587,
              secure: false,
              auth: { user: brevoUser, pass: brevoPass },
            });
            await delTransporter.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: memberData.email,
              subject: 'Votre compte El Mouhssinine a été supprimé',
              html: textToEmailHtml(
                `Salam alaykoum,\n\nVotre compte et vos données personnelles ont été supprimés conformément au RGPD.\n\nSi vous souhaitez revenir, vous pouvez créer un nouveau compte à tout moment depuis l'application.\n\nL'équipe El Mouhssinine`,
                {
                  headerTitle: '🗑️ Compte supprimé',
                  headerGradient: '#616161, #9e9e9e',
                  footerAssociation: 'Mosquée El Mohsinine',
                }
              ),
            });
            log.steps.push({ action: 'deletion_email_sent' });
          }
        } catch (emailErr) {
          log.steps.push({ action: 'deletion_email_failed', reason: emailErr.message });
          // Ne pas bloquer la suppression si l'email échoue
        }
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
      await createNotifBO({
        type: 'compte_supprime',
        titre: '🗑️ Compte supprimé',
        message: `Un membre a supprimé son propre compte${log.memberName ? ' (' + log.memberName + ')' : ''}`,
      });
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
      throw new functions.https.HttpsError('internal', 'Une erreur est survenue. Veuillez réessayer.');
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

    const [memberDoc, donationsSnap, paymentsSnap, messagesSnap, recusSnap] = await Promise.all([
      db.collection('members').doc(uid).get(),
      db.collection('donations').where('userId', '==', uid).get(),
      db.collection('payments').where('metadata.memberId', '==', uid).get(),
      db.collection('messages').where('odUserId', '==', uid).get(),
      db.collection('recus_fiscaux').where('userId', '==', uid).get(),
    ]);

    const sanitizeTimestamp = (val) => {
      if (!val) return null;
      if (val.toDate) return val.toDate().toISOString();
      return val;
    };

    // SECURITE: champs internes à exclure de l'export RGPD
    const INTERNAL_FIELDS = new Set([
      'stripeCustomerId', 'stripeSubscriptionId', 'stripePaymentId',
      'fcmTokens', 'fcmToken', 'paiementId', 'inscritPar',
      'validatedBy', 'metadata',
    ]);

    const sanitizeDoc = (doc, excludeInternal = false) => {
      const d = doc.data();
      const result = { id: doc.id };
      for (const [key, val] of Object.entries(d)) {
        if (excludeInternal && INTERNAL_FIELDS.has(key)) continue;
        result[key] = sanitizeTimestamp(val);
      }
      return result;
    };

    return {
      exportedAt: new Date().toISOString(),
      profil: memberDoc.exists ? sanitizeDoc(memberDoc, true) : {},
      donations: donationsSnap.docs.map(d => sanitizeDoc(d, true)),
      paiements: paymentsSnap.docs.map(d => sanitizeDoc(d, true)),
      messages: messagesSnap.docs.map(d => sanitizeDoc(d)),
      recus_fiscaux: recusSnap.docs.map(d => sanitizeDoc(d)),
    };
  });

// ════════════════════════════════════════
// PIÈGE 5 — onAuthUserDeleted
// Filet de sécurité : si un compte Auth est supprimé
// (ex: via console Firebase, suppression manuelle, ou API)
// sans passer par deleteMyAccount/deleteMemberByAdmin,
// cette function nettoie les données orphelines.
// NOTE: functions.auth.user() ne supporte PAS .region()
// ════════════════════════════════════════
exports.onAuthUserDeleted = functions
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 60, memory: '256MB' })
  .auth.user().onDelete(async (user) => {
    const uid = user.uid;
    const email = user.email || '';
    console.log(`=== onAuthUserDeleted: ${uid} (${maskEmail(email)}) ===`);

    const db = admin.firestore();

    // Guard : si deleteMyAccount/deleteMemberByAdmin a déjà traité, skip
    const deletionLogSnap = await db.collection('deletion_logs')
      .where('uid', '==', uid).limit(1).get();
    if (!deletionLogSnap.empty) {
      console.log(`onAuthUserDeleted: déjà traité par deletion_logs, skip.`);
      return;
    }

    try {
      // Chercher le document membre
      let memberRef = null;
      let memberData = null;

      const memberByUid = await db.collection('members')
        .where('uid', '==', uid).limit(1).get();
      if (!memberByUid.empty) {
        memberRef = memberByUid.docs[0].ref;
        memberData = memberByUid.docs[0].data();
      } else {
        const directDoc = await db.collection('members').doc(uid).get();
        if (directDoc.exists) {
          memberRef = directDoc.ref;
          memberData = directDoc.data();
        }
      }

      if (memberRef && memberData) {
        // Annuler abonnement Stripe si actif
        if (memberData.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(memberData.stripeSubscriptionId);
          } catch (e) {
            console.log('onAuthUserDeleted: Stripe cancel skip:', e.message);
          }
        }

        // Anonymiser le document membre (ne pas supprimer pour audit)
        await memberRef.update({
          nom: '[supprimé]',
          prenom: '[supprimé]',
          email: '[supprimé]',
          telephone: '[supprimé]',
          adresse: '[supprimé]',
          uid: `deleted_${uid}`,
          status: 'annule',
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          deletedBy: 'onAuthUserDeleted',
          fcmTokens: admin.firestore.FieldValue.delete(),
          fcmToken: admin.firestore.FieldValue.delete(),
        });
      }

      // Supprimer messages
      const messagesSnap = await db.collection('messages')
        .where('odUserId', '==', uid).get();
      const batch = db.batch();
      messagesSnap.docs.forEach(doc => batch.delete(doc.ref));
      if (!messagesSnap.empty) await batch.commit();

      // Supprimer doc admin si existant — GUARD : ne pas supprimer le dernier admin
      const adminDoc = await db.collection('admins').doc(uid).get();
      if (adminDoc.exists) {
        const allAdmins = await db.collection('admins').get();
        if (allAdmins.size <= 1) {
          console.warn(`onAuthUserDeleted: ${uid} est le dernier admin — doc admins conservé`);
        } else {
          await adminDoc.ref.delete();
        }
      }

      // Log RGPD
      await db.collection('deletion_logs').add({
        uid,
        email: '[supprimé]',
        deletedBy: 'onAuthUserDeleted',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        memberFound: !!memberRef,
        messagesDeleted: messagesSnap.size,
      });

      await createNotifBO({
        type: 'compte_supprime',
        titre: '🗑️ Compte Auth supprimé (orphelin)',
        message: `UID ${uid} supprimé hors app — données nettoyées automatiquement.`,
      });

      console.log(`=== onAuthUserDeleted: ${uid} nettoyé ===`);
    } catch (error) {
      console.error('❌ onAuthUserDeleted error:', error);
    }
  });

// ─── MONITOR SILENT BUGS ─────────────────────────────────────────────────────
// Se declenche toutes les 10 minutes. Verifie errors_log, membres paymentFailed,
// et membres bloques en en_attente_validation > 30 min.
// Envoie un WhatsApp si des anomalies sont detectees.

// Alerte technique (dev) par EMAIL via Brevo — canal fiable pour les bugs
// (le WhatsApp sandbox Twilio expire toutes les 24-72h, l'email reste fiable).
const DEV_ALERT_EMAIL = 'faicalkriouar@gmail.com';
const sendDevAlertEmail = async (subject, bodyText) => {
  try {
    if (!BREVO_SMTP_USER || !BREVO_SMTP_PASS || !BREVO_FROM_EMAIL) {
      console.error('sendDevAlertEmail: Brevo non configuré');
      return;
    }
    const t = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com', port: 587, secure: false,
      auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS },
    });
    await t.sendMail({
      from: `"${BREVO_FROM_NAME || 'El Mouhssinine'} — Alertes" <${BREVO_FROM_EMAIL}>`,
      to: DEV_ALERT_EMAIL,
      subject,
      html: textToEmailHtml(bodyText, { headerTitle: subject, headerGradient: '#dc2626, #ef4444' }),
    });
    console.log('Alerte dev email envoyée:', subject);
  } catch (e) {
    console.error('Echec alerte dev email:', e.message);
  }
};

exports.monitorSilentBugs = functions
  .runWith({ secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM', 'TWILIO_WHATSAPP_TO', 'BREVO_SMTP_PASS'] })
  .region('europe-west1')
  .pubsub.schedule('every 10 minutes')
  .timeZone('Europe/Paris')
  .onRun(async (_context) => {
    const issues = [];
    let hasFreshAlerts = false; // erreurs nouvelles (errors_log) -> toujours envoyees
    const db = admin.firestore();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    // 1. errors_log — erreurs non alertees
    try {
      const errorsSnap = await db
        .collection('errors_log')
        .where('alerted', '==', false)
        .limit(20)
        .get();

      if (!errorsSnap.empty) {
        issues.push(`⚠️ ${errorsSnap.size} erreur(s) silencieuse(s)`);
        hasFreshAlerts = true;

        // Marquer comme alertees
        const batch = db.batch();
        errorsSnap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            alerted: true,
            alertedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();

        // Detailler les 3 premieres
        errorsSnap.docs.slice(0, 3).forEach((doc) => {
          const d = doc.data();
          issues.push(`   • [${d.context ?? '?'}] ${String(d.message ?? '').slice(0, 80)}`);
        });
      }
    } catch (err) {
      console.error('monitorSilentBugs errors_log:', err.message);
    }

    // 2. Membres avec paymentFailed: true
    try {
      const failedSnap = await db
        .collection('members')
        .where('paymentFailed', '==', true)
        .limit(10)
        .get();

      if (!failedSnap.empty) {
        const names = failedSnap.docs
          .slice(0, 3)
          .map((d) => `${d.data().prenom ?? ''} ${d.data().nom ?? ''}`.trim())
          .join(', ');
        issues.push(
          `💳 ${failedSnap.size} membre(s) paiement echoue: ${names}${failedSnap.size > 3 ? '...' : ''}`,
        );
      }
    } catch (err) {
      console.error('monitorSilentBugs paymentFailed:', err.message);
    }

    // 3. [DÉSACTIVÉ] Alerte "membre en attente de validation > 30 min".
    // La validation est manuelle (le bureau valide à la main, peut prendre des jours)
    // -> ce contrôle générait du bruit. Retiré sur décision de Faiçal (2026-06-09).
    // La cloche backoffice "Validation requise" reste, elle, active.

    // 4. Dons sans userId créés dans les 90 dernières minutes
    try {
      const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000);
      const donsNoUserSnap = await db
        .collection('donations')
        .where('userId', '==', '')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(ninetyMinAgo))
        .limit(5)
        .get();

      if (!donsNoUserSnap.empty) {
        // userId vide est NORMAL pour les dons web publics et anonymes -> ne pas alerter
        const reels = donsNoUserSnap.docs.filter((doc) => {
          const dd = doc.data();
          return dd.source !== "web_don_public" && dd.isAnonymous !== true;
        });
        if (reels.length > 0) {
          issues.push(`💸 ${reels.length} don(s) app sans userId (90 dernières min)`);
        }
      }
    } catch (err) {
      console.error('monitorSilentBugs dons_no_userId:', err.message);
    }

    // 5. Membres actifs dont cotisation.dateFin est expirée (drift Stripe/Firestore)
    try {
      const now = admin.firestore.Timestamp.now();
      const expiredActiveSnap = await db
        .collection('members')
        .where('status', '==', 'actif')
        .where('cotisation.dateFin', '<', now)
        .limit(10)
        .get();

      if (!expiredActiveSnap.empty) {
        const names = expiredActiveSnap.docs
          .slice(0, 3)
          .map((d) => `${d.data().prenom ?? ''} ${d.data().nom ?? ''}`.trim())
          .join(', ');
        issues.push(
          `🔄 ${expiredActiveSnap.size} membre(s) "actif" avec cotisation expirée (drift): ${names}${expiredActiveSnap.size > 3 ? '...' : ''}`,
        );
      }
    } catch (err) {
      console.error('monitorSilentBugs actif_cotisation_expired:', err.message);
    }

    // 6. Erreurs Cloud Function récentes dans errors_log non encore alertées
    try {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const cfErrorsSnap = await db
        .collection('errors_log')
        .where('screen', '==', 'CloudFunction')
        .where('alerted', '==', false)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(tenMinAgo))
        .limit(10)
        .get();

      if (!cfErrorsSnap.empty) {
        issues.push(`⚙️ ${cfErrorsSnap.size} erreur(s) CF récente(s) (10 dernières min)`);
        hasFreshAlerts = true;
        const batch = db.batch();
        cfErrorsSnap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            alerted: true,
            alertedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();

        cfErrorsSnap.docs.slice(0, 2).forEach((doc) => {
          const d = doc.data();
          issues.push(`   • [${d.context ?? '?'}] ${String(d.message ?? '').slice(0, 80)}`);
        });
      }
    } catch (err) {
      console.error('monitorSilentBugs cf_errors_recent:', err.message);
    }

    if (issues.length === 0) {
      console.log('monitorSilentBugs: OK — aucune anomalie');
      return null;
    }

    // Anti-spam : ne pas re-alerter une anomalie persistante identique trop souvent.
    // Les erreurs fraiches (errors_log) sont toujours envoyees (deja dedupliquees par alerted).
    const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 h
    const signature = issues
      .filter((l) => !l.startsWith('   '))
      .map((l) => l.split(':')[0].trim())
      .sort()
      .join(' | ');
    const monitorStateRef = db.collection('system').doc('monitoring_state');
    try {
      const stateSnap = await monitorStateRef.get();
      const prev = stateSnap.exists ? stateSnap.data() : {};
      const lastAt = prev.lastAlertAt && prev.lastAlertAt.toMillis ? prev.lastAlertAt.toMillis() : 0;
      const sameSignature = prev.lastSignature === signature;
      const withinCooldown = Date.now() - lastAt < ALERT_COOLDOWN_MS;
      if (!hasFreshAlerts && sameSignature && withinCooldown) {
        console.log('monitorSilentBugs: anomalies persistantes inchangees — alerte deja envoyee, skip (cooldown 6h)');
        return null;
      }
    } catch (err) {
      console.error('monitorSilentBugs: lecture etat anti-spam echouee, on alerte par securite:', err.message);
    }

    // Envoyer WhatsApp
    const heure = new Date().toLocaleTimeString('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
    });
    const message =
      `🔍 MONITORING El Mouhssinine (${heure})\n\n` +
      issues.join('\n') +
      '\n\nBackoffice: https://el-mouhssinine.web.app';

    try {
      const twilio = require('twilio');
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );
      await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
        to: `whatsapp:${process.env.TWILIO_WHATSAPP_TO}`,
        body: message,
      });
      console.log(`monitorSilentBugs: WhatsApp envoye — ${issues.length} issue(s)`);
    } catch (err) {
      console.error('monitorSilentBugs: echec WhatsApp:', err.message);
    }

    // Alerte EMAIL (canal fiable, indépendant du WhatsApp sandbox)
    await sendDevAlertEmail(`🔍 Monitoring El Mouhssinine — ${issues.length} anomalie(s)`, message);

    try {
      await monitorStateRef.set({
        lastSignature: signature,
        lastAlertAt: admin.firestore.FieldValue.serverTimestamp(),
        lastIssuesCount: issues.length,
      }, { merge: true });
    } catch (err) {
      console.error('monitorSilentBugs: ecriture etat anti-spam echouee:', err.message);
    }

    return null;
  });

// ─── WHATSAPP CRASH ALERT ─────────────────────────────────────────────────────
// Se declenche automatiquement quand Crashlytics detecte un nouveau crash fatal.
// Envoie un WhatsApp a Faical via Twilio.
// Variables d'env necessaires (firebase functions:secrets:set) :
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//   TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_TO

const { onNewFatalIssuePublished } = require('firebase-functions/v2/alerts/crashlytics');

exports.alertCrashWhatsApp = onNewFatalIssuePublished(
  {
    region: 'europe-west1',
    secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM', 'TWILIO_WHATSAPP_TO', 'BREVO_SMTP_PASS'],
  },
  async (event) => {
    const issue = event.data.payload.issue;
    const appId = event.appId ?? 'el-mouhssinine';
    const issueId = issue?.id ?? 'inconnu';
    const title = issue?.title ?? 'Crash inconnu';
    const subtitle = issue?.subtitle ?? '';
    const impacted = issue?.impactedDevicesCount ?? '?';
    const platform = appId.includes('ios') ? 'iOS' : 'Android';

    const message =
      `CRASH El Mouhssinine ${platform}\n\n` +
      `Erreur : ${title}\n` +
      `Detail : ${subtitle}\n` +
      `Appareils touches : ${impacted}\n` +
      `Issue ID : ${issueId}\n\n` +
      `Ouvre Claude Code et tape :\n` +
      `"verifie les bugs"\n\n` +
      `https://console.firebase.google.com/project/el-mouhssinine/crashlytics`;

    try {
      const twilio = require('twilio');
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );
      await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
        to: `whatsapp:${process.env.TWILIO_WHATSAPP_TO}`,
        body: message,
      });
      console.log(`WhatsApp crash alert envoye pour issue ${issueId}`);
    } catch (err) {
      // Ne jamais laisser l'alert crasher — juste logger
      console.error('Echec envoi WhatsApp crash alert:', err.message);
    }

    // Alerte EMAIL (canal fiable)
    await sendDevAlertEmail('🚨 Crash El Mouhssinine', message);
  },
);

// ============================================================
// createPublicCheckoutSession — Stripe Checkout pour la page /don
// Remplace le Payment Link statique (buy.stripe.com) qui s'affichait
// en noir sur les appareils en dark mode (appearance non configurable via API).
// Checkout Sessions (checkout.stripe.com) utilisent toujours le thème clair.
// ============================================================
exports.createPublicCheckoutSession = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    const ALLOWED_ORIGIN = 'https://el-mouhssinine.web.app';
    res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Méthode non autorisée' }); return; }

    try {
      // Rate limiting par IP : max 10 sessions par heure
      const clientIp = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0].trim();
      const ipKey = `rate_limits/ip_checkout_${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const ipRef = admin.firestore().doc(ipKey);
      const ipDoc = await ipRef.get();
      const now = Date.now();
      const windowMs = 3600 * 1000; // 1 heure
      if (ipDoc.exists) {
        const calls = (ipDoc.data().calls || []).filter(t => now - t < windowMs);
        if (calls.length >= 10) {
          return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
        }
        calls.push(now);
        await ipRef.update({ calls, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        await ipRef.set({ calls: [now], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }

      const { amount, email, name } = req.body || {};
      const amountCents = Math.round(parseFloat(amount) * 100);

      if (!amountCents || amountCents < 100 || amountCents > 500000) {
        return res.status(400).json({ error: 'Montant invalide (1€ – 5000€)' });
      }

      const sessionParams = {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: 'Don à El Mouhssinine' },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        success_url: `${ALLOWED_ORIGIN}/don?success=1&app_redirect=${encodeURIComponent('fr.elmouhssinine.mosquee://don-success')}`,
        cancel_url: `${ALLOWED_ORIGIN}/don`,
        metadata: {
          type: 'donation',
          donorEmail: email ? email.toLowerCase() : '',
          donorName: name || '',
          source: 'web_don_public',
        },
        customer_email: email ? email.toLowerCase() : undefined,
        payment_intent_data: {
          metadata: {
            type: 'donation',
            source: 'web_don_public',
            donorEmail: email ? email.toLowerCase() : '',
            donorName: name || '',
            userId: '',
            memberId: '',
          },
        },
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      return res.json({ url: session.url });
    } catch (err) {
      console.error('createPublicCheckoutSession error:', err.message);
      return res.status(500).json({ error: 'Une erreur est survenue. Veuillez réessayer.' });
    }
  });

// ============================================================
// backfillWebDonations — DÉSACTIVÉ (one-shot terminé, token compromis dans Git)
// Anciennement : patchait les dons web orphelins (donateurEmail vide)
// Sécurité Build 285b : endpoint désactivé car token hardcodé dans l'historique Git
// ============================================================
exports.backfillWebDonations = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    // DÉSACTIVÉ — one-shot terminé + token compromis
    return res.status(410).json({ error: 'Endpoint désactivé (one-shot terminé)' });

    // Code mort ci-dessous conservé pour référence — ne sera jamais exécuté
    const token = req.headers['x-admin-token'];
    if (token !== 'DISABLED') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const results = { found: 0, patched: 0, skipped: 0, errors: [] };

    try {
      // 1. Récupérer tous les docs donations/ avec donateurEmail vide
      const snapshot = await admin.firestore()
        .collection('donations')
        .where('donateurEmail', '==', '')
        .get();

      results.found = snapshot.size;

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skipper si déjà un email valide
        if (data.donateurEmail && data.donateurEmail.trim() !== '') {
          results.skipped++;
          continue;
        }

        const piId = data.stripePaymentIntentId;
        if (!piId) {
          results.errors.push({ id: doc.id, reason: 'stripePaymentIntentId manquant' });
          continue;
        }

        try {
          // 2. Récupérer l'email depuis Stripe via les Checkout Sessions liées
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: piId,
            limit: 1,
          });

          if (!sessions.data.length) {
            results.errors.push({ id: doc.id, piId, reason: 'Aucune session Stripe trouvée' });
            continue;
          }

          const session = sessions.data[0];
          const donorEmail = (
            session.customer_details?.email ||
            session.customer_email ||
            ''
          ).toLowerCase().trim();

          const donorName =
            session.customer_details?.name ||
            data.donateur ||
            'Anonyme';

          if (!donorEmail) {
            results.errors.push({ id: doc.id, piId, reason: 'Email absent dans la session Stripe' });
            continue;
          }

          // 3. Lookup membre par email
          let userId = data.userId || '';
          if (!userId) {
            const memberSnap = await admin.firestore()
              .collection('members')
              .where('email', '==', donorEmail)
              .limit(1)
              .get();
            if (!memberSnap.empty) {
              userId = memberSnap.docs[0].id;
            }
          }

          // 4. Patcher le document Firestore
          const updatePayload = {
            donateurEmail: donorEmail,
            donateur: donorName,
            backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          if (userId) {
            updatePayload.userId = userId;
            updatePayload.memberId = userId;
          }

          await doc.ref.update(updatePayload);
          results.patched++;
          console.log(`Backfill OK: ${doc.id} → ${donorEmail} (userId: ${userId || 'non trouvé'})`);

        } catch (docErr) {
          results.errors.push({ id: doc.id, piId, reason: docErr.message });
        }
      }

      return res.status(200).json({
        success: true,
        ...results,
      });

    } catch (err) {
      return res.status(500).json({ error: 'Une erreur est survenue.', ...results });
    }
  });

// ════════════════════════════════════════
// OpenAI Proxy — Empêche l'exposition de la clé API côté client
// ════════════════════════════════════════
const MOSQUE_CONTEXT = `CONTEXTE: Tu ecris AU NOM de la Mosquee El Mouhssinine (Bourg-en-Bresse) qui s'adresse a ses fideles, comme une famille spirituelle. Le ton est CHALEUREUX, BIENVEILLANT, FRATERNEL et RESPECTUEUX. Tu peux employer avec parcimonie et naturel des formules islamiques (ex: As-salamu alaykum, qu'Allah vous recompense, barak Allahu fikoum, in cha Allah) quand c'est approprie, sans jamais en abuser. Evite absolument le ton sec, commercial ou impersonnel. Reste sobre, humble et digne. Ecris en francais correct.\nREGLE DE SORTIE ABSOLUE: reponds UNIQUEMENT par le texte final demande. JAMAIS d'etiquette comme "Titre:" ou "Message:", JAMAIS de guillemets, JAMAIS d'asterisques ni de markdown (pas de **). Donne directement le contenu, rien d'autre.`;

const OPENAI_PROMPTS = {
  notification: `${MOSQUE_CONTEXT}\n\nTu rediges une notification PUSH lue d'un coup d'oeil sur l'ecran verrouille d'un telephone. Elle doit etre TRES COURTE.\nFORMAT STRICT (a respecter absolument):\n- Titre: MAX 40 caracteres, commence par un emoji\n- Message: UNE SEULE phrase, MAX 80 caracteres, directe et bienveillante\n- INTERDIT: preambule du type "Chers freres et soeurs", signature, longues formules religieuses. Va droit a l'essentiel, chaleureusement mais en tres peu de mots.`,
  annonce: `${MOSQUE_CONTEXT}\n\nTu rediges une annonce pour la communaute.\nFORMAT:\n- Titre: MAX 60 caracteres\n- Contenu: 2 a 4 phrases, ton accueillant et fraternel\n- Infos essentielles (quoi, quand, ou) presentees avec chaleur\n- Une breve formule bienveillante en ouverture ou cloture est la bienvenue.`,
  popup: `${MOSQUE_CONTEXT}\n\nTu rediges le CONTENU d'un popup : un message affiche en MODAL plein ecran dans l'app, lu EN ENTIER (ce n'est PAS une notification courte).\nFORMAT:\n- 2 a 5 phrases chaleureuses, claires et bienveillantes\n- Message complet et accueillant, qui va a l'essentiel sans etre sec\n- Tu peux ouvrir par un salam et clore par une formule bienveillante.`,
  evenement: `${MOSQUE_CONTEXT}\n\nTu rediges la description d'un evenement de la mosquee.\nFORMAT:\n- Titre: MAX 60 caracteres, donnant envie de venir\n- Description: 2 a 5 phrases chaleureuses\n- Inclure date, heure, lieu\n- Invite la communaute avec convivialite (ex: "Nous serions heureux de vous accueillir").`,
  rappel: `${MOSQUE_CONTEXT}\n\nTu rediges un rappel spirituel doux et inspirant.\nFORMAT:\n- 2 a 4 phrases\n- Si pertinent, un verset ou hadith avec sa source courte (et l'arabe si utile)\n- Ton apaisant, qui rapproche d'Allah et reconforte le coeur.`,
  janaza: `${MOSQUE_CONTEXT}\n\nTu rediges une annonce de Salat Janaza, avec gravite et compassion.\nFORMAT:\n- Titre: Nom du defunt + "Salat Janaza"\n- Message: 2 a 3 phrases\n- Inclure nom, date, heure, lieu\n- Une formule de condoleances et d'invocation (ex: "Inna lillahi wa inna ilayhi raji'un. Qu'Allah lui fasse misericorde").`,
  projet: `${MOSQUE_CONTEXT}\n\nTu rediges la presentation d'un projet de la mosquee pour encourager les dons.\nFORMAT:\n- Titre: MAX 50 caracteres, porteur d'esperance\n- Description: 2 a 4 phrases\n- Expliquer l'impact concret pour la communaute\n- Appel a la generosite avec coeur (ex: "Chaque don, meme modeste, compte. Qu'Allah recompense votre generosite").`,
  general: `${MOSQUE_CONTEXT}\n\nTu aides a rediger du contenu pour la mosquee.\nFORMAT:\n- Reste concis (2 a 5 phrases selon le besoin)\n- Ton chaleureux, fraternel et clair, fidele a l'esprit de la mosquee.`,
};

const OPENAI_TITLE_PROMPT = `${MOSQUE_CONTEXT}\n\nTu generes UN SEUL titre court pour l'application de la mosquee.\nFORMAT:\n- Maximum 25 caracteres (2 a 4 mots) pour qu il ne soit JAMAIS coupe sur l ecran verrouille\n- Commence par un emoji pertinent\n- Pas de ponctuation finale, pas de ":" dans le titre\n- Ton chaleureux mais clair\nReponds uniquement par le titre, sans guillemets.`

exports.generateAIContent = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30, memory: '256MB', secrets: ['MISTRAL_API_KEY'] })
  .https.onCall(async (data, context) => {
    // Admin requis
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Connexion requise');
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.actif !== true) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux administrateurs actifs');
    }
    // Anti-abus coûts IA : max 20 générations/heure/admin
    await checkRateLimit(context.auth.uid, 'generateAI', 20, 3600);

    const { type, userPrompt, contentContext } = data;
    if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.length > 2000) {
      throw new functions.https.HttpsError('invalid-argument', 'Prompt invalide (max 2000 caractères)');
    }

    const allowedTypes = Object.keys(OPENAI_PROMPTS);
    const safeType = allowedTypes.includes(type) ? type : 'general';

    // Mistral prioritaire (clé dans Secret Manager), fallback OpenAI si présent
    const useMistral = !!MISTRAL_API_KEY_ENV;
    const apiKey = useMistral ? MISTRAL_API_KEY_ENV : OPENAI_API_KEY_ENV;
    if (!apiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Clé IA non configurée');
    }

    // Construire messages
    const isGeneratingTitle = contentContext?.field === 'titre';
    const systemPrompt = isGeneratingTitle ? OPENAI_TITLE_PROMPT : OPENAI_PROMPTS[safeType];

    let userMessage = userPrompt;
    if (contentContext?.existingTitle && !isGeneratingTitle) {
      userMessage += `\n\nTitre existant: "${String(contentContext.existingTitle).slice(0, 200)}"`;
    }
    if (contentContext?.existingContent) {
      userMessage += `\n\nContenu existant à améliorer: "${String(contentContext.existingContent).slice(0, 1000)}"`;
    }
    if (contentContext?.field === 'message' || contentContext?.field === 'contenu') {
      userMessage += '\n\nGénère uniquement le CONTENU/MESSAGE (pas de titre).';
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    // Appel OpenAI via https natif
    const payload = JSON.stringify({
      model: useMistral ? 'mistral-small-latest' : 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: useMistral ? 'api.mistral.ai' : 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode !== 200) {
              reject(new Error(parsed.error?.message || `OpenAI API error ${res.statusCode}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error('Réponse OpenAI invalide'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(25000, () => { req.destroy(); reject(new Error('OpenAI timeout')); });
      req.write(payload);
      req.end();
    });

    const content = result.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new functions.https.HttpsError('internal', 'Réponse vide de l\'IA');
    }

    return { content };
  });

// ==================== VERIFICATION EMAIL VIA BREVO (anti-spam) ====================

exports.sendVerificationEmail = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // 1. Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Connexion requise');
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email;
    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Email non trouvé dans le compte');
    }

    // 2. Skip si déjà vérifié
    if (context.auth.token.email_verified) {
      return { success: true, message: 'Email déjà vérifié' };
    }

    // 3. Rate limit : max 1 email / 2 min par uid (atomique via transaction)
    const rateLimitRef = admin.firestore().collection('verification_emails').doc(uid);
    await admin.firestore().runTransaction(async (t) => {
      const rateLimitDoc = await t.get(rateLimitRef);
      if (rateLimitDoc.exists) {
        const lastSent = rateLimitDoc.data()?.lastSent?.toDate?.();
        if (lastSent && (Date.now() - lastSent.getTime()) < 120000) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            'Veuillez patienter 2 minutes avant de renvoyer un email de vérification'
          );
        }
      }
      t.set(rateLimitRef, { lastSent: admin.firestore.FieldValue.serverTimestamp() });
    });

    // 4. Générer le lien de vérification Firebase → redirige vers page custom
    const firebaseLink = await admin.auth().generateEmailVerificationLink(email, {
      url: 'https://el-mouhssinine.web.app',
    });
    // Garder le handler Firebase (firebaseapp.com) et NON web.app : l'app mobile
    // revendique web.app (Universal Link) et intercepterait le lien sur iPhone.
    // firebaseapp.com s'ouvre dans Safari → vérification email directe.
    const verificationLink = firebaseLink
      .replace('https://el-mouhssinine.web.app/auth/action', 'https://el-mouhssinine.firebaseapp.com/__/auth/action')
      .replace('https://el-mouhssinine.web.app/__/auth/action', 'https://el-mouhssinine.firebaseapp.com/__/auth/action');

    // 5. Envoyer via Brevo SMTP
    const brevoUser = BREVO_SMTP_USER;
    const brevoPass = BREVO_SMTP_PASS;
    const fromEmail = BREVO_FROM_EMAIL;
    const fromName = BREVO_FROM_NAME || 'Mosquée El Mouhssinine';

    if (!brevoUser || !brevoPass || !fromEmail) {
      await logServerError('BREVO_SMTP non configuré pour sendVerificationEmail', 'sendVerificationEmail', { uid });
      throw new functions.https.HttpsError('failed-precondition', 'Service email non configuré');
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    });

    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">📧 Vérification de votre email</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Assalamu alaykum,</p>
        <p style="font-size: 16px;">Merci de vous être inscrit(e) sur l'application <strong>El Mouhssinine</strong>.</p>
        <p style="font-size: 16px;">Veuillez cliquer sur le bouton ci-dessous pour confirmer votre adresse email :</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background: #2e7d32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
            ✅ Vérifier mon email
          </a>
        </div>
        <p style="font-size: 14px; color: #666;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">${verificationLink}</p>
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2e7d32;">
          <p style="margin: 0; font-size: 14px;">⚠️ Ce lien est valable pendant 3 jours.</p>
        </div>
        <p style="font-size: 14px; color: #444;">Barakallahu fik,<br><strong>L'équipe El Mouhssinine</strong></p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
          <p style="color: #aaa; font-size: 11px;">Mosquée El Mouhssinine — Bourg-en-Bresse</p>
        </div>
      </div>
    </div>`;

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: '📧 Vérifiez votre email — El Mouhssinine',
        html: emailHtml,
      });
    } catch (smtpError) {
      await logServerError(`SMTP sendVerificationEmail échoué: ${smtpError.message}`, 'sendVerificationEmail', { uid });
      throw new functions.https.HttpsError('internal', "Erreur lors de l'envoi de l'email");
    }

    // 6. Rate limit déjà enregistré dans la transaction ci-dessus

    console.log('📧 Email vérification Brevo envoyé à', maskEmail(email));
    return { success: true, message: 'Email de vérification envoyé' };
  });


// ==================== RESET MOT DE PASSE VIA BREVO ====================
// Envoie l'email de réinitialisation via Brevo (domaine authentifié) au lieu
// de l'email Firebase par défaut (noreply@firebaseapp.com) qui finit en spam.
// Callable SANS auth (l'utilisateur a oublié son mot de passe = déconnecté).
exports.requestPasswordReset = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data) => {
    const email = (data && data.email ? String(data.email) : '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'Adresse email invalide');
    }

    // Rate limit : 1 email / 2 min par adresse (atomique)
    const rlRef = admin.firestore().collection('password_reset_requests').doc(email.replace(/[^a-z0-9]/g, '_'));
    await admin.firestore().runTransaction(async (t) => {
      const doc = await t.get(rlRef);
      if (doc.exists) {
        const last = doc.data() && doc.data().lastSent && doc.data().lastSent.toDate ? doc.data().lastSent.toDate() : null;
        if (last && (Date.now() - last.getTime()) < 120000) {
          throw new functions.https.HttpsError('resource-exhausted', 'Veuillez patienter 2 minutes avant de redemander un lien.');
        }
      }
      t.set(rlRef, { lastSent: admin.firestore.FieldValue.serverTimestamp() });
    });

    // Générer le lien de reset (échoue si email inconnu → on masque, anti-énumération)
    let resetLink = null;
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email, { url: 'https://el-mouhssinine.web.app' });
      // Forcer le handler sur firebaseapp.com (PAS un domaine Universal Link de l'app)
      // pour que le lien s'ouvre dans Safari, pas dans l'app mobile.
      resetLink = resetLink
        .replace('https://el-mouhssinine.web.app/auth/action', 'https://el-mouhssinine.firebaseapp.com/__/auth/action')
        .replace('https://el-mouhssinine.web.app/__/auth/action', 'https://el-mouhssinine.firebaseapp.com/__/auth/action');
    } catch (e) {
      console.log('requestPasswordReset — email non trouvé:', maskEmail(email));
      return { success: true, message: 'Si un compte existe, un email a été envoyé.' };
    }

    // Envoi via Brevo
    const brevoUser = BREVO_SMTP_USER;
    const brevoPass = BREVO_SMTP_PASS;
    const fromEmail = BREVO_FROM_EMAIL;
    const fromName = BREVO_FROM_NAME || 'Mosquée El Mouhssinine';
    if (!brevoUser || !brevoPass || !fromEmail) {
      await logServerError('BREVO_SMTP non configuré pour requestPasswordReset', 'requestPasswordReset', { email: maskEmail(email) });
      throw new functions.https.HttpsError('failed-precondition', 'Service email non configuré');
    }
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com', port: 587, secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    });
    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🔑 Réinitialisation du mot de passe</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Assalamu alaykum,</p>
        <p style="font-size: 16px;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #2e7d32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
            🔑 Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="font-size: 14px; color: #666;">Si le bouton ne fonctionne pas, copiez ce lien :</p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">${resetLink}</p>
        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
          <p style="margin: 0; font-size: 14px;">⚠️ Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        </div>
        <p style="font-size: 14px; color: #444;">Barakallahu fik,<br><strong>L'équipe El Mouhssinine</strong></p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
          <p style="color: #aaa; font-size: 11px;">Mosquée El Mouhssinine — Bourg-en-Bresse</p>
        </div>
      </div>
    </div>`;
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        replyTo: 'centreculturelislamique@orange.fr',
        subject: '🔑 Réinitialisation de votre mot de passe — El Mouhssinine',
        html: emailHtml,
      });
    } catch (smtpError) {
      await logServerError(`SMTP requestPasswordReset échoué: ${smtpError.message}`, 'requestPasswordReset', { email: maskEmail(email) });
      throw new functions.https.HttpsError('internal', "Erreur lors de l'envoi de l'email");
    }
    console.log('🔑 Email reset password Brevo envoyé à', maskEmail(email));
    return { success: true, message: 'Email de réinitialisation envoyé' };
  });


// ==================== RELANCE AUTO DES ADHÉSIONS EN ATTENTE ====================
// Relance les membres bloqués en attente d'une action de LEUR part (paiement/signature)
// après 3 jours (une seule relance), + rappelle au backoffice les validations en attente
// côté admin. Comble le trou : le cron checkExpiringCotisations ne balaie que les 'actif'.
exports.relancePendingMemberships = functions
  .region('europe-west1')
  .runWith({ secrets: ['BREVO_SMTP_PASS'], timeoutSeconds: 300, memory: '256MB' })
  .pubsub.schedule('0 9 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const db = admin.firestore();
    const RELANCE_DELAY_DAYS = 3;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RELANCE_DELAY_DAYS);

    const brevoUser = BREVO_SMTP_USER;
    const brevoPass = BREVO_SMTP_PASS;
    const fromEmail = BREVO_FROM_EMAIL;
    const fromName = BREVO_FROM_NAME || 'Mosquée El Mouhssinine';
    let transporter = null;
    if (brevoUser && brevoPass && fromEmail) {
      transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com', port: 587, secure: false,
        auth: { user: brevoUser, pass: brevoPass },
      });
    }

    let relanced = 0;

    // a) Membres devant agir : paiement / signature non finalisé depuis > 3 jours
    try {
      const snap = await db.collection('members')
        .where('status', 'in', ['en_attente_paiement', 'en_attente_signature'])
        .get();
      for (const doc of snap.docs) {
        const m = doc.data();
        if (m.relanceAttenteSent === true) continue; // une seule relance
        const created = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate()
          : (m.createdAt ? new Date(m.createdAt) : null);
        if (!created || created > cutoff) continue; // trop récent
        const prenom = m.prenom || 'Membre';
        const isPaiement = m.status === 'en_attente_paiement';
        const subject = isPaiement ? '⏳ Finalisez votre adhésion' : '⏳ Finalisez votre adhésion';
        const bodyText = isPaiement
          ? `Assalamu alaykum ${prenom},\n\nVotre adhésion à la Mosquée El Mouhssinine est en attente de paiement. Pour la finaliser, ouvrez l'application El Mouhssinine et complétez votre cotisation.\n\nBarakallahu fik,\nL'équipe El Mouhssinine`
          : `Assalamu alaykum ${prenom},\n\nVotre adhésion à la Mosquée El Mouhssinine est en attente de finalisation. Ouvrez l'application El Mouhssinine pour la compléter.\n\nBarakallahu fik,\nL'équipe El Mouhssinine`;
        if (transporter && m.email) {
          try {
            await transporter.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: m.email,
              subject,
              html: textToEmailHtml(bodyText, {
                headerTitle: subject,
                headerGradient: '#f59e0b, #fbbf24',
                footerAssociation: 'Mosquée El Mouhssinine',
              }),
            });
          } catch (e) { console.error('relance email échouée:', e.message); }
        }
        await sendPushToMember(
          doc.id, subject,
          isPaiement ? "Finalisez votre cotisation dans l'application." : "Finalisez votre adhésion dans l'application.",
          { type: 'relance_attente' },
        );
        await doc.ref.update({
          relanceAttenteSent: true,
          relanceAttenteSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        relanced++;
      }
    } catch (e) { console.error('relancePendingMemberships (membres):', e.message); }

    // b) Validations en attente côté ADMIN → rappel backoffice (1x/jour tant que pending)
    try {
      const pendingVal = await db.collection('members')
        .where('status', '==', 'en_attente_validation').get();
      if (!pendingVal.empty) {
        await createNotifBO({
          type: 'validation_requise',
          titre: '⏳ Validations en attente',
          message: `${pendingVal.size} adhésion(s) en attente de validation au bureau`,
        });
      }
    } catch (e) { console.error('relancePendingMemberships (BO):', e.message); }

    console.log(`relancePendingMemberships: ${relanced} membre(s) relancé(s)`);
    return null;
  });


// ==================== HEALTH CHECK AUTOMATIQUE (niveau pro) ====================
// Teste chaque jour TOUS les systèmes critiques de bout en bout et envoie un
// rapport par email. Alerte immédiate si une défaillance, bilan vert le lundi.
// Couvre exactement ce qui a déjà cassé un jour : Brevo, Stripe, paramètres
// reçus fiscaux, Twilio, admins, index Firestore, backoffice en ligne, AASA.
exports.healthCheck = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
    secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM', 'TWILIO_WHATSAPP_TO', 'BREVO_SMTP_PASS'],
  })
  .region('europe-west1')
  .pubsub.schedule('0 7 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const db = admin.firestore();
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail || '' });

    // 1. Email Brevo (connexion SMTP réelle)
    try {
      if (BREVO_SMTP_USER && BREVO_SMTP_PASS && BREVO_FROM_EMAIL) {
        const t = nodemailer.createTransport({ host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS } });
        await t.verify();
        add('Email (Brevo SMTP)', true, BREVO_FROM_EMAIL);
      } else { add('Email (Brevo SMTP)', false, 'Identifiants Brevo manquants'); }
    } catch (e) { add('Email (Brevo SMTP)', false, e.message); }

    // 2. Paiements Stripe (clé valide)
    try {
      const k = process.env.STRIPE_SECRET_KEY;
      if (k) { const stripe = require('stripe')(k); await stripe.balance.retrieve(); add('Paiements (Stripe)', true, 'API OK'); }
      else { add('Paiements (Stripe)', false, 'Clé Stripe manquante'); }
    } catch (e) { add('Paiements (Stripe)', false, e.message); }

    // 3. Paramètres reçus fiscaux (sinon CERFA invalides le 2 janvier)
    try {
      const rf = await db.collection('settings').doc('recusFiscaux').get();
      const d = rf.data() || {};
      const ok = rf.exists && d.nom && d.adresse && d.siren && d.nomSignataire;
      add('Reçus fiscaux (paramètres assoc.)', ok, ok ? 'Complet' : 'Champs manquants (nom/adresse/SIREN/signataire)');
    } catch (e) { add('Reçus fiscaux (paramètres assoc.)', false, e.message); }

    // 4. Tarifs cotisation
    try {
      const c = await db.collection('settings').doc('cotisation').get();
      add('Tarifs cotisation', c.exists, c.exists ? 'OK' : 'settings/cotisation manquant');
    } catch (e) { add('Tarifs cotisation', false, e.message); }

    // 5. Super admins actifs
    try {
      const a = await db.collection('admins').where('actif', '==', true).get();
      add('Super admins actifs', a.size >= 1, a.size + ' admin(s) actif(s)');
    } catch (e) { add('Super admins actifs', false, e.message); }

    // 6. Twilio config (canal bonus)
    add('WhatsApp (Twilio)', !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      process.env.TWILIO_WHATSAPP_FROM === '+14155238886' ? 'Sandbox (bonus — email = canal principal)' : 'Configuré');

    // 7. Index Firestore critiques (relances + reçus fiscaux)
    try {
      await db.collection('payments').where('status', '==', 'succeeded')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(0)).limit(1).get();
      add('Index Firestore (reçus fiscaux)', true, 'OK');
    } catch (e) { add('Index Firestore (reçus fiscaux)', false, 'Index manquant ? ' + e.message.slice(0, 50)); }
    try {
      await db.collection('members').where('status', '==', 'actif')
        .where('gracePeriodEnd', '<=', admin.firestore.Timestamp.fromMillis(Date.now())).limit(1).get();
      add('Index Firestore (relances cotisation)', true, 'OK');
    } catch (e) { add('Index Firestore (relances cotisation)', false, 'Index manquant ? ' + e.message.slice(0, 50)); }

    // 8. Backoffice en ligne
    try {
      const r = await fetch('https://el-mouhssinine.web.app/login');
      add('Backoffice en ligne', r.ok, 'HTTP ' + r.status);
    } catch (e) { add('Backoffice en ligne', false, e.message); }

    // 9. Universal Links AASA (le lien backoffice ne doit PAS ouvrir l'app)
    try {
      const r = await fetch('https://el-mouhssinine.web.app/.well-known/apple-app-site-association');
      const j = await r.json();
      const paths = (j && j.applinks && j.applinks.details && j.applinks.details[0] && j.applinks.details[0].paths) || [];
      const ok = paths.length === 0 || JSON.stringify(paths).includes('NOT /*');
      add('Universal Links (AASA)', ok, ok ? 'Restreint (OK)' : '⚠️ Trop large (/*)');
    } catch (e) { add('Universal Links (AASA)', false, e.message); }

    // ===== Bilan =====
    const failed = checks.filter((c) => !c.ok);
    const allOk = failed.length === 0;
    const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });
    const isMonday = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long' }).toLowerCase().startsWith('lun');

    // Sauvegarde du dernier résultat (visible côté backoffice si besoin)
    try {
      await db.collection('settings').doc('healthCheck').set({
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        allOk,
        failedCount: failed.length,
        checks,
      });
    } catch (e) { console.error('healthCheck save:', e.message); }

    console.log(`healthCheck: ${allOk ? 'TOUT OK' : failed.length + ' ÉCHEC(S)'}`);

    // Email : si défaillance (tous les jours) OU bilan vert (lundi)
    if (!allOk || isMonday) {
      const rows = checks.map((c) =>
        `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;">${c.ok ? '✅' : '🔴'} ${c.name}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#666;">${c.detail}</td></tr>`).join('');
      const headerColor = allOk ? '#2e7d32, #4caf50' : '#dc2626, #ef4444';
      const titre = allOk ? '✅ Santé El Mouhssinine — Tout va bien' : `🔴 Santé El Mouhssinine — ${failed.length} problème(s) !`;
      const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,${headerColor});padding:24px;text-align:center;border-radius:10px 10px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">${titre}</h1>
          <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:13px;">${date}</p>
        </div>
        <div style="background:#fafafa;padding:16px;border-radius:0 0 10px 10px;">
          <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;">${rows}</table>
          ${allOk ? '<p style="text-align:center;color:#2e7d32;margin:16px 0 0;font-size:14px;">Tous les systèmes sont opérationnels. 🌙</p>'
            : '<p style="text-align:center;color:#dc2626;margin:16px 0 0;font-size:14px;font-weight:bold;">Action requise sur les points en rouge ci-dessus.</p>'}
          <p style="text-align:center;color:#aaa;margin:16px 0 0;font-size:11px;">Health-check automatique quotidien — El Mouhssinine</p>
        </div>
      </div>`;
      try {
        if (BREVO_SMTP_USER && BREVO_SMTP_PASS && BREVO_FROM_EMAIL) {
          const t = nodemailer.createTransport({ host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS } });
          await t.sendMail({
            from: `"${BREVO_FROM_NAME || 'El Mouhssinine'} — Santé" <${BREVO_FROM_EMAIL}>`,
            to: 'faicalkriouar@gmail.com',
            subject: titre,
            html,
          });
          console.log('healthCheck: rapport email envoyé');
        }
      } catch (e) { console.error('healthCheck email:', e.message); }
    }

    return null;
  });

// ==================== STATS TÉLÉCHARGEMENTS (App Store + Google Play) ====================
const storeStats = require('./storeStats');
exports.updateStoreStats = storeStats.updateStoreStats;
exports.refreshStoreStats = storeStats.refreshStoreStats;

// ==================== NOTIFS PUSH ADMIN (Web Push backoffice) ====================
const pushNotif = require('./pushNotif');
exports.saveAdminPushSub = pushNotif.saveAdminPushSub;
exports.testAdminPush = pushNotif.testAdminPush;
