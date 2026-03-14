/**
 * Service d'authentification Firebase - Production
 * Utilise Firebase Auth pour l'authentification réelle
 */
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import firebase from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils';
import { computeMemberStatus } from '../utils/memberStatus';
import { setUserForCrashlytics } from './monitoring';

const AUTH_STORAGE_KEY = '@auth_user_profile';

/**
 * Envoie l'email de vérification via Cloud Function Brevo (anti-spam).
 * Utilise le même expéditeur que les emails de paiement → bonne délivrabilité.
 */
export const sendVerificationEmailViaCF = async (): Promise<void> => {
  const sendVerification = firebase
    .app()
    .functions('europe-west1')
    .httpsCallable('sendVerificationEmail');
  await sendVerification({});
};

export interface MemberProfile {
  uid: string;
  name: string;
  email: string;
  memberId: string;
  nom?: string;
  prenom?: string;
  cotisationType: 'mensuel' | 'annuel' | null;
  cotisationStatus:
    | 'aucun'
    | 'actif'
    | 'expire'
    | 'en_attente_paiement'
    | 'sympathisant'
    | 'en_attente_validation'
    | 'en_attente_signature'
    | 'annule';
  cotisationExpiry?: Date;
  phone?: string;
  address?: string;
  telephone?: string; // Alias français pour phone
  adresse?: string; // Alias français pour address
  codePostal?: string;
  ville?: string;
  subscriptionCancelPending?: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface AuthResult {
  success: boolean;
  user?: FirebaseAuthTypes.User;
  error?: string;
}

// Generer un ID membre unique
const generateMemberId = (): string => {
  const year = new Date().getFullYear();
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ELM-${year}-${random}`;
};

// Mapper les codes d'erreur Firebase vers des messages français
// SÉCURITÉ: user-not-found et wrong-password retournent le même message
// pour éviter l'énumération d'emails (savoir si un email existe ou non)
const getErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    'auth/invalid-email': "L'adresse email n'est pas valide.",
    'auth/user-disabled': 'Ce compte a été désactivé.',
    // SÉCURITÉ: Message générique pour éviter l'énumération d'emails
    'auth/user-not-found': 'Email ou mot de passe incorrect.',
    'auth/wrong-password': 'Email ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Cette adresse email est déjà utilisée.',
    'auth/weak-password':
      'Le mot de passe doit contenir au moins 6 caractères.',
    'auth/network-request-failed':
      'Erreur de connexion. Vérifiez votre connexion internet.',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  };
  return (
    errorMessages[errorCode] || 'Une erreur est survenue. Veuillez réessayer.'
  );
};

// ==================== VALIDATION EMAIL ANTI-TYPOS ====================

const VALID_COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.fr',
  'yahoo.com',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.fr',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'laposte.net',
  'bbox.fr',
  'numericable.fr',
  'protonmail.com',
  'proton.me',
  'gmx.fr',
  'gmx.com',
];

// Domaines bidon fréquents (typos ou faux)
const BLOCKED_DOMAINS = [
  'gmail.cum',
  'gmail.con',
  'gmail.co',
  'gmail.fr',
  'gmail.cm',
  'gmail.om',
  'gmail.cmo',
  'gmail.comm',
  'gmail.ccom',
  'gmal.com',
  'gmil.com',
  'gmai.com',
  'gmali.com',
  'gamail.com',
  'gnail.com',
  'gemail.com',
  'gimail.com',
  'hotmail.cum',
  'hotmail.con',
  'hotmail.co',
  'hotmal.com',
  'hotmial.com',
  'hotamil.com',
  'hotmil.com',
  'yahoo.cum',
  'yahoo.con',
  'yaho.com',
  'yahooo.com',
  'yhoo.com',
  'outlook.cum',
  'outlook.con',
  'outloo.com',
  'outlok.com',
  'icloud.cum',
  'icloud.con',
  'orange.cum',
  'orange.con',
  'test.com',
  'test.fr',
  'example.com',
  'email.com',
  'fake.com',
  'fake.fr',
  'bidon.com',
  'bidon.fr',
  'aaa.com',
  'bbb.com',
  'abc.com',
  'azerty.com',
  'qwerty.com',
  'tempmail.com',
  'throwaway.email',
  'guerrillamail.com',
  'mailinator.com',
  'yopmail.com',
  'yopmail.fr',
  'jetable.org',
  'trashmail.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'dispostable.com',
  'temp-mail.org',
];

const VALID_TLDS = [
  'com',
  'fr',
  'net',
  'org',
  'io',
  'me',
  'co',
  'eu',
  'be',
  'ch',
  'de',
  'es',
  'it',
  'uk',
  'ca',
  'us',
  'info',
  'pro',
  'biz',
  'dz',
  'ma',
  'tn',
  'ly',
  'eg',
  'sa',
  'ae',
  'qa',
  'kw',
];

/**
 * Valide un email contre les typos et domaines bidon courants.
 * Retourne null si OK, ou un message d'erreur en français si invalide.
 */
export const validateEmailQuality = (email: string): string | null => {
  const trimmed = email.trim().toLowerCase();

  // Format basique
  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return 'Format email invalide';
  }

  const [localPart, domain] = parts;

  // Local part vide ou trop court
  if (!localPart || localPart.length < 2) {
    return 'Adresse email trop courte';
  }

  // Caractères répétitifs (aaaa@, 1111@)
  if (/^(.)\1{3,}$/.test(localPart)) {
    return 'Adresse email invalide';
  }

  // Domaine vide
  if (!domain || !domain.includes('.')) {
    return 'Domaine email invalide';
  }

  // Domaine bloqué (typos, jetables, faux)
  if (BLOCKED_DOMAINS.includes(domain)) {
    // Chercher la suggestion : même base ou base similaire
    const domainBase = domain.split('.')[0];
    const suggestion = VALID_COMMON_DOMAINS.find(
      d =>
        d.startsWith(domainBase) ||
        d.split('.')[0].startsWith(domainBase.slice(0, 3)),
    );
    if (suggestion) {
      return `Domaine "${domain}" invalide. Vouliez-vous dire "${suggestion}" ?`;
    }
    return `Domaine "${domain}" non autorisé`;
  }

  // TLD invalide
  const tld = domain.split('.').pop() || '';
  if (tld.length < 2 || tld.length > 6) {
    return 'Extension email invalide';
  }
  if (!VALID_TLDS.includes(tld)) {
    return `Extension ".${tld}" non reconnue`;
  }

  // Domaine avec chiffres uniquement (123.com)
  const domainName = domain.split('.')[0];
  if (/^\d+$/.test(domainName)) {
    return 'Domaine email invalide';
  }

  return null; // Email OK
};

export const AuthService = {
  // Mode production (vraie auth Firebase)
  isMockMode: false,

  /**
   * Inscription d'un nouveau membre avec Firebase Auth
   * Inclut retry logic pour Firestore et rollback si échec total
   */
  signUp: async (
    email: string,
    password: string,
    name: string,
    telephone?: string,
    adresse?: string,
    genre?: 'homme' | 'femme',
    dateNaissance?: string,
  ): Promise<AuthResult> => {
    let user: FirebaseAuthTypes.User | null = null;

    try {
      // Créer l'utilisateur dans Firebase Auth
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password,
      );
      user = userCredential.user;

      // Mettre à jour le displayName
      await user.updateProfile({ displayName: name });

      // Envoyer l'email de vérification via Brevo (meilleure délivrabilité)
      try {
        await sendVerificationEmailViaCF();
        logger.log('[Auth] Email de vérification Brevo envoyé à', email);
      } catch (emailError) {
        logger.warn('[Auth] Erreur envoi email vérification:', emailError);
        // On continue quand même, ce n'est pas bloquant
      }

      // Créer le profil membre dans Firestore avec retry
      const memberId = generateMemberId();
      const nameParts = name.trim().split(' ');
      const prenom = nameParts[0] || '';
      const nom = nameParts.slice(1).join(' ') || prenom;

      const profileData = {
        nom: nom,
        prenom: prenom,
        email: email,
        telephone: telephone || '',
        adresse: adresse || '',
        genre: genre || '',
        dateNaissance: dateNaissance || '',
        cotisation: {
          type: null,
          montant: 0,
          dateDebut: null,
          dateFin: null,
          status: 'sympathisant',
        },
        status: 'sympathisant', // Nouveau: inscrit sans paiement, accès complet app
        actif: true,
        memberId: memberId,
        uid: user.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        source: 'mobile_app',
      };

      // Retry Firestore document creation (max 3 tentatives)
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 500; // ms
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await firestore()
            .collection('members')
            .doc(user.uid)
            .set(profileData);
          logger.auth('Inscription réussie', email, memberId);
          return { success: true, user };
        } catch (firestoreError) {
          lastError = firestoreError as Error;
          logger.warn(
            `[Auth] Firestore attempt ${attempt}/${MAX_RETRIES} failed`,
          );

          if (attempt < MAX_RETRIES) {
            // Attendre avant de réessayer
            await new Promise<void>(resolve =>
              setTimeout(() => resolve(), RETRY_DELAY * attempt),
            );
          }
        }
      }

      // Toutes les tentatives Firestore ont échoué
      // Rollback: supprimer le compte Auth pour éviter un état incohérent
      logger.error(
        '[Auth] Firestore failed after retries, rolling back Auth account',
      );
      try {
        await user.delete();
        logger.log('[Auth] Auth account rolled back successfully');
      } catch (deleteError) {
        // Log mais ne pas masquer l'erreur Firestore
        logger.error('[Auth] Failed to rollback Auth account', deleteError);
      }

      return {
        success: false,
        error: 'Erreur lors de la création du profil. Veuillez réessayer.',
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('[Auth] Erreur inscription', err);
      return {
        success: false,
        error: getErrorMessage(err.code || ''),
      };
    }
  },

  /**
   * Connexion d'un membre existant avec Firebase Auth
   */
  signIn: async (email: string, password: string): Promise<AuthResult> => {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(
        email,
        password,
      );
      logger.auth('Connexion réussie', email);
      return { success: true, user: userCredential.user };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('[Auth] Erreur connexion', err);
      return {
        success: false,
        error: getErrorMessage(err.code || ''),
      };
    }
  },

  /**
   * Déconnexion avec Firebase Auth
   */
  signOut: async (): Promise<void> => {
    try {
      // 1. Annuler toutes les notifications locales programmées
      try {
        const notifee = (await import('@notifee/react-native')).default;
        await notifee.cancelAllNotifications();
      } catch (e) {
        // Non bloquant
      }

      // 2. Désouscrire de tous les topics FCM
      const fcmTopics = [
        'general',
        'announcements',
        'events',
        'janaza',
        'jumua',
        'fajr_reminders',
        'members',
      ];
      for (const topic of fcmTopics) {
        try {
          await messaging().unsubscribeFromTopic(topic);
        } catch (e) {
          // Non bloquant - log silencieux
        }
      }

      // 3. Retirer le token FCM actuel de Firestore (multi-device: arrayRemove)
      try {
        const uid = auth().currentUser?.uid;
        if (uid) {
          const token = await messaging().getToken();
          if (token) {
            await firestore().collection('members').doc(uid).update({
              fcmTokens: firestore.FieldValue.arrayRemove(token),
            });
          }
        }
      } catch (e) {
        // Non bloquant — le token peut être indisponible au logout
      }

      await auth().signOut();
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setUserForCrashlytics(null);
      logger.log('[Auth] Déconnexion réussie');
    } catch (error) {
      logger.error('[Auth] Erreur déconnexion', error);
    }
  },

  /**
   * Réinitialisation du mot de passe via Firebase
   */
  resetPassword: async (email: string): Promise<AuthResult> => {
    try {
      auth().languageCode = 'fr';
      await auth().sendPasswordResetEmail(email);
      logger.auth('Email de réinitialisation envoyé', email);
      return { success: true };
    } catch (error) {
      const err = error as { code?: string };
      logger.error('[Auth] Erreur reset password', err);
      return {
        success: false,
        error: getErrorMessage(err.code || ''),
      };
    }
  },

  /**
   * Écouter les changements d'état d'authentification Firebase
   */
  onAuthStateChanged: (
    callback: (user: FirebaseAuthTypes.User | null) => void,
  ): (() => void) => {
    return auth().onAuthStateChanged(callback);
  },

  /**
   * Obtenir l'utilisateur Firebase actuel
   */
  getCurrentUser: (): FirebaseAuthTypes.User | null => {
    return auth().currentUser;
  },

  /**
   * Build 255 — Fusionne les doublons backoffice au login.
   * Si un doc members/{uid} existe ET qu'il y a d'autres docs
   * avec le même email (créés par le backoffice avec addDoc),
   * on fusionne les champs non-vides des doublons dans le principal
   * puis on supprime les doublons.
   * Si doc(uid) n'existe PAS mais un doc backoffice existe,
   * on migre le doc backoffice vers doc(uid).
   */
  fusionnerDoublonBackoffice: async (
    user: FirebaseAuthTypes.User,
  ): Promise<void> => {
    try {
      const uid = user.uid;
      const email = user.email?.toLowerCase()?.trim();
      if (!email) return;

      // Chercher TOUS les docs avec cet email
      const emailQuery = await firestore()
        .collection('members')
        .where('email', '==', email)
        .get();

      if (emailQuery.empty || emailQuery.size <= 1) {
        // 0 ou 1 doc → pas de doublon, rien à faire
        // Mais vérifier si le doc unique n'est PAS doc(uid) → migration nécessaire
        if (emailQuery.size === 1) {
          const singleDoc = emailQuery.docs[0];
          if (singleDoc.id !== uid) {
            // Doc backoffice trouvé mais PAS doc(uid) → migrer vers doc(uid)
            const data = singleDoc.data();
            logger.log(
              '[Auth] Migration doc backoffice vers doc(uid):',
              singleDoc.id,
              '→',
              uid,
            );
            await firestore()
              .collection('members')
              .doc(uid)
              .set({
                ...data,
                uid: uid,
                mergedFrom: [singleDoc.id],
                mergedAt: firestore.FieldValue.serverTimestamp(),
              });
            await firestore().collection('members').doc(singleDoc.id).delete();
            logger.log('[Auth] Migration terminée, ancien doc supprimé');
          }
        }
        return;
      }

      // 2+ docs avec le même email → fusion nécessaire
      logger.log(
        '[Auth] Doublons détectés pour',
        email,
        ':',
        emailQuery.size,
        'docs',
      );

      // Chercher le doc principal = doc(uid) ou celui avec le bon uid
      let principal: FirebaseFirestoreTypes.QueryDocumentSnapshot | null = null;
      const doublons: FirebaseFirestoreTypes.QueryDocumentSnapshot[] = [];

      emailQuery.docs.forEach(doc => {
        if (doc.id === uid || doc.data().uid === uid) {
          if (!principal) {
            principal = doc;
          } else {
            doublons.push(doc);
          }
        } else {
          doublons.push(doc);
        }
      });

      // Si aucun doc n'a l'uid actuel, prendre le plus récent comme principal
      if (!principal) {
        const sorted = [...emailQuery.docs].sort((a, b) => {
          const aDate = a.data().createdAt?.toDate?.() || new Date(0);
          const bDate = b.data().createdAt?.toDate?.() || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
        principal = sorted[0];
        doublons.length = 0;
        sorted.slice(1).forEach(d => doublons.push(d));
      }

      if (doublons.length === 0) return;

      // Fusionner les champs non-vides des doublons dans le principal
      const principalData = { ...principal.data() };
      const champsFusionnes: string[] = [];

      doublons.forEach(doublon => {
        const doublonData = doublon.data();
        Object.keys(doublonData).forEach(key => {
          const valPrincipal = principalData[key];
          const valDoublon = doublonData[key];
          const principalVide =
            valPrincipal === undefined ||
            valPrincipal === null ||
            valPrincipal === '';
          const doublonNonVide =
            valDoublon !== undefined &&
            valDoublon !== null &&
            valDoublon !== '';
          if (principalVide && doublonNonVide) {
            principalData[key] = valDoublon;
            champsFusionnes.push(key);
          }
        });
      });

      // Écrire le doc fusionné dans doc(uid)
      await firestore()
        .collection('members')
        .doc(uid)
        .set({
          ...principalData,
          uid: uid,
          mergedFrom: doublons.map(d => d.id),
          mergedAt: firestore.FieldValue.serverTimestamp(),
        });

      // Supprimer les doublons
      for (const doublon of doublons) {
        await firestore().collection('members').doc(doublon.id).delete();
        logger.log('[Auth] Doublon supprimé:', doublon.id);
      }

      // Si le principal n'était pas doc(uid), supprimer l'ancien aussi
      if (principal.id !== uid) {
        await firestore().collection('members').doc(principal.id).delete();
        logger.log('[Auth] Ancien principal migré et supprimé:', principal.id);
      }

      logger.log(
        '[Auth] Fusion terminée:',
        champsFusionnes.length,
        'champs récupérés,',
        doublons.length,
        'doublons supprimés',
      );
    } catch (error) {
      // Non bloquant — on log l'erreur mais on ne bloque pas le login
      logger.error('[Auth] Erreur fusion doublons (non bloquant):', error);
    }
  },

  /**
   * Obtenir le profil membre depuis Firestore
   */
  getMemberProfile: async (uid: string): Promise<MemberProfile | null> => {
    try {
      const user = auth().currentUser;
      const userEmail = user?.email?.toLowerCase();

      // Build 255 — Fusionner les doublons backoffice AVANT le chargement du profil
      if (user) {
        await AuthService.fusionnerDoublonBackoffice(user);
      }

      // Helper pour mettre à jour les champs manquants et retourner le profil
      const processAndReturnProfile = async (memberDoc: any, docData: any) => {
        const updates: any = {};

        // Ajouter uid si manquant
        if (!docData.uid) {
          updates.uid = uid;
        }

        // Générer et sauvegarder memberId si manquant
        if (!docData.memberId) {
          updates.memberId = generateMemberId();
          docData.memberId = updates.memberId; // Pour le retour immédiat
        }

        // Sauvegarder les updates si nécessaire
        if (Object.keys(updates).length > 0) {
          await memberDoc.ref.update(updates);
          logger.log('[Auth] Champs manquants ajoutés:', Object.keys(updates));
        }

        return mapFirestoreToProfile(uid, docData);
      };

      // 1. Chercher par doc ID = uid
      const docRef = firestore().collection('members').doc(uid);
      const doc = await docRef.get();

      if (doc.exists()) {
        return processAndReturnProfile({ ref: docRef }, doc.data());
      }

      // 2. Chercher par champ uid
      const uidQuery = await firestore()
        .collection('members')
        .where('uid', '==', uid)
        .limit(1)
        .get();

      if (!uidQuery.empty) {
        const memberDoc = uidQuery.docs[0];
        return processAndReturnProfile(memberDoc, memberDoc.data());
      }

      // 3. Chercher par EMAIL (important pour membres créés via backoffice)
      if (userEmail) {
        const emailQuery = await firestore()
          .collection('members')
          .where('email', '==', userEmail)
          .limit(1)
          .get();

        if (!emailQuery.empty) {
          const memberDoc = emailQuery.docs[0];
          logger.auth('Membre trouvé par email', userEmail);
          return processAndReturnProfile(memberDoc, memberDoc.data());
        }
      }

      // Pas de profil trouvé - CRÉER UN PROFIL DE BASE
      // (Cas où le compte Auth existe mais pas le document Firestore)
      if (user) {
        logger.log(
          '[Auth] Création profil de base pour:',
          uid.substring(0, 8) + '...',
        );
        const memberId = generateMemberId();
        const displayName = user.displayName || 'Membre';
        const nameParts = displayName.split(' ');

        const newProfile = {
          nom: nameParts.slice(1).join(' ') || nameParts[0] || '',
          prenom: nameParts[0] || '',
          email: userEmail || '',
          telephone: '',
          adresse: '',
          cotisation: {
            type: 'annuel',
            montant: 0,
            dateDebut: null,
            dateFin: null,
          },
          actif: true,
          memberId: memberId,
          uid: uid,
          createdAt: firestore.FieldValue.serverTimestamp(),
          source: 'auto_created',
        };

        await firestore().collection('members').doc(uid).set(newProfile);
        logger.log('[Auth] Profil créé automatiquement:', memberId);

        return {
          uid,
          name: displayName,
          email: userEmail || '',
          memberId: memberId,
          nom: newProfile.nom,
          prenom: newProfile.prenom,
          cotisationType: 'annuel',
          cotisationStatus: 'aucun',
          phone: '',
          address: '',
          telephone: '', // Alias français
          adresse: '', // Alias français
          createdAt: new Date(),
        };
      }

      logger.log(
        "[Auth] Profil membre non trouvé et pas d'utilisateur connecté",
      );
      return null;
    } catch (error) {
      logger.error('[Auth] Erreur récupération profil', error);
      return null;
    }
  },

  /**
   * Mettre à jour le profil membre dans Firestore
   */
  updateMemberProfile: async (
    uid: string,
    updates: Partial<MemberProfile>,
  ): Promise<void> => {
    try {
      // Chercher le document par uid
      const querySnapshot = await firestore()
        .collection('members')
        .where('uid', '==', uid)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        await querySnapshot.docs[0].ref.update(updates);
        logger.log('[Auth] Profil mis à jour');
      } else {
        // Essayer avec doc ID
        await firestore().collection('members').doc(uid).update(updates);
      }
    } catch (error) {
      logger.error('[Auth] Erreur mise à jour profil', error);
      throw error;
    }
  },

  /**
   * Mettre à jour la cotisation
   */
  updateCotisation: async (
    uid: string,
    type: 'mensuel' | 'annuel',
    status: 'actif' | 'en_attente_paiement',
  ): Promise<void> => {
    const now = new Date();
    const dateFin =
      type === 'mensuel'
        ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
        : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    await AuthService.updateMemberProfile(uid, {
      cotisationType: type,
      cotisationStatus: status,
      cotisationExpiry: dateFin,
    });
  },

  /**
   * Vérifier si la cotisation est active
   */
  isCotisationActive: (profile: MemberProfile | null): boolean => {
    if (!profile || profile.cotisationStatus !== 'actif') {
      return false;
    }

    if (profile.cotisationExpiry) {
      const expiry =
        profile.cotisationExpiry instanceof Date
          ? profile.cotisationExpiry
          : new Date(profile.cotisationExpiry);
      return new Date() < expiry;
    }

    return false;
  },
};

/**
 * Mapper les données Firestore vers MemberProfile
 */
function mapFirestoreToProfile(uid: string, data: any): MemberProfile {
  const user = auth().currentUser;
  const cotisation = data.cotisation || {};

  let cotisationExpiry: Date | undefined;
  if (cotisation.dateFin) {
    cotisationExpiry = cotisation.dateFin.toDate
      ? cotisation.dateFin.toDate()
      : new Date(cotisation.dateFin);
  }

  // Source unique de vérité : computeMemberStatus
  const cotisationStatus = computeMemberStatus({
    status: data.status,
    cotisationDateFin: cotisation.dateFin,
  });

  return {
    uid,
    name:
      `${data.prenom || ''} ${data.nom || ''}`.trim() ||
      user?.displayName ||
      'Membre',
    email: data.email || user?.email || '',
    memberId: data.memberId || generateMemberId(),
    nom: data.nom,
    prenom: data.prenom,
    cotisationType: cotisation.type || null,
    cotisationStatus,
    cotisationExpiry,
    phone: data.telephone || '',
    address: data.adresse || '',
    telephone: data.telephone || '', // Alias français
    adresse: data.adresse || '', // Alias français
    codePostal: data.codePostal || '',
    ville: data.ville || '',
    subscriptionCancelPending: data.subscriptionCancelPending || false,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    lastLoginAt: data.lastLoginAt?.toDate
      ? data.lastLoginAt.toDate()
      : undefined,
  };
}

export default AuthService;
