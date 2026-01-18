/**
 * Service d'authentification Firebase - Production
 * Utilise Firebase Auth pour l'authentification réelle
 */
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
const getErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    'auth/invalid-email': 'L\'adresse email n\'est pas valide.',
    'auth/user-disabled': 'Ce compte a été désactivé.',
    'auth/user-not-found': 'Aucun compte ne correspond à cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
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
   */
  signUp: async (
    email: string,
    password: string,
    name: string,
    telephone?: string,
    adresse?: string
  ): Promise<AuthResult> => {
    try {
      // Créer l'utilisateur dans Firebase Auth
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Mettre à jour le displayName
      await user.updateProfile({ displayName: name });

      // Créer le profil membre dans Firestore
      const memberId = generateMemberId();
      const nameParts = name.trim().split(' ');
      const prenom = nameParts[0] || '';
      const nom = nameParts.slice(1).join(' ') || prenom;

      await firestore().collection('members').doc(user.uid).set({
        nom: nom,
        prenom: prenom,
        email: email,
        telephone: telephone || '',
        adresse: adresse || '',
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
      });

      console.log('[Auth] ✅ Inscription réussie:', email, memberId);
      return { success: true, user };
    } catch (error: any) {
      console.error('[Auth] ❌ Erreur inscription:', error.code, error.message);
      return {
        success: false,
        error: getErrorMessage(error.code)
      };
    }
  },

  /**
   * Connexion d'un membre existant avec Firebase Auth
   */
  signIn: async (email: string, password: string): Promise<AuthResult> => {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      console.log('[Auth] ✅ Connexion réussie:', email);
      return { success: true, user: userCredential.user };
    } catch (error: any) {
      console.error('[Auth] ❌ Erreur connexion:', error.code, error.message);
      return {
        success: false,
        error: getErrorMessage(error.code)
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
      console.log('[Auth] Déconnexion réussie');
    } catch (error) {
      console.error('[Auth] Erreur déconnexion:', error);
    }
  },

  /**
   * Réinitialisation du mot de passe via Firebase
   */
  resetPassword: async (email: string): Promise<AuthResult> => {
    try {
      await auth().sendPasswordResetEmail(email);
      console.log('[Auth] Email de réinitialisation envoyé à:', email);
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Erreur reset password:', error.code);
      return {
        success: false,
        error: getErrorMessage(error.code)
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
          console.log('[Auth] Champs manquants ajoutés:', Object.keys(updates));
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
          console.log('[Auth] Membre trouvé par email:', userEmail);
          return processAndReturnProfile(memberDoc, memberDoc.data());
        }
      }

      // Pas de profil trouvé - CRÉER UN PROFIL DE BASE
      // (Cas où le compte Auth existe mais pas le document Firestore)
      if (user) {
        console.log('[Auth] Création profil de base pour:', uid, userEmail);
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
        console.log('[Auth] Profil créé automatiquement:', memberId);

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

      console.log('[Auth] Profil membre non trouvé et pas d\'utilisateur connecté');
      return null;
    } catch (error) {
      console.error('[Auth] Erreur récupération profil:', error);
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
        console.log('[Auth] Profil mis à jour');
      } else {
        // Essayer avec doc ID
        await firestore().collection('members').doc(uid).update(updates);
      }
    } catch (error) {
      console.error('[Auth] Erreur mise à jour profil:', error);
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
