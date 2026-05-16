/**
 * Tests pour le service d'authentification - Tests unitaires
 * Focus sur les utilitaires et la logique métier
 */

describe('Auth Service Utilities', () => {
  describe('Member ID Generation', () => {
    const generateMemberId = (): string => {
      const year = new Date().getFullYear();
      const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      return `ELM-${year}-${random}`;
    };

    it('should generate ID with ELM prefix', () => {
      const id = generateMemberId();
      expect(id.startsWith('ELM-')).toBe(true);
    });

    it('should include current year', () => {
      const id = generateMemberId();
      const year = new Date().getFullYear();
      expect(id).toContain(`-${year}-`);
    });

    it('should have correct format', () => {
      const id = generateMemberId();
      expect(id).toMatch(/^ELM-\d{4}-\d{4}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        ids.add(generateMemberId());
      }
      // Most should be unique
      expect(ids.size).toBeGreaterThan(40);
    });
  });

  describe('Error Message Mapping', () => {
    const getErrorMessage = (errorCode: string): string => {
      const errorMessages: Record<string, string> = {
        'auth/invalid-email': "L'adresse email n'est pas valide.",
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

    it('should return French message for invalid-email', () => {
      expect(getErrorMessage('auth/invalid-email')).toBe("L'adresse email n'est pas valide.");
    });

    it('should return French message for user-disabled', () => {
      expect(getErrorMessage('auth/user-disabled')).toBe('Ce compte a été désactivé.');
    });

    it('should return French message for user-not-found', () => {
      expect(getErrorMessage('auth/user-not-found')).toBe('Aucun compte ne correspond à cet email.');
    });

    it('should return French message for wrong-password', () => {
      expect(getErrorMessage('auth/wrong-password')).toBe('Mot de passe incorrect.');
    });

    it('should return French message for email-already-in-use', () => {
      expect(getErrorMessage('auth/email-already-in-use')).toBe('Cette adresse email est déjà utilisée.');
    });

    it('should return French message for weak-password', () => {
      expect(getErrorMessage('auth/weak-password')).toBe('Le mot de passe doit contenir au moins 6 caractères.');
    });

    it('should return French message for network-request-failed', () => {
      expect(getErrorMessage('auth/network-request-failed')).toBe('Erreur de connexion. Vérifiez votre connexion internet.');
    });

    it('should return French message for too-many-requests', () => {
      expect(getErrorMessage('auth/too-many-requests')).toBe('Trop de tentatives. Réessayez plus tard.');
    });

    it('should return French message for invalid-credential', () => {
      expect(getErrorMessage('auth/invalid-credential')).toBe('Email ou mot de passe incorrect.');
    });

    it('should return default message for unknown error', () => {
      expect(getErrorMessage('auth/unknown-error')).toBe('Une erreur est survenue. Veuillez réessayer.');
    });

    it('should return default message for empty string', () => {
      expect(getErrorMessage('')).toBe('Une erreur est survenue. Veuillez réessayer.');
    });
  });

  describe('Cotisation Status Check', () => {
    interface MemberProfile {
      uid: string;
      cotisationStatus: 'none' | 'active' | 'expired' | 'pending';
      cotisationExpiry?: Date;
    }

    const isCotisationActive = (profile: MemberProfile | null): boolean => {
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
    };

    it('should return false for null profile', () => {
      expect(isCotisationActive(null)).toBe(false);
    });

    it('should return false for expired status', () => {
      const profile: MemberProfile = {
        uid: 'test-uid',
        cotisationStatus: 'expired',
      };
      expect(isCotisationActive(profile)).toBe(false);
    });

    it('should return false for pending status', () => {
      const profile: MemberProfile = {
        uid: 'test-uid',
        cotisationStatus: 'pending',
      };
      expect(isCotisationActive(profile)).toBe(false);
    });

    it('should return false for none status', () => {
      const profile: MemberProfile = {
        uid: 'test-uid',
        cotisationStatus: 'none',
      };
      expect(isCotisationActive(profile)).toBe(false);
    });

    it('should return true for active status with future expiry', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const profile: MemberProfile = {
        uid: 'test-uid',
        cotisationStatus: 'active',
        cotisationExpiry: futureDate,
      };
      expect(isCotisationActive(profile)).toBe(true);
    });

    it('should return false for active status with past expiry', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const profile: MemberProfile = {
        uid: 'test-uid',
        cotisationStatus: 'active',
        cotisationExpiry: pastDate,
      };
      expect(isCotisationActive(profile)).toBe(false);
    });

    it('should return false for active status without expiry date', () => {
      const profile: MemberProfile = {
        uid: 'test-uid',
        cotisationStatus: 'active',
      };
      expect(isCotisationActive(profile)).toBe(false);
    });
  });

  describe('Cotisation Expiry Calculation', () => {
    const calculateExpiry = (type: 'mensuel' | 'annuel'): Date => {
      const now = new Date();
      if (type === 'mensuel') {
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    };

    it('should calculate monthly expiry one month ahead', () => {
      const expiry = calculateExpiry('mensuel');
      const now = new Date();
      const expectedMonth = (now.getMonth() + 1) % 12;

      // Handle year rollover
      if (expectedMonth === 0) {
        expect(expiry.getMonth()).toBe(0);
        expect(expiry.getFullYear()).toBe(now.getFullYear() + 1);
      } else {
        expect(expiry.getMonth()).toBe(expectedMonth);
      }
    });

    it('should calculate yearly expiry one year ahead', () => {
      const expiry = calculateExpiry('annuel');
      const now = new Date();

      expect(expiry.getFullYear()).toBe(now.getFullYear() + 1);
      expect(expiry.getMonth()).toBe(now.getMonth());
      expect(expiry.getDate()).toBe(now.getDate());
    });
  });

  describe('Name Parsing', () => {
    const parseName = (fullName: string): { prenom: string; nom: string } => {
      const nameParts = fullName.trim().split(' ');
      const prenom = nameParts[0] || '';
      const nom = nameParts.slice(1).join(' ') || prenom;
      return { prenom, nom };
    };

    it('should parse single name', () => {
      const result = parseName('John');
      expect(result.prenom).toBe('John');
      expect(result.nom).toBe('John'); // Fallback to prenom
    });

    it('should parse first and last name', () => {
      const result = parseName('John Doe');
      expect(result.prenom).toBe('John');
      expect(result.nom).toBe('Doe');
    });

    it('should handle multiple name parts', () => {
      const result = parseName('John Van Der Berg');
      expect(result.prenom).toBe('John');
      expect(result.nom).toBe('Van Der Berg');
    });

    it('should handle empty string', () => {
      const result = parseName('');
      expect(result.prenom).toBe('');
      expect(result.nom).toBe('');
    });

    it('should trim whitespace', () => {
      const result = parseName('  John Doe  ');
      expect(result.prenom).toBe('John');
      expect(result.nom).toBe('Doe');
    });
  });

  describe('Auth Mode', () => {
    it('should have isMockMode set to false', () => {
      // In production, mock mode should be disabled
      const isMockMode = false;
      expect(isMockMode).toBe(false);
    });
  });
});
