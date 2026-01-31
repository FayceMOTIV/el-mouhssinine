// Firebase Service - Connecté au backoffice El Mouhssinine
// Collections Firestore en FRANÇAIS (alignées sur le backoffice)
// Fallback sur données mock si Firebase vide ou erreur

import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
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
    return firebaseData as T[];
  }
  return mockData as T[];
};

// Helper: Convert Firestore timestamp to Date
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
};

// ==================== INTERFACES ====================

// Réexport du type MosqueeInfo depuis types
export type { MosqueeInfo } from '../types';

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
  frequence?: 'always' | 'daily' | 'once' | 'weekly';
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

  console.log('🔔 [Firebase] Subscribing to announcements...');

  try {
    // Query simple sans orderBy pour éviter les problèmes d'index composite
    return firestore()
      .collection('announcements')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          console.log('📢 [Firebase] Annonces snapshot:', snapshot.docs.length, 'documents');
          const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            console.log('📢 [Firebase] Annonce:', doc.id, docData.titre);
            return {
              id: doc.id,
              title: docData.titre,
              content: docData.contenu,
              isActive: docData.actif,
              publishedAt: toDate(docData.createdAt),
            };
          });
          // Tri côté client (plus récent en premier)
          data.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
          console.log('📢 [Firebase] Annonces finales:', data.length);
          callback(data.length > 0 ? data : mockAnnouncements as Announcement[]);
        },
        error => {
          console.error('❌ [Firebase] Announcements error:', error.message);
          callback(mockAnnouncements as Announcement[]);
        }
      );
  } catch (error: any) {
    console.error('❌ [Firebase] Announcements catch:', error?.message);
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

  console.log('🔔 [Firebase] Subscribing to events...');

  try {
    // Query simple sans orderBy pour éviter les problèmes d'index composite
    return firestore()
      .collection('events')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          console.log('📅 [Firebase] Events snapshot:', snapshot.docs.length, 'documents');
          const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            console.log('📅 [Firebase] Event:', doc.id, docData.titre);
            return {
              id: doc.id,
              title: docData.titre,
              description: docData.description,
              date: toDate(docData.date),
              time: docData.heure,
              location: docData.lieu,
              requiresRegistration: docData.inscription || false,
              category: docData.categorie,
            };
          });
          // Tri côté client (plus proche en premier)
          data.sort((a, b) => a.date.getTime() - b.date.getTime());
          console.log('📅 [Firebase] Events finaux:', data.length);
          callback(data.length > 0 ? data : mockEvents as Event[]);
        },
        error => {
          console.error('❌ [Firebase] Events error:', error.message);
          callback(mockEvents as Event[]);
        }
      );
  } catch (error: any) {
    console.error('❌ [Firebase] Events catch:', error?.message);
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
    const data: Event[] = snapshot.docs.map(doc => ({
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

// Version qui retourne UN SEUL janaza (le plus récent) - conservée pour compatibilité
export const subscribeToJanaza = (callback: (data: Janaza | null) => void) => {
  if (FORCE_DEMO_MODE) {
    const active = mockJanaza.find(j => j.isActive);
    callback(active ? (active as Janaza) : null);
    return () => {};
  }

  console.log('🔔 [Firebase] Subscribing to janaza...');

  try {
    return firestore()
      .collection('janaza')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          console.log('🤲 [Firebase] Janaza snapshot:', snapshot.docs.length, 'documents');
          if (snapshot.empty) {
            console.log('🤲 [Firebase] Pas de janaza active');
            callback(null);
            return;
          }
          const docs = snapshot.docs.map(doc => ({
            doc,
            date: toDate(doc.data().date),
          }));
          docs.sort((a, b) => b.date.getTime() - a.date.getTime());
          const doc = docs[0].doc;
          const docData = doc.data();
          console.log('🤲 [Firebase] Janaza:', doc.id, docData.nomDefunt);
          const data: Janaza = {
            id: doc.id,
            deceasedName: docData.nomDefunt,
            deceasedNameAr: docData.nomDefuntAr || docData.phraseAr,
            prayerDate: toDate(docData.date),
            prayerTime: docData.heurePriere,
            location: docData.lieu,
            message: docData.phraseFr,
            isActive: docData.actif,
            salatApres: docData.salatApres,
          };
          callback(data);
        },
        error => {
          console.error('❌ [Firebase] Janaza error:', error.message);
          callback(null);
        }
      );
  } catch (error: any) {
    console.error('❌ [Firebase] Janaza catch:', error?.message);
    callback(null);
    return () => {};
  }
};

// Version qui retourne TOUS les janazas actifs
export const subscribeToJanazaList = (callback: (data: Janaza[]) => void) => {
  if (FORCE_DEMO_MODE) {
    const activeList = mockJanaza.filter(j => j.isActive) as Janaza[];
    callback(activeList);
    return () => {};
  }

  console.log('🔔 [Firebase] Subscribing to janaza list...');

  try {
    return firestore()
      .collection('janaza')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          console.log('🤲 [Firebase] Janaza list snapshot:', snapshot.docs.length, 'documents');
          if (snapshot.empty) {
            console.log('🤲 [Firebase] Pas de janaza active');
            callback([]);
            return;
          }
          // Mapper TOUS les documents et trier par date
          const janazaList: Janaza[] = snapshot.docs.map(doc => {
            const docData = doc.data();
            return {
              id: doc.id,
              deceasedName: docData.nomDefunt,
              deceasedNameAr: docData.nomDefuntAr || docData.phraseAr,
              prayerDate: toDate(docData.date),
              prayerTime: docData.heurePriere,
              location: docData.lieu,
              message: docData.phraseFr,
              isActive: docData.actif,
              salatApres: docData.salatApres, // "apres_fajr", "apres_dhuhr", etc.
            };
          });
          // Trier par date (plus récent en premier)
          janazaList.sort((a, b) => b.prayerDate.getTime() - a.prayerDate.getTime());
          console.log('🤲 [Firebase] Janaza list:', janazaList.length, 'items');
          callback(janazaList);
        },
        error => {
          console.error('❌ [Firebase] Janaza list error:', error.message);
          callback([]);
        }
      );
  } catch (error: any) {
    console.error('❌ [Firebase] Janaza list catch:', error?.message);
    callback([]);
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
      salatApres: doc.data().salatApres,
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
          const data: Project[] = snapshot.docs.map(doc => ({
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
            fichiers: doc.data().fichiers || [],
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
    let data: Project[] = snapshot.docs.map(doc => ({
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
      fichiers: doc.data().fichiers || [],
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

// Ajouter un don avec paiement Stripe
export interface AddDonationParams {
  projectId: string;
  projectName: string;
  amount: number;
  stripePaymentIntentId: string;
  paymentMethod: string;
  isAnonymous?: boolean;
  donorEmail?: string;
  donorName?: string;
}

export const addDonation = async (params: AddDonationParams): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-donation-${Date.now()}`;
  }
  try {
    // Utiliser stripePaymentIntentId comme docId pour IDEMPOTENCE
    // Si retry, le même document sera réécrit au lieu d'en créer un nouveau
    const docId = params.stripePaymentIntentId || `donation-${Date.now()}`;
    const donationRef = firestore().collection('donations').doc(docId);
    const projectRef = params.projectId ? firestore().collection('projects').doc(params.projectId) : null;

    // Vérifier si donation existe déjà (idempotence)
    const existingDoc = await donationRef.get();
    if (existingDoc.exists()) {
      console.log('[Firebase] Don déjà existant (idempotent):', docId);
      return docId;
    }

    // TRANSACTION ATOMIQUE: donation + update projet
    await firestore().runTransaction(async (transaction) => {
      // 1. Créer le don
      transaction.set(donationRef, {
        donateur: params.isAnonymous ? 'Anonyme' : (params.donorName || params.donorEmail || 'Anonyme'),
        donateurEmail: params.isAnonymous ? null : (params.donorEmail || null),
        montant: params.amount,
        projetId: params.projectId,
        projetNom: params.projectName,
        modePaiement: params.paymentMethod,
        stripePaymentIntentId: params.stripePaymentIntentId,
        statut: 'completed',
        isAnonymous: params.isAnonymous || false,
        source: 'app_mobile',
        date: firestore.FieldValue.serverTimestamp(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // 2. Mettre à jour le montant collecté du projet (dans la même transaction)
      if (projectRef) {
        const projectDoc = await transaction.get(projectRef);
        if (projectDoc.exists()) {
          transaction.update(projectRef, {
            montantActuel: firestore.FieldValue.increment(params.amount),
          });
        }
      }
    });

    console.log('[Firebase] Don enregistré (transaction atomique):', docId);
    return docId;
  } catch (error) {
    console.error('[Firebase] addDonation error:', error);
    throw error;
  }
};

// Ajouter un paiement de cotisation avec Stripe
export interface AddPaymentParams {
  memberId: string;
  memberName: string;
  amount: number;
  stripePaymentIntentId: string;
  paymentMethod: string;
  period?: string;
}

export const addPayment = async (params: AddPaymentParams): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-payment-${Date.now()}`;
  }
  try {
    // Utiliser stripePaymentIntentId comme docId pour IDEMPOTENCE
    const docId = params.stripePaymentIntentId || `payment-${Date.now()}`;
    const paymentRef = firestore().collection('payments').doc(docId);
    const memberRef = params.memberId ? firestore().collection('members').doc(params.memberId) : null;

    // Vérifier si paiement existe déjà (idempotence)
    const existingDoc = await paymentRef.get();
    if (existingDoc.exists()) {
      console.log('[Firebase] Paiement déjà existant (idempotent):', docId);
      return docId;
    }

    const now = new Date();
    // Calculer dateFin selon la période
    let dateFin: Date;
    if (params.period === 'mensuel') {
      dateFin = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    } else {
      // annuel par défaut
      dateFin = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    }

    // TRANSACTION ATOMIQUE: paiement + update membre
    await firestore().runTransaction(async (transaction) => {
      // 1. Créer le paiement
      transaction.set(paymentRef, {
        memberId: params.memberId,
        memberName: params.memberName,
        montant: params.amount,
        modePaiement: params.paymentMethod,
        stripePaymentIntentId: params.stripePaymentIntentId,
        type: 'cotisation',
        statut: 'completed',
        source: 'app_mobile',
        period: params.period || 'annuel',
        date: firestore.FieldValue.serverTimestamp(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // 2. Mettre à jour le statut du membre (dans la même transaction)
      if (memberRef) {
        const memberDoc = await transaction.get(memberRef);
        if (memberDoc.exists()) {
          transaction.update(memberRef, {
            statut: 'actif',
            status: 'actif',
            datePaiement: firestore.FieldValue.serverTimestamp(),
            montantPaye: params.amount,
            stripePaymentId: params.stripePaymentIntentId,
            formule: params.period || 'annuel',
            cotisation: {
              type: params.period || 'annuel',
              montant: params.amount,
              dateDebut: firestore.Timestamp.fromDate(now),
              dateFin: firestore.Timestamp.fromDate(dateFin),
            },
          });
        }
      }
    });

    console.log('[Firebase] Paiement cotisation enregistré (transaction atomique):', docId);
    return docId;
  } catch (error) {
    console.error('[Firebase] addPayment error:', error);
    throw error;
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
          const data: Popup[] = snapshot.docs
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

export const subscribeToMosqueeInfo = (callback: (data: MosqueeInfo & { headerImageUrl?: string }) => void) => {
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
          if (doc.exists()) {
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
              headerImageUrl: data?.headerImageUrl || undefined,
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

// ==================== PRIX COTISATIONS ====================
// Collection Firestore: "settings/cotisation"
export interface CotisationPrices {
  mensuel: number;
  annuel: number;
}

const defaultCotisationPrices: CotisationPrices = {
  mensuel: 10,
  annuel: 100,
};

export const subscribeToCotisationPrices = (callback: (data: CotisationPrices) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(defaultCotisationPrices);
    return () => {};
  }

  try {
    return firestore()
      .collection('settings')
      .doc('cotisation')
      .onSnapshot(
        doc => {
          if (doc.exists()) {
            const data = doc.data();
            callback({
              mensuel: data?.mensuel ?? defaultCotisationPrices.mensuel,
              annuel: data?.annuel ?? defaultCotisationPrices.annuel,
            });
          } else {
            callback(defaultCotisationPrices);
          }
        },
        error => {
          console.error('[Firebase] CotisationPrices error:', error);
          callback(defaultCotisationPrices);
        }
      );
  } catch (error) {
    console.error('[Firebase] CotisationPrices catch:', error);
    callback(defaultCotisationPrices);
    return () => {};
  }
};

export const getMosqueeInfo = async (): Promise<MosqueeInfo> => {
  if (FORCE_DEMO_MODE) {
    return mockMosqueeInfo;
  }
  try {
    const doc = await firestore().collection('settings').doc('mosqueeInfo').get();
    if (doc.exists()) {
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
  } catch (error: any) {
    console.error('❌ [Firebase] getMosqueeInfo error:', error?.message);
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
          if (doc.exists() && doc.data()?.iqama) {
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
    if (doc.exists() && doc.data()?.iqama) {
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

// ==================== GENERAL SETTINGS (Display, Maintenance) ====================
// Collection Firestore: "settings/general"

export interface DisplaySettings {
  showIqama: boolean;
  showSunrise: boolean;
  darkMode: boolean;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

export interface GeneralSettings {
  display: DisplaySettings;
  maintenance: MaintenanceSettings;
}

const defaultGeneralSettings: GeneralSettings = {
  display: {
    showIqama: true,
    showSunrise: true,
    darkMode: true,
  },
  maintenance: {
    enabled: false,
    message: '',
  },
};

export const subscribeToGeneralSettings = (callback: (data: GeneralSettings) => void) => {
  if (FORCE_DEMO_MODE) {
    callback(defaultGeneralSettings);
    return () => {};
  }

  try {
    return firestore()
      .collection('settings')
      .doc('general')
      .onSnapshot(
        doc => {
          if (doc.exists()) {
            const data = doc.data();
            callback({
              display: {
                showIqama: data?.display?.showIqama ?? true,
                showSunrise: data?.display?.showSunrise ?? true,
                darkMode: data?.display?.darkMode ?? true,
              },
              maintenance: {
                enabled: data?.maintenance?.enabled ?? false,
                message: data?.maintenance?.message ?? '',
              },
            });
          } else {
            callback(defaultGeneralSettings);
          }
        },
        error => {
          console.error('[Firebase] GeneralSettings error:', error);
          callback(defaultGeneralSettings);
        }
      );
  } catch (error) {
    console.error('[Firebase] GeneralSettings catch:', error);
    callback(defaultGeneralSettings);
    return () => {};
  }
};

export const getGeneralSettings = async (): Promise<GeneralSettings> => {
  if (FORCE_DEMO_MODE) {
    return defaultGeneralSettings;
  }
  try {
    const doc = await firestore().collection('settings').doc('general').get();
    if (doc.exists()) {
      const data = doc.data();
      return {
        display: {
          showIqama: data?.display?.showIqama ?? true,
          showSunrise: data?.display?.showSunrise ?? true,
          darkMode: data?.display?.darkMode ?? true,
        },
        maintenance: {
          enabled: data?.maintenance?.enabled ?? false,
          message: data?.maintenance?.message ?? '',
        },
      };
    }
    return defaultGeneralSettings;
  } catch (error) {
    console.error('[Firebase] getGeneralSettings error:', error);
    return defaultGeneralSettings;
  }
};

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
          const data: DateIslamique[] = snapshot.docs.map(doc => ({
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
    const data: DateIslamique[] = snapshot.docs.map(doc => ({
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
    if (!doc.exists()) return null;
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

// Interface pour l'objet inscritPar (info du payeur)
export interface InscritParData {
  odUserId: string;  // ID Firebase du payeur
  nom: string;
  prenom: string;
}

// Interface pour création de membre avec nouveaux champs multi-membres
export interface CreateMemberData {
  // Champs directs (nouveau format)
  nom?: string;
  prenom?: string;
  telephone?: string;
  adresse?: string;
  email?: string;
  accepteReglement?: boolean; // A accepté le règlement intérieur
  // Ancien format
  name?: string;
  phone?: string;
  // Nouveaux champs multi-membres
  inscritPar?: InscritParData | string; // Objet avec info du payeur (ou string pour rétrocompatibilité)
  status?: 'actif' | 'en_attente_signature' | 'en_attente_paiement' | 'expire';
  dateInscription?: Date;
  datePaiement?: Date | null; // null pour virement non encore reçu
  paiementId?: string; // ID pour regrouper les membres payés ensemble
  referenceVirement?: string | null; // Référence pour paiement par virement (ex: ADH-2026-X7K9MN)
  montant?: number; // Montant payé
  modePaiement?: string; // 'carte', 'apple', 'virement', etc.
  formule?: 'mensuel' | 'annuel' | null; // Type de cotisation choisi
  // Cotisation
  cotisation?: {
    type: 'mensuel' | 'annuel' | null;
    montant: number;
    dateDebut: Date | null;
    dateFin: Date | null;
  };
  cotisationType?: 'mensuel' | 'annuel' | null;
}

export const createMember = async (member: CreateMemberData | Omit<Member, 'id' | 'createdAt' | 'memberId'>): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-member-${Date.now()}`;
  }
  try {
    // Déterminer nom et prénom
    let nom = '';
    let prenom = '';

    if ('nom' in member && member.nom) {
      nom = member.nom;
      prenom = ('prenom' in member && member.prenom) ? member.prenom : '';
    } else if ('name' in member && member.name) {
      const nameParts = member.name.split(' ');
      prenom = nameParts[0];
      nom = nameParts.slice(1).join(' ');
    }

    // Déterminer téléphone et email
    const telephone = ('telephone' in member && member.telephone)
      ? member.telephone
      : ('phone' in member && member.phone)
        ? member.phone
        : '';
    const email = member.email || '';
    const adresse = ('adresse' in member && member.adresse) ? member.adresse : '';

    // Construire l'objet cotisation
    let cotisationData: any;
    if ('cotisation' in member && member.cotisation) {
      cotisationData = {
        type: member.cotisation.type,
        montant: member.cotisation.montant,
        dateDebut: member.cotisation.dateDebut,
        dateFin: member.cotisation.dateFin,
      };
    } else if ('cotisationType' in member) {
      const cotisationType = member.cotisationType ?? null;
      cotisationData = {
        type: cotisationType,
        montant: cotisationType === 'annuel' ? 100 : 20,
        dateDebut: firestore.FieldValue.serverTimestamp(),
        dateFin: getNextPaymentDate(cotisationType),
      };
    }

    // Construire le document
    const docData: any = {
      nom,
      prenom,
      email,
      telephone,
      adresse,
      cotisation: cotisationData,
      actif: true,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    // Ajouter les champs multi-membres si présents
    if ('inscritPar' in member && member.inscritPar) {
      docData.inscritPar = member.inscritPar;
    }
    if ('status' in member && member.status) {
      docData.status = member.status;
    }
    if ('dateInscription' in member && member.dateInscription) {
      docData.dateInscription = member.dateInscription;
    }
    // datePaiement: sauvegarder même si null (virement en attente)
    if ('datePaiement' in member) {
      docData.datePaiement = member.datePaiement; // peut être null pour virement
    }
    if ('paiementId' in member && member.paiementId) {
      docData.paiementId = member.paiementId;
    }
    // referenceVirement: pour les paiements par virement
    if ('referenceVirement' in member) {
      docData.referenceVirement = member.referenceVirement;
    }
    if ('montant' in member && member.montant !== undefined) {
      docData.montant = member.montant;
    }
    if ('modePaiement' in member && member.modePaiement) {
      docData.modePaiement = member.modePaiement;
    }
    // formule: type d'abonnement choisi
    if ('formule' in member && member.formule) {
      docData.formule = member.formule;
    }

    const docRef = await firestore().collection('members').add(docData);
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

// ==================== ADHÉRENTS INSCRITS PAR UN UTILISATEUR ====================

export interface InscribedMember {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
  adresse?: string;
  status: string;
  dateInscription: Date;
  formule?: 'mensuel' | 'annuel' | null;
  montant?: number;
  modePaiement?: string;
  datePaiement?: Date;
  dateFin?: Date;
  paiementId?: string;
}

export const getMembersInscribedBy = async (userId: string): Promise<InscribedMember[]> => {
  if (FORCE_DEMO_MODE) return [];
  try {
    const snapshot = await firestore()
      .collection('members')
      .where('inscritPar.odUserId', '==', userId)
      .get();

    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        nom: data.nom || '',
        prenom: data.prenom || '',
        telephone: data.telephone || '',
        email: data.email || '',
        adresse: data.adresse || '',
        status: data.status || 'en_attente_signature',
        dateInscription: toDate(data.dateInscription),
        formule: data.formule || data.cotisation?.type || null,
        montant: data.montant || data.cotisation?.montant || 0,
        modePaiement: data.modePaiement || '',
        datePaiement: data.datePaiement ? toDate(data.datePaiement) : undefined,
        dateFin: data.cotisation?.dateFin ? toDate(data.cotisation.dateFin) : undefined,
        paiementId: data.paiementId || '',
      };
    });

    // Trier par date d'inscription décroissante (plus récent en premier)
    return members.sort((a, b) => {
      const dateA = a.dateInscription?.getTime() || 0;
      const dateB = b.dateInscription?.getTime() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('[Firebase] getMembersInscribedBy error:', error);
    return [];
  }
};

// Récupérer l'adhésion de l'utilisateur connecté (par email)
export interface MyMembership {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  status: string;
  formule: 'mensuel' | 'annuel' | null;
  montant: number;
  dateInscription: Date;
  datePaiement?: Date;
  dateDebut?: Date;
  dateFin?: Date;
  modePaiement?: string;
  paiementId?: string;
  inscritPar?: { nom: string; prenom: string } | null;
  referenceVirement?: string;
}

export const getMyMembership = async (email: string): Promise<MyMembership | null> => {
  if (FORCE_DEMO_MODE) return null;
  try {
    const snapshot = await firestore()
      .collection('members')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Déterminer le statut - null signifie "actif" (legacy du backoffice)
    const hasValidCotisation = data.cotisation?.dateFin &&
      (data.cotisation.dateFin.toDate ? data.cotisation.dateFin.toDate() : new Date(data.cotisation.dateFin)) > new Date();
    const memberStatus = data.status || (hasValidCotisation ? 'actif' : 'en_attente_signature');

    return {
      id: doc.id,
      nom: data.nom || '',
      prenom: data.prenom || '',
      email: data.email || '',
      telephone: data.telephone || '',
      adresse: data.adresse || '',
      status: memberStatus,
      formule: data.formule || data.cotisation?.type || null,
      montant: data.montant || data.cotisation?.montant || 0,
      dateInscription: toDate(data.dateInscription),
      datePaiement: data.datePaiement ? toDate(data.datePaiement) : undefined,
      dateDebut: data.cotisation?.dateDebut ? toDate(data.cotisation.dateDebut) : undefined,
      dateFin: data.cotisation?.dateFin ? toDate(data.cotisation.dateFin) : undefined,
      modePaiement: data.modePaiement || '',
      paiementId: data.paiementId || '',
      inscritPar: data.inscritPar && typeof data.inscritPar === 'object'
        ? { nom: data.inscritPar.nom, prenom: data.inscritPar.prenom }
        : null,
      referenceVirement: data.referenceVirement || undefined,
    };
  } catch (error) {
    console.error('[Firebase] getMyMembership error:', error);
    return null;
  }
};

// Listener temps réel pour les adhésions (mise à jour automatique depuis le backoffice)
export const subscribeToMyMembership = (
  email: string,
  callback: (membership: MyMembership | null) => void
): (() => void) => {
  if (FORCE_DEMO_MODE || !email) {
    callback(null);
    return () => {};
  }

  try {
    return firestore()
      .collection('members')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .onSnapshot(
        snapshot => {
          if (snapshot.empty) {
            callback(null);
            return;
          }

          const doc = snapshot.docs[0];
          const data = doc.data();

          // Déterminer le statut
          const hasValidCotisation = data.cotisation?.dateFin &&
            (data.cotisation.dateFin.toDate ? data.cotisation.dateFin.toDate() : new Date(data.cotisation.dateFin)) > new Date();
          const memberStatus = data.status || (hasValidCotisation ? 'actif' : 'en_attente_signature');

          callback({
            id: doc.id,
            nom: data.nom || '',
            prenom: data.prenom || '',
            email: data.email || '',
            telephone: data.telephone || '',
            adresse: data.adresse || '',
            status: memberStatus,
            formule: data.formule || data.cotisation?.type || null,
            montant: data.montant || data.cotisation?.montant || 0,
            dateInscription: toDate(data.dateInscription),
            datePaiement: data.datePaiement ? toDate(data.datePaiement) : undefined,
            dateDebut: data.cotisation?.dateDebut ? toDate(data.cotisation.dateDebut) : undefined,
            dateFin: data.cotisation?.dateFin ? toDate(data.cotisation.dateFin) : undefined,
            modePaiement: data.modePaiement || '',
            paiementId: data.paiementId || '',
            inscritPar: data.inscritPar && typeof data.inscritPar === 'object'
              ? { nom: data.inscritPar.nom, prenom: data.inscritPar.prenom }
              : null,
            referenceVirement: data.referenceVirement || undefined,
          });
        },
        error => {
          console.error('[Firebase] subscribeToMyMembership error:', error);
          callback(null);
        }
      );
  } catch (error) {
    console.error('[Firebase] subscribeToMyMembership catch:', error);
    callback(null);
    return () => {};
  }
};

// ==================== SERVICES & ACTIVITÉS (statiques) ====================

export const getServices = () => mockServices;
export const getActivites = () => mockActivites;

// ==================== SOURATES & DUAS (à implémenter si besoin) ====================

export const getSourates = async () => [];
export const getDuas = async () => [];

// ==================== MESSAGERIE ====================

export type MessageStatus = 'non_lu' | 'en_cours' | 'resolu';

export interface MessageReply {
  id: string;
  message: string;
  createdAt: Date;
  createdBy: 'mosquee' | 'user';
}

export interface UserMessage {
  id: string;
  odUserId: string;
  userName: string;
  userEmail: string;
  sujet: string;
  message: string;
  status: MessageStatus;
  createdAt: Date;
  updatedAt: Date;
  reponses: MessageReply[];
}

// Catégories de sujets
export const MESSAGE_SUBJECTS = [
  'Question générale',
  'Demande de certificat',
  'Problème technique',
  'Suggestion',
  'Autre',
];

// Anti-spam : vérifier le nombre de messages envoyés aujourd'hui
const checkDailyMessageLimit = async (userId: string): Promise<boolean> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await firestore()
      .collection('messages')
      .where('odUserId', '==', userId)
      .where('createdAt', '>=', today)
      .get();

    return snapshot.docs.length < 5; // Max 5 messages par jour
  } catch (error) {
    console.error('[Firebase] checkDailyMessageLimit error:', error);
    return true; // En cas d'erreur, on autorise
  }
};

// Envoyer un nouveau message
export const sendMessage = async (
  userId: string,
  userName: string,
  userEmail: string,
  sujet: string,
  message: string
): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  if (FORCE_DEMO_MODE) {
    return { success: false, error: 'Mode démo activé' };
  }

  // Validation
  if (!message || message.trim().length < 10) {
    return { success: false, error: 'Le message doit contenir au moins 10 caractères' };
  }

  // Vérifier limite anti-spam
  const canSend = await checkDailyMessageLimit(userId);
  if (!canSend) {
    return { success: false, error: 'Vous avez atteint la limite de 5 messages par jour' };
  }

  try {
    const now = new Date();
    const docRef = await firestore().collection('messages').add({
      odUserId: userId,
      userName,
      userEmail,
      sujet,
      message: message.trim(),
      status: 'non_lu',
      createdAt: now,
      updatedAt: now,
      reponses: [],
    });

    return { success: true, messageId: docRef.id };
  } catch (error: any) {
    console.error('[Firebase] sendMessage error:', error);
    return { success: false, error: error.message || 'Erreur lors de l\'envoi' };
  }
};

// Récupérer les messages d'un utilisateur
export const getUserMessages = async (userId: string): Promise<UserMessage[]> => {
  if (FORCE_DEMO_MODE) return [];

  try {
    const snapshot = await firestore()
      .collection('messages')
      .where('odUserId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        odUserId: data.odUserId,
        userName: data.userName,
        userEmail: data.userEmail,
        sujet: data.sujet,
        message: data.message,
        status: data.status,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        reponses: (data.reponses || []).map((r: any) => ({
          id: r.id,
          message: r.message,
          createdAt: toDate(r.createdAt),
          createdBy: r.createdBy,
        })),
      };
    });
  } catch (error) {
    console.error('[Firebase] getUserMessages error:', error);
    return [];
  }
};

// Souscrire aux messages d'un utilisateur (temps réel)
export const subscribeToUserMessages = (
  userId: string,
  callback: (messages: UserMessage[]) => void
) => {
  if (FORCE_DEMO_MODE) {
    callback([]);
    return () => {};
  }

  try {
    return firestore()
      .collection('messages')
      .where('odUserId', '==', userId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          const messages = snapshot.docs
            // Filtrer uniquement les messages supprimés par l'utilisateur
            // (les messages supprimés par l'admin restent visibles côté user)
            .filter(doc => !doc.data().deletedByUser)
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                odUserId: data.odUserId,
                userName: data.userName,
                userEmail: data.userEmail,
                sujet: data.sujet,
                message: data.message,
                status: data.status,
                createdAt: toDate(data.createdAt),
                updatedAt: toDate(data.updatedAt),
                reponses: (data.reponses || []).map((r: any) => ({
                  id: r.id,
                  message: r.message,
                  createdAt: toDate(r.createdAt),
                  createdBy: r.createdBy,
                })),
              };
            });
          callback(messages);
        },
        error => {
          console.error('[Firebase] subscribeToUserMessages error:', error);
          callback([]);
        }
      );
  } catch (error) {
    console.error('[Firebase] subscribeToUserMessages catch:', error);
    callback([]);
    return () => {};
  }
};

// Ajouter une réponse à un message (côté utilisateur)
export const addUserReplyToMessage = async (
  messageId: string,
  replyText: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> => {
  if (FORCE_DEMO_MODE) {
    return { success: false, error: 'Mode démo activé' };
  }

  if (!replyText || replyText.trim().length < 5) {
    return { success: false, error: 'La réponse doit contenir au moins 5 caractères' };
  }

  try {
    const messageRef = firestore().collection('messages').doc(messageId);
    const doc = await messageRef.get();

    if (!doc.exists()) {
      return { success: false, error: 'Message introuvable' };
    }

    // SÉCURITÉ: Vérifier que l'utilisateur est le propriétaire du message
    const data = doc.data();
    if (userId && data?.odUserId !== userId) {
      console.warn('[Firebase] Tentative de réponse non autorisée:', { messageId, userId, owner: data?.odUserId });
      return { success: false, error: 'Non autorisé' };
    }

    // Utiliser le même format que le backoffice (ISO string + arrayUnion)
    const newReply = {
      id: `reply-${Date.now()}`,
      message: replyText.trim(),
      createdAt: new Date().toISOString(),
      createdBy: 'user',
    };

    // arrayUnion pour ajouter atomiquement sans écraser les autres réponses
    await messageRef.update({
      reponses: firestore.FieldValue.arrayUnion(newReply),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      status: 'non_lu', // Remet en non lu pour la mosquée
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Firebase] addUserReplyToMessage error:', error);
    return { success: false, error: error.message || 'Erreur lors de l\'envoi' };
  }
};

// Récupérer un message spécifique
export const getMessage = async (messageId: string): Promise<UserMessage | null> => {
  if (FORCE_DEMO_MODE) return null;

  try {
    const doc = await firestore().collection('messages').doc(messageId).get();

    if (!doc.exists()) return null;

    const data = doc.data();
    return {
      id: doc.id,
      odUserId: data?.odUserId,
      userName: data?.userName,
      userEmail: data?.userEmail,
      sujet: data?.sujet,
      message: data?.message,
      status: data?.status,
      createdAt: toDate(data?.createdAt),
      updatedAt: toDate(data?.updatedAt),
      reponses: (data?.reponses || []).map((r: any) => ({
        id: r.id,
        message: r.message,
        createdAt: toDate(r.createdAt),
        createdBy: r.createdBy,
      })),
    };
  } catch (error) {
    console.error('[Firebase] getMessage error:', error);
    return null;
  }
};

// Supprimer un message (soft delete - reste visible dans le backoffice)
export const deleteMessage = async (
  messageId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> => {
  if (FORCE_DEMO_MODE) {
    return { success: false, error: 'Mode démo activé' };
  }

  try {
    const messageRef = firestore().collection('messages').doc(messageId);

    // SÉCURITÉ: Vérifier que l'utilisateur est le propriétaire du message
    if (userId) {
      const doc = await messageRef.get();
      if (!doc.exists()) {
        return { success: false, error: 'Message introuvable' };
      }
      const data = doc.data();
      if (data?.odUserId !== userId) {
        console.warn('[Firebase] Tentative de suppression non autorisée:', { messageId, userId, owner: data?.odUserId });
        return { success: false, error: 'Non autorisé' };
      }
    }

    // Soft delete: marquer comme supprimé par l'utilisateur
    await messageRef.update({
      deletedByUser: true,
      deletedByUserAt: firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('[Firebase] deleteMessage error:', error);
    return { success: false, error: error.message || 'Erreur lors de la suppression' };
  }
};

// Souscrire à un message spécifique (temps réel)
export const subscribeToMessage = (
  messageId: string,
  callback: (message: UserMessage | null) => void
) => {
  if (FORCE_DEMO_MODE) {
    callback(null);
    return () => {};
  }

  try {
    return firestore()
      .collection('messages')
      .doc(messageId)
      .onSnapshot(
        doc => {
          if (!doc.exists()) {
            callback(null);
            return;
          }
          const data = doc.data();
          callback({
            id: doc.id,
            odUserId: data?.odUserId,
            userName: data?.userName,
            userEmail: data?.userEmail,
            sujet: data?.sujet,
            message: data?.message,
            status: data?.status,
            createdAt: toDate(data?.createdAt),
            updatedAt: toDate(data?.updatedAt),
            reponses: (data?.reponses || []).map((r: any) => ({
              id: r.id,
              message: r.message,
              createdAt: toDate(r.createdAt),
              createdBy: r.createdBy,
            })),
          });
        },
        error => {
          console.error('[Firebase] subscribeToMessage error:', error);
          callback(null);
        }
      );
  } catch (error) {
    console.error('[Firebase] subscribeToMessage catch:', error);
    callback(null);
    return () => {};
  }
};

// ==================== REÇUS FISCAUX ====================

/**
 * Demande l'envoi d'un reçu fiscal par email
 * @param email - Email du donateur
 * @param annee - Année fiscale
 */
export const requestRecuFiscal = async (
  email: string,
  annee: number
): Promise<{ success: boolean; message: string; montantTotal?: number }> => {
  if (FORCE_DEMO_MODE) {
    return {
      success: false,
      message: 'Mode démo - Fonction non disponible',
    };
  }

  try {
    const sendRecuFiscal = functions().httpsCallable('sendRecuFiscal');
    const result = await sendRecuFiscal({ email, annee });
    const data = result.data as any;

    return {
      success: true,
      message: data.message || 'Reçu fiscal envoyé',
      montantTotal: data.montantTotal,
    };
  } catch (error: any) {
    console.error('[Firebase] requestRecuFiscal error:', error);
    let message = 'Erreur lors de l\'envoi du reçu fiscal';

    if (error.code === 'functions/not-found') {
      message = 'Aucun don trouvé pour cette année';
    } else if (error.code === 'functions/failed-precondition') {
      message = 'Service non configuré. Contactez l\'administration.';
    } else if (error.message) {
      message = error.message;
    }

    return {
      success: false,
      message,
    };
  }
};

/**
 * Récupère le total des dons pour une année
 * @param email - Email du donateur
 * @param annee - Année fiscale
 */
export const getDonsTotalByYear = async (
  email: string,
  annee: number
): Promise<{ total: number; count: number } | null> => {
  if (FORCE_DEMO_MODE) {
    return null;
  }

  try {
    const getDonsByYear = functions().httpsCallable('getDonsByYear');
    const result = await getDonsByYear({ email, annee });
    const data = result.data as any;

    return {
      total: data.total || 0,
      count: data.dons?.length || 0,
    };
  } catch (error) {
    console.error('[Firebase] getDonsTotalByYear error:', error);
    return null;
  }
};

// ==================== EXPORTS ====================
export const isDemoMode = FORCE_DEMO_MODE;
