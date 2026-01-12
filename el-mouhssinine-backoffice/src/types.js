// Admin roles
export const AdminRole = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderateur'
}

// Permissions par role
export const rolePermissions = {
  [AdminRole.SUPER_ADMIN]: {
    dashboard: true,
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
  [AdminRole.ADMIN]: {
    dashboard: true,
    horaires: true,
    annonces: true,
    popups: true,
    evenements: true,
    janaza: true,
    dons: true,
    adherents: true,
    notifications: true,
    admins: false,
    parametres: false
  },
  [AdminRole.MODERATOR]: {
    dashboard: true,
    horaires: false,
    annonces: true,
    popups: false,
    evenements: true,
    janaza: false,
    dons: false,
    adherents: false,
    notifications: false,
    admins: false,
    parametres: false
  }
}

// Popup priorites
export const PopupPriorite = {
  HAUTE: 'haute',
  NORMALE: 'normale',
  BASSE: 'basse'
}

// Popup cibles
export const PopupCible = {
  TOUS: 'tous',
  ANDROID: 'android',
  IOS: 'ios',
  MEMBRES: 'membres',
  NON_MEMBRES: 'non_membres'
}

// Popup frequence d'affichage
export const PopupFrequence = {
  ALWAYS: 'always',
  DAILY: 'daily',
  ONCE: 'once',
  WEEKLY: 'weekly'
}

// Notification statuts
export const NotificationStatut = {
  BROUILLON: 'brouillon',
  PROGRAMMEE: 'programmee',
  ENVOYEE: 'envoyee',
  ECHOUEE: 'echouee'
}

// Notification topics
export const NotificationTopic = {
  TOUS: 'tous',
  PRIERES: 'prieres',
  EVENEMENTS: 'evenements',
  URGENCES: 'urgences',
  ANNOUNCEMENTS: 'announcements',
  PRAYER_REMINDERS: 'prayer_reminders',
  JANAZA: 'janaza',
  EVENTS: 'events',
  MEMBRES: 'membres'
}

// Janaza genres
export const JanazaGenre = {
  HOMME: 'homme',
  FEMME: 'femme',
  ENFANT: 'enfant'
}

// Salat Janaza options
export const SalatOptions = {
  APRES_FAJR: 'apres_fajr',
  APRES_DHUHR: 'apres_dhuhr',
  APRES_ASR: 'apres_asr',
  APRES_MAGHRIB: 'apres_maghrib',
  APRES_ISHA: 'apres_isha',
  AUTRE: 'autre',
  // Aliases for simpler access
  FAJR: 'apres_fajr',
  DHUHR: 'apres_dhuhr',
  ASR: 'apres_asr',
  MAGHRIB: 'apres_maghrib',
  ISHA: 'apres_isha',
  JUMUA: 'apres_jumua'
}

// Phrase par defaut pour Janaza
export const defaultJanazaPhrase = {
  ar: "إنا لله وإنا إليه راجعون",
  fr: "Nous appartenons à Allah et c'est vers Lui que nous retournerons"
}

// Categories de projets
export const CategorieProjet = {
  INTERNE: 'interne',
  EXTERNE: 'externe',
  HUMANITAIRE: 'humanitaire'
}

// Modes de paiement
export const ModePaiement = {
  CARTE: 'carte',
  VIREMENT: 'virement',
  ESPECES: 'especes',
  CHEQUE: 'cheque',
  PAYPAL: 'paypal'
}

// Types de cotisation
export const CotisationType = {
  MENSUEL: 'mensuel',
  TRIMESTRIEL: 'trimestriel',
  ANNUEL: 'annuel'
}

// Statuts de cotisation
export const CotisationStatut = {
  ACTIF: 'actif',
  EXPIRE: 'expire',
  EN_ATTENTE: 'en_attente',
  AUCUN: 'aucun'
}

// Fichiers autorises
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

// Taille max des fichiers en MB
export const MAX_FILE_SIZE_MB = 10
