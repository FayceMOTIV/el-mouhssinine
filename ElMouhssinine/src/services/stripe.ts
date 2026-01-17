import { Alert } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import functions from '@react-native-firebase/functions';

// Types
export interface PaymentParams {
  amount: number; // en euros
  description: string;
  type: 'donation' | 'cotisation';
  metadata?: {
    projectId?: string;
    projectName?: string;
    memberId?: string;
    memberName?: string;
    isAnonymous?: boolean;
    period?: string;
    membersCount?: string; // Nombre de membres pour multi-adhésion
  };
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

// Convertir euros en centimes pour Stripe
const eurosToCents = (euros: number): number => Math.round(euros * 100);

// Créer un PaymentIntent via Cloud Function
const createPaymentIntent = async (
  amount: number,
  description: string,
  metadata: Record<string, any>
): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  try {
    const createPayment = functions().httpsCallable('createPaymentIntent');
    const result = await createPayment({
      amount: eurosToCents(amount),
      currency: 'eur',
      description,
      metadata,
    });

    const data = result.data as { clientSecret: string; paymentIntentId: string };
    return data;
  } catch (error: any) {
    console.error('Erreur création PaymentIntent:', error);
    throw new Error(error.message || 'Erreur lors de la création du paiement');
  }
};

// Initialiser et présenter le Payment Sheet
export const makePayment = async (params: PaymentParams): Promise<PaymentResult> => {
  const { amount, description, type, metadata = {} } = params;

  try {
    // 1. Créer le PaymentIntent via Cloud Function
    const { clientSecret, paymentIntentId } = await createPaymentIntent(
      amount,
      description,
      {
        type,
        ...metadata,
      }
    );

    // 2. Initialiser le Payment Sheet
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'Mosquée El Mouhssinine',
      style: 'automatic',
      googlePay: {
        merchantCountryCode: 'FR',
        testEnv: __DEV__,
      },
      applePay: {
        merchantCountryCode: 'FR',
      },
      defaultBillingDetails: {
        address: {
          country: 'FR',
        },
      },
    });

    if (initError) {
      console.error('Erreur init Payment Sheet:', initError);
      return {
        success: false,
        error: initError.message,
      };
    }

    // 3. Présenter le Payment Sheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      // L'utilisateur a annulé ou erreur
      if (presentError.code === 'Canceled') {
        return {
          success: false,
          error: 'Paiement annulé',
        };
      }
      console.error('Erreur présentation Payment Sheet:', presentError);
      return {
        success: false,
        error: presentError.message,
      };
    }

    // 4. Paiement réussi
    return {
      success: true,
      paymentIntentId,
    };
  } catch (error: any) {
    console.error('Erreur paiement:', error);
    return {
      success: false,
      error: error.message || 'Une erreur est survenue',
    };
  }
};

// Helper pour afficher les erreurs
export const showPaymentError = (error: string) => {
  Alert.alert(
    'Erreur de paiement',
    error,
    [{ text: 'OK' }]
  );
};

// Helper pour afficher la confirmation
export const showPaymentSuccess = (type: 'donation' | 'cotisation') => {
  const message = type === 'donation'
    ? 'Votre don a été effectué avec succès. Jazak Allah Khayran!'
    : 'Votre cotisation a été enregistrée avec succès. Jazak Allah Khayran!';

  Alert.alert(
    'Paiement réussi',
    message,
    [{ text: 'OK' }]
  );
};

// Informations bancaires pour les virements (fallback)
export const bankInfo = {
  bankName: 'Credit Agricole',
  iban: 'FR76 XXXX XXXX XXXX XXXX XXXX XXX', // A remplir avec le vrai IBAN
  bic: 'AGRIFRPP',
  beneficiary: 'Association El Mouhssinine',
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
    savings: '10 EUR d\'economie',
  },
};

// Montants suggérés pour les dons
export const suggestedDonations = [10, 20, 50, 100, 200];
