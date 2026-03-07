import { Alert, Platform } from 'react-native';
import {
  initPaymentSheet,
  presentPaymentSheet,
  isPlatformPaySupported,
  confirmPlatformPayPayment,
  PlatformPay,
} from '@stripe/stripe-react-native';
import { firebase } from '@react-native-firebase/functions';
import { logger } from '../utils';

// Types
export interface PaymentParams {
  amount: number; // en euros
  description: string;
  type: 'donation' | 'cotisation';
  metadata?: {
    projectId?: string;
    projectName?: string;
    memberId?: string;
    memberIdDisplay?: string; // Format ELM-XXXX pour affichage
    memberName?: string;
    email?: string;
    donorEmail?: string; // Email du donateur pour reçus fiscaux
    donorUid?: string; // UID Firebase du donateur
    isAnonymous?: boolean;
    period?: string;
    membersCount?: string; // Nombre de membres pour multi-adhésion
    montantCotisation?: number;
    montantDon?: number;
  };
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  paymentIntentId?: string;
  error?: string;
}

// Convertir euros en centimes pour Stripe
const eurosToCents = (euros: number): number => Math.round(euros * 100);

// Créer un PaymentIntent via Cloud Function
const createPaymentIntent = async (
  amount: number,
  description: string,
  metadata: Record<string, any>,
): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  try {
    logger.log('[Stripe] createPaymentIntent appelé:', {
      amount: eurosToCents(amount),
      description,
    });
    const createPayment = firebase
      .app()
      .functions('europe-west1')
      .httpsCallable('createPaymentIntent');
    const result = await createPayment({
      amount: eurosToCents(amount),
      currency: 'eur',
      description,
      metadata,
    });

    const data = result.data as {
      clientSecret: string;
      paymentIntentId: string;
    };
    logger.log('[Stripe] PaymentIntent reçu:', data.paymentIntentId);
    return data;
  } catch (error) {
    const err = error as Error;
    logger.error(
      '[Stripe] Erreur création PaymentIntent: ' + err?.message,
      err,
    );
    throw new Error(err?.message || 'Erreur lors de la création du paiement');
  }
};

// Créer un Subscription via Cloud Function
const createSubscription = async (
  amount: number,
  description: string,
  metadata: Record<string, any>,
): Promise<{
  clientSecret: string;
  subscriptionId: string;
  paymentIntentId: string;
}> => {
  try {
    const createSub = firebase
      .app()
      .functions('europe-west1')
      .httpsCallable('createSubscription');
    const result = await createSub({
      amount: eurosToCents(amount),
      description,
      metadata,
    });

    const data = result.data as {
      clientSecret: string;
      subscriptionId: string;
      paymentIntentId: string;
    };
    return data;
  } catch (error) {
    const err = error as Error;
    logger.error('Erreur création Subscription:', err);
    throw new Error(
      err?.message || "Erreur lors de la création de l'abonnement",
    );
  }
};

// Limites de montant (en euros)
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10000;

// Validation commune
const validateAmount = (amount: number): PaymentResult | null => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { success: false, error: 'Montant invalide' };
  }
  if (amount < MIN_AMOUNT) {
    return {
      success: false,
      error: `Le montant minimum est de ${MIN_AMOUNT}€`,
    };
  }
  if (amount > MAX_AMOUNT) {
    return {
      success: false,
      error: `Le montant maximum est de ${MAX_AMOUNT}€`,
    };
  }
  return null;
};

// ============================================================
// PAIEMENT CB UNIQUEMENT (PaymentSheet sans Apple Pay / Google Pay)
// ============================================================
export const makePayment = async (
  params: PaymentParams,
): Promise<PaymentResult> => {
  const { amount, description, type, metadata = {} } = params;

  const validationError = validateAmount(amount);
  if (validationError) return validationError;

  try {
    // 1. Créer le PaymentIntent via Cloud Function
    const { clientSecret, paymentIntentId } = await createPaymentIntent(
      amount,
      description,
      { type, ...metadata },
    );

    // 2. Initialiser le Payment Sheet — CB UNIQUEMENT (pas d'Apple Pay, pas de Google Pay)
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'Mosquée El Mohsinine',
      style: 'automatic',
      // Pas de applePay ni googlePay → force le formulaire CB
      defaultBillingDetails: {
        address: {
          country: 'FR',
        },
      },
    });

    if (initError) {
      logger.error('Erreur init Payment Sheet:', initError);
      return { success: false, error: initError.message };
    }

    // 3. Présenter le Payment Sheet (CB uniquement) avec timeout 60s
    const paymentPromise = presentPaymentSheet();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Le paiement a expiré. Veuillez réessayer.')),
        60000,
      ),
    );
    const { error: presentError } = (await Promise.race([
      paymentPromise,
      timeoutPromise,
    ])) as Awaited<ReturnType<typeof presentPaymentSheet>>;

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, error: 'Paiement annulé' };
      }
      logger.error('Erreur présentation Payment Sheet:', presentError);
      return { success: false, error: presentError.message };
    }

    // 4. Paiement réussi
    return { success: true, paymentIntentId };
  } catch (error) {
    const err = error as Error;
    logger.error('Erreur paiement CB:', err);
    return { success: false, error: err?.message || 'Une erreur est survenue' };
  }
};

// ============================================================
// PAIEMENT APPLE PAY NATIF DIRECT (confirmPlatformPayPayment)
// ============================================================
export const makeApplePayPayment = async (
  params: PaymentParams,
): Promise<PaymentResult> => {
  const { amount, description, type, metadata = {} } = params;
  logger.log('[ApplePay] Début paiement:', { amount, description, type });

  const validationError = validateAmount(amount);
  if (validationError) {
    logger.log('[ApplePay] Validation échouée:', validationError);
    return validationError;
  }

  try {
    // 1. Vérifier qu'Apple Pay est disponible
    logger.log('[ApplePay] Vérification isPlatformPaySupported...');
    const supported = await isPlatformPaySupported();
    logger.log('[ApplePay] isPlatformPaySupported =', supported);
    if (!supported) {
      Alert.alert(
        'Apple Pay indisponible',
        "Apple Pay n'est pas configuré sur cet appareil. Vérifiez que vous avez une carte dans votre Wallet.",
      );
      return {
        success: false,
        error: "Apple Pay n'est pas disponible sur cet appareil",
      };
    }

    // 2. Créer le PaymentIntent via Cloud Function
    logger.log('[ApplePay] Création PaymentIntent...');
    const { clientSecret, paymentIntentId } = await createPaymentIntent(
      amount,
      description,
      { type, ...metadata },
    );
    logger.log('[ApplePay] PaymentIntent créé:', paymentIntentId);

    // 3. Lancer Apple Pay directement
    logger.log('[ApplePay] Lancement confirmPlatformPayPayment...');
    const { error } = await confirmPlatformPayPayment(clientSecret, {
      applePay: {
        cartItems: [
          {
            label: description,
            amount: amount.toFixed(2),
            paymentType: PlatformPay.PaymentType.Immediate,
          },
        ],
        merchantCountryCode: 'FR',
        currencyCode: 'EUR',
      },
    });

    if (error) {
      if (error.code === 'Canceled') {
        logger.log("[ApplePay] Paiement annulé par l'utilisateur");
        return { success: false, error: 'Paiement annulé' };
      }
      logger.error('[ApplePay] Erreur confirmPlatformPayPayment:', error);
      Alert.alert('Erreur Apple Pay', `Code: ${error.code}\n${error.message}`);
      return { success: false, error: error.message };
    }

    // 4. Paiement réussi
    logger.log('[ApplePay] Paiement réussi!', paymentIntentId);
    return { success: true, paymentIntentId };
  } catch (error) {
    const err = error as Error;
    logger.error('[ApplePay] Exception: ' + err?.message, err);
    Alert.alert(
      'Erreur Apple Pay',
      `Exception: ${err?.message || 'Erreur inconnue'}`,
    );
    return { success: false, error: err?.message || 'Une erreur est survenue' };
  }
};

// Helper pour afficher les erreurs
export const showPaymentError = (error: string) => {
  Alert.alert('Erreur de paiement', error, [{ text: 'OK' }]);
};

// Helper pour afficher la confirmation
export const showPaymentSuccess = (type: 'donation' | 'cotisation') => {
  const message =
    type === 'donation'
      ? 'Votre don a été effectué avec succès. Jazak Allah Khayran!'
      : 'Votre cotisation a été enregistrée avec succès. Jazak Allah Khayran!';

  Alert.alert('Paiement réussi', message, [{ text: 'OK' }]);
};

// Informations bancaires pour les virements (fallback)
export const bankInfo = {
  bankName: 'Credit Agricole',
  iban: '', // BUG 8 FIX: Pas de faux IBAN - récupéré depuis Firestore settings/mosquee
  bic: 'AGRIFRPP',
  beneficiary: 'Association El Mohsinine',
  reference: 'DON-', // + numero de reference
};

// Prix des cotisations
export const cotisationPrices = {
  mensuel: {
    amount: 5,
    currency: 'EUR',
    label: '5 EUR / mois',
  },
  annuel: {
    amount: 50,
    currency: 'EUR',
    label: '50 EUR / an',
    savings: "10 EUR d'economie",
  },
};

// Montants suggérés pour les dons
export const suggestedDonations = [10, 20, 50, 100, 200];

// ============================================================
// ABONNEMENT MENSUEL (PaymentSheet CB uniquement)
// ============================================================
export const makeSubscription = async (
  params: PaymentParams,
): Promise<SubscriptionResult> => {
  const { amount, description, type, metadata = {} } = params;

  const validationError = validateAmount(amount);
  if (validationError) return { ...validationError, subscriptionId: undefined };

  try {
    // 1. Créer la Subscription via Cloud Function
    const { clientSecret, subscriptionId, paymentIntentId } =
      await createSubscription(amount, description, { type, ...metadata });

    // 2. Initialiser le Payment Sheet — CB UNIQUEMENT pour abonnements
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'Mosquée El Mohsinine',
      style: 'automatic',
      // Pas de applePay ni googlePay pour les abonnements
      defaultBillingDetails: {
        address: {
          country: 'FR',
        },
      },
    });

    if (initError) {
      logger.error('Erreur init Payment Sheet:', initError);
      return { success: false, error: initError.message };
    }

    // 3. Présenter le Payment Sheet avec timeout 60s
    const paymentPromise2 = presentPaymentSheet();
    const timeoutPromise2 = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Le paiement a expiré. Veuillez réessayer.')),
        60000,
      ),
    );
    const { error: presentError } = (await Promise.race([
      paymentPromise2,
      timeoutPromise2,
    ])) as Awaited<ReturnType<typeof presentPaymentSheet>>;

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, error: 'Paiement annulé' };
      }
      logger.error('Erreur présentation Payment Sheet:', presentError);
      return { success: false, error: presentError.message };
    }

    // 4. Paiement réussi - abonnement créé
    return { success: true, subscriptionId, paymentIntentId };
  } catch (error) {
    const err = error as Error;
    logger.error('Erreur abonnement:', err);
    return { success: false, error: err?.message || 'Une erreur est survenue' };
  }
};

// ============================================================
// ABONNEMENT MENSUEL via APPLE PAY DIRECT
// ============================================================
export const makeApplePaySubscription = async (
  params: PaymentParams,
): Promise<SubscriptionResult> => {
  const { amount, description, type, metadata = {} } = params;
  logger.log('[ApplePay-Sub] Début abonnement:', { amount, description, type });

  const validationError = validateAmount(amount);
  if (validationError) return { ...validationError, subscriptionId: undefined };

  try {
    logger.log('[ApplePay-Sub] Vérification isPlatformPaySupported...');
    const supported = await isPlatformPaySupported();
    logger.log('[ApplePay-Sub] isPlatformPaySupported =', supported);
    if (!supported) {
      Alert.alert(
        'Apple Pay indisponible',
        "Apple Pay n'est pas configuré sur cet appareil.",
      );
      return {
        success: false,
        error: "Apple Pay n'est pas disponible sur cet appareil",
      };
    }

    // 1. Créer la Subscription via Cloud Function
    logger.log('[ApplePay-Sub] Création Subscription...');
    const { clientSecret, subscriptionId, paymentIntentId } =
      await createSubscription(amount, description, { type, ...metadata });
    logger.log(
      '[ApplePay-Sub] Subscription créée:',
      subscriptionId,
      paymentIntentId,
    );

    // 2. Lancer Apple Pay directement
    logger.log('[ApplePay-Sub] Lancement confirmPlatformPayPayment...');
    const { error } = await confirmPlatformPayPayment(clientSecret, {
      applePay: {
        cartItems: [
          {
            label: description,
            amount: amount.toFixed(2),
            paymentType: PlatformPay.PaymentType.Immediate,
          },
        ],
        merchantCountryCode: 'FR',
        currencyCode: 'EUR',
      },
    });

    if (error) {
      if (error.code === 'Canceled') {
        logger.log('[ApplePay-Sub] Annulé par utilisateur');
        return { success: false, error: 'Paiement annulé' };
      }
      logger.error('[ApplePay-Sub] Erreur:', error);
      Alert.alert('Erreur Apple Pay', `Code: ${error.code}\n${error.message}`);
      return { success: false, error: error.message };
    }

    logger.log('[ApplePay-Sub] Abonnement réussi!');
    return { success: true, subscriptionId, paymentIntentId };
  } catch (error) {
    const err = error as Error;
    logger.error('[ApplePay-Sub] Exception: ' + err?.message, err);
    Alert.alert(
      'Erreur Apple Pay',
      `Exception: ${err?.message || 'Erreur inconnue'}`,
    );
    return { success: false, error: err?.message || 'Une erreur est survenue' };
  }
};
