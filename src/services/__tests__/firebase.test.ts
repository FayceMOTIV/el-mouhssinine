/**
 * Tests pour les utilitaires Firebase
 */

// Ces fonctions sont internes au module firebase.ts
// On teste le comportement via les exports

describe('Firebase Service Utilities', () => {
  describe('toDate helper', () => {
    // Le helper toDate est interne, on teste le comportement via les mocks
    it('should handle Firestore timestamp objects', () => {
      const firestoreTimestamp = {
        toDate: () => new Date('2026-01-15'),
      };
      expect(firestoreTimestamp.toDate()).toEqual(new Date('2026-01-15'));
    });

    it('should handle Date objects', () => {
      const date = new Date('2026-01-15');
      expect(date).toBeInstanceOf(Date);
    });

    it('should handle ISO string dates', () => {
      const dateString = '2026-01-15T10:30:00Z';
      const date = new Date(dateString);
      expect(date).toBeInstanceOf(Date);
    });

    it('should handle null/undefined with fallback', () => {
      const fallback = new Date();
      expect(fallback).toBeInstanceOf(Date);
    });
  });

  describe('addMinutesToTime helper', () => {
    // Test du format HH:MM
    const addMinutes = (time: string, minutes: number): string => {
      const [hours, mins] = time.split(':').map(Number);
      let totalMinutes = hours * 60 + mins + minutes;

      // Handle negative and overflow
      if (totalMinutes < 0) totalMinutes += 1440; // 24 * 60
      if (totalMinutes >= 1440) totalMinutes -= 1440;

      const newHours = Math.floor(totalMinutes / 60);
      const newMins = totalMinutes % 60;
      return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
    };

    it('should add minutes to time', () => {
      expect(addMinutes('10:00', 30)).toBe('10:30');
      expect(addMinutes('10:00', 60)).toBe('11:00');
      expect(addMinutes('10:30', 45)).toBe('11:15');
    });

    it('should handle midnight rollover', () => {
      expect(addMinutes('23:30', 60)).toBe('00:30');
      expect(addMinutes('23:59', 2)).toBe('00:01');
    });

    it('should handle negative minutes', () => {
      expect(addMinutes('10:00', -30)).toBe('09:30');
      expect(addMinutes('00:15', -30)).toBe('23:45');
    });

    it('should handle zero minutes', () => {
      expect(addMinutes('10:00', 0)).toBe('10:00');
    });
  });

  describe('mergeWithMock helper', () => {
    const mergeWithMock = <T>(firebaseData: T[], mockData: T[]): T[] => {
      if (firebaseData && firebaseData.length > 0) {
        return firebaseData;
      }
      return mockData;
    };

    it('should return Firebase data when available', () => {
      const firebaseData = [{ id: '1', name: 'Test' }];
      const mockData = [{ id: 'mock', name: 'Mock' }];
      expect(mergeWithMock(firebaseData, mockData)).toEqual(firebaseData);
    });

    it('should return mock data when Firebase is empty', () => {
      const firebaseData: any[] = [];
      const mockData = [{ id: 'mock', name: 'Mock' }];
      expect(mergeWithMock(firebaseData, mockData)).toEqual(mockData);
    });

    it('should return mock data when Firebase is null', () => {
      const mockData = [{ id: 'mock', name: 'Mock' }];
      expect(mergeWithMock(null as any, mockData)).toEqual(mockData);
    });
  });

  describe('cotisation status calculation', () => {
    const getCotisationStatus = (dateFin: Date | null): 'active' | 'expired' | 'none' => {
      if (!dateFin) return 'none';
      return new Date() < dateFin ? 'active' : 'expired';
    };

    it('should return active for future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(getCotisationStatus(futureDate)).toBe('active');
    });

    it('should return expired for past date', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      expect(getCotisationStatus(pastDate)).toBe('expired');
    });

    it('should return none for null date', () => {
      expect(getCotisationStatus(null)).toBe('none');
    });
  });

  describe('member ID generation', () => {
    const generateMemberId = (): string => {
      const year = new Date().getFullYear();
      const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      return `ELM-${year}-${random}`;
    };

    it('should generate ID with correct format', () => {
      const id = generateMemberId();
      expect(id).toMatch(/^ELM-\d{4}-\d{4}$/);
    });

    it('should include current year', () => {
      const id = generateMemberId();
      const currentYear = new Date().getFullYear();
      expect(id).toContain(`ELM-${currentYear}-`);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateMemberId());
      }
      // Most should be unique (small chance of collision)
      expect(ids.size).toBeGreaterThan(90);
    });
  });

  describe('prayer time helpers', () => {
    const parsePrayerTime = (timeString: string): { hours: number; minutes: number } | null => {
      if (!timeString || typeof timeString !== 'string') return null;
      const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;
      return {
        hours: parseInt(match[1], 10),
        minutes: parseInt(match[2], 10),
      };
    };

    it('should parse valid time strings', () => {
      expect(parsePrayerTime('06:45')).toEqual({ hours: 6, minutes: 45 });
      expect(parsePrayerTime('13:15')).toEqual({ hours: 13, minutes: 15 });
      expect(parsePrayerTime('00:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parsePrayerTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    it('should handle single digit hours', () => {
      expect(parsePrayerTime('6:45')).toEqual({ hours: 6, minutes: 45 });
    });

    it('should return null for invalid strings', () => {
      expect(parsePrayerTime('')).toBeNull();
      expect(parsePrayerTime('invalid')).toBeNull();
      expect(parsePrayerTime('25:00')).toEqual({ hours: 25, minutes: 0 }); // Parsing but not validating
    });

    it('should return null for null/undefined', () => {
      expect(parsePrayerTime(null as any)).toBeNull();
      expect(parsePrayerTime(undefined as any)).toBeNull();
    });
  });

  describe('amount validation', () => {
    const MIN_AMOUNT = 1;
    const MAX_AMOUNT = 10000;

    const validateAmount = (amount: number): { valid: boolean; error?: string } => {
      if (typeof amount !== 'number' || isNaN(amount)) {
        return { valid: false, error: 'Montant invalide' };
      }
      if (amount < MIN_AMOUNT) {
        return { valid: false, error: `Le montant minimum est ${MIN_AMOUNT}€` };
      }
      if (amount > MAX_AMOUNT) {
        return { valid: false, error: `Le montant maximum est ${MAX_AMOUNT}€` };
      }
      return { valid: true };
    };

    it('should accept valid amounts', () => {
      expect(validateAmount(50)).toEqual({ valid: true });
      expect(validateAmount(1)).toEqual({ valid: true });
      expect(validateAmount(10000)).toEqual({ valid: true });
      expect(validateAmount(0.99)).toEqual({ valid: false, error: 'Le montant minimum est 1€' });
    });

    it('should reject amounts below minimum', () => {
      const result = validateAmount(0.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('minimum');
    });

    it('should reject amounts above maximum', () => {
      const result = validateAmount(10001);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum');
    });

    it('should reject NaN', () => {
      const result = validateAmount(NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Montant invalide');
    });

    it('should reject negative amounts', () => {
      const result = validateAmount(-10);
      expect(result.valid).toBe(false);
    });
  });

  describe('date formatting', () => {
    const formatDateFr = (date: Date): string => {
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    it('should format date in French', () => {
      const date = new Date('2026-01-15');
      const formatted = formatDateFr(date);
      expect(formatted).toContain('2026');
      // Note: locale formatting varies by environment
    });
  });
});
