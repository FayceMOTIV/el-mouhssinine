// Firebase Service - Mode Mock pour TestFlight
// Firestore sera active plus tard

import {
  Project,
  Announcement,
  Event,
  Janaza,
  Member,
  Donation,
  MosqueeInfo,
  Sourate,
  Dua
} from '../types';

// ==================== MOCK DATA ====================
const mockPrayerTimes = {
  prayers: [
    { name: 'Fajr', time: '06:45', icon: '🌅' },
    { name: 'Dhuhr', time: '13:15', icon: '☀️' },
    { name: 'Asr', time: '15:45', icon: '🌤️' },
    { name: 'Maghrib', time: '18:02', icon: '🌅' },
    { name: 'Isha', time: '19:30', icon: '🌙' },
  ]
};

const mockAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'Cours de Coran pour enfants',
    content: 'Reprise des cours chaque samedi à 14h. Inscription obligatoire.',
    publishedAt: new Date('2026-01-08'),
    isActive: true,
  },
  {
    id: '2',
    title: 'Collecte vêtements chauds',
    content: 'Dépôt possible tous les jours après la prière de Maghrib.',
    publishedAt: new Date('2026-01-05'),
    isActive: true,
  },
];

const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Conférence : La patience en Islam',
    description: 'Par Sheikh Ahmed',
    date: new Date('2026-01-12'),
    time: '15h00',
    location: 'Salle principale',
    requiresRegistration: false,
  },
  {
    id: '2',
    title: 'Repas communautaire',
    description: 'Tous ensemble',
    date: new Date('2026-01-18'),
    time: '19h30',
    location: 'Après Maghrib',
    requiresRegistration: true,
  },
];

const mockProjects: Project[] = [
  { id: '1', name: 'Rénovation Salle de Prière', description: 'Travaux de rénovation et isolation thermique', goal: 15000, raised: 8500, icon: '🕌', isExternal: false, isActive: true },
  { id: '2', name: 'Aide aux Nécessiteux', description: 'Distribution alimentaire mensuelle', goal: 5000, raised: 3200, icon: '🤲', isExternal: false, isActive: true },
  { id: '3', name: 'École du Dimanche', description: 'Matériel pédagogique et fournitures', goal: 3000, raised: 1800, icon: '📚', isExternal: false, isActive: true },
  { id: 'ext1', name: 'Mosquée de Gaza', description: 'Reconstruction après les bombardements', goal: 50000, raised: 32000, icon: '🇵🇸', lieu: 'Palestine', isExternal: true, isActive: true },
  { id: 'ext2', name: 'Puits au Sénégal', description: 'Construction de puits pour villages', goal: 8000, raised: 6500, icon: '💧', lieu: 'Sénégal', isExternal: true, isActive: true },
];

const mockMosqueeInfo: MosqueeInfo = {
  name: 'Mosquée El Mouhssinine',
  address: '123 Rue de la Mosquée',
  city: 'Bourg-en-Bresse',
  postalCode: '01000',
  phone: '04 74 XX XX XX',
  email: 'contact@elmouhssinine.fr',
  website: 'el-mouhssinine.web.app',
  iban: 'FR76 1234 5678 9012 3456 7890 123',
  bic: 'AGRIFRPP',
  bankName: 'Crédit Agricole',
  accountHolder: 'Association El Mouhssinine',
};

// ==================== PRAYER TIMES ====================

export const getPrayerTimes = async () => {
  console.log('[Firebase Mock] getPrayerTimes');
  return mockPrayerTimes;
};

export const subscribeToPrayerTimes = (callback: (times: any) => void) => {
  console.log('[Firebase Mock] subscribeToPrayerTimes');
  setTimeout(() => callback(mockPrayerTimes), 100);
  return () => {};
};

// ==================== ANNOUNCEMENTS ====================

export const getAnnouncements = async (): Promise<Announcement[]> => {
  console.log('[Firebase Mock] getAnnouncements');
  return mockAnnouncements;
};

export const subscribeToAnnouncements = (callback: (announcements: Announcement[]) => void) => {
  console.log('[Firebase Mock] subscribeToAnnouncements');
  setTimeout(() => callback(mockAnnouncements), 100);
  return () => {};
};

// ==================== EVENTS ====================

export const getEvents = async (): Promise<Event[]> => {
  console.log('[Firebase Mock] getEvents');
  return mockEvents;
};

export const subscribeToEvents = (callback: (events: Event[]) => void) => {
  console.log('[Firebase Mock] subscribeToEvents');
  setTimeout(() => callback(mockEvents), 100);
  return () => {};
};

// ==================== JANAZA ====================

export const getActiveJanaza = async (): Promise<Janaza | null> => {
  console.log('[Firebase Mock] getActiveJanaza');
  return null;
};

export const subscribeToJanaza = (callback: (janaza: Janaza | null) => void) => {
  console.log('[Firebase Mock] subscribeToJanaza');
  setTimeout(() => callback(null), 100);
  return () => {};
};

// ==================== PROJECTS ====================

export const getProjects = async (isExternal: boolean = false): Promise<Project[]> => {
  console.log('[Firebase Mock] getProjects isExternal:', isExternal);
  return mockProjects.filter(p => p.isExternal === isExternal);
};

export const subscribeToProjects = (callback: (projects: Project[]) => void) => {
  console.log('[Firebase Mock] subscribeToProjects');
  setTimeout(() => callback(mockProjects), 100);
  return () => {};
};

// ==================== DONATIONS ====================

export const createDonation = async (donation: Omit<Donation, 'id' | 'createdAt'>): Promise<string> => {
  console.log('[Firebase Mock] createDonation:', donation);
  return `mock-donation-${Date.now()}`;
};

// ==================== MEMBERS ====================

export const getMember = async (memberId: string): Promise<Member | null> => {
  console.log('[Firebase Mock] getMember:', memberId);
  return null;
};

export const updateMember = async (memberId: string, data: Partial<Member>) => {
  console.log('[Firebase Mock] updateMember:', memberId, data);
};

export const createMember = async (member: Omit<Member, 'id' | 'createdAt' | 'memberId'>): Promise<string> => {
  console.log('[Firebase Mock] createMember:', member);
  return `mock-member-${Date.now()}`;
};

// ==================== MOSQUEE INFO ====================

export const getMosqueeInfo = async (): Promise<MosqueeInfo | null> => {
  console.log('[Firebase Mock] getMosqueeInfo');
  return mockMosqueeInfo;
};

export const subscribeToMosqueeInfo = (callback: (info: MosqueeInfo) => void) => {
  console.log('[Firebase Mock] subscribeToMosqueeInfo');
  setTimeout(() => callback(mockMosqueeInfo), 100);
  return () => {};
};

// ==================== SOURATES & DUAS ====================

export const getSourates = async (): Promise<Sourate[]> => {
  console.log('[Firebase Mock] getSourates');
  return [];
};

export const getDuas = async (): Promise<Dua[]> => {
  console.log('[Firebase Mock] getDuas');
  return [];
};

// ==================== ISLAMIC DATES ====================

export const getIslamicDates = async () => {
  console.log('[Firebase Mock] getIslamicDates');
  return null;
};
