/**
 * Tests d'integration pour le service Stripe
 * Teste les vrais exports du module stripe.ts
 */

import {
  showPaymentError,
  showPaymentSuccess,
  bankInfo,
  cotisationPrices,
  suggestedDonations,
} from '../stripe';
import { Alert } from 'react-native';

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

describe('Stripe Service - Tests Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // CONSTANTES ET CONFIGURATION
  // ============================================================
  describe('Configuration', () => {
    it('devrait avoir les prix de cotisation corrects', () => {
      expect(cotisationPrices.mensuel.amount).toBe(5);
      expect(cotisationPrices.mensuel.currency).toBe('EUR');
      expect(cotisationPrices.annuel.amount).toBe(50);
      expect(cotisationPrices.annuel.currency).toBe('EUR');
    });

    it('devrait avoir les labels de cotisation', () => {
      expect(cotisationPrices.mensuel.label).toContain('5');
      expect(cotisationPrices.annuel.label).toContain('50');
    });

    it('devrait avoir l\'economie annuelle', () => {
      expect(cotisationPrices.annuel.savings).toBeDefined();
      expect(cotisationPrices.annuel.savings).toContain('10');
    });

    it('devrait avoir les montants de dons suggeres', () => {
      expect(suggestedDonations).toEqual([10, 20, 50, 100, 200]);
      expect(suggestedDonations).toHaveLength(5);
    });

    it('devrait avoir les infos bancaires (sans IBAN)', () => {
      expect(bankInfo.bankName).toBe('Credit Agricole');
      expect(bankInfo.bic).toBe('AGRIFRPP');
      expect(bankInfo.beneficiary).toBe('Association El Mohsinine');
      // BUG 8 FIX: IBAN vide par securite
      expect(bankInfo.iban).toBe('');
    });

    it('devrait avoir le prefixe de reference de don', () => {
      expect(bankInfo.reference).toBe('DON-');
    });
  });

  // ============================================================
  // HELPERS D'AFFICHAGE
  // ============================================================
  describe('showPaymentError', () => {
    it('devrait afficher une alerte d\'erreur', () => {
      showPaymentError('Test error');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Erreur de paiement',
        'Test error',
        [{ text: 'OK' }]
      );
    });

    it('devrait afficher le message d\'erreur exact', () => {
      showPaymentError('Montant invalide');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Erreur de paiement',
        'Montant invalide',
        [{ text: 'OK' }]
      );
    });
  });

  describe('showPaymentSuccess', () => {
    it('devrait afficher un message de succes pour un don', () => {
      showPaymentSuccess('donation');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Paiement réussi',
        expect.stringContaining('don'),
        [{ text: 'OK' }]
      );
    });

    it('devrait inclure Jazak Allah dans le message de don', () => {
      showPaymentSuccess('donation');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Paiement réussi',
        expect.stringContaining('Jazak Allah'),
        [{ text: 'OK' }]
      );
    });

    it('devrait afficher un message de succes pour une cotisation', () => {
      showPaymentSuccess('cotisation');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Paiement réussi',
        expect.stringContaining('cotisation'),
        [{ text: 'OK' }]
      );
    });
  });

  // ============================================================
  // VALIDATION MONTANT (logique locale)
  // ============================================================
  describe('Validation de montant (locale)', () => {
    const MIN_AMOUNT = 1;
    const MAX_AMOUNT = 10000;

    const validateAmount = (amount: number): { valid: boolean; error?: string } => {
      if (typeof amount !== 'number' || isNaN(amount)) {
        return { valid: false, error: 'Montant invalide' };
      }
      if (amount < MIN_AMOUNT) {
        return { valid: false, error: `Le montant minimum est de ${MIN_AMOUNT}€` };
      }
      if (amount > MAX_AMOUNT) {
        return { valid: false, error: `Le montant maximum est de ${MAX_AMOUNT}€` };
      }
      return { valid: true };
    };

    it('devrait accepter un montant valide', () => {
      expect(validateAmount(50).valid).toBe(true);
    });

    it('devrait accepter le montant minimum (1 EUR)', () => {
      expect(validateAmount(1).valid).toBe(true);
    });

    it('devrait accepter le montant maximum (10000 EUR)', () => {
      expect(validateAmount(10000).valid).toBe(true);
    });

    it('devrait rejeter un montant < 1 EUR', () => {
      const result = validateAmount(0.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('minimum');
    });

    it('devrait rejeter un montant > 10000 EUR', () => {
      const result = validateAmount(10001);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum');
    });

    it('devrait rejeter NaN', () => {
      expect(validateAmount(NaN).valid).toBe(false);
      expect(validateAmount(NaN).error).toBe('Montant invalide');
    });

    it('devrait rejeter les montants negatifs', () => {
      expect(validateAmount(-10).valid).toBe(false);
    });
  });

  // ============================================================
  // CONVERSION EUROS / CENTIMES
  // ============================================================
  describe('eurosToCents', () => {
    const eurosToCents = (euros: number): number => Math.round(euros * 100);

    it('devrait convertir correctement les euros entiers', () => {
      expect(eurosToCents(50)).toBe(5000);
    });

    it('devrait convertir les decimales', () => {
      expect(eurosToCents(10.50)).toBe(1050);
      expect(eurosToCents(9.99)).toBe(999);
    });

    it('devrait arrondir correctement', () => {
      expect(eurosToCents(10.555)).toBe(1056);
    });
  });
});
