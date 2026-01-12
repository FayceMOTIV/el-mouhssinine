// Service d'authentification - Mode Mock pour TestFlight
// Les inscriptions sont sauvegardées dans Firestore pour le backoffice
import firestore from '@react-native-firebase/firestore';

export interface MemberProfile {
  uid: string;
  name: string;
  email: string;
  memberId: string;
  cotisationType: 'mensuel' | 'annuel' | null;
  cotisationStatus: 'none' | 'active' | 'expired' | 'pending';
  cotisationExpiry?: Date;
  phone?: string;
  address?: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface AuthResult {
  success: boolean;
  user?: MockUser;
  error?: string;
}

// Mock user type (compatible avec FirebaseAuthTypes.User)
export interface MockUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// Etat local de l'authentification (mock)
let currentUser: MockUser | null = null;
let authStateListeners: ((user: MockUser | null) => void)[] = [];

// Donnees mockees pour le profil
const mockMemberProfile: MemberProfile = {
  uid: 'mock-uid-123',
  name: 'Membre Test',
  email: 'test@elmouhssinine.fr',
  memberId: 'ELM-2025-0001',
  cotisationType: null,
  cotisationStatus: 'none',
  createdAt: new Date(),
  lastLoginAt: new Date(),
};

// Generer un ID membre unique
const generateMemberId = (): string => {
  const year = new Date().getFullYear();
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ELM-${year}-${random}`;
};

// Notifier les listeners
const notifyAuthStateChange = (user: MockUser | null) => {
  authStateListeners.forEach(listener => listener(user));
};

export const AuthService = {
  // Mode mock actif
  isMockMode: true,

  // Inscription d'un nouveau membre (mock mais sauvegarde dans Firestore)
  signUp: async (
    email: string,
    password: string,
    name: string
  ): Promise<AuthResult> => {
    // Simuler un delai reseau
    await new Promise<void>(resolve => setTimeout(resolve, 500));

    // Validation basique
    if (!email.includes('@')) {
      return { success: false, error: 'L\'adresse email n\'est pas valide.' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Le mot de passe est trop faible (minimum 6 caracteres).' };
    }

    // Creer un utilisateur mock
    const mockUser: MockUser = {
      uid: `mock-${Date.now()}`,
      email,
      displayName: name,
    };

    // IMPORTANT: Sauvegarder dans Firestore pour le backoffice
    try {
      const memberId = generateMemberId();
      const nameParts = name.trim().split(' ');
      const prenom = nameParts[0] || '';
      const nom = nameParts.slice(1).join(' ') || prenom;

      await firestore().collection('members').add({
        nom: nom,
        prenom: prenom,
        email: email,
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
        uid: mockUser.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        source: 'mobile_app' // Pour identifier les inscriptions depuis l'app
      });
      console.log('[Auth] ✅ Membre sauvegardé dans Firestore:', email, memberId);
    } catch (error) {
      console.error('[Auth] ❌ Erreur sauvegarde Firestore:', error);
      // On continue malgré l'erreur pour ne pas bloquer l'inscription
    }

    currentUser = mockUser;
    notifyAuthStateChange(mockUser);

    console.log('[Auth Mock] Inscription reussie:', email);
    return { success: true, user: mockUser };
  },

  // Connexion d'un membre existant (mock)
  signIn: async (email: string, password: string): Promise<AuthResult> => {
    // Simuler un delai reseau
    await new Promise<void>(resolve => setTimeout(resolve, 500));

    // Validation basique
    if (!email.includes('@')) {
      return { success: false, error: 'L\'adresse email n\'est pas valide.' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Email ou mot de passe incorrect.' };
    }

    // Creer un utilisateur mock
    const mockUser: MockUser = {
      uid: 'mock-uid-123',
      email,
      displayName: email.split('@')[0],
    };

    currentUser = mockUser;
    notifyAuthStateChange(mockUser);

    console.log('[Auth Mock] Connexion reussie:', email);
    return { success: true, user: mockUser };
  },

  // Deconnexion (mock)
  signOut: async (): Promise<void> => {
    await new Promise<void>(resolve => setTimeout(resolve, 200));
    currentUser = null;
    notifyAuthStateChange(null);
    console.log('[Auth Mock] Deconnexion');
  },

  // Reinitialisation du mot de passe (mock)
  resetPassword: async (email: string): Promise<AuthResult> => {
    await new Promise<void>(resolve => setTimeout(resolve, 500));

    if (!email.includes('@')) {
      return { success: false, error: 'L\'adresse email n\'est pas valide.' };
    }

    console.log('[Auth Mock] Email de reinitialisation envoye a:', email);
    return { success: true };
  },

  // Ecouter les changements d'etat d'authentification
  onAuthStateChanged: (
    callback: (user: MockUser | null) => void
  ): (() => void) => {
    authStateListeners.push(callback);
    // Appeler immediatement avec l'etat actuel
    setTimeout(() => callback(currentUser), 0);

    // Retourner la fonction de desinscription
    return () => {
      authStateListeners = authStateListeners.filter(l => l !== callback);
    };
  },

  // Obtenir l'utilisateur actuel
  getCurrentUser: (): MockUser | null => {
    return currentUser;
  },

  // Obtenir le profil membre (mock)
  getMemberProfile: async (uid: string): Promise<MemberProfile | null> => {
    await new Promise<void>(resolve => setTimeout(resolve, 300));

    if (currentUser) {
      return {
        ...mockMemberProfile,
        uid,
        name: currentUser.displayName || 'Membre',
        email: currentUser.email || '',
        memberId: generateMemberId(),
      };
    }

    return null;
  },

  // Mettre a jour le profil membre (mock)
  updateMemberProfile: async (
    uid: string,
    updates: Partial<MemberProfile>
  ): Promise<void> => {
    await new Promise<void>(resolve => setTimeout(resolve, 300));
    console.log('[Auth Mock] Profil mis a jour:', updates);
  },

  // Mettre a jour la cotisation (mock)
  updateCotisation: async (
    uid: string,
    type: 'mensuel' | 'annuel',
    status: 'active' | 'pending'
  ): Promise<void> => {
    await new Promise<void>(resolve => setTimeout(resolve, 300));
    console.log('[Auth Mock] Cotisation mise a jour:', { type, status });
  },

  // Verifier si la cotisation est active
  isCotisationActive: (profile: MemberProfile | null): boolean => {
    if (!profile || profile.cotisationStatus !== 'active') {
      return false;
    }

    if (profile.cotisationExpiry) {
      return new Date() < profile.cotisationExpiry;
    }

    return false;
  },
};

export default AuthService;
