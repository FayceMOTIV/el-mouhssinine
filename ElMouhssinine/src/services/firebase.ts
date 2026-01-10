// Firebase Service - Connecté au backoffice El Mouhssinine
// Collections Firestore en FRANÇAIS (alignées sur le backoffice)

import {
  Project,
  Announcement,
  Event,
  Janaza,
  Member,
  Donation,
  MosqueeInfo,
  Sourate,
  Dua,
  PrayerTime
} from '../types';

// ==================== CONFIGURATION ====================
const firebaseConfig = {
  apiKey: "AIzaSyCJr6tGI9QpbWr3pf1GpYoEnvsGgkJj8j8",
  authDomain: "el-mouhssinine.firebaseapp.com",
  projectId: "el-mouhssinine",
  storageBucket: "el-mouhssinine.firebasestorage.app",
  messagingSenderId: "658931173250",
  appId: "1:658931173250:web:c5a7e8f2d3b4a192837465"
};

// Mode demo pour TestFlight (à mettre à false pour production)
const FORCE_DEMO_MODE = false;
let isDemoMode = FORCE_DEMO_MODE;

// Firebase sera initialisé dynamiquement quand on désactivera le mode démo
let db: any = null;

// ==================== MOCK DATA (Mode Demo) ====================
const mockPrayerTimes = {
  times: {
    fajr: '06:45',
    dhuhr: '13:15',
    asr: '15:45',
    maghrib: '18:02',
    isha: '19:30',
  },
  // Iqama = délai en MINUTES après l'adhan (comme dans le backoffice)
  iqama: {
    fajr: 15,      // Adhan 06:45 + 15 min = Iqama 07:00
    dhuhr: 15,     // Adhan 13:15 + 15 min = Iqama 13:30
    asr: 15,       // Adhan 15:45 + 15 min = Iqama 16:00
    maghrib: 5,    // Adhan 18:02 + 5 min = Iqama 18:07
    isha: 15,      // Adhan 19:30 + 15 min = Iqama 19:45
  },
  jumua: {
    jumua1: '13:00',
    jumua2: '14:00',
  }
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

const mockJanaza: Janaza | null = null;

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

// ==================== HELPER: Convert Firestore timestamp ====================
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
};

// ==================== PRAYER TIMES ====================
// Collection: settings/horaires (synchronisé avec le backoffice)

// Iqama = délai en minutes à ajouter à l'adhan (ex: 10 = +10 min après l'adhan)
export interface IqamaDelays {
  fajr: number | string;
  dhuhr: number | string;
  asr: number | string;
  maghrib: number | string;
  isha: number | string;
}

export interface JumuaTimes {
  jumua1: string;
  jumua2?: string;
  jumua3?: string;
}

export interface HorairesData {
  iqama: IqamaDelays;
  jumua: JumuaTimes;
  lastUpdated?: string;
}

// Helper: Ajouter des minutes à une heure (HH:MM)
export const addMinutesToTime = (time: string, minutes: number | string): string => {
  if (!time || !minutes) return '--:--';
  const [hours, mins] = time.split(':').map(Number);
  const totalMins = hours * 60 + mins + parseInt(String(minutes));
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
};

export const getPrayerTimes = async () => {
  console.log('[Firebase] getPrayerTimes');
  if (isDemoMode) {
    return mockPrayerTimes;
  }
  // TODO: Implement Firestore query
  // const docRef = doc(db, 'settings', 'prayerTimes');
  // const docSnap = await getDoc(docRef);
  // return docSnap.data();
  return mockPrayerTimes;
};

export const subscribeToPrayerTimes = (callback: (times: any) => void) => {
  console.log('[Firebase] subscribeToPrayerTimes');
  if (isDemoMode) {
    setTimeout(() => callback(mockPrayerTimes), 100);
    return () => {};
  }
  // TODO: Implement Firestore subscription
  // return onSnapshot(doc(db, 'settings', 'prayerTimes'), (doc) => {
  //   callback(doc.data());
  // });
  setTimeout(() => callback(mockPrayerTimes), 100);
  return () => {};
};

// Récupérer les horaires Iqama depuis Firebase (settings/horaires)
export const subscribeToIqama = (callback: (horaires: HorairesData | null) => void) => {
  console.log('[Firebase] subscribeToIqama');
  if (isDemoMode) {
    // En mode démo, utiliser les données mockées
    setTimeout(() => callback({
      iqama: mockPrayerTimes.iqama,
      jumua: mockPrayerTimes.jumua,
    }), 100);
    return () => {};
  }
  // TODO: Implement Firestore subscription
  // return onSnapshot(doc(db, 'settings', 'horaires'), (doc) => {
  //   callback(doc.exists() ? doc.data() as HorairesData : null);
  // });
  setTimeout(() => callback({
    iqama: mockPrayerTimes.iqama,
    jumua: mockPrayerTimes.jumua,
  }), 100);
  return () => {};
};

// ==================== ANNOUNCEMENTS ====================
// Collection Firestore: "announcements"
// Champs FR: titre, contenu, actif, createdAt

export const getAnnouncements = async (): Promise<Announcement[]> => {
  console.log('[Firebase] getAnnouncements');
  if (isDemoMode) {
    return mockAnnouncements;
  }
  // TODO: Implement Firestore query with mapping
  // const snapshot = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')));
  // return snapshot.docs.map(doc => mapAnnouncementFromFirestore(doc));
  return mockAnnouncements;
};

export const subscribeToAnnouncements = (callback: (announcements: Announcement[]) => void) => {
  console.log('[Firebase] subscribeToAnnouncements');
  if (isDemoMode) {
    setTimeout(() => callback(mockAnnouncements), 100);
    return () => {};
  }
  // TODO: Implement Firestore subscription with mapping
  // return onSnapshot(
  //   query(collection(db, 'announcements'), orderBy('createdAt', 'desc')),
  //   (snapshot) => {
  //     const data = snapshot.docs.map(doc => ({
  //       id: doc.id,
  //       title: doc.data().titre,           // FR → EN
  //       content: doc.data().contenu,       // FR → EN
  //       isActive: doc.data().actif,        // FR → EN
  //       publishedAt: toDate(doc.data().createdAt),
  //     }));
  //     callback(data.filter(a => a.isActive));
  //   }
  // );
  setTimeout(() => callback(mockAnnouncements), 100);
  return () => {};
};

// ==================== EVENTS ====================
// Collection Firestore: "events"
// Champs FR: titre, description, date, heure, lieu, actif

export const getEvents = async (): Promise<Event[]> => {
  console.log('[Firebase] getEvents');
  if (isDemoMode) {
    return mockEvents;
  }
  // TODO: Implement Firestore query with mapping
  return mockEvents;
};

export const subscribeToEvents = (callback: (events: Event[]) => void) => {
  console.log('[Firebase] subscribeToEvents');
  if (isDemoMode) {
    setTimeout(() => callback(mockEvents), 100);
    return () => {};
  }
  // TODO: Implement Firestore subscription with mapping
  // return onSnapshot(
  //   query(collection(db, 'events'), orderBy('date', 'asc')),
  //   (snapshot) => {
  //     const data = snapshot.docs.map(doc => ({
  //       id: doc.id,
  //       title: doc.data().titre,           // FR → EN
  //       description: doc.data().description,
  //       date: toDate(doc.data().date),
  //       time: doc.data().heure,            // FR → EN
  //       location: doc.data().lieu,         // FR → EN
  //       requiresRegistration: false,
  //     }));
  //     callback(data.filter(e => doc.data().actif));
  //   }
  // );
  setTimeout(() => callback(mockEvents), 100);
  return () => {};
};

// ==================== JANAZA ====================
// Collection Firestore: "janaza"
// Champs FR: nomDefunt, genre, age, date, heurePriere, salatApres, lieu, phraseAr, phraseFr, actif

export const getActiveJanaza = async (): Promise<Janaza | null> => {
  console.log('[Firebase] getActiveJanaza');
  if (isDemoMode) {
    return mockJanaza;
  }
  // TODO: Implement Firestore query with mapping
  // const snapshot = await getDocs(query(collection(db, 'janaza'), where('actif', '==', true)));
  // if (snapshot.empty) return null;
  // const doc = snapshot.docs[0];
  // return {
  //   id: doc.id,
  //   deceasedName: doc.data().nomDefunt,      // FR → EN
  //   deceasedNameAr: doc.data().nomDefuntAr,  // FR → EN
  //   prayerTime: doc.data().heurePriere || doc.data().salatApres,
  //   prayerDate: toDate(doc.data().date),
  //   location: doc.data().lieu,               // FR → EN
  //   message: doc.data().phraseFr,
  //   isActive: doc.data().actif,
  // };
  return mockJanaza;
};

export const subscribeToJanaza = (callback: (janaza: Janaza | null) => void) => {
  console.log('[Firebase] subscribeToJanaza');
  if (isDemoMode) {
    setTimeout(() => callback(mockJanaza), 100);
    return () => {};
  }
  // TODO: Implement Firestore subscription with mapping
  setTimeout(() => callback(mockJanaza), 100);
  return () => {};
};

// ==================== PROJECTS ====================
// Collection Firestore: "projects"
// Champs FR: titre, description, objectif, montantActuel, categorie, actif, fichiers

export const getProjects = async (isExternal: boolean = false): Promise<Project[]> => {
  console.log('[Firebase] getProjects isExternal:', isExternal);
  if (isDemoMode) {
    return mockProjects.filter(p => p.isExternal === isExternal);
  }
  // TODO: Implement Firestore query with mapping
  // const snapshot = await getDocs(query(collection(db, 'projects'), where('actif', '==', true)));
  // return snapshot.docs.map(doc => ({
  //   id: doc.id,
  //   name: doc.data().titre,                    // FR → EN
  //   description: doc.data().description,
  //   goal: doc.data().objectif,                 // FR → EN
  //   raised: doc.data().montantActuel,          // FR → EN
  //   icon: '🕌',
  //   isExternal: doc.data().categorie === 'externe',
  //   lieu: doc.data().lieu,
  //   isActive: doc.data().actif,
  // })).filter(p => p.isExternal === isExternal);
  return mockProjects.filter(p => p.isExternal === isExternal);
};

export const subscribeToProjects = (callback: (projects: Project[]) => void) => {
  console.log('[Firebase] subscribeToProjects');
  if (isDemoMode) {
    setTimeout(() => callback(mockProjects), 100);
    return () => {};
  }
  // TODO: Implement Firestore subscription with mapping
  setTimeout(() => callback(mockProjects), 100);
  return () => {};
};

// ==================== DONATIONS ====================
// Collection Firestore: "donations"
// Champs FR: donateur, montant, projetId, modePaiement, date

export const createDonation = async (donation: Omit<Donation, 'id' | 'createdAt'>): Promise<string> => {
  console.log('[Firebase] createDonation:', donation);
  if (isDemoMode) {
    return `mock-donation-${Date.now()}`;
  }
  // TODO: Implement Firestore write with mapping
  // const docRef = await addDoc(collection(db, 'donations'), {
  //   donateur: donation.memberEmail || 'Anonyme',  // EN → FR
  //   montant: donation.amount,                      // EN → FR
  //   projetId: donation.projectId,
  //   modePaiement: donation.paymentMethod,          // EN → FR
  //   date: serverTimestamp(),
  // });
  // return docRef.id;
  return `mock-donation-${Date.now()}`;
};

// ==================== MEMBERS ====================
// Collection Firestore: "members"
// Champs FR: nom, prenom, email, telephone, cotisation: { type, montant, dateDebut, dateFin }, actif

export const getMember = async (memberId: string): Promise<Member | null> => {
  console.log('[Firebase] getMember:', memberId);
  if (isDemoMode) {
    return null;
  }
  // TODO: Implement Firestore query with mapping
  // const docSnap = await getDoc(doc(db, 'members', memberId));
  // if (!docSnap.exists()) return null;
  // const data = docSnap.data();
  // return {
  //   id: docSnap.id,
  //   name: `${data.prenom} ${data.nom}`,           // FR → EN
  //   email: data.email,
  //   phone: data.telephone,                         // FR → EN
  //   memberId: docSnap.id,
  //   cotisationType: data.cotisation?.type || null,
  //   cotisationStatus: getCotisationStatus(data.cotisation),
  //   nextPaymentDate: toDate(data.cotisation?.dateFin),
  //   createdAt: toDate(data.createdAt),
  // };
  return null;
};

export const updateMember = async (memberId: string, data: Partial<Member>) => {
  console.log('[Firebase] updateMember:', memberId, data);
  if (isDemoMode) return;
  // TODO: Implement Firestore update with mapping
};

export const createMember = async (member: Omit<Member, 'id' | 'createdAt' | 'memberId'>): Promise<string> => {
  console.log('[Firebase] createMember:', member);
  if (isDemoMode) {
    return `mock-member-${Date.now()}`;
  }
  // TODO: Implement Firestore write with mapping
  // const nameParts = member.name.split(' ');
  // const docRef = await addDoc(collection(db, 'members'), {
  //   prenom: nameParts[0],                          // EN → FR
  //   nom: nameParts.slice(1).join(' '),             // EN → FR
  //   email: member.email,
  //   telephone: member.phone,                        // EN → FR
  //   cotisation: {
  //     type: member.cotisationType,
  //     montant: member.cotisationType === 'annuel' ? 100 : 10,
  //     dateDebut: new Date(),
  //     dateFin: getNextPaymentDate(member.cotisationType),
  //   },
  //   actif: true,
  //   createdAt: serverTimestamp(),
  // });
  // return docRef.id;
  return `mock-member-${Date.now()}`;
};

// ==================== MOSQUEE INFO ====================
// Collection Firestore: "settings/mosqueeInfo"
// Champs FR: nom, ville, telephone

export const getMosqueeInfo = async (): Promise<MosqueeInfo | null> => {
  console.log('[Firebase] getMosqueeInfo');
  if (isDemoMode) {
    return mockMosqueeInfo;
  }
  // TODO: Implement Firestore query with mapping
  // const docSnap = await getDoc(doc(db, 'settings', 'mosqueeInfo'));
  // if (!docSnap.exists()) return null;
  // const data = docSnap.data();
  // return {
  //   name: data.nom,                                // FR → EN
  //   address: data.adresse,                         // FR → EN
  //   city: data.ville,                              // FR → EN
  //   postalCode: data.codePostal,                   // FR → EN
  //   phone: data.telephone,                         // FR → EN
  //   email: data.email,
  //   website: data.website,
  //   iban: data.iban,
  //   bic: data.bic,
  //   bankName: data.banque,                         // FR → EN
  //   accountHolder: data.titulaire,                 // FR → EN
  // };
  return mockMosqueeInfo;
};

export const subscribeToMosqueeInfo = (callback: (info: MosqueeInfo) => void) => {
  console.log('[Firebase] subscribeToMosqueeInfo');
  if (isDemoMode) {
    setTimeout(() => callback(mockMosqueeInfo), 100);
    return () => {};
  }
  // TODO: Implement Firestore subscription with mapping
  setTimeout(() => callback(mockMosqueeInfo), 100);
  return () => {};
};

// ==================== SOURATES & DUAS ====================

export const getSourates = async (): Promise<Sourate[]> => {
  console.log('[Firebase] getSourates');
  return [];
};

export const getDuas = async (): Promise<Dua[]> => {
  console.log('[Firebase] getDuas');
  return [];
};

// ==================== ISLAMIC DATES ====================

export const getIslamicDates = async () => {
  console.log('[Firebase] getIslamicDates');
  return null;
};

// ==================== EXPORTS ====================
export { isDemoMode, firebaseConfig };
