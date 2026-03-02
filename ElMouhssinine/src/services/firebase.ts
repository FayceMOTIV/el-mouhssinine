// Firebase Service - Connecté au backoffice El Mohsinine
// Collections Firestore en FRANÇAIS (alignées sur le backoffice)
// Fallback sur données mock si Firebase vide ou erreur

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { logger, computeMemberStatus } from '../utils';
import { firebase } from '@react-native-firebase/functions';
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
  titreAr?: string;
  contenu: string;
  contenuAr?: string;
  actif: boolean;
  dateDebut?: string;
  dateFin?: string;
  priorite?: number;
  frequence?: 'always' | 'daily' | 'once' | 'weekly';
  cible?: string;
  texteBouton?: string;
  lienBouton?: string;
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
export const addMinutesToTime = (
  time: string,
  minutes: number | string,
): string => {
  if (!time || minutes === undefined || minutes === null) return '--:--';
  const [hours, mins] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(mins)) return '--:--';
  const totalMins = hours * 60 + mins + parseInt(String(minutes));
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(
    2,
    '0',
  )}`;
};

// ==================== ANNONCES ====================
// Collection Firestore: "announcements"
// Champs backoffice: titre, contenu, actif, createdAt

export const subscribeToAnnouncements = (
  callback: (data: Announcement[]) => void,
) => {
  if (FORCE_DEMO_MODE) {
    callback(mockAnnouncements as Announcement[]);
    return () => {};
  }

  logger.firebase('🔔 Subscribing to announcements...');

  try {
    // Query simple sans orderBy pour éviter les problèmes d'index composite
    return firestore()
      .collection('announcements')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          logger.firebase(
            '📢 Annonces snapshot:',
            snapshot.docs.length,
            'documents',
          );
          const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            logger.firebase('📢 Annonce:', doc.id, docData.titre);
            return {
              id: doc.id,
              title: docData.titre,
              titleAr: docData.titreAr || '',
              content: docData.contenu,
              contentAr: docData.contenuAr || '',
              isActive: docData.actif,
              publishedAt: toDate(docData.createdAt),
            };
          });
          // Tri côté client (plus récent en premier)
          data.sort(
            (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
          );
          logger.firebase('📢 Annonces finales:', data.length);
          callback(
            data.length > 0 ? data : (mockAnnouncements as Announcement[]),
          );
        },
        error => {
          logger.error('❌ [Firebase] Announcements error:', error.message);
          callback(mockAnnouncements as Announcement[]);
        },
      );
  } catch (error) {
    const err = error as Error;
    logger.error('❌ [Firebase] Announcements catch:', err?.message);
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
    const data: Announcement[] = snapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().titre,
      titleAr: doc.data().titreAr || '',
      content: doc.data().contenu,
      contentAr: doc.data().contenuAr || '',
      isActive: doc.data().actif,
      publishedAt: toDate(doc.data().createdAt),
    }));
    return mergeWithMock(data, mockAnnouncements as Announcement[]);
  } catch (error) {
    logger.error('[Firebase] getAnnouncements error:', error);
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

  logger.firebase('🔔 Subscribing to events...');

  try {
    // Query simple sans orderBy pour éviter les problèmes d'index composite
    return firestore()
      .collection('events')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          logger.firebase(
            '📅 Events snapshot:',
            snapshot.docs.length,
            'documents',
          );
          const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            logger.firebase('📅 Event:', doc.id, docData.titre);
            return {
              id: doc.id,
              title: docData.titre,
              titleAr: docData.titreAr || '',
              description: docData.description,
              descriptionAr: docData.descriptionAr || '',
              date: toDate(docData.date),
              time: docData.heure,
              location: docData.lieu,
              requiresRegistration: docData.inscription || false,
              category: docData.categorie,
            };
          });
          // Tri côté client (plus proche en premier)
          data.sort((a, b) => a.date.getTime() - b.date.getTime());
          logger.firebase('📅 Events finaux:', data.length);
          callback(data.length > 0 ? data : (mockEvents as Event[]));
        },
        error => {
          logger.error('❌ [Firebase] Events error:', error.message);
          callback(mockEvents as Event[]);
        },
      );
  } catch (error) {
    const err = error as Error;
    logger.error('❌ [Firebase] Events catch:', err?.message);
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
      titleAr: doc.data().titreAr || '',
      description: doc.data().description,
      descriptionAr: doc.data().descriptionAr || '',
      date: toDate(doc.data().date),
      time: doc.data().heure,
      location: doc.data().lieu,
      requiresRegistration: doc.data().inscription || false,
      category: doc.data().categorie,
    }));
    return mergeWithMock(data, mockEvents as Event[]);
  } catch (error) {
    logger.error('[Firebase] getEvents error:', error);
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

  logger.firebase('🔔 Subscribing to janaza...');

  try {
    return firestore()
      .collection('janaza')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          logger.firebase(
            '🤲 Janaza snapshot:',
            snapshot.docs.length,
            'documents',
          );
          if (snapshot.empty) {
            logger.firebase('🤲 Pas de janaza active');
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
          logger.firebase('🤲 Janaza:', doc.id, docData.nomDefunt);
          const data: Janaza = {
            id: doc.id,
            deceasedName: docData.nomDefunt,
            deceasedNameAr: docData.nomDefuntAr || '',
            deceasedFirstName: docData.prenomDefunt || '',
            cemeteryAddress: docData.adresseCimetiere || '',
            prayerDate: toDate(docData.date),
            prayerTime: docData.heurePriere,
            location: docData.lieu,
            message: docData.phraseFr,
            messageAr: docData.phraseAr || '',
            isActive: docData.actif,
            salatApres: docData.salatApres,
            genre: docData.genre,
            age: docData.age,
          };
          callback(data);
        },
        error => {
          logger.error('❌ [Firebase] Janaza error:', error.message);
          callback(null);
        },
      );
  } catch (error) {
    const err = error as Error;
    logger.error('❌ [Firebase] Janaza catch:', err?.message);
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

  logger.firebase('🔔 Subscribing to janaza list...');

  try {
    return firestore()
      .collection('janaza')
      .where('actif', '==', true)
      .onSnapshot(
        snapshot => {
          logger.firebase(
            '🤲 Janaza list snapshot:',
            snapshot.docs.length,
            'documents',
          );
          if (snapshot.empty) {
            logger.firebase('🤲 Pas de janaza active');
            callback([]);
            return;
          }
          // Mapper TOUS les documents et trier par date
          const janazaList: Janaza[] = snapshot.docs.map(doc => {
            const docData = doc.data();
            return {
              id: doc.id,
              deceasedName: docData.nomDefunt,
              deceasedNameAr: docData.nomDefuntAr || '',
              deceasedFirstName: docData.prenomDefunt || '',
              cemeteryAddress: docData.adresseCimetiere || '',
              prayerDate: toDate(docData.date),
              prayerTime: docData.heurePriere,
              location: docData.lieu,
              message: docData.phraseFr,
              messageAr: docData.phraseAr || '',
              isActive: docData.actif,
              salatApres: docData.salatApres, // "apres_fajr", "apres_dhuhr", etc.
              genre: docData.genre,
              age: docData.age,
            };
          });
          // Trier par date (plus récent en premier)
          janazaList.sort(
            (a, b) => b.prayerDate.getTime() - a.prayerDate.getTime(),
          );
          logger.firebase('🤲 Janaza list:', janazaList.length, 'items');
          callback(janazaList);
        },
        error => {
          logger.error('❌ [Firebase] Janaza list error:', error.message);
          callback([]);
        },
      );
  } catch (error) {
    const err = error as Error;
    logger.error('❌ [Firebase] Janaza list catch:', err?.message);
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
    const docData = doc.data();
    return {
      id: doc.id,
      deceasedName: docData.nomDefunt,
      deceasedNameAr: docData.nomDefuntAr || '',
      deceasedFirstName: docData.prenomDefunt || '',
      cemeteryAddress: docData.adresseCimetiere || '',
      prayerDate: toDate(docData.date),
      prayerTime: docData.heurePriere,
      location: docData.lieu,
      message: docData.phraseFr,
      messageAr: docData.phraseAr || '',
      isActive: docData.actif,
      salatApres: docData.salatApres,
      genre: docData.genre,
      age: docData.age,
    };
  } catch (error) {
    logger.error('[Firebase] getActiveJanaza error:', error);
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
          logger.error('[Firebase] Projects error:', error);
          callback(mockProjects as Project[]);
        },
      );
  } catch (error) {
    logger.error('[Firebase] Projects catch:', error);
    callback(mockProjects as Project[]);
    return () => {};
  }
};

export const getProjects = async (isExternal?: boolean): Promise<Project[]> => {
  if (FORCE_DEMO_MODE) {
    if (isExternal !== undefined) {
      return (mockProjects as Project[]).filter(
        p => p.isExternal === isExternal,
      );
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
    logger.error('[Firebase] getProjects error:', error);
    if (isExternal !== undefined) {
      return (mockProjects as Project[]).filter(
        p => p.isExternal === isExternal,
      );
    }
    return mockProjects as Project[];
  }
};

// ==================== DONATIONS ====================
// Collection Firestore: "donations"

export const createDonation = async (
  donation: Omit<Donation, 'id' | 'createdAt'>,
): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-donation-${Date.now()}`;
  }
  try {
    // BUG 7 FIX: userId garanti non-vide (évite permission-denied)
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Utilisateur non connecté');
    }
    const docRef = await firestore()
      .collection('donations')
      .add({
        userId: currentUser.uid,
        donateur: donation.memberEmail || 'Anonyme',
        montant: donation.amount,
        projetId: donation.projectId,
        projetNom: donation.projectName,
        modePaiement: donation.paymentMethod,
        status: donation.status,
        date: firestore.FieldValue.serverTimestamp(),
      });
    return docRef.id;
  } catch (error) {
    logger.error('[Firebase] createDonation error:', error);
    throw error;
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
  // Nouveaux champs reçu fiscal
  donorType?: 'particulier' | 'entreprise';
  donorInfo?: {
    email: string;
    address: string;
    postalCode: string;
    city: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    siret?: string;
    legalRepresentative?: string;
  };
}

export const addDonation = async (
  params: AddDonationParams,
): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-donation-${Date.now()}`;
  }
  try {
    // Utiliser stripePaymentIntentId comme docId pour IDEMPOTENCE
    // Si retry, le même document sera réécrit au lieu d'en créer un nouveau
    const docId = params.stripePaymentIntentId || `donation-${Date.now()}`;
    const donationRef = firestore().collection('donations').doc(docId);

    // BUG 1 FIX: Pas de transaction — écriture simple dans donations uniquement.
    // La mise à jour du compteur projet est faite par le webhook Stripe (admin SDK)
    // qui a les droits d'écriture sur la collection projects.
    // L'ancienne transaction échouait avec permission-denied car les rules projects
    // n'autorisent que isAdmin() en écriture.
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Utilisateur non connecté');
    }

    const donationData: Record<string, any> = {
      userId: currentUser.uid,
      donateur: params.isAnonymous
        ? 'Anonyme'
        : params.donorName || params.donorEmail || 'Anonyme',
      donateurEmail: params.isAnonymous ? null : params.donorEmail || null,
      montant: params.amount,
      projetId: params.projectId,
      projetNom: params.projectName,
      modePaiement: params.paymentMethod,
      stripePaymentIntentId: params.stripePaymentIntentId,
      status: 'completed',
      isAnonymous: params.isAnonymous || false,
      source: 'app_mobile',
      date: firestore.FieldValue.serverTimestamp(),
      createdAt: firestore.FieldValue.serverTimestamp(),
      // Champs reçu fiscal
      donorType: params.donorType || 'particulier',
      recuFiscalGenerated: false,
      recuFiscalYear: null,
      recuFiscalUrl: null,
    };
    if (params.donorInfo) {
      donationData.donorInfo = params.donorInfo;
    }
    // merge: true permet de ne pas écraser les champs déjà écrits par le webhook Stripe
    await donationRef.set(donationData, { merge: true });

    logger.firebase(' Don enregistré (transaction atomique):', docId);
    return docId;
  } catch (error) {
    logger.error('[Firebase] addDonation error:', error);
    throw error;
  }
};

// Ajouter un paiement de cotisation ou don avec Stripe
export interface AddCotisationParams {
  memberId: string; // Format ELM-XXXX (pour affichage)
  memberUid?: string; // Firebase Auth UID (pour la mise à jour du document)
  memberName: string;
  memberEmail?: string; // Email pour les emails de confirmation
  amount: number;
  stripePaymentIntentId: string;
  paymentMethod: string;
  period?: string;
  stripeSubscriptionId?: string; // ID de l'abonnement Stripe si paiement récurrent
}

// Alias rétrocompatible
export type AddPaymentParams = AddCotisationParams;

export const addCotisation = async (
  params: AddCotisationParams,
): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-payment-${Date.now()}`;
  }
  try {
    // Utiliser stripePaymentIntentId comme docId pour IDEMPOTENCE
    const docId = params.stripePaymentIntentId || `payment-${Date.now()}`;
    const paymentRef = firestore().collection('payments').doc(docId);
    // IMPORTANT: Utiliser memberUid (Firebase Auth UID) pour la mise à jour du document membre
    // memberId (ELM-XXXX) est juste pour l'affichage, pas pour le lookup Firestore
    const memberRef = params.memberUid
      ? firestore().collection('members').doc(params.memberUid)
      : null;

    // Vérifier si paiement existe déjà (idempotence)
    const existingDoc = await paymentRef.get();
    if (existingDoc.exists()) {
      logger.firebase(' Paiement déjà existant (idempotent):', docId);
      return docId;
    }

    const now = new Date();
    // Calculer dateFin selon la période
    // FIX B3: Si le membre a une dateFin dans le futur, on ajoute à partir de cette date
    // pour ne pas perdre les mois restants lors d'un renouvellement anticipé
    let dateFin: Date;
    let baseDate = now;
    if (memberRef) {
      try {
        const currentMember = await memberRef.get();
        if (currentMember.exists()) {
          const currentData = currentMember.data();
          const currentExpiry = currentData?.cotisation?.dateFin;
          if (currentExpiry) {
            const expiryDate = currentExpiry.toDate
              ? currentExpiry.toDate()
              : new Date(currentExpiry);
            if (expiryDate > now) {
              baseDate = expiryDate;
            }
          }
        }
      } catch (e) {
        // En cas d'erreur, on utilise now comme base (comportement par défaut)
      }
    }
    if (params.period === 'mensuel') {
      dateFin = new Date(baseDate);
      dateFin.setMonth(dateFin.getMonth() + 1);
      // Fix Bug 5: débordement mois (31 jan + 1 mois = 3 mars au lieu de 28 fév)
      if (dateFin.getDate() !== baseDate.getDate()) {
        dateFin.setDate(0); // Dernier jour du mois voulu
      }
    } else {
      // annuel par défaut
      dateFin = new Date(baseDate);
      dateFin.setFullYear(dateFin.getFullYear() + 1);
      if (dateFin.getDate() !== baseDate.getDate()) {
        dateFin.setDate(0); // Fix Bug 5: 29 fév + 1 an
      }
    }

    // TRANSACTION ATOMIQUE: cotisation + update membre
    await firestore().runTransaction(async transaction => {
      // 1. Créer la cotisation
      const paymentData: any = {
        memberId: params.memberId,
        memberName: params.memberName,
        montant: params.amount,
        modePaiement: params.paymentMethod,
        stripePaymentIntentId: params.stripePaymentIntentId,
        type: 'cotisation',
        status: 'completed',
        source: 'app_mobile',
        period: params.period || 'annuel',
        date: firestore.FieldValue.serverTimestamp(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        eligibleRecuFiscal: false,
        // Metadata pour les triggers Cloud Functions (emails de confirmation)
        metadata: {
          memberId: params.memberUid || '', // UID Firebase pour lookup membre
          memberIdDisplay: params.memberId, // Format ELM-XXXX
          memberName: params.memberName,
          email: params.memberEmail || '',
          period: params.period || 'annuel',
        },
      };

      // Ajouter stripeSubscriptionId si abonnement récurrent
      if (params.stripeSubscriptionId) {
        paymentData.stripeSubscriptionId = params.stripeSubscriptionId;
      }

      transaction.set(paymentRef, paymentData);

      // 2. Mettre à jour le statut du membre
      if (memberRef) {
        const memberDoc = await transaction.get(memberRef);
        if (memberDoc.exists()) {
          const memberUpdate: any = {
            status: 'actif',
            datePaiement: firestore.FieldValue.serverTimestamp(),
            montantPaye: params.amount,
            stripePaymentId: params.stripePaymentIntentId,
            formule: params.period || 'annuel',
            modePaiement: params.stripeSubscriptionId ? 'prelevement' : 'carte',
            cotisation: {
              type: params.period || 'annuel',
              montant: params.amount,
              dateDebut: firestore.Timestamp.fromDate(now),
              dateFin: firestore.Timestamp.fromDate(dateFin),
            },
          };

          // Ajouter stripeSubscriptionId si abonnement récurrent
          if (params.stripeSubscriptionId) {
            memberUpdate.stripeSubscriptionId = params.stripeSubscriptionId;
            memberUpdate.cotisationType = 'mensuel';
          }

          transaction.update(memberRef, memberUpdate);
        }
      }
    });

    logger.firebase(' Cotisation enregistrée (transaction atomique):', docId);
    return docId;
  } catch (error) {
    logger.error('[Firebase] addCotisation error:', error);
    throw error;
  }
};

// Alias rétrocompatible
export const addPayment = addCotisation;

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
          logger.log(
            `[Firebase] Popups snapshot: ${snapshot.docs.length} docs trouvés`,
          );
          const allPopups = snapshot.docs.map(doc => {
            const d = doc.data();
            logger.log(
              `[Firebase] Popup raw: id=${doc.id}, titre=${d.titre}, actif=${d.actif}, dateDebut=${d.dateDebut}, dateFin=${d.dateFin}, contenu=${d.contenu}, message=${d.message}, frequence=${d.frequence}`,
            );
            return {
              id: doc.id,
              titre: d.titre,
              titreAr: d.titreAr,
              contenu: d.contenu || d.message,
              contenuAr: d.contenuAr || d.messageAr,
              actif: d.actif,
              dateDebut: d.dateDebut,
              dateFin: d.dateFin,
              priorite: d.priorite || 0,
              frequence: d.frequence,
              cible: d.cible,
              texteBouton: d.texteBouton,
              lienBouton: d.lienBouton,
            };
          });

          const data: Popup[] = allPopups
            .filter(popup => {
              // Filtrer par date de validité
              // Gérer string ISO ("2026-02-13" ou "2026-02-13T14:30") et Firestore Timestamp
              const toDateStr = (val: any): string | null => {
                if (!val) return null;
                if (typeof val === 'string') return val.split('T')[0];
                if (val.toDate) return val.toDate().toISOString().split('T')[0];
                return null;
              };
              const startDate = toDateStr(popup.dateDebut);
              const endDate = toDateStr(popup.dateFin);
              const pass =
                !(startDate && startDate > today) &&
                !(endDate && endDate < today);
              logger.log(
                `[Firebase] Popup filter: id=${popup.id}, today=${today}, startDate=${startDate}, endDate=${endDate}, pass=${pass}`,
              );
              return pass;
            })
            .sort((a, b) => (b.priorite || 0) - (a.priorite || 0));
          logger.log(`[Firebase] Popups après filtrage: ${data.length}`);
          callback(mergeWithMock(data, mockPopups as Popup[]));
        },
        error => {
          logger.error('[Firebase] Popups error:', error);
          callback(mockPopups as Popup[]);
        },
      );
  } catch (error) {
    logger.error('[Firebase] Popups catch:', error);
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
          logger.error('[Firebase] Rappels error:', error);
          callback(mockRappels as Rappel[]);
        },
      );
  } catch (error) {
    logger.error('[Firebase] Rappels catch:', error);
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
    logger.error('[Firebase] getRappels error:', error);
    return mockRappels as Rappel[];
  }
};

// ==================== INFOS MOSQUÉE ====================
// Collection Firestore: "settings/mosqueeInfo"
// Champs backoffice: nom, adresse, codePostal, ville, telephone, email, siteWeb, iban, bic, bankName, accountHolder

export const subscribeToMosqueeInfo = (
  callback: (data: MosqueeInfo & { headerImageUrl?: string }) => void,
) => {
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
              accountHolder:
                data?.accountHolder || mockMosqueeInfo.accountHolder,
              headerImageUrl: data?.headerImageUrl || undefined,
            });
          } else {
            callback(mockMosqueeInfo);
          }
        },
        error => {
          logger.error('[Firebase] MosqueeInfo error:', error);
          callback(mockMosqueeInfo);
        },
      );
  } catch (error) {
    logger.error('[Firebase] MosqueeInfo catch:', error);
    callback(mockMosqueeInfo);
    return () => {};
  }
};

// ==================== RAMADAN SETTINGS ====================
// Collection Firestore: "settings/ramadan"

export interface RamadanSettings {
  enabled: boolean;
  startDate: string;
  endDate: string;
  tarawihTime: string;
  notifications: {
    suhoor: { enabled: boolean; minutesBefore: number };
    iftar: { enabled: boolean; minutesBefore: number };
    tarawih: { enabled: boolean; minutesBefore: number };
  };
}

const defaultRamadanSettings: RamadanSettings = {
  enabled: false,
  startDate: '',
  endDate: '',
  tarawihTime: '21:30',
  notifications: {
    suhoor: { enabled: true, minutesBefore: 30 },
    iftar: { enabled: true, minutesBefore: 5 },
    tarawih: { enabled: true, minutesBefore: 15 },
  },
};

export const subscribeToRamadanSettings = (
  callback: (data: RamadanSettings) => void,
) => {
  if (FORCE_DEMO_MODE) {
    callback(defaultRamadanSettings);
    return () => {};
  }

  try {
    return firestore()
      .collection('settings')
      .doc('ramadan')
      .onSnapshot(
        doc => {
          if (doc.exists()) {
            const data = doc.data();
            callback({
              enabled: data?.enabled ?? false,
              startDate: data?.startDate || '',
              endDate: data?.endDate || '',
              tarawihTime: data?.tarawihTime || '21:30',
              notifications: {
                suhoor:
                  data?.notifications?.suhoor ||
                  defaultRamadanSettings.notifications.suhoor,
                iftar:
                  data?.notifications?.iftar ||
                  defaultRamadanSettings.notifications.iftar,
                tarawih:
                  data?.notifications?.tarawih ||
                  defaultRamadanSettings.notifications.tarawih,
              },
            });
          } else {
            callback(defaultRamadanSettings);
          }
        },
        error => {
          logger.error('[Firebase] RamadanSettings error:', error);
          callback(defaultRamadanSettings);
        },
      );
  } catch (error) {
    logger.error('[Firebase] RamadanSettings catch:', error);
    callback(defaultRamadanSettings);
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

export const subscribeToCotisationPrices = (
  callback: (data: CotisationPrices) => void,
) => {
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
          logger.error('[Firebase] CotisationPrices error:', error);
          callback(defaultCotisationPrices);
        },
      );
  } catch (error) {
    logger.error('[Firebase] CotisationPrices catch:', error);
    callback(defaultCotisationPrices);
    return () => {};
  }
};

export const getMosqueeInfo = async (): Promise<MosqueeInfo> => {
  if (FORCE_DEMO_MODE) {
    return mockMosqueeInfo;
  }
  try {
    const doc = await firestore()
      .collection('settings')
      .doc('mosqueeInfo')
      .get();
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
  } catch (error) {
    const err = error as Error;
    logger.error('❌ [Firebase] getMosqueeInfo error:', err?.message);
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
          logger.error('[Firebase] Iqama error:', error);
          callback({ iqama: mockIqama, jumua: mockJumua });
        },
      );
  } catch (error) {
    logger.error('[Firebase] Iqama catch:', error);
    callback({ iqama: mockIqama, jumua: mockJumua });
    return () => {};
  }
};

export const getPrayerTimes = async (): Promise<HorairesData> => {
  if (FORCE_DEMO_MODE) {
    return { iqama: mockIqama, jumua: mockJumua };
  }
  try {
    const doc = await firestore()
      .collection('settings')
      .doc('prayerTimes')
      .get();
    if (doc.exists() && doc.data()?.iqama) {
      return {
        iqama: doc.data()?.iqama || mockIqama,
        jumua: doc.data()?.jumua || mockJumua,
        lastUpdated: doc.data()?.lastUpdated,
      };
    }
    return { iqama: mockIqama, jumua: mockJumua };
  } catch (error) {
    logger.error('[Firebase] getPrayerTimes error:', error);
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

export const subscribeToGeneralSettings = (
  callback: (data: GeneralSettings) => void,
) => {
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
          logger.error('[Firebase] GeneralSettings error:', error);
          callback(defaultGeneralSettings);
        },
      );
  } catch (error) {
    logger.error('[Firebase] GeneralSettings catch:', error);
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
    logger.error('[Firebase] getGeneralSettings error:', error);
    return defaultGeneralSettings;
  }
};

// ==================== DATES ISLAMIQUES ====================
// Collection Firestore: "dates_islamiques"

export const subscribeToIslamicDates = (
  callback: (data: DateIslamique[]) => void,
) => {
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
          logger.error('[Firebase] IslamicDates error:', error);
          callback(mockDatesIslamiques as DateIslamique[]);
        },
      );
  } catch (error) {
    logger.error('[Firebase] IslamicDates catch:', error);
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
    logger.error('[Firebase] getIslamicDates error:', error);
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
      nextPaymentDate: data?.cotisation?.dateFin
        ? toDate(data.cotisation.dateFin)
        : undefined,
      createdAt: toDate(data?.createdAt),
    };
  } catch (error) {
    logger.error('[Firebase] getMember error:', error);
    return null;
  }
};

export const updateMember = async (
  memberId: string,
  data: Partial<Member>,
): Promise<void> => {
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
    logger.error('[Firebase] updateMember error:', error);
  }
};

// Interface pour l'objet inscritPar (info du payeur)
export interface InscritParData {
  odUserId: string; // ID Firebase du payeur
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
  genre?: 'homme' | 'femme' | ''; // Sexe du membre
  dateNaissance?: string; // Format JJ/MM/AAAA
  accepteReglement?: boolean; // A accepté le règlement intérieur
  // Ancien format
  name?: string;
  phone?: string;
  // Nouveaux champs multi-membres
  inscritPar?: InscritParData | string; // Objet avec info du payeur (ou string pour rétrocompatibilité)
  status?:
    | 'actif'
    | 'en_attente_validation'
    | 'en_attente_signature'
    | 'en_attente_paiement'
    | 'expire';
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

export const createMember = async (
  member: CreateMemberData | Omit<Member, 'id' | 'createdAt' | 'memberId'>,
): Promise<string> => {
  if (FORCE_DEMO_MODE) {
    return `mock-member-${Date.now()}`;
  }
  try {
    // Déterminer nom et prénom
    let nom = '';
    let prenom = '';

    if ('nom' in member && member.nom) {
      nom = member.nom;
      prenom = 'prenom' in member && member.prenom ? member.prenom : '';
    } else if ('name' in member && member.name) {
      const nameParts = member.name.split(' ');
      prenom = nameParts[0];
      nom = nameParts.slice(1).join(' ');
    }

    // Déterminer téléphone et email
    const telephone =
      'telephone' in member && member.telephone
        ? member.telephone
        : 'phone' in member && member.phone
        ? member.phone
        : '';
    const email = member.email || '';
    const adresse = 'adresse' in member && member.adresse ? member.adresse : '';

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

    // Déterminer genre et date de naissance
    const genre = 'genre' in member && member.genre ? member.genre : '';
    const dateNaissance =
      'dateNaissance' in member && member.dateNaissance
        ? member.dateNaissance
        : '';

    // Construire le document
    const docData: any = {
      nom,
      prenom,
      email,
      telephone,
      adresse,
      genre,
      dateNaissance,
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
    logger.error('[Firebase] createMember error:', error);
    return `error-member-${Date.now()}`;
  }
};

// Helper pour déterminer le statut de cotisation
const getCotisationStatus = (
  cotisation: any,
): 'actif' | 'expire' | 'aucun' | 'en_attente_paiement' => {
  if (!cotisation) return 'aucun';
  if (!cotisation.dateFin) return 'en_attente_paiement';
  const now = new Date();
  const dateFin = toDate(cotisation.dateFin);
  return dateFin > now ? 'actif' : 'expire';
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

export const getMembersInscribedBy = async (
  userId: string,
): Promise<InscribedMember[]> => {
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
        dateFin: data.cotisation?.dateFin
          ? toDate(data.cotisation.dateFin)
          : undefined,
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
    logger.error('[Firebase] getMembersInscribedBy error:', error);
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

export const getMyMembership = async (
  email: string,
): Promise<MyMembership | null> => {
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

    // Déterminer le statut — ALIGNÉ avec buildMemberProfile
    const hasValidCotisation =
      data.cotisation?.dateFin &&
      (data.cotisation.dateFin.toDate
        ? data.cotisation.dateFin.toDate()
        : new Date(data.cotisation.dateFin)) > new Date();
    const memberStatus =
      data.status === 'actif' || hasValidCotisation
        ? 'actif'
        : data.status === 'en_attente_paiement'
        ? 'en_attente_paiement'
        : data.status === 'en_attente_validation'
        ? 'en_attente_validation'
        : data.status === 'en_attente_signature'
        ? 'en_attente_signature'
        : data.status === 'sympathisant'
        ? 'sympathisant'
        : data.status === 'annule'
        ? 'annule'
        : data.status || 'en_attente_signature';

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
      dateDebut: data.cotisation?.dateDebut
        ? toDate(data.cotisation.dateDebut)
        : undefined,
      dateFin: data.cotisation?.dateFin
        ? toDate(data.cotisation.dateFin)
        : undefined,
      modePaiement: data.modePaiement || '',
      paiementId: data.paiementId || '',
      inscritPar:
        data.inscritPar && typeof data.inscritPar === 'object'
          ? { nom: data.inscritPar.nom, prenom: data.inscritPar.prenom }
          : null,
      referenceVirement: data.referenceVirement || undefined,
    };
  } catch (error) {
    logger.error('[Firebase] getMyMembership error:', error);
    return null;
  }
};

// Listener temps réel pour les adhésions (mise à jour automatique depuis le backoffice)
// Build 255 Fix: recherche par doc ID = uid d'abord (comme getMemberProfile dans auth.ts)
// puis champ uid, puis email. Garantit de trouver le MÊME document que la carte membre.
export const subscribeToMyMembership = (
  email: string,
  callback: (membership: MyMembership | null, error?: string) => void,
): (() => void) => {
  if (FORCE_DEMO_MODE || !email) {
    callback(null);
    return () => {};
  }

  // Helper pour mapper un doc Firestore vers MyMembership
  const mapDocToMembership = (doc: any, data: any): MyMembership => {
    const memberStatus = computeMemberStatus({
      status: data.status,
      cotisationDateFin: data.cotisation?.dateFin,
    });

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
      dateDebut: data.cotisation?.dateDebut
        ? toDate(data.cotisation.dateDebut)
        : undefined,
      dateFin: data.cotisation?.dateFin
        ? toDate(data.cotisation.dateFin)
        : undefined,
      modePaiement: data.modePaiement || '',
      paiementId: data.paiementId || '',
      inscritPar:
        data.inscritPar && typeof data.inscritPar === 'object'
          ? { nom: data.inscritPar.nom, prenom: data.inscritPar.prenom }
          : null,
      referenceVirement: data.referenceVirement || undefined,
    };
  };

  try {
    // Stratégie ALIGNÉE sur getMemberProfile (auth.ts) :
    // 1. doc(uid) — doc ID = uid (créé par signup app)
    // 2. where('uid', '==', uid) — champ uid (créé par backoffice puis lié)
    // 3. where('email', '==', email) — fallback email
    // Ceci garantit que MemberCardFullScreen et MyMembershipsScreen trouvent le MÊME document.
    const currentUser = auth().currentUser;
    const uid = currentUser?.uid;

    if (uid) {
      // Phase 1 : vérifier si doc(uid) existe (doc ID = uid, créé par signup)
      // Si oui, écouter CE document en temps réel
      // Si non, fallback sur where('uid', '==', uid) puis email
      const docRef = firestore().collection('members').doc(uid);

      return docRef.onSnapshot(
        async docSnapshot => {
          if (docSnapshot.exists()) {
            // Document trouvé par doc ID = uid (cas principal)
            const data = docSnapshot.data();
            // S'assurer que le champ uid est présent pour cohérence
            if (data && !data.uid) {
              try {
                await docRef.update({ uid });
              } catch {}
            }
            callback(mapDocToMembership(docSnapshot, data));
            return;
          }

          // Doc ID = uid n'existe pas → chercher par champ uid
          try {
            const uidSnapshot = await firestore()
              .collection('members')
              .where('uid', '==', uid)
              .limit(1)
              .get();

            if (!uidSnapshot.empty) {
              const uidDoc = uidSnapshot.docs[0];
              callback(mapDocToMembership(uidDoc, uidDoc.data()));
              return;
            }

            // Fallback : chercher par email (membre créé depuis backoffice sans uid)
            const emailSnapshot = await firestore()
              .collection('members')
              .where('email', '==', email.toLowerCase())
              .limit(1)
              .get();

            if (!emailSnapshot.empty) {
              const emailDoc = emailSnapshot.docs[0];
              const data = emailDoc.data();

              // Lier le UID au document pour les prochaines requêtes
              if (data && !data.uid) {
                try {
                  await emailDoc.ref.update({ uid });
                } catch {}
              }

              callback(mapDocToMembership(emailDoc, data));
            } else {
              callback(null);
            }
          } catch (fallbackError) {
            logger.error(
              '[Firebase] subscribeToMyMembership fallback error:',
              fallbackError,
            );
            callback(null);
          }
        },
        error => {
          logger.error('[Firebase] subscribeToMyMembership error:', error);
          callback(null, 'firestore_error');
        },
      );
    }

    // Pas d'UID : écouter par email directement
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
          callback(mapDocToMembership(doc, doc.data()));
        },
        error => {
          logger.error('[Firebase] subscribeToMyMembership error:', error);
          callback(null, 'firestore_error');
        },
      );
  } catch (error) {
    logger.error('[Firebase] subscribeToMyMembership catch:', error);
    callback(null, 'firestore_error');
    return () => {};
  }
};

// Listener temps réel pour le profil membre (par UID ou email)
// Utilisé par MemberScreen pour mise à jour en temps réel depuis le backoffice
export interface MemberProfileRealtime {
  id: string;
  memberId: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  status: string;
  cotisation: {
    type: 'mensuel' | 'annuel' | null;
    montant: number;
    dateDebut: Date | null;
    dateFin: Date | null;
    status: string;
  };
}

export const subscribeToMemberProfile = (
  uid: string,
  email: string,
  callback: (profile: MemberProfileRealtime | null) => void,
): (() => void) => {
  if (FORCE_DEMO_MODE || (!uid && !email)) {
    callback(null);
    return () => {};
  }

  // Aligné avec getMemberProfile : doc(uid) d'abord, puis where('uid'), puis email
  const unsubscribers: (() => void)[] = [];

  try {
    // 1. Écouter doc(uid) en temps réel — source de vérité principale
    const docUnsub = firestore()
      .collection('members')
      .doc(uid)
      .onSnapshot(
        async docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Ajouter uid si manquant
            if (data && !data.uid) {
              await docSnap.ref.update({ uid });
            }
            callback(buildMemberProfile(docSnap.id, data || {}));
            return;
          }

          // 2. Fallback : chercher par champ uid (ancien format)
          try {
            const uidSnap = await firestore()
              .collection('members')
              .where('uid', '==', uid)
              .limit(1)
              .get();

            if (!uidSnap.empty) {
              const doc = uidSnap.docs[0];
              callback(buildMemberProfile(doc.id, doc.data()));
              return;
            }

            // 3. Fallback : chercher par email (membres créés via backoffice)
            if (email) {
              const emailSnap = await firestore()
                .collection('members')
                .where('email', '==', email.toLowerCase())
                .limit(1)
                .get();

              if (!emailSnap.empty) {
                const doc = emailSnap.docs[0];
                const data = doc.data();
                // Lier le UID au document
                if (!data.uid) {
                  await doc.ref.update({ uid });
                }
                callback(buildMemberProfile(doc.id, data));
                return;
              }
            }
          } catch (fallbackError) {
            logger.error(
              '[Firebase] subscribeToMemberProfile fallback error:',
              fallbackError,
            );
          }

          callback(null);
        },
        error => {
          logger.error('[Firebase] subscribeToMemberProfile error:', error);
          callback(null);
        },
      );

    unsubscribers.push(docUnsub);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  } catch (error) {
    logger.error('[Firebase] subscribeToMemberProfile catch:', error);
    callback(null);
    return () => {};
  }
};

// Helper pour construire le profil membre
const buildMemberProfile = (
  docId: string,
  data: any,
): MemberProfileRealtime => {
  // Source unique de verite — computeMemberStatus (utils/memberStatus.ts)
  const resolvedStatus = computeMemberStatus({
    status: data.status,
    cotisationDateFin: data.cotisation?.dateFin,
  });

  return {
    id: docId,
    memberId: data.memberId || data.numeroAdherent || '',
    nom: data.nom || '',
    prenom: data.prenom || '',
    email: data.email || '',
    telephone: data.telephone || '',
    adresse: data.adresse || '',
    status: resolvedStatus,
    cotisation: {
      type: data.formule || data.cotisation?.type || null,
      montant: data.montant || data.cotisation?.montant || 0,
      dateDebut: data.cotisation?.dateDebut
        ? toDate(data.cotisation.dateDebut)
        : null,
      dateFin: data.cotisation?.dateFin
        ? toDate(data.cotisation.dateFin)
        : null,
      status: resolvedStatus,
    },
  };
};

// ==================== RÈGLEMENT INTÉRIEUR ====================

export interface ReglementData {
  contenu: string;
  updatedAt: Date | null;
}

/**
 * Écouter les changements du règlement intérieur en temps réel
 */
export const subscribeToReglement = (
  callback: (reglement: ReglementData | null) => void,
): (() => void) => {
  if (FORCE_DEMO_MODE) {
    callback({
      contenu:
        "Règlement intérieur de l'association...\n\nARTICLE 1 - OBJET\n...",
      updatedAt: null,
    });
    return () => {};
  }

  try {
    return firestore()
      .collection('settings')
      .doc('reglement')
      .onSnapshot(
        doc => {
          if (doc.exists()) {
            const data = doc.data();
            callback({
              contenu: data?.contenu || '',
              updatedAt: data?.updatedAt?.toDate
                ? data.updatedAt.toDate()
                : null,
            });
          } else {
            callback(null);
          }
        },
        error => {
          logger.error('[Firebase] subscribeToReglement error:', error);
          callback(null);
        },
      );
  } catch (error) {
    logger.error('[Firebase] subscribeToReglement catch:', error);
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
    logger.error('[Firebase] checkDailyMessageLimit error:', error);
    return true; // En cas d'erreur, on autorise
  }
};

// Envoyer un nouveau message
export const sendMessage = async (
  userId: string,
  userName: string,
  userEmail: string,
  sujet: string,
  message: string,
  userPhone?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  if (FORCE_DEMO_MODE) {
    return { success: false, error: 'Mode démo activé' };
  }

  // Validation
  if (!message || message.trim().length < 10) {
    return {
      success: false,
      error: 'Le message doit contenir au moins 10 caractères',
    };
  }

  // Vérifier limite anti-spam
  const canSend = await checkDailyMessageLimit(userId);
  if (!canSend) {
    return {
      success: false,
      error: 'Vous avez atteint la limite de 5 messages par jour',
    };
  }

  try {
    const docRef = await firestore()
      .collection('messages')
      .add({
        odUserId: userId,
        userName,
        userEmail,
        userPhone: userPhone || '',
        sujet,
        message: message.trim(),
        status: 'non_lu',
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        reponses: [],
      });

    return { success: true, messageId: docRef.id };
  } catch (error) {
    const err = error as Error;
    logger.error('[Firebase] sendMessage error:', err);
    return { success: false, error: err?.message || "Erreur lors de l'envoi" };
  }
};

// Récupérer les messages d'un utilisateur
export const getUserMessages = async (
  userId: string,
): Promise<UserMessage[]> => {
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
    logger.error('[Firebase] getUserMessages error:', error);
    return [];
  }
};

// Souscrire aux messages d'un utilisateur (temps réel)
export const subscribeToUserMessages = (
  userId: string,
  callback: (messages: UserMessage[]) => void,
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
      .limit(50)
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
          logger.error('[Firebase] subscribeToUserMessages error:', error);
          callback([]);
        },
      );
  } catch (error) {
    logger.error('[Firebase] subscribeToUserMessages catch:', error);
    callback([]);
    return () => {};
  }
};

// Ajouter une réponse à un message (côté utilisateur)
export const addUserReplyToMessage = async (
  messageId: string,
  replyText: string,
  userId?: string,
): Promise<{ success: boolean; error?: string }> => {
  if (FORCE_DEMO_MODE) {
    return { success: false, error: 'Mode démo activé' };
  }

  if (!replyText || replyText.trim().length < 5) {
    return {
      success: false,
      error: 'La réponse doit contenir au moins 5 caractères',
    };
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
      logger.warn('[Firebase] Tentative de réponse non autorisée:', {
        messageId,
        userId,
        owner: data?.odUserId,
      });
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
  } catch (error) {
    const err = error as Error;
    logger.error('[Firebase] addUserReplyToMessage error:', err);
    return { success: false, error: err?.message || "Erreur lors de l'envoi" };
  }
};

// Récupérer un message spécifique
export const getMessage = async (
  messageId: string,
): Promise<UserMessage | null> => {
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
    logger.error('[Firebase] getMessage error:', error);
    return null;
  }
};

// Supprimer un message (soft delete - reste visible dans le backoffice)
export const deleteMessage = async (
  messageId: string,
  userId?: string,
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
        logger.warn('[Firebase] Tentative de suppression non autorisée:', {
          messageId,
          userId,
          owner: data?.odUserId,
        });
        return { success: false, error: 'Non autorisé' };
      }
    }

    // Soft delete: marquer comme supprimé par l'utilisateur
    await messageRef.update({
      deletedByUser: true,
      deletedByUserAt: firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    const err = error as Error;
    logger.error('[Firebase] deleteMessage error:', err);
    return {
      success: false,
      error: err?.message || 'Erreur lors de la suppression',
    };
  }
};

// Souscrire à un message spécifique (temps réel)
export const subscribeToMessage = (
  messageId: string,
  callback: (message: UserMessage | null) => void,
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
          logger.error('[Firebase] subscribeToMessage error:', error);
          callback(null);
        },
      );
  } catch (error) {
    logger.error('[Firebase] subscribeToMessage catch:', error);
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
  annee: number,
): Promise<{ success: boolean; message: string; montantTotal?: number }> => {
  if (FORCE_DEMO_MODE) {
    return {
      success: false,
      message: 'Mode démo - Fonction non disponible',
    };
  }

  try {
    const sendRecuFiscal = firebase
      .app()
      .functions('europe-west1')
      .httpsCallable('sendRecuFiscal');
    const result = await sendRecuFiscal({ email, annee });
    const data = result.data as any;

    return {
      success: true,
      message: data.message || 'Reçu fiscal envoyé',
      montantTotal: data.montantTotal,
    };
  } catch (error) {
    const err = error as Error & { code?: string };
    logger.error('[Firebase] requestRecuFiscal error:', err);
    let message = "Erreur lors de l'envoi du reçu fiscal";

    if (err?.code === 'functions/not-found') {
      message = 'Aucun don trouvé pour cette année';
    } else if (err?.code === 'functions/failed-precondition') {
      message = "Service non configuré. Contactez l'administration.";
    } else if (err?.message) {
      message = err.message;
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
  annee: number,
): Promise<{ total: number; count: number } | null> => {
  if (FORCE_DEMO_MODE) {
    return null;
  }

  try {
    const getDonsByYear = firebase
      .app()
      .functions('europe-west1')
      .httpsCallable('getDonsByYear');
    const result = await getDonsByYear({ email, annee });
    const data = result.data as any;

    return {
      total: data.total || 0,
      count: data.dons?.length || 0,
    };
  } catch (error) {
    logger.error('[Firebase] getDonsTotalByYear error:', error);
    return null;
  }
};

// ==================== CANCEL SUBSCRIPTION ====================
export const cancelSubscription = async (
  reason?: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const cancelFn = firebase
      .app()
      .functions('europe-west1')
      .httpsCallable('cancelSubscription');
    const result = await cancelFn({ reason: reason || 'Annulé par le membre' });
    const data = result.data as any;
    return { success: data.success, message: data.message };
  } catch (error: any) {
    logger.error('[Firebase] cancelSubscription error:', error);
    return {
      success: false,
      message: error?.message || "Erreur lors de l'annulation",
    };
  }
};

// ==================== DELETE MY ACCOUNT (SELF-SERVICE RGPD) ====================
export const deleteMyAccount = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    const deleteFn = firebase
      .app()
      .functions('europe-west1')
      .httpsCallable('deleteMyAccount');
    const result = await deleteFn({});
    const data = result.data as any;
    return { success: data.success, message: data.message };
  } catch (error: any) {
    logger.error('[Firebase] deleteMyAccount error:', error);
    return {
      success: false,
      message: error?.message || 'Erreur lors de la suppression du compte',
    };
  }
};

// ==================== EXPORTS ====================
export const isDemoMode = FORCE_DEMO_MODE;
