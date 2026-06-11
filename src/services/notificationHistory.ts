/**
 * Service pour stocker et gérer l'historique des notifications
 * Les notifications sont automatiquement effacées après 24h
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { logger } from '../utils';

// ==================== TYPES ====================

export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number; // Unix timestamp en ms
  type: 'prayer' | 'backoffice' | 'message' | 'event' | 'janaza' | 'other';
  read: boolean;
}

// ==================== CONSTANTES ====================

const NOTIFICATION_HISTORY_KEY = '@notification_history';
const READ_IDS_KEY = '@notification_read_ids';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 heures (notifs locales foreground)
const DISPLAY_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours (centre de notif Firestore)

// --- Suivi local des notifs marquées lues (couvre les broadcasts non modifiables côté Firestore) ---
const getLocalReadIds = async (): Promise<Set<string>> => {
  try {
    const raw = await AsyncStorage.getItem(READ_IDS_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch { return new Set<string>(); }
};
const addLocalReadIds = async (ids: string[]): Promise<void> => {
  try {
    const set = await getLocalReadIds();
    ids.forEach(id => set.add(id));
    await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify([...set].slice(-300)));
  } catch {}
};

// --- Récupère les notifs depuis Firestore (user_notifications) : perso + broadcasts ---
const fetchFirestoreNotifs = async (): Promise<StoredNotification[]> => {
  try {
    const uid = auth().currentUser?.uid;
    const cutoffTs = firestore.Timestamp.fromMillis(Date.now() - DISPLAY_AGE_MS);
    const queries: Promise<any>[] = [];
    if (uid) {
      queries.push(
        firestore().collection('user_notifications')
          .where('userId', '==', uid)
          .where('createdAt', '>=', cutoffTs)
          .orderBy('createdAt', 'desc').limit(50).get(),
      );
    }
    queries.push(
      firestore().collection('user_notifications')
        .where('audience', '==', 'all')
        .where('createdAt', '>=', cutoffTs)
        .orderBy('createdAt', 'desc').limit(50).get(),
    );
    const snaps = await Promise.all(queries);
    const readIds = await getLocalReadIds();
    const out: StoredNotification[] = [];
    snaps.forEach(snap => snap.forEach((doc: any) => {
      const d = doc.data();
      const ts = d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : Date.now();
      out.push({
        id: doc.id,
        title: d.title || '',
        body: d.body || '',
        timestamp: ts,
        type: (d.type as StoredNotification['type']) || 'other',
        read: d.read === true || readIds.has(doc.id),
      });
    }));
    return out;
  } catch (error) {
    logger.error('[NotifHistory] Erreur Firestore:', error);
    return [];
  }
};

// ==================== FUNCTIONS ====================

/**
 * Nettoie les notifications de plus de 24h
 */
const cleanOldNotifications = (notifications: StoredNotification[]): StoredNotification[] => {
  const cutoff = Date.now() - MAX_AGE_MS;
  return notifications.filter(n => n.timestamp > cutoff);
};

/**
 * Récupère l'historique des notifications (max 24h)
 */
export const getNotificationHistory = async (): Promise<StoredNotification[]> => {
  try {
    // 1. Notifs locales (reçues app ouverte)
    const stored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    const local: StoredNotification[] = stored ? JSON.parse(stored) : [];
    // 2. Notifs Firestore (reçues même app fermée : perso + broadcasts)
    const remote = await fetchFirestoreNotifs();
    // 3. Fusion + déduplication par id (Firestore prioritaire)
    const byId = new Map<string, StoredNotification>();
    [...remote, ...local].forEach(n => { if (!byId.has(n.id)) byId.set(n.id, n); });
    // 4. Filtrer sur 30 jours + trier
    const cutoff = Date.now() - DISPLAY_AGE_MS;
    const merged = [...byId.values()].filter(n => n.timestamp > cutoff);
    merged.sort((a, b) => b.timestamp - a.timestamp);
    return merged.slice(0, 60);
  } catch (error) {
    logger.error('[NotifHistory] Erreur lecture:', error);
    return [];
  }
};

/**
 * Ajoute une notification à l'historique
 * Déduplication : ignore les doublons (même titre+body) reçus dans les 2 dernières minutes
 */
export const addNotificationToHistory = async (
  title: string,
  body: string,
  type: StoredNotification['type'] = 'other'
): Promise<void> => {
  try {
    const history = await getNotificationHistory();

    // Déduplication : vérifier si une notif identique existe dans les 2 dernières minutes
    const DEDUP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
    const now = Date.now();
    const isDuplicate = history.some(
      n => n.title === title && n.body === body && (now - n.timestamp) < DEDUP_WINDOW_MS
    );

    if (isDuplicate) {
      logger.log('[NotifHistory] Doublon ignoré:', title);
      return;
    }

    // Créer la nouvelle notification
    const newNotif: StoredNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      body,
      timestamp: now,
      type,
      read: false,
    };

    // Ajouter au début du tableau
    history.unshift(newNotif);

    // Limiter à 50 notifications max pour éviter trop de stockage
    const limited = history.slice(0, 50);

    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(limited));
    logger.log('[NotifHistory] Notification ajoutée:', title);
  } catch (error) {
    logger.error('[NotifHistory] Erreur ajout:', error);
  }
};

/**
 * Marque une notification comme lue
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    await addLocalReadIds([notificationId]);
    // MAJ historique local
    const stored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    if (stored) {
      const arr: StoredNotification[] = JSON.parse(stored);
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(
        arr.map(n => n.id === notificationId ? { ...n, read: true } : n),
      ));
    }
    // MAJ Firestore (best-effort, fonctionne pour les notifs perso de l'utilisateur)
    if (auth().currentUser?.uid) {
      firestore().collection('user_notifications').doc(notificationId).update({ read: true }).catch(() => {});
    }
  } catch (error) {
    logger.error('[NotifHistory] Erreur markAsRead:', error);
  }
};

/**
 * Marque toutes les notifications comme lues
 */
export const markAllNotificationsAsRead = async (): Promise<void> => {
  try {
    const history = await getNotificationHistory();
    const ids = history.map(n => n.id);
    await addLocalReadIds(ids);
    // MAJ historique local
    const stored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    if (stored) {
      const arr: StoredNotification[] = JSON.parse(stored);
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(arr.map(n => ({ ...n, read: true }))));
    }
    // MAJ Firestore best-effort pour les notifs perso
    if (auth().currentUser?.uid) {
      ids.forEach(id => firestore().collection('user_notifications').doc(id).update({ read: true }).catch(() => {}));
    }
    logger.log('[NotifHistory] Toutes les notifications marquées comme lues');
  } catch (error) {
    logger.error('[NotifHistory] Erreur markAllAsRead:', error);
  }
};

/**
 * Compte les notifications non lues
 */
export const getUnreadCount = async (): Promise<number> => {
  try {
    const history = await getNotificationHistory();
    return history.filter(n => !n.read).length;
  } catch (error) {
    logger.error('[NotifHistory] Erreur getUnreadCount:', error);
    return 0;
  }
};

/**
 * Supprime une notification par son ID
 */
export const deleteNotificationById = async (notificationId: string): Promise<void> => {
  try {
    const history = await getNotificationHistory();
    const filtered = history.filter(n => n.id !== notificationId);
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(filtered));
    logger.log('[NotifHistory] Notification supprimée:', notificationId);
  } catch (error) {
    logger.error('[NotifHistory] Erreur deleteById:', error);
  }
};

/**
 * Efface tout l'historique
 */
export const clearNotificationHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    logger.log('[NotifHistory] Historique effacé');
  } catch (error) {
    logger.error('[NotifHistory] Erreur clearHistory:', error);
  }
};

/**
 * Détermine le type de notification selon le titre/body
 */
export const detectNotificationType = (title: string, body: string): StoredNotification['type'] => {
  const lowerTitle = title.toLowerCase();
  const lowerBody = body.toLowerCase();

  // Notifications de prière
  if (
    lowerTitle.includes('fajr') ||
    lowerTitle.includes('dhuhr') ||
    lowerTitle.includes('asr') ||
    lowerTitle.includes('maghrib') ||
    lowerTitle.includes('isha') ||
    lowerTitle.includes("jumu'a") ||
    lowerTitle.includes('jumua') ||
    lowerTitle.includes('prière') ||
    lowerBody.includes('prière') ||
    lowerBody.includes('prayer')
  ) {
    return 'prayer';
  }

  // Notifications de message
  if (
    lowerTitle.includes('message') ||
    lowerTitle.includes('réponse') ||
    lowerTitle.includes('reply')
  ) {
    return 'message';
  }

  // Notifications janaza
  if (
    lowerTitle.includes('janaza') ||
    lowerTitle.includes('جنازة') ||
    lowerTitle.includes('décès') ||
    lowerBody.includes('janaza') ||
    lowerBody.includes('جنازة')
  ) {
    return 'janaza';
  }

  // Notifications événement
  if (
    lowerTitle.includes('événement') ||
    lowerTitle.includes('evenement') ||
    lowerTitle.includes('حدث') ||
    lowerBody.includes('événement') ||
    lowerBody.includes('evenement')
  ) {
    return 'event';
  }

  // Sinon c'est du backoffice (annonces, etc.)
  return 'backoffice';
};
