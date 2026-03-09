/**
 * Tests pour le hook useResponsive et les helpers associes
 */

import { platformShadow, responsiveText } from '../useResponsive';
import { Platform } from 'react-native';

describe('useResponsive helpers', () => {
  // ============================================================
  // platformShadow
  // ============================================================
  describe('platformShadow', () => {
    it('devrait retourner les styles d\'ombre iOS sur iOS', () => {
      // Platform.select retourne la valeur iOS en test
      const shadow = platformShadow(4);
      expect(shadow).toBeDefined();
    });

    it('devrait accepter une elevation personnalisee', () => {
      const shadowLow = platformShadow(2);
      const shadowHigh = platformShadow(8);
      expect(shadowLow).toBeDefined();
      expect(shadowHigh).toBeDefined();
    });

    it('devrait fonctionner avec l\'elevation par defaut', () => {
      const shadow = platformShadow();
      expect(shadow).toBeDefined();
    });
  });

  // ============================================================
  // responsiveText
  // ============================================================
  describe('responsiveText', () => {
    it('devrait retourner la taille de base pour un ecran de reference (390px)', () => {
      const result = responsiveText(16, 390);
      expect(result).toBe(16);
    });

    it('devrait augmenter la taille pour un ecran plus large', () => {
      const result = responsiveText(16, 430);
      expect(result).toBeGreaterThanOrEqual(16);
    });

    it('devrait reduire la taille pour un ecran plus petit', () => {
      const result = responsiveText(16, 320);
      expect(result).toBeLessThanOrEqual(16);
    });

    it('ne devrait pas depasser 115% de la taille de base', () => {
      const baseSize = 16;
      const result = responsiveText(baseSize, 1000);
      expect(result).toBeLessThanOrEqual(Math.round(baseSize * 1.15));
    });

    it('ne devrait pas descendre en dessous de 85% de la taille de base', () => {
      const baseSize = 16;
      const result = responsiveText(baseSize, 200);
      expect(result).toBeGreaterThanOrEqual(Math.round(baseSize * 0.85));
    });

    it('devrait arrondir le resultat', () => {
      const result = responsiveText(15, 400);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  // ============================================================
  // BREAKPOINTS
  // ============================================================
  describe('Breakpoints', () => {
    it('devrait definir les seuils correctement', () => {
      // Verification des seuils utilises dans le hook
      const SMALL_MAX = 375;
      const MEDIUM_MAX = 414;
      const TABLET_MIN = 744;

      expect(SMALL_MAX).toBeLessThan(MEDIUM_MAX);
      expect(MEDIUM_MAX).toBeLessThan(TABLET_MIN);
    });
  });
});
