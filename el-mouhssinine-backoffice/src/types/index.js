// ==================== POPUP ====================
export const PopupPriorite = {
  BASSE: 'basse',
  NORMALE: 'normale',
  HAUTE: 'haute'
}

export const PopupCible = {
  TOUS: 'tous',
  MEMBRES: 'membres',
  NON_MEMBRES: 'non_membres'
}

export const PopupFrequence = {
  ALWAYS: 'always',
  DAILY: 'daily',
  ONCE: 'once',
  WEEKLY: 'weekly'
}

// ==================== JANAZA ====================
export const JanazaGenre = {
  HOMME: 'homme',
  FEMME: 'femme',
  ENFANT: 'enfant'
}

export const SalatOptions = {
  FAJR: 'fajr',
  DHUHR: 'dhuhr',
  ASR: 'asr',
  MAGHRIB: 'maghrib',
  ISHA: 'isha',
  JUMUA: 'jumua'
}

// ==================== DONS ====================
export const ModePaiement = {
  CARTE: 'carte',
  VIREMENT: 'virement',
  ESPECES: 'especes',
  CHEQUE: 'cheque',
  PAYPAL: 'paypal',
  APPLE_PAY: 'apple_pay'
}

export const CategorieProjet = {
  INTERNE: 'interne',
  EXTERNE: 'externe'
}

export const FichierType = {
  PDF: 'pdf',
  IMAGE: 'image',
  DOCUMENT: 'document'
}

export const ALLOWED_FILE_TYPES = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx']
export const MAX_FILE_SIZE_MB = 10

// ==================== MEMBRES ====================
export const CotisationType = {
  MENSUEL: 'mensuel',
  ANNUEL: 'annuel'
}

export const CotisationStatut = {
  ACTIF: 'actif',
  EXPIRE: 'expire',
  AUCUN: 'aucun',
  EN_ATTENTE_SIGNATURE: 'en_attente_signature',
  EN_ATTENTE_PAIEMENT: 'en_attente_paiement'
}

// ==================== NOTIFICATIONS ====================
export const NotificationStatut = {
  PROGRAMMEE: 'programmee',
  ENVOYEE: 'envoyee',
  ECHOUEE: 'echouee',
  ANNULEE: 'annulee'
}

export const NotificationTopic = {
  TOUS: 'tous',
  ANNOUNCEMENTS: 'announcements',
  PRAYER_REMINDERS: 'prayer_reminders',
  JANAZA: 'janaza',
  EVENTS: 'events',
  MEMBRES: 'membres'
}

// ==================== ADMINS ====================
export const AdminRole = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderateur'
}

// ==================== DEFAULT VALUES ====================
export const defaultJanazaPhrase = {
  ar: 'إنا لله وإنا إليه راجعون',
  fr: 'Nous appartenons à Allah et c\'est vers Lui que nous retournerons'
}

export const defaultPermissions = {
  horaires: true,
  annonces: true,
  popups: false,
  evenements: true,
  janaza: true,
  dons: false,
  adherents: false,
  notifications: false,
  admins: false,
  parametres: false
}

export const rolePermissions = {
  super_admin: {
    horaires: true,
    annonces: true,
    popups: true,
    evenements: true,
    janaza: true,
    dons: true,
    adherents: true,
    notifications: true,
    admins: true,
    parametres: true
  },
  admin: {
    horaires: true,
    annonces: true,
    popups: true,
    evenements: true,
    janaza: true,
    dons: true,
    adherents: true,
    notifications: true,
    admins: false,
    parametres: true
  },
  moderateur: {
    horaires: false,
    annonces: true,
    popups: false,
    evenements: true,
    janaza: true,
    dons: false,
    adherents: false,
    notifications: false,
    admins: false,
    parametres: false
  }
}
