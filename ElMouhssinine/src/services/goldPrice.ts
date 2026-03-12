/**
 * Service pour le calcul du Nisab basé sur le cours de l'or
 * Nisab = 85 grammes d'or
 *
 * Stratégie API :
 * 1. NBP (Banque Nationale de Pologne) → prix or en PLN/gramme (gratuit, sans clé)
 * 2. Frankfurter → taux EUR/PLN (gratuit, sans clé)
 * 3. Fallback → prix statique 141€/g (mars 2026)
 */

const GOLD_GRAMS_NISAB = 85;
const DEFAULT_GOLD_PRICE = 141; // €/gramme (fallback - cours mars 2026)

// Cache pour éviter trop de requêtes (durée: 6 heures)
let cachedPrice: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 heures en ms

export interface GoldPriceResult {
  pricePerGram: number;
  isRealTime: boolean;
  timestamp?: Date;
}

/**
 * Récupère le prix de l'or au gramme en EUR via NBP + Frankfurter
 * @returns Prix en €/gramme et indicateur temps réel
 */
export const getGoldPricePerGram = async (): Promise<GoldPriceResult> => {
  // Vérifier le cache
  const now = Date.now();
  if (cachedPrice !== null && (now - cacheTimestamp) < CACHE_DURATION) {
    return {
      pricePerGram: cachedPrice,
      isRealTime: true,
      timestamp: new Date(cacheTimestamp),
    };
  }

  try {
    // Étape 1 : Prix or en PLN/gramme (NBP - gratuit, sans clé)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const [goldRes, fxRes] = await Promise.all([
      fetch('https://api.nbp.pl/api/cenyzlota?format=json', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }),
      // Étape 2 : Taux EUR/PLN (Frankfurter - gratuit, sans clé)
      fetch('https://api.frankfurter.app/latest?from=EUR&to=PLN', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }),
    ]);
    clearTimeout(timeout);

    if (!goldRes.ok || !fxRes.ok) {
      throw new Error(`API response not ok: gold=${goldRes.status} fx=${fxRes.status}`);
    }

    const goldData = await goldRes.json();
    const fxData = await fxRes.json();

    const goldPricePLN = goldData?.[0]?.cena;
    const eurToPln = fxData?.rates?.PLN;

    if (!goldPricePLN || !eurToPln || eurToPln === 0) {
      throw new Error('Invalid API data');
    }

    const pricePerGram = Math.round(goldPricePLN / eurToPln);

    // Mettre en cache
    cachedPrice = pricePerGram;
    cacheTimestamp = now;

    return {
      pricePerGram,
      isRealTime: true,
      timestamp: new Date(),
    };
  } catch (error) {
    console.log('[GoldPrice] APIs failed, using fallback price:', error);

    // Fallback si les APIs échouent
    return {
      pricePerGram: DEFAULT_GOLD_PRICE,
      isRealTime: false,
    };
  }
};

/**
 * Version simple qui retourne juste le prix (pour compatibilité)
 */
export const getGoldPrice = async (): Promise<number> => {
  const result = await getGoldPricePerGram();
  return result.pricePerGram;
};

/**
 * Calcule le Nisab en euros basé sur le prix de l'or
 * @param goldPricePerGram Prix de l'or au gramme en euros
 * @returns Nisab en euros (arrondi)
 */
export const calculateNisab = (goldPricePerGram: number): number => {
  return Math.round(goldPricePerGram * GOLD_GRAMS_NISAB);
};

/**
 * Informations sur le Nisab
 */
export const NISAB_INFO = {
  goldGrams: GOLD_GRAMS_NISAB,
  zakatRate: 0.025, // 2.5%
  defaultPrice: DEFAULT_GOLD_PRICE,
};

export default {
  getGoldPricePerGram,
  getGoldPrice,
  calculateNisab,
  NISAB_INFO,
};
