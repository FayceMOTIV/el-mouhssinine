/**
 * Tests pour le service Gold Price (Zakat / Nisab)
 * API : NBP (prix or PLN/g) + Frankfurter (taux EUR/PLN)
 * Note: les tests qui appellent getGoldPricePerGram utilisent jest.isolateModules
 * car le module a un cache interne qui persiste entre tests.
 */

// Mock fetch globalement
const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

// Import des fonctions pures (pas affectees par le cache)
import { calculateNisab, NISAB_INFO } from '../goldPrice';

// Helpers pour mocker les reponses API
const mockNbpResponse = (cena: number) => ({
  ok: true,
  json: () => Promise.resolve([{ data: '2026-03-02', cena }]),
});

const mockFrankfurterResponse = (plnRate: number) => ({
  ok: true,
  json: () => Promise.resolve({ rates: { PLN: plnRate } }),
});

const mockHttpError = (status = 500) => ({
  ok: false,
  status,
  json: () => Promise.reject(new Error('not ok')),
});

describe('Gold Price Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // CONSTANTES
  // ============================================================
  describe('NISAB_INFO', () => {
    it("devrait utiliser 85 grammes d'or pour le Nisab", () => {
      expect(NISAB_INFO.goldGrams).toBe(85);
    });

    it('devrait utiliser 2.5% comme taux de Zakat', () => {
      expect(NISAB_INFO.zakatRate).toBe(0.025);
    });

    it('devrait avoir un prix par defaut de 141 EUR/g', () => {
      expect(NISAB_INFO.defaultPrice).toBe(141);
    });
  });

  // ============================================================
  // CALCUL NISAB (fonction pure, pas de cache)
  // ============================================================
  describe('calculateNisab', () => {
    it('devrait calculer le Nisab correctement (100 EUR/g = 8500 EUR)', () => {
      expect(calculateNisab(100)).toBe(8500);
    });

    it('devrait arrondir le resultat', () => {
      expect(calculateNisab(135.7)).toBe(Math.round(135.7 * 85));
    });

    it('devrait gerer 0', () => {
      expect(calculateNisab(0)).toBe(0);
    });

    it('devrait calculer avec le prix par defaut (141 * 85 = 11985)', () => {
      const nisab = calculateNisab(NISAB_INFO.defaultPrice);
      expect(nisab).toBe(11985);
    });
  });

  // ============================================================
  // RECUPERATION PRIX OR (avec isolateModules pour le cache)
  // ============================================================
  describe('getGoldPricePerGram', () => {
    it('devrait retourner le prix depuis NBP + Frankfurter', done => {
      jest.isolateModules(() => {
        // NBP: 595.71 PLN/g, Frankfurter: 4.244 EUR/PLN
        // Resultat attendu: Math.round(595.71 / 4.244) = 140
        mockFetch
          .mockResolvedValueOnce(mockNbpResponse(595.71))
          .mockResolvedValueOnce(mockFrankfurterResponse(4.244));

        const { getGoldPricePerGram: fn } = require('../goldPrice');
        fn().then((result: any) => {
          expect(result.pricePerGram).toBe(Math.round(595.71 / 4.244));
          expect(result.isRealTime).toBe(true);
          expect(result.timestamp).toBeInstanceOf(Date);
          expect(mockFetch).toHaveBeenCalledTimes(2);
          done();
        });
      });
    });

    it('devrait retourner le prix fallback (141) si fetch echoue', done => {
      jest.isolateModules(() => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const { getGoldPricePerGram: fn } = require('../goldPrice');
        fn().then((result: any) => {
          expect(result.pricePerGram).toBe(141);
          expect(result.isRealTime).toBe(false);
          expect(result.timestamp).toBeUndefined();
          done();
        });
      });
    });

    it('devrait retourner le fallback si NBP retourne HTTP non-ok', done => {
      jest.isolateModules(() => {
        mockFetch
          .mockResolvedValueOnce(mockHttpError(503))
          .mockResolvedValueOnce(mockFrankfurterResponse(4.244));

        const { getGoldPricePerGram: fn } = require('../goldPrice');
        fn().then((result: any) => {
          expect(result.pricePerGram).toBe(141);
          expect(result.isRealTime).toBe(false);
          done();
        });
      });
    });

    it('devrait retourner le fallback si Frankfurter retourne HTTP non-ok', done => {
      jest.isolateModules(() => {
        mockFetch
          .mockResolvedValueOnce(mockNbpResponse(595.71))
          .mockResolvedValueOnce(mockHttpError(500));

        const { getGoldPricePerGram: fn } = require('../goldPrice');
        fn().then((result: any) => {
          expect(result.pricePerGram).toBe(141);
          expect(result.isRealTime).toBe(false);
          done();
        });
      });
    });

    it('devrait retourner le fallback si NBP retourne des donnees invalides', done => {
      jest.isolateModules(() => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([]), // tableau vide, pas de cena
          })
          .mockResolvedValueOnce(mockFrankfurterResponse(4.244));

        const { getGoldPricePerGram: fn } = require('../goldPrice');
        fn().then((result: any) => {
          expect(result.pricePerGram).toBe(141);
          expect(result.isRealTime).toBe(false);
          done();
        });
      });
    });

    it('devrait retourner le fallback si Frankfurter retourne taux 0', done => {
      jest.isolateModules(() => {
        mockFetch
          .mockResolvedValueOnce(mockNbpResponse(595.71))
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ rates: { PLN: 0 } }),
          });

        const { getGoldPricePerGram: fn } = require('../goldPrice');
        fn().then((result: any) => {
          expect(result.pricePerGram).toBe(141);
          expect(result.isRealTime).toBe(false);
          done();
        });
      });
    });

    it('devrait arrondir le prix au gramme', done => {
      jest.isolateModules(() => {
        // 600 / 4.2 = 142.857... → arrondi à 143
        mockFetch
          .mockResolvedValueOnce(mockNbpResponse(600))
          .mockResolvedValueOnce(mockFrankfurterResponse(4.2));

        const { getGoldPricePerGram: fn } = require('../goldPrice');
        fn().then((result: any) => {
          expect(result.pricePerGram).toBe(Math.round(600 / 4.2));
          expect(result.isRealTime).toBe(true);
          done();
        });
      });
    });
  });

  // ============================================================
  // WRAPPER getGoldPrice (retourne juste le nombre)
  // ============================================================
  describe('getGoldPrice', () => {
    it('devrait retourner juste le prix (nombre) en cas de succes', done => {
      jest.isolateModules(() => {
        mockFetch
          .mockResolvedValueOnce(mockNbpResponse(595.71))
          .mockResolvedValueOnce(mockFrankfurterResponse(4.244));

        const { getGoldPrice: fn } = require('../goldPrice');
        fn().then((price: number) => {
          expect(typeof price).toBe('number');
          expect(price).toBe(Math.round(595.71 / 4.244));
          done();
        });
      });
    });

    it("devrait retourner le prix fallback (nombre) en cas d'erreur", done => {
      jest.isolateModules(() => {
        mockFetch.mockRejectedValue(new Error('timeout'));

        const { getGoldPrice: fn } = require('../goldPrice');
        fn().then((price: number) => {
          expect(typeof price).toBe('number');
          expect(price).toBe(141);
          done();
        });
      });
    });
  });
});
