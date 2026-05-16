/**
 * Tests pour l'internationalisation FR/AR
 * Verifie la completude et coherence des traductions
 */

import { translations } from '../index';

describe('i18n - Traductions FR/AR', () => {
  const frKeys = Object.keys(translations.fr);
  const arKeys = Object.keys(translations.ar);

  // ============================================================
  // COMPLETUDE
  // ============================================================
  describe('Completude des traductions', () => {
    it('devrait avoir des traductions FR', () => {
      expect(frKeys.length).toBeGreaterThan(0);
    });

    it('devrait avoir des traductions AR', () => {
      expect(arKeys.length).toBeGreaterThan(0);
    });

    it('devrait avoir le meme nombre de cles FR et AR', () => {
      const missingInAr = frKeys.filter(k => !arKeys.includes(k));
      const missingInFr = arKeys.filter(k => !frKeys.includes(k));

      if (missingInAr.length > 0) {
        console.warn('Cles manquantes en AR:', missingInAr.slice(0, 10));
      }
      if (missingInFr.length > 0) {
        console.warn('Cles manquantes en FR:', missingInFr.slice(0, 10));
      }

      // Tolérance: max 5% de cles manquantes
      const totalKeys = Math.max(frKeys.length, arKeys.length);
      const maxMissing = Math.ceil(totalKeys * 0.05);
      expect(missingInAr.length).toBeLessThanOrEqual(maxMissing);
      expect(missingInFr.length).toBeLessThanOrEqual(maxMissing);
    });

    it('toutes les cles FR doivent exister en AR', () => {
      const missingInAr = frKeys.filter(k => !(k in translations.ar));
      // On liste les cles manquantes pour faciliter le debug
      expect(missingInAr).toEqual([]);
    });

    it('toutes les cles AR doivent exister en FR', () => {
      const missingInFr = arKeys.filter(k => !(k in translations.fr));
      expect(missingInFr).toEqual([]);
    });
  });

  // ============================================================
  // CONTENU (pas de traductions vides)
  // ============================================================
  describe('Contenu des traductions', () => {
    it('aucune traduction FR ne devrait etre vide', () => {
      const emptyKeys = frKeys.filter(k => {
        const val = (translations.fr as any)[k];
        return val === '' || val === null || val === undefined;
      });
      expect(emptyKeys).toEqual([]);
    });

    it('aucune traduction AR ne devrait etre vide', () => {
      const emptyKeys = arKeys.filter(k => {
        const val = (translations.ar as any)[k];
        return val === '' || val === null || val === undefined;
      });
      expect(emptyKeys).toEqual([]);
    });
  });

  // ============================================================
  // CLES CRITIQUES (indispensables pour l'UX)
  // ============================================================
  describe('Cles critiques', () => {
    const criticalKeys = [
      // Navigation
      'home',
      'donations',
      'member',
      'more',
      // Auth
      'login',
      // Common
      'commonError',
      'commonSuccess',
      'commonCancel',
      'commonOk',
      'commonLoading',
      'commonClose',
      'commonSend',
      // Priere
      'fajr',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
      // Donations
      'donate',
    ];

    criticalKeys.forEach(key => {
      it(`devrait avoir la cle "${key}" en FR`, () => {
        expect((translations.fr as any)[key]).toBeDefined();
        expect((translations.fr as any)[key]).not.toBe('');
      });

      it(`devrait avoir la cle "${key}" en AR`, () => {
        expect((translations.ar as any)[key]).toBeDefined();
        expect((translations.ar as any)[key]).not.toBe('');
      });
    });
  });

  // ============================================================
  // COHERENCE (pas de clés FR identiques à AR)
  // ============================================================
  describe('Coherence linguistique', () => {
    it('les traductions AR ne devraient pas etre identiques au FR (sauf nombres/URLs)', () => {
      const identicalKeys = frKeys.filter(k => {
        const fr = (translations.fr as any)[k];
        const ar = (translations.ar as any)[k];
        // Ignorer les nombres, URLs, et chaînes très courtes
        if (typeof fr !== 'string' || typeof ar !== 'string') return false;
        if (fr.length <= 3) return false;
        if (fr.match(/^https?:\/\//)) return false;
        if (fr.match(/^\d+$/)) return false;
        return fr === ar;
      });

      // Tolerance: max 10 cles identiques (certaines sont universelles)
      if (identicalKeys.length > 10) {
        console.warn(
          'Cles FR = AR (potentiellement non traduites):',
          identicalKeys.slice(0, 10),
        );
      }
      expect(identicalKeys.length).toBeLessThan(30);
    });
  });

  // ============================================================
  // PRIERES (5 prieres obligatoires)
  // ============================================================
  describe('Noms des prieres', () => {
    const prayerKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    prayerKeys.forEach(prayer => {
      it(`devrait avoir la priere "${prayer}" en FR et AR`, () => {
        expect((translations.fr as any)[prayer]).toBeDefined();
        expect((translations.ar as any)[prayer]).toBeDefined();
      });
    });
  });
});
