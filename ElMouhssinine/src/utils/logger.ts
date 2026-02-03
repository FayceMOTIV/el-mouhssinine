/**
 * Logger utilitaire pour El Mouhssinine
 *
 * Protège les logs en production pour éviter d'exposer des informations sensibles.
 * En mode __DEV__, tous les logs sont affichés.
 * En production, seules les erreurs sont loguées (sans détails sensibles).
 */

const isDev = __DEV__;

/**
 * Masque les emails pour la privacy dans les logs
 * @param email - L'email à masquer
 * @returns Email masqué (ex: j***n@example.com)
 */
export const maskEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '***';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

/**
 * Masque un UID pour la privacy dans les logs
 * @param uid - L'UID à masquer
 * @returns UID tronqué (8 premiers caractères)
 */
export const maskUid = (uid: string): string => {
  if (!uid || typeof uid !== 'string') return '***';
  return uid.substring(0, 8) + '...';
};

/**
 * Logger conditionnel - ne log qu'en mode développement
 */
export const logger = {
  /**
   * Log standard - uniquement en dev
   */
  log: (...args: any[]): void => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log d'avertissement - uniquement en dev
   */
  warn: (...args: any[]): void => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log d'erreur - toujours actif mais sans stack trace en prod
   * @param message - Message d'erreur (toujours affiché)
   * @param error - Objet erreur (détails uniquement en dev)
   */
  error: (message: string, error?: any): void => {
    if (isDev) {
      console.error(message, error);
    } else {
      // En prod, log seulement le message sans détails sensibles
      console.error(message);
    }
  },

  /**
   * Log d'info - uniquement en dev
   */
  info: (...args: any[]): void => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Log de debug - uniquement en dev
   */
  debug: (...args: any[]): void => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Log d'un appel API - uniquement en dev
   * @param endpoint - L'endpoint appelé
   * @param params - Les paramètres (seront masqués si contiennent des emails)
   */
  api: (endpoint: string, params?: Record<string, any>): void => {
    if (isDev) {
      const safeParams = params ? { ...params } : undefined;
      if (safeParams?.email) {
        safeParams.email = maskEmail(safeParams.email);
      }
      if (safeParams?.uid) {
        safeParams.uid = maskUid(safeParams.uid);
      }
      console.log(`[API] ${endpoint}`, safeParams);
    }
  },

  /**
   * Log Firebase - uniquement en dev avec préfixe
   */
  firebase: (action: string, ...args: any[]): void => {
    if (isDev) {
      console.log(`[Firebase] ${action}`, ...args);
    }
  },

  /**
   * Log Auth - uniquement en dev avec préfixe et masquage
   */
  auth: (action: string, email?: string, ...args: any[]): void => {
    if (isDev) {
      const safeEmail = email ? maskEmail(email) : undefined;
      console.log(`[Auth] ${action}`, safeEmail, ...args);
    }
  },
};

export default logger;
