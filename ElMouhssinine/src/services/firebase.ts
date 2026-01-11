// Firebase Service - Connecté au backoffice El Mouhssinine
// Collections Firestore en FRANÇAIS (alignées sur le backoffice)
// Fallback sur données mock si Firebase vide ou erreur

import firestore from '@react-native-firebase/firestore';
import {
  Project,
  Announcement,
  Event,
  Janaza,
  Member,
  Donation,
  MosqueeInfo,
} from '../types';
import {
  mockAnnouncements,
  mockEvents,
  mockJanaza,
  mockProjects,
  mockPopups,
  mockRappels,
  mockMosqueeInfo,
  mockServices,
  mockActivites,
  mockDatesIslamiques,
  mockIqama,
  mockJumua,
} from '../data/mockData';

// ==================== CONFIGURATION ====================

// MODE DÉMO : true = données mock uniquement, false = Firebase avec fallback mock
const FORCE_DEMO_MODE = false;

// Helper pour fusionner Firebase + Mock (Firebase prioritaire, mock en fallback)
const mergeWithMock = <T>(firebaseData: T[], mockData: T[]): T[] => {
  if (firebaseData && firebaseData.length > 0) {
    return firebaseData;
  }
  return mockData;
};

// Helper: Convert Firestore timestamp to Date
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
};

// ==================== INTERFACES ====================

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

export interface Rappel {
  id: string;
  texteFr: string;
  texteAr: string;
  source: string;
  actif: boolean;
}

export interface Popup {
  id: string;
  titre: string;
  contenu: string;
  actif: boolean;
  dateDebut?: string;
  dateFin?: string;
  priorite?: number;
}

export interface DateIslamique {
  id: string;
  nom: string;
  nomAr: string;
  dateHijri: string;
  dateGregorien: string;
  icon: string;
  approximatif?: boolean;
}

// ==================== HELPER FUNCTIONS ====================

// Ajouter des minutes à une heure (HH:MM)
export const addMinutesToTime = (time: string, minutes: number | string): string => {
  if (!time || minutes === undefined || minutes === null) return '--:--';
  const [hours, mins] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(mins)) return '--:--';
  const totalMins = hours * 60 + mins + parseInt(String(minutes));
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
};

// ==================== ANNONCES ====================
// Collection Firestore: "announcements"
// Champs backoffice: titre, contenu, actif, createdAt

export const subscribeToAnnouncements = (callback: (data: Announcement[]) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(mockAnnouncements as Announcement[]);
    return () => {};
  }

  try {
    return firestore()
      .collection('announcements')
      .where('actif', '==', true)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().titre,
            content: doc.data().contenu,
            isActive: doc.data().actif,
            publishedAt: toDate(doc.data().createdAt),
          }));
          callback(mergeWithMock(data, mockAnnouncements as Announcement[]));
        },
        error => {
          console.error('[Firebase] Announcements error:', error);
          callback(mockAnnouncements as Announcement[]);
        }
      );
  } catch (error) {
    console.error('[Firebase] Announcements catch:', error);
    callback(mockAnnouncements as Announcement[]);
    return () => {};
  }
};

export const getAnnouncements = async (): Promise<Announcement[]> => {
  if (FORCE_DEMO_MODE) {
    return mockAnnouncements as Announcement[];
  }
  try {
    const snapshot = await firestore()
      .collection('announcements')
      .where('actif', '==', true)
      .orderBy('createdAt', 'desc')
      .get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().titre,
      content: doc.data().contenu,
      isActive: doc.data().actif,
      publishedAt: toDate(doc.data().createdAt),
    }));
    return mergeWithMock(data, mockAnnouncements as Announcement[]);
  } catch (error) {
    console.error('[Firebase] getAnnouncements error:', error);
    return mockAnnouncements as Announcement[];
  }
};

// ==================== ÉVÉNEMENTS ====================
// Collection Firestore: "events"
// Champs backoffice: titre, description, date, heure, lieu, actif, categorie

export const subscribeToEvents = (callback: (data: Event[]) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(mockEvents as Event[]);
    return () => {};
  }

  try {
    return firestore()
      .collection('events')
      .where('actif', '==', true)
      .orderBy('date', 'asc')
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().titre,
            description: doc.data().description,
            date: toDate(doc.data().date),
            time: doc.data().heure,
            location: doc.data().lieu,
            requiresRegistration: doc.data().inscription || false,
            category: doc.data().categorie,
          }));
          callback(mergeWithMock(data, mockEvents as Event[]));
        },
        error => {
          console.error('[Firebase] Events error:', error);
          callback(mockEvents as Event[]);
        }
      );
  } catch (error) {
    console.error('[Firebase] Events catch:', error);
    callback(mockEvents as Event[]);
    return () => {};
  }
};

export const getEvents = async (): Promise<Event[]> => {
  if (FORCE_DEMO_MODE) {
    return mockEvents as Event[];
  }
  try {
    const snapshot = await firestore()
      .collection('events')
      .where('actif', '==', true)
      .orderBy('date', 'asc')
      .get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().titre,
      description: doc.data().description,
      date: toDate(doc.data().date),
      time: doc.data().heure,
      location: doc.data().lieu,
      requiresRegistration: doc.data().inscription || false,
      category: doc.data().categorie,
    }));
    return mergeWithMock(data, mockEvents as Event[]);
  } catch (error) {
    console.error('[Firebase] getEvents error:', error);
    return mockEvents as Event[];
  }
};

// ==================== SALAT JANAZA ====================
// Collection Firestore: "janaza"
// Champs backoffice: nomDefunt, nomDefuntAr, date, heurePriere, lieu, phraseAr, phraseFr, actif

export const subscribeToJanaza = (callback: (data: Janaza | null) => void) => {
  if (FORCE_DEMO_MODE) {
    const active = mockJanaza.find(j => j.isActive);
    callback(active ? (active as Janaza) : null);
    return () => {};
  }

  try {
    return firestore()
      .collection('janaza')
      .where('actif', '==', true)
      .orderBy('date', 'desc')
      .limit(1)
      .onSnapshot(
        snapshot => {
          if (snapshot.empty) {
            // Pas de janaza active dans Firebase, vérifier mock
            const mockActive = mockJanaza.find(j => j.isActive);
            callback(mockActive ? (mockActive as Janaza) : null);
            return;
          }
          const doc = snapshot.docs[0];
          const data: Janaza = {
            id: doc.id,
            deceasedName: doc.data().nomDefunt,
            deceasedNameAr: doc.data().nomDefuntAr || doc.data().phraseAr,
            prayerDate: toDate(doc.data().date),
            prayerTime: doc.data().heurePriere,
            location: doc.data().lieu,
            message: doc.data().phraseFr,
            isActive: doc.data().actif,
          };
          callback(data);
        },
        error => {
          console.error('[Firebase] Janaza error:', error);
          const mockActive = mockJanaza.find(j => j.isActive);
          callback(mockActive ? (mockActive as Janaza) : null);
        }
      );
  } catch (error) {
    console.error('[Firebase] Janaza catch:', error);
    const mockActive = mockJanaza.find(j => j.isActive);
    callback(mockActive ? (mockActive as Janaza) : null);
    return () => {};
  }
};

export const getActiveJanaza = async (): Promise<Janaza | null> => {
  if (FORCE_DEMO_MODE) {
    const active = mockJanaza.find(j => j.isActive);
    return active ? (active as Janaza) : null;
  }
  try {
    const snapshot = await firestore()
      .collection('janaza')
      .where('actif', '==', true)
      .orderBy('date', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) {
      const mockActive = mockJanaza.find(j => j.isActive);
      return mockActive ? (mockActive as Janaza) : null;
    }
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      deceasedName: doc.data().nomDefunt,
      deceasedNameAr: doc.data().nomDefuntAr || doc.data().phraseAr,
      prayerDate: toDate(doc.data().date),
      prayerTime: doc.data().heurePriere,
      location: doc.data().lieu,
      message: doc.data().phraseFr,
      isActive: doc.data().actif,
    };
  } catch (error) {
    console.error('[Firebase] getActiveJanaza error:', error);
    const mockActive = mockJanaza.find(j => j.isActive);
    return mockActive ? (mockActive as Janaza) : null;
  }
};

// ==================== PROJETS / DONS ====================
// Collection Firestore: "projects"
// Champs backoffice: titre, description, objectif, montantActuel, categorie, actif, icon, lieu, iban

export const subscribeToProjects = (callback: (data: Project[]) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(mockProjects as Project[]);
    return () => {};
  }

  try {
    return firestore()
      .collection('projects')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().titre,
            description: doc.data().description,
            goal: doc.data().objectif || 0,
            raised: doc.data().montantActuel || 0,
            icon: doc.data().icon || '🕌',
            isExternal: doc.data().categorie === 'externe',
            isActive: doc.data().actif,
            lieu: doc.data().lieu,
            iban: doc.data().iban,
          }));
          callback(mergeWithMock(data, mockProjects as Project[]));
        },
        error => {
          console.error('[Firebase] Projects error:', error);
          callback(mockProjects as Project[]);
        }
      );
  } catch (error) {
    console.error('[Firebase] Projects catch:', error);
    callback(mockProjects as Project[]);
    return () => {};
  }
};

export const getProjects = async (isExternal?: boolean): Promise<Project[]> => {
  if (FORCE_DEMO_MODE) {
    if (isExternal !== undefined) {
      return (mockProjects as Project[]).filter(p => p.isExternal === isExternal);
    }
    return mockProjects as Project[];
  }
  try {
    const snapshot = await firestore()
      .collection('projects')
      .where('actif', '==', true)
      .get();
    let data = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().titre,
      description: doc.data().description,
      goal: doc.data().objectif || 0,
      raised: doc.data().montantActuel || 0,
      icon: doc.data().icon || '🕌',
      isExternal: doc.data().categorie === 'externe',
      isActive: doc.data().actif,
      lieu: doc.data().lieu,
      iban: doc.data().iban,
    }));
    data = mergeWithMock(data, mockProjects as Project[]);
    if (isExternal !== undefined) {
      return data.filter(p => p.isExternal === isExternal);
    }
    return data;
  } catch (error) {
    console.error('[Firebase] getProjects error:', error);
    if (isExternal !== undefined) {
      return (mockProjects as Project[]).filter(p => p.isExternal === isExternal);
    }
    return mockProjects as Project[];
  }
};

// ==================== DONATIONS ====================
// Collection Firestore: "donations"

export const createDonation = async (donation: Omit<Donation, 'id' | 'createdAt'>): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-donation-${Date.now()}`;
  }
  try {
    const docRef = await firestore().collection('donations').add({
      donateur: donation.memberEmail || 'Anonyme',
      montant: donation.amount,
      projetId: donation.projectId,
      projetNom: donation.projectName,
      modePaiement: donation.paymentMethod,
      statut: donation.status,
      date: firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('[Firebase] createDonation error:', error);
    return `error-donation-${Date.now()}`;
  }
};

// ==================== POPUPS ====================
// Collection Firestore: "popups"
// Champs backoffice: titre, contenu, actif, dateDebut, dateFin, priorite

export const subscribeToPopups = (callback: (data: Popup[]) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(mockPopups as Popup[]);
    return () => {};
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    return firestore()
      .collection('popups')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs
            .map(doc => ({
              id: doc.id,
              titre: doc.data().titre,
              contenu: doc.data().contenu || doc.data().message,
              actif: doc.data().actif,
              dateDebut: doc.data().dateDebut,
              dateFin: doc.data().dateFin,
              priorite: doc.data().priorite || 0,
            }))
            .filter(popup => {
              // Filtrer par date de validité
              if (popup.dateDebut && popup.dateDebut > today) return false;
              if (popup.dateFin && popup.dateFin < today) return false;
              return true;
            })
            .sort((a, b) => (b.priorite || 0) - (a.priorite || 0));
          callback(mergeWithMock(data, mockPopups as Popup[]));
        },
        error => {
          console.error('[Firebase] Popups error:', error);
          callback(mockPopups as Popup[]);
        }
      );
  } catch (error) {
    console.error('[Firebase] Popups catch:', error);
    callback(mockPopups as Popup[]);
    return () => {};
  }
};

// ==================== RAPPELS DU JOUR (Hadiths) ====================
// Collection Firestore: "rappels"
// Champs: texteFr, texteAr, source, actif

export const subscribeToRappels = (callback: (data: Rappel[]) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(mockRappels as Rappel[]);
    return () => {};
  }

  try {
    return firestore()
      .collection('rappels')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            texteFr: doc.data().texteFr,
            texteAr: doc.data().texteAr,
            source: doc.data().source,
            actif: doc.data().actif,
          }));
          callback(mergeWithMock(data, mockRappels as Rappel[]));
        },
        error => {
          console.error('[Firebase] Rappels error:', error);
          callback(mockRappels as Rappel[]);
        }
      );
  } catch (error) {
    console.error('[Firebase] Rappels catch:', error);
    callback(mockRappels as Rappel[]);
    return () => {};
  }
};

export const getRappels = async (): Promise<Rappel[]> => {
  if (FORCE_DEMO_MODE) {
    return mockRappels as Rappel[];
  }
  try {
    const snapshot = await firestore()
      .collection('rappels')
      .where('actif', '==', true)
      .get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      texteFr: doc.data().texteFr,
      texteAr: doc.data().texteAr,
      source: doc.data().source,
      actif: doc.data().actif,
    }));
    return mergeWithMock(data, mockRappels as Rappel[]);
  } catch (error) {
    console.error('[Firebase] getRappels error:', error);
    return mockRappels as Rappel[];
  }
};

// ==================== INFOS MOSQUÉE ====================
// Collection Firestore: "settings/mosqueeInfo"
// Champs backoffice: nom, adresse, codePostal, ville, telephone, email, siteWeb, iban, bic, bankName, accountHolder

export const subscribeToMosqueeInfo = (callback: (data: MosqueeInfo) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(mockMosqueeInfo);
    return () => {};
  }

  try {
    return firestore()
      .collection('settings')
      .doc('mosqueeInfo')
      .onSnapshot(
        doc => {
          if (doc.exists) {
            const data = doc.data();
            callback({
              name: data?.nom || mockMosqueeInfo.name,
              address: data?.adresse || mockMosqueeInfo.address,
              postalCode: data?.codePostal || mockMosqueeInfo.postalCode,
              city: data?.ville || mockMosqueeInfo.city,
              phone: data?.telephone || mockMosqueeInfo.phone,
              email: data?.email || mockMosqueeInfo.email,
              website: data?.siteWeb || mockMosqueeInfo.website,
              iban: data?.iban || mockMosqueeInfo.iban,
              bic: data?.bic || mockMosqueeInfo.bic,
              bankName: data?.bankName || mockMosqueeInfo.bankName,
              accountHolder: data?.accountHolder || mockMosqueeInfo.accountHolder,
            });
          } else {
            callback(mockMosqueeInfo);
          }
        },
        error => {
          console.error('[Firebase] MosqueeInfo error:', error);
          callback(mockMosqueeInfo);
        }
      );
  } catch (error) {
    console.error('[Firebase] MosqueeInfo catch:', error);
    callback(mockMosqueeInfo);
    return () => {};
  }
};

export const getMosqueeInfo = async (): Promise<MosqueeInfo> => {
  if (FORCE_DEMO_MODE) {
    return mockMosqueeInfo;
  }
  try {
    const doc = await firestore().collection('settings').doc('mosqueeInfo').get();
    if (doc.exists) {
      const data = doc.data();
      return {
        name: data?.nom || mockMosqueeInfo.name,
        address: data?.adresse || mockMosqueeInfo.address,
        postalCode: data?.codePostal || mockMosqueeInfo.postalCode,
        city: data?.ville || mockMosqueeInfo.city,
        phone: data?.telephone || mockMosqueeInfo.phone,
        email: data?.email || mockMosqueeInfo.email,
        website: data?.siteWeb || mockMosqueeInfo.website,
        iban: data?.iban || mockMosqueeInfo.iban,
        bic: data?.bic || mockMosqueeInfo.bic,
        bankName: data?.bankName || mockMosqueeInfo.bankName,
        accountHolder: data?.accountHolder || mockMosqueeInfo.accountHolder,
      };
    }
    return mockMosqueeInfo;
  } catch (error) {
    console.error('[Firebase] getMosqueeInfo error:', error);
    return mockMosqueeInfo;
  }
};

// ==================== HORAIRES IQAMA & JUMUA ====================
// Collection Firestore: "settings/prayerTimes"
// Champs: iqama: { fajr, dhuhr, asr, maghrib, isha }, jumua: { jumua1, jumua2, jumua3 }

export const subscribeToIqama = (callback: (data: HorairesData) => void) => {
  if (FORCE_DEMO_MODE) {
    callback({ iqama: mockIqama, jumua: mockJumua });
    return () => {};
  }

  try {
    return firestore()
      .collection('settings')
      .doc('prayerTimes')
      .onSnapshot(
        doc => {
          if (doc.exists && doc.data()?.iqama) {
            callback({
              iqama: doc.data()?.iqama || mockIqama,
              jumua: doc.data()?.jumua || mockJumua,
              lastUpdated: doc.data()?.lastUpdated,
            });
          } else {
            callback({ iqama: mockIqama, jumua: mockJumua });
          }
        },
        error => {
          console.error('[Firebase] Iqama error:', error);
          callback({ iqama: mockIqama, jumua: mockJumua });
        }
      );
  } catch (error) {
    console.error('[Firebase] Iqama catch:', error);
    callback({ iqama: mockIqama, jumua: mockJumua });
    return () => {};
  }
};

export const getPrayerTimes = async (): Promise<HorairesData> => {
  if (FORCE_DEMO_MODE) {
    return { iqama: mockIqama, jumua: mockJumua };
  }
  try {
    const doc = await firestore().collection('settings').doc('prayerTimes').get();
    if (doc.exists && doc.data()?.iqama) {
      return {
        iqama: doc.data()?.iqama || mockIqama,
        jumua: doc.data()?.jumua || mockJumua,
        lastUpdated: doc.data()?.lastUpdated,
      };
    }
    return { iqama: mockIqama, jumua: mockJumua };
  } catch (error) {
    console.error('[Firebase] getPrayerTimes error:', error);
    return { iqama: mockIqama, jumua: mockJumua };
  }
};

export const subscribeToPrayerTimes = subscribeToIqama;

// ==================== DATES ISLAMIQUES ====================
// Collection Firestore: "dates_islamiques"

export const subscribeToIslamicDates = (callback: (data: DateIslamique[]) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(mockDatesIslamiques as DateIslamique[]);
    return () => {};
  }

  try {
    return firestore()
      .collection('dates_islamiques')
      .orderBy('dateGregorien', 'asc')
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            nom: doc.data().nom,
            nomAr: doc.data().nomAr,
            dateHijri: doc.data().dateHijri,
            dateGregorien: doc.data().dateGregorien,
            icon: doc.data().icon || '📅',
            approximatif: doc.data().approximatif,
          }));
          callback(mergeWithMock(data, mockDatesIslamiques as DateIslamique[]));
        },
        error => {
          console.error('[Firebase] IslamicDates error:', error);
          callback(mockDatesIslamiques as DateIslamique[]);
        }
      );
  } catch (error) {
    console.error('[Firebase] IslamicDates catch:', error);
    callback(mockDatesIslamiques as DateIslamique[]);
    return () => {};
  }
};

export const getIslamicDates = async (): Promise<DateIslamique[]> => {
  if (FORCE_DEMO_MODE) {
    return mockDatesIslamiques as DateIslamique[];
  }
  try {
    const snapshot = await firestore()
      .collection('dates_islamiques')
      .orderBy('dateGregorien', 'asc')
      .get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      nom: doc.data().nom,
      nomAr: doc.data().nomAr,
      dateHijri: doc.data().dateHijri,
      dateGregorien: doc.data().dateGregorien,
      icon: doc.data().icon || '📅',
      approximatif: doc.data().approximatif,
    }));
    return mergeWithMock(data, mockDatesIslamiques as DateIslamique[]);
  } catch (error) {
    console.error('[Firebase] getIslamicDates error:', error);
    return mockDatesIslamiques as DateIslamique[];
  }
};

// ==================== MEMBERS ====================
// Collection Firestore: "members"

export const getMember = async (memberId: string): Promise<Member | null> => {
  if (FORCE_DEMO_MODE) {
    return null;
  }
  try {
    const doc = await firestore().collection('members').doc(memberId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      id: doc.id,
      name: `${data?.prenom || ''} ${data?.nom || ''}`.trim(),
      email: data?.email || '',
      phone: data?.telephone,
      memberId: doc.id,
      cotisationType: data?.cotisation?.type || null,
      cotisationStatus: getCotisationStatus(data?.cotisation),
      nextPaymentDate: data?.cotisation?.dateFin ? toDate(data.cotisation.dateFin) : undefined,
      createdAt: toDate(data?.createdAt),
    };
  } catch (error) {
    console.error('[Firebase] getMember error:', error);
    return null;
  }
};

export const updateMember = async (memberId: string, data: Partial<Member>): Promise<void> => {
  if (FORCE_DEMO_MODE) return;
  try {
    const updateData: any = {};
    if (data.name) {
      const parts = data.name.split(' ');
      updateData.prenom = parts[0];
      updateData.nom = parts.slice(1).join(' ');
    }
    if (data.phone) updateData.telephone = data.phone;
    if (data.email) updateData.email = data.email;
    await firestore().collection('members').doc(memberId).update(updateData);
  } catch (error) {
    console.error('[Firebase] updateMember error:', error);
  }
};

export const createMember = async (member: Omit<Member, 'id' | 'createdAt' | 'memberId'>): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-member-${Date.now()}`;
  }
  try {
    const nameParts = member.name.split(' ');
    const docRef = await firestore().collection('members').add({
      prenom: nameParts[0],
      nom: nameParts.slice(1).join(' '),
      email: member.email,
      telephone: member.phone,
      cotisation: {
        type: member.cotisationType,
        montant: member.cotisationType === 'annuel' ? 100 : 10,
        dateDebut: firestore.FieldValue.serverTimestamp(),
        dateFin: getNextPaymentDate(member.cotisationType),
      },
      actif: true,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('[Firebase] createMember error:', error);
    return `error-member-${Date.now()}`;
  }
};

// Helper pour déterminer le statut de cotisation
const getCotisationStatus = (cotisation: any): 'active' | 'expired' | 'none' | 'pending' => {
  if (!cotisation) return 'none';
  if (!cotisation.dateFin) return 'pending';
  const now = new Date();
  const dateFin = toDate(cotisation.dateFin);
  return dateFin > now ? 'active' : 'expired';
};

// Helper pour calculer la prochaine date de paiement
const getNextPaymentDate = (type: 'mensuel' | 'annuel' | null): Date => {
  const now = new Date();
  if (type === 'annuel') {
    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

// ==================== SERVICES & ACTIVITÉS (statiques) ====================

export const getServices = () => mockServices;
export const getActivites = () => mockActivites;

// ==================== SOURATES & DUAS (à implémenter si besoin) ====================

export const getSourates = async () => [];
export const getDuas = async () => [];

// ==================== EXPORTS ====================
export const isDemoMode = FORCE_DEMO_MODE;
