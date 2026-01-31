/**
 * Service pour stocker et gérer l'historique des notifications
 * Les notifications sont automatiquement effacées après 24h
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== TYPES ====================

export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number; // Unix timestamp en ms
  type: 'prayer' | 'backoffice' | 'message' | 'other';
  read: boolean;
}

// ==================== CONSTANTES ====================

const NOTIFICATION_HISTORY_KEY = '@notification_history';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 heures

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
    const stored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    if (!stored) return [];

    const notifications: StoredNotification[] = JSON.parse(stored);
    // Nettoyer les anciennes et trier par timestamp décroissant (plus récent en premier)
    const cleaned = cleanOldNotifications(notifications);
    cleaned.sort((a, b) => b.timestamp - a.timestamp);

    // Si on a nettoyé des notifications, sauvegarder
    if (cleaned.length !== notifications.length) {
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch (error) {
    console.error('[NotifHistory] Erreur lecture:', error);
    return [];
  }
};

/**
 * Ajoute une notification à l'historique
 */
export const addNotificationToHistory = async (
  title: string,
  body: string,
  type: StoredNotification['type'] = 'other'
): Promise<void> => {
  try {
    const history = await getNotificationHistory();

    // Créer la nouvelle notification
    const newNotif: StoredNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      body,
      timestamp: Date.now(),
      type,
      read: false,
    };

    // Ajouter au début du tableau
    history.unshift(newNotif);

    // Limiter à 50 notifications max pour éviter trop de stockage
    const limited = history.slice(0, 50);

    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(limited));
    console.log('[NotifHistory] Notification ajoutée:', title);
  } catch (error) {
    console.error('[NotifHistory] Erreur ajout:', error);
  }
};

/**
 * Marque une notification comme lue
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const history = await getNotificationHistory();
    const updated = history.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[NotifHistory] Erreur markAsRead:', error);
  }
};

/**
 * Marque toutes les notifications comme lues
 */
export const markAllNotificationsAsRead = async (): Promise<void> => {
  try {
    const history = await getNotificationHistory();
    const updated = history.map(n => ({ ...n, read: true }));
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
    console.log('[NotifHistory] Toutes les notifications marquées comme lues');
  } catch (error) {
    console.error('[NotifHistory] Erreur markAllAsRead:', error);
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
    console.error('[NotifHistory] Erreur getUnreadCount:', error);
    return 0;
  }
};

/**
 * Efface tout l'historique
 */
export const clearNotificationHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    console.log('[NotifHistory] Historique effacé');
  } catch (error) {
    console.error('[NotifHistory] Erreur clearHistory:', error);
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

  // Sinon c'est du backoffice (annonces, événements, etc.)
  return 'backoffice';
};
