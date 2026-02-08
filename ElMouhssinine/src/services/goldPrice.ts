/**
 * Service pour le calcul du Nisab basé sur le cours de l'or
 * Nisab = 85 grammes d'or
 *
 * Utilise l'API gratuite goldprice.org (pas de clé requise)
 */

const GOLD_GRAMS_NISAB = 85;
const DEFAULT_GOLD_PRICE = 135; // €/gramme (fallback - cours approximatif février 2026)
const TROY_OUNCE_TO_GRAMS = 31.1035; // 1 once troy = 31.1035 grammes

// Cache pour éviter trop de requêtes (durée: 1 heure)
let cachedPrice: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure en ms

export interface GoldPriceResult {
  pricePerGram: number;
  isRealTime: boolean;
  timestamp?: Date;
}

/**
 * Récupère le prix de l'or au gramme depuis l'API goldprice.org
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
    // API goldprice.org - gratuite, pas de clé requise
    const response = await fetch('https://data-asg.goldprice.org/dbXRates/EUR', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('API response not ok');
    }

    const data = await response.json();

    // xauPrice = prix par once troy en EUR
    if (data.items && data.items[0] && data.items[0].xauPrice) {
      const pricePerOunce = data.items[0].xauPrice;
      const pricePerGram = Math.round(pricePerOunce / TROY_OUNCE_TO_GRAMS);

      // Mettre en cache
      cachedPrice = pricePerGram;
      cacheTimestamp = now;

      return {
        pricePerGram,
        isRealTime: true,
        timestamp: new Date(),
      };
    }

    throw new Error('Invalid API response format');
  } catch (error) {
    console.log('[GoldPrice] API failed, using fallback price:', error);

    // Fallback si l'API échoue
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
