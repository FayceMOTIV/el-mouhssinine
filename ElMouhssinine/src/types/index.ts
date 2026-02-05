// Types pour l'application El Mouhssinine

export interface PrayerTime {
  name: string;
  time: string;
  icon: string;
}

export interface IslamicDate {
  name: string;
  date: string;
  gregorian: string;
  daysLeft: number;
  icon: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  publishedAt: Date;
  isActive: boolean;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  time: string;
  location: string;
  requiresRegistration?: boolean;
  isActive?: boolean;
  category?: string;
}

export interface Janaza {
  id: string;
  deceasedName: string;
  deceasedNameAr?: string;
  prayerTime: string;
  prayerDate: Date;
  location: string;
  message?: string;
  isActive: boolean;
  salatApres?: string; // "apres_fajr", "apres_dhuhr", etc.
}

export interface ProjectFile {
  id: string;
  nom: string;
  type: string;
  url: string;
  taille?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  storagePath?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  goal: number;
  raised: number;
  icon: string;
  isExternal: boolean;
  lieu?: string;
  iban?: string;
  isActive: boolean;
  fichiers?: ProjectFile[];
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  memberId: string;
  cotisationType: 'mensuel' | 'annuel' | null;
  cotisationStatus: 'active' | 'expired' | 'none' | 'pending' | 'sympathisant' | 'en_attente_validation' | 'en_attente_signature' | 'en_attente_paiement';
  nextPaymentDate?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
}

export interface Donation {
  id: string;
  memberId?: string;
  memberEmail?: string;
  amount: number;
  projectId: string;
  projectName: string;
  paymentMethod: 'card' | 'apple_pay' | 'sepa' | 'virement';
  status: 'pending' | 'completed' | 'failed';
  stripePaymentId?: string;
  createdAt: Date;
}

export interface MosqueeInfo {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  bic: string;
  bankName: string;
  accountHolder: string;
}

export interface Sourate {
  id: number;
  name: string;
  nameAr: string;
  verses: number;
  type: 'Mecquoise' | 'Médinoise';
}

export interface Dua {
  id: number;
  name: string;
  nameAr: string;
  icon: string;
  count: number;
  invocations?: Invocation[];
}

export interface Invocation {
  id: string;
  arabic: string;
  translation: string;
  transliteration?: string;
  repetitions: number;
}

export interface NotificationSettings {
  enabled: boolean;
  minutesBefore: number;
  adhanSound: boolean;
  jumuaReminder: boolean;
}

export interface AppSettings {
  notifications: NotificationSettings;
  language: 'fr' | 'ar';
  calculationMethod: string;
}

// ==================== ERROR & RESULT TYPES ====================

/**
 * Interface pour les erreurs Firebase (Auth, Firestore, etc.)
 */
export interface FirebaseError extends Error {
  code?: string;
  customData?: { httpErrorCode?: string };
}

/**
 * Résultat d'une opération d'authentification
 */
export interface AuthResult {
  success: boolean;
  user?: {
    uid: string;
    email: string | null;
  };
  error?: string;
}

/**
 * Résultat d'une opération de paiement
 */
export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

/**
 * Résultat générique d'une opération API
 */
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== NAVIGATION TYPES ====================

/**
 * Types des paramètres de navigation pour toutes les routes
 */
export type RootStackParamList = {
  Home: undefined;
  Member: undefined;
  Quran: undefined;
  QuranHome: undefined;
  QuranRead: { page?: number };
  Surah: { surahNumber: number; surahName: string };
  Messages: undefined;
  Conversation: { messageId: string };
  Donations: undefined;
  More: undefined;
  Adhkar: undefined;
  AdhkarDetail: { category: string };
  LearnArabic: undefined;
  Alphabet: undefined;
  LetterDetail: { letter: any };
  LessonsList: undefined;
  Lesson: { lessonId: number };
  Quiz: { lessonId: number };
  Spiritual: undefined;
  MyMemberships: undefined;
};

// ==================== MESSAGE TYPES ====================

/**
 * Interface pour une réponse dans un message
 */
export interface MessageReply {
  id: string;
  contenu: string;
  createdBy: 'user' | 'mosquee';
  createdAt: any; // Timestamp Firebase
  createdByName?: string;
}

/**
 * Interface pour un message complet
 */
export interface Message {
  id: string;
  sujet: string;
  contenu: string;
  nom: string;
  email: string;
  telephone?: string;
  odUserId: string;
  statut: 'nouveau' | 'lu' | 'repondu' | 'archive';
  createdAt: any; // Timestamp Firebase
  reponses?: MessageReply[];
  deleted?: boolean;
}

// ==================== COTISATION TYPES ====================

/**
 * Statuts possibles d'une cotisation/membre
 */
export type CotisationStatus =
  | 'none'
  | 'active'
  | 'expired'
  | 'pending'
  | 'sympathisant'           // Inscrit sans paiement, accès complet app
  | 'en_attente_validation'  // A payé, attend validation bureau
  | 'en_attente_paiement'
  | 'en_attente_signature';

/**
 * Types de cotisation
 */
export type CotisationType = 'mensuel' | 'annuel' | null;

/**
 * Interface pour les données de cotisation
 */
export interface CotisationData {
  dateDebut?: string;
  dateFin?: string;
  montant: number;
  type: CotisationType;
  status?: CotisationStatus;
  modePaiement?: 'card' | 'virement' | 'especes' | 'cheque' | 'apple_pay' | 'google_pay';
}

// ==================== PAYMENT METADATA ====================

/**
 * Métadonnées pour un paiement Stripe
 */
export interface PaymentMetadata {
  projectId?: string;
  projectName?: string;
  memberId?: string;
  memberIdDisplay?: string;
  memberName?: string;
  email?: string;
  isAnonymous?: boolean;
  period?: string;
  membersCount?: string;
  montantCotisation?: number;
  montantDon?: number;
}
