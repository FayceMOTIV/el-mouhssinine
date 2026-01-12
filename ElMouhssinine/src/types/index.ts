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
  requiresRegistration: boolean;
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
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  memberId: string;
  cotisationType: 'mensuel' | 'annuel' | null;
  cotisationStatus: 'active' | 'expired' | 'none' | 'pending';
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
