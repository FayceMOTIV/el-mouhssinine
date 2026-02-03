/**
 * Service d'authentification Firebase - Production
 * Utilise Firebase Auth pour l'authentification réelle
 */
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils';

const AUTH_STORAGE_KEY = '@auth_user_profile';

export interface MemberProfile {
  uid: string;
  name: string;
  email: string;
  memberId: string;
  nom?: string;
  prenom?: string;
  cotisationType: 'mensuel' | 'annuel' | null;
  cotisationStatus: 'none' | 'active' | 'expired' | 'pending';
  cotisationExpiry?: Date;
  phone?: string;
  address?: string;
  telephone?: string; // Alias français pour phone
  adresse?: string;   // Alias français pour address
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
    'auth/invalid-email': 'L\'adresse email n\'est pas valide.',
    'auth/user-disabled': 'Ce compte a été désactivé.',
    // SÉCURITÉ: Message générique pour éviter l'énumération d'emails
    'auth/user-not-found': 'Email ou mot de passe incorrect.',
    'auth/wrong-password': 'Email ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Cette adresse email est déjà utilisée.',
    'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
    'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre connexion internet.',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  };
  return errorMessages[errorCode] || 'Une erreur est survenue. Veuillez réessayer.';
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
    dateNaissance?: string
  ): Promise<AuthResult> => {
    let user: FirebaseAuthTypes.User | null = null;

    try {
      // Créer l'utilisateur dans Firebase Auth
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      user = userCredential.user;

      // Mettre à jour le displayName
      await user.updateProfile({ displayName: name });

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
          type: 'annuel',
          montant: 0,
          dateDebut: null,
          dateFin: null
        },
        actif: true,
        memberId: memberId,
        uid: user.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        source: 'mobile_app'
      };

      // Retry Firestore document creation (max 3 tentatives)
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 500; // ms
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await firestore().collection('members').doc(user.uid).set(profileData);
          logger.auth('Inscription réussie', email, memberId);
          return { success: true, user };
        } catch (firestoreError) {
          lastError = firestoreError as Error;
          logger.warn(`[Auth] Firestore attempt ${attempt}/${MAX_RETRIES} failed`);

          if (attempt < MAX_RETRIES) {
            // Attendre avant de réessayer
            await new Promise<void>(resolve => setTimeout(() => resolve(), RETRY_DELAY * attempt));
          }
        }
      }

      // Toutes les tentatives Firestore ont échoué
      // Rollback: supprimer le compte Auth pour éviter un état incohérent
      logger.error('[Auth] Firestore failed after retries, rolling back Auth account');
      try {
        await user.delete();
        logger.log('[Auth] Auth account rolled back successfully');
      } catch (deleteError) {
        // Log mais ne pas masquer l'erreur Firestore
        logger.error('[Auth] Failed to rollback Auth account', deleteError);
      }

      return {
        success: false,
        error: 'Erreur lors de la création du profil. Veuillez réessayer.'
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('[Auth] Erreur inscription', err);
      return {
        success: false,
        error: getErrorMessage(err.code || '')
      };
    }
  },

  /**
   * Connexion d'un membre existant avec Firebase Auth
   */
  signIn: async (email: string, password: string): Promise<AuthResult> => {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      logger.auth('Connexion réussie', email);
      return { success: true, user: userCredential.user };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      logger.error('[Auth] Erreur connexion', err);
      return {
        success: false,
        error: getErrorMessage(err.code || '')
      };
    }
  },

  /**
   * Déconnexion avec Firebase Auth
   */
  signOut: async (): Promise<void> => {
    try {
      await auth().signOut();
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
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
      await auth().sendPasswordResetEmail(email);
      logger.auth('Email de réinitialisation envoyé', email);
      return { success: true };
    } catch (error) {
      const err = error as { code?: string };
      logger.error('[Auth] Erreur reset password', err);
      return {
        success: false,
        error: getErrorMessage(err.code || '')
      };
    }
  },

  /**
   * Écouter les changements d'état d'authentification Firebase
   */
  onAuthStateChanged: (
    callback: (user: FirebaseAuthTypes.User | null) => void
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
   * Obtenir le profil membre depuis Firestore
   */
  getMemberProfile: async (uid: string): Promise<MemberProfile | null> => {
    try {
      const user = auth().currentUser;
      const userEmail = user?.email?.toLowerCase();

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
        logger.log('[Auth] Création profil de base pour:', uid.substring(0, 8) + '...');
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
            dateFin: null
          },
          actif: true,
          memberId: memberId,
          uid: uid,
          createdAt: firestore.FieldValue.serverTimestamp(),
          source: 'auto_created'
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
          cotisationStatus: 'none',
          phone: '',
          address: '',
          telephone: '', // Alias français
          adresse: '',   // Alias français
          createdAt: new Date(),
        };
      }

      logger.log('[Auth] Profil membre non trouvé et pas d\'utilisateur connecté');
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
    updates: Partial<MemberProfile>
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
    status: 'active' | 'pending'
  ): Promise<void> => {
    const now = new Date();
    const dateFin = type === 'mensuel'
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
    if (!profile || profile.cotisationStatus !== 'active') {
      return false;
    }

    if (profile.cotisationExpiry) {
      const expiry = profile.cotisationExpiry instanceof Date
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

  // Calculer le statut de cotisation
  let cotisationStatus: 'none' | 'active' | 'expired' | 'pending' = 'none';
  let cotisationExpiry: Date | undefined;

  if (cotisation.dateFin) {
    const dateFin = cotisation.dateFin.toDate ? cotisation.dateFin.toDate() : new Date(cotisation.dateFin);
    cotisationExpiry = dateFin;

    if (new Date() < dateFin) {
      cotisationStatus = 'active';
    } else {
      cotisationStatus = 'expired';
    }
  }

  return {
    uid,
    name: `${data.prenom || ''} ${data.nom || ''}`.trim() || user?.displayName || 'Membre',
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
    adresse: data.adresse || '',     // Alias français
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : undefined,
  };
}

export default AuthService;
