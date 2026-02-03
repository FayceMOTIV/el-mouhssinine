# Cloud Functions API Documentation

## Callable Functions

Ces fonctions sont appelées depuis l'app mobile ou le backoffice via le SDK Firebase.

### `createPaymentIntent`

Crée un PaymentIntent Stripe pour un don ou une cotisation.

**Authentification** : Optionnelle (dons anonymes autorisés)

**Paramètres** :
```typescript
{
  amount: number;      // Montant en centimes (ex: 1000 = 10€)
  currency: string;    // Devise (ex: "eur")
  description: string; // Description du paiement
  metadata?: {
    type: 'donation' | 'cotisation';
    projectId?: string;
    projectName?: string;
    memberId?: string;
    email?: string;
    montantCotisation?: number;
    montantDon?: number;
  }
}
```

**Réponse** :
```typescript
{
  clientSecret: string;     // Secret pour Stripe SDK
  paymentIntentId: string;  // ID du PaymentIntent
}
```

**Limites** :
- Montant minimum : 1€ (100 centimes)
- Montant maximum : 10 000€ (1 000 000 centimes)
- Rate limit : 5 paiements / 5 minutes par utilisateur

---

### `sendManualNotification`

Envoie une notification push manuelle depuis le backoffice.

**Authentification** : Requise (admin uniquement)

**Paramètres** :
```typescript
{
  title: string;  // Titre de la notification
  body: string;   // Corps de la notification
  topic?: string; // Topic FCM (défaut: "general")
  data?: object;  // Données personnalisées
}
```

**Réponse** :
```typescript
{
  success: boolean;
  messageId: string;
}
```

**Limites** :
- Rate limit : 10 notifications / minute par admin

---

### `getNotificationStats`

Récupère les statistiques des notifications des 30 derniers jours.

**Authentification** : Requise (admin uniquement)

**Paramètres** : Aucun

**Réponse** :
```typescript
{
  total: number;
  success: number;
  failed: number;
  byTopic: {
    [topic: string]: number;
  }
}
```

---

### `sendRecuFiscal`

Génère et envoie un reçu fiscal PDF par email.

**Authentification** : Requise (l'utilisateur ne peut demander que son propre reçu)

**Paramètres** :
```typescript
{
  email: string;  // Email du donateur
  annee: number;  // Année fiscale (ex: 2025)
}
```

**Réponse** :
```typescript
{
  success: boolean;
  numeroRecu: string;      // Numéro du reçu (ex: "RF-2025-00001")
  montantTotal: number;    // Total des dons en euros
  message: string;
}
```

**Limites** :
- Rate limit : 3 reçus / heure par utilisateur
- Seuls les dons sont comptabilisés (pas les cotisations)

---

### `getDonsByYear`

Récupère les dons d'un utilisateur pour une année donnée.

**Authentification** : Requise (l'utilisateur ne peut voir que ses propres dons)

**Paramètres** :
```typescript
{
  email: string;  // Email du donateur
  annee: number;  // Année (ex: 2025)
}
```

**Réponse** :
```typescript
{
  totalEligible: number;    // Total éligible au reçu fiscal
  totalCotisations: number; // Total cotisations (non éligible)
  total: number;            // Total général
  dons: Array<{
    id: string;
    type: 'don_projet' | 'don_libre' | 'cotisation';
    montant: number;
    date: string;
    eligibleRecuFiscal: boolean;
  }>;
  annee: number;
}
```

---

### `forceCachePrayerTimes`

Force le rafraîchissement du cache des horaires de prière.

**Authentification** : Requise (admin uniquement)

**Paramètres** : Aucun

**Réponse** :
```typescript
{
  success: boolean;
  date: string;  // Date du cache (YYYY-MM-DD)
}
```

---

## HTTP Functions

### `stripeWebhook`

Webhook Stripe pour confirmer les paiements.

**URL** : `https://europe-west1-el-mouhssinine.cloudfunctions.net/stripeWebhook`

**Méthode** : POST

**Headers requis** :
- `stripe-signature` : Signature Stripe

**Events gérés** :
- `payment_intent.succeeded` : Paiement réussi
- `payment_intent.payment_failed` : Paiement échoué

**Sécurité** :
- Vérification de la signature Stripe
- Idempotence via collection `processed_payments`
- Transaction atomique Firestore
- Validation du montant (metadata vs Stripe)

---

## Trigger Functions

### `onNewAnnouncement`
- **Collection** : `announcements`
- **Event** : `onCreate`
- **Action** : Notification push (désactivé - utiliser le backoffice)

### `onNewEvent`
- **Collection** : `events`
- **Event** : `onCreate`
- **Action** : Notification push (désactivé - utiliser le backoffice)

### `onNewJanaza`
- **Collection** : `janaza`
- **Event** : `onCreate`
- **Action** : Notification push urgente (désactivé - utiliser le backoffice)

### `onNotificationFromBackoffice`
- **Collection** : `notifications`
- **Event** : `onWrite`
- **Action** : Envoi notification FCM quand `statut === 'envoyee'`

### `onMessageReply`
- **Collection** : `messages`
- **Event** : `onUpdate`
- **Action** : Notification à l'utilisateur (réponse mosquée) ou aux admins (réponse utilisateur)

---

## Scheduled Functions

### `scheduledJumuaReminder`
- **Schedule** : Vendredi 11h30 (Europe/Paris)
- **Action** : Rappel prière du vendredi

### `cleanupOldNotifications`
- **Schedule** : Dimanche 3h00 (Europe/Paris)
- **Action** : Supprime les notifications de +30 jours

### `cachePrayerTimesDaily`
- **Schedule** : Tous les jours 0h05 (Europe/Paris)
- **Action** : Cache les horaires de prière depuis Aladhan API

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| `unauthenticated` | Utilisateur non connecté |
| `permission-denied` | Droits insuffisants (admin requis) |
| `invalid-argument` | Paramètres invalides |
| `resource-exhausted` | Rate limit atteint |
| `not-found` | Ressource non trouvée |
| `failed-precondition` | Configuration manquante |
| `internal` | Erreur serveur |
