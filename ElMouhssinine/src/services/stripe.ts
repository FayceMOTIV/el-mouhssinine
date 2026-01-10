// Service de paiement Stripe - Placeholder
// Stripe sera configure quand les cles de l'association seront disponibles

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
}

export const StripeService = {
  // Indicateur de configuration
  isConfigured: false,

  // Initialiser Stripe avec les cles (a appeler au demarrage)
  initialize: async (): Promise<boolean> => {
    // TODO: Initialiser avec les vraies cles Stripe
    // import { initStripe } from '@stripe/stripe-react-native';
    // await initStripe({ publishableKey: 'pk_live_...' });
    console.log('[Stripe] Service non configure - en attente des cles');
    return false;
  },

  // Creer un payment intent pour un don
  createPaymentIntent: async (
    amount: number,
    projectName: string,
    donorEmail?: string
  ): Promise<PaymentResult> => {
    if (!StripeService.isConfigured) {
      console.log(
        `[Stripe] Non configure - Don: ${amount} EUR pour "${projectName}"`,
        donorEmail ? `(${donorEmail})` : ''
      );
      return {
        success: false,
        error: 'Le paiement par carte sera bientot disponible. Utilisez le virement bancaire.',
      };
    }

    // TODO: Implementer avec les vraies cles
    // 1. Appeler votre backend pour creer un PaymentIntent
    // 2. Utiliser confirmPayment de @stripe/stripe-react-native
    // const { paymentIntent, error } = await confirmPayment(clientSecret);

    return {
      success: false,
      error: 'Fonctionnalite en cours de developpement.',
    };
  },

  // Creer un abonnement pour la cotisation
  createSubscription: async (
    type: 'mensuel' | 'annuel',
    memberEmail: string,
    memberId: string
  ): Promise<SubscriptionResult> => {
    if (!StripeService.isConfigured) {
      const amount = type === 'mensuel' ? 5 : 50;
      console.log(
        `[Stripe] Non configure - Cotisation ${type}: ${amount} EUR`,
        `(${memberEmail}, ${memberId})`
      );
      return {
        success: false,
        error: 'Le paiement par carte sera bientot disponible. Utilisez le virement bancaire.',
      };
    }

    // TODO: Implementer avec les vraies cles
    // 1. Appeler votre backend pour creer une subscription Stripe
    // 2. Gerer le cycle de facturation

    return {
      success: false,
      error: 'Fonctionnalite en cours de developpement.',
    };
  },

  // Annuler un abonnement
  cancelSubscription: async (subscriptionId: string): Promise<boolean> => {
    if (!StripeService.isConfigured) {
      console.log(`[Stripe] Non configure - Annulation: ${subscriptionId}`);
      return false;
    }

    // TODO: Implementer avec les vraies cles
    return false;
  },

  // Obtenir les informations de paiement
  getPaymentMethods: async (): Promise<any[]> => {
    if (!StripeService.isConfigured) {
      return [];
    }

    // TODO: Implementer avec les vraies cles
    return [];
  },
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

// Montants suggeres pour les dons
export const suggestedDonations = [10, 20, 50, 100, 200];

export default StripeService;
