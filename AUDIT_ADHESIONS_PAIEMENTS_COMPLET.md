# AUDIT COMPLET - Cloud Functions Adhésions & Paiements
## El Mouhssinine - Cas : "Actif" mais "Non payé"

---

## RÉSUMÉ EXÉCUTIF

**PROBLÈME IDENTIFIÉ :**
L'application affiche la carte de membre comme "Actif" mais la section "Voir mes adhésions" affiche "Non payé".

**CAUSE RACINE PROBABLE :**
Incohérence entre deux champs dans la collection `members` :
1. **`status`** = 'actif' (champ utilisé pour afficher la carte)
2. **Champ de paiement absent ou mal mis à jour** (pour l'affichage "Voir mes adhésions")

Le problème vient de la **divergence dans les flux de paiement** où certains chemins mettent à jour `status` mais pas les métadonnées de paiement.

---

## 1. ARCHITECTURE GÉNÉRALE DE GESTION DES ADHÉSIONS

### États possibles d'un membre
```
sympathisant → en_attente_paiement → actif → expire → (renouvelement)
```

### Flux de transition principal
1. **Création** : Nouveau membre créé comme "sympathisant"
2. **Adhésion payante** : Transition vers "en_attente_paiement" ou directement "actif"
3. **Validation** : Admin valide → "actif"
4. **Expiration** : Cron quotidien → "expire" → "sympathisant"
5. **Renouvellement** : Paiement récurrent → "actif"

---

## 2. ANALYSE DES CLOUD FUNCTIONS PERTINENTES

### 2.1 `createPaymentIntent` (Ligne 1312)
**Rôle:** Créer un PaymentIntent Stripe pour dons/cotisations

**Champs Firestore lus/écrits:**
- Lit: aucun
- Écrit: aucun (côté frontend création du paiement)

**Logique de statut:**
- N'impacte pas directement le statut

**Métadonnées importantes:**
```javascript
metadata: {
  type: 'cotisation' || 'donation',
  period: 'mensuel' || 'annuel',
  memberId: uid,
  montantCotisation: 100,
}
```

---

### 2.2 `createSubscription` (Ligne 1422)
**Rôle:** Créer un abonnement Stripe mensuel récurrent

**Champs Firestore lus/écrits:**
- **Lit:** aucun avant création
- **Écrit:** `stripeCustomerId`, `stripeSubscriptionId`, `cotisationType: 'mensuel'`

**Logique de statut:**
- ⚠️ **N'écrit PAS le status** au moment de la création
- Status restera "sympathisant" jusqu'au webhook `invoice.payment_succeeded`

**INCOHÉRENCE 1:**
Le membre fait un abonnement mensuel, mais son `status` n'est pas immédiatement "actif".

---

### 2.3 `stripeWebhook` (Ligne 1546) - **FONCTION CRITIQUE**
**Rôle:** Traiter les événements Stripe et synchroniser Firestore

#### Événement: `payment_intent.succeeded` (Ligne 1573)
```javascript
// Paiement ponctuel réussi

if (metadata.type === 'cotisation') {
  // Créer payment record
  transaction.set(paymentRef, {
    status: 'succeeded',
    type: 'cotisation',
    amount: montantCotisation,
  });

  // UPDATE MEMBRE
  if (memberRef && memberDoc.exists) {
    transaction.update(memberRef, {
      status: 'actif',              // ✅ Status changé
      datePaiement: timestamp(),
      montantPaye: montantCotisation,
      stripePaymentId: paymentIntentId,
    });
  }
}
```

**Champs modifiés:** `status`, `datePaiement`, `montantPaye`, `stripePaymentId`

---

#### Événement: `invoice.payment_succeeded` (Ligne 1785)
```javascript
// Paiement récurrent réussi (abonnement mensuel)

// Créer payment record (avec type=cotisation)
const paymentRef = admin.firestore().collection('payments').doc(invoice.id);
await paymentRef.set({
  status: 'succeeded',
  type: 'cotisation',
  amount: amountEuros,
});

// UPDATE MEMBRE
await memberDoc.ref.update({
  status: 'actif',              // ✅ Status changé
  datePaiement: timestamp(),
  montantPaye: amountEuros,
  stripePaymentId: invoice.payment_intent,
  cotisation: {
    dateFin: newEndDate,  // Renouvellement de 1 mois
  },
});
```

**Champs modifiés:** `status`, `datePaiement`, `montantPaye`, `stripePaymentId`, `cotisation.dateFin`

---

#### Événement: `invoice.payment_failed` (Ligne 1909)
```javascript
if (attemptCount >= 3) {
  statusUpdate.status = 'expire';
  // Membre passe en "expire" après 3 tentatives échouées
}
```

---

#### Événement: `customer.subscription.deleted` (Ligne 2051)
```javascript
await subMemberDoc.ref.update({
  status: 'expire',              // ✅ Status changé à "expire"
  cotisationType: null,
  stripeSubscriptionId: null,
  subscriptionCancelledAt: timestamp(),
});
```

---

### 2.4 `validateMembership` (Ligne 3384) - **ADMIN APPROVAL**
**Rôle:** Admin valide/refuse une adhésion

#### Action: `approve`
```javascript
await memberRef.update({
  status: 'actif',               // ✅ Status changé
  validatedAt: timestamp(),
  validatedBy: adminId,
});
```

#### Action: `reject`
```javascript
batch.update(memberRef, {
  status: 'sympathisant',         // ✅ Status changé
  aPaye: false,                   // ⚠️ Champ additionnel
  datePaiement: null,
  adhesionRefuseeAt: timestamp(),
});
```

**INCOHÉRENCE 2:**
Le champ `aPaye` est utilisé ici mais pas systématiquement dans les webhooks Stripe.

---

### 2.5 `checkExpiringCotisations` (Ligne 5117)
**Rôle:** Cron quotidien (8h00) qui vérifie expiration des adhésions annuelles

**Logique d'expiration:**
```javascript
// Lire: status='actif' ET cotisation.dateFin
// Calculer les jours restants

if (diffDays === 0) {  // Date d'expiration = aujourd'hui
  // Passer le membre en sympathisant
  await memberDoc.ref.update({
    status: 'sympathisant',
    statut: 'sympathisant',      // Double champ!
    cotisationExpiredAt: timestamp(),
  });
}
```

**Champs modifiés:** `status`, `statut` (double), `cotisationExpiredAt`

**INCOHÉRENCE 3:**
Utilise deux champs `status` et `statut` - raison inconnue (compatibilité historique?)

---

### 2.6 `onCotisationConfirmation` (Ligne 4487)
**Rôle:** Trigger on `payments/{paymentId}` - Envoyer email confirmation

**Logique:**
```javascript
const isCompleted = payment.statut === 'completed' || payment.status === 'succeeded';
if (!isCompleted) {
  return null;  // Skip
}

// Lire les données de cotisation depuis payment record
const montant = payment.amount || payment.montant;
const period = payment.period || payment.metadata?.period;
```

**Important:** Cette fonction **NE MODIFIE PAS** le status du membre.
Elle lit juste les données du paiement et envoie un email.

---

### 2.7 `refundPayment` (Ligne 4650)
**Rôle:** Rembouser un paiement (admin)

**Logique de statut:**
```javascript
if (isPartialRefund) {
  memberUpdate.partialRefund = true;
} else {  // Remboursement total
  memberUpdate.refunded = true;
  memberUpdate.aPaye = false;       // ⚠️ Réutilise `aPaye`
  memberUpdate.status = 'en_attente_paiement';
}
```

---

### 2.8 `cancelSubscription` (Ligne 4790)
**Rôle:** Membre annule son abonnement mensuel

**Logique:**
```javascript
await memberRef.update({
  abonnementActif: false,
  subscriptionCancelPending: true,
  subscriptionCancelledAt: timestamp(),
  // ⚠️ NE PAS modifier status - le webhook s'en chargera
});
```

**Commentaire important (Ligne 4837-4839):**
```javascript
// BUG 3 FIX: Ne PAS changer le status immédiatement
// Le membre garde son statut actif jusqu'à la fin de la période payée
// Le webhook customer.subscription.deleted gèrera le passage en sympathisant
```

---

### 2.9 `reconcileStripePayments` (Ligne 5279)
**Rôle:** Cron hebdo (dimanche 3h) - Réconciliation Stripe/Firestore

**Logique:**
- Récupère les PaymentIntents et Invoices réussis (derniers 7 jours)
- Vérifie s'ils existent dans les collections `payments` ou `donations`
- Alerte admin si paiements Stripe manquent dans Firestore

**Important:** Cette fonction N'ÉCRIT PAS dans Firestore (sauf alertes email).

---

## 3. IDENTIFICATION DES INCOHÉRENCES MAJEURES

### INCOHÉRENCE #1: Champs de statut doubles
| Fonction | Champ utilisé | Valeurs |
|----------|---------------|---------|
| `stripeWebhook.payment_intent.succeeded` | `status` | 'actif' |
| `checkExpiringCotisations` | `status` + `statut` | 'sympathisant' |
| `refundPayment` | `status` | 'en_attente_paiement' |
| `validateMembership` | `status` | 'actif' / 'sympathisant' |

**Problème:** Certaines fonctions écrivent `statut`, d'autres `status`. L'app iOS lit probablement un seul des deux.

---

### INCOHÉRENCE #2: Champ `aPaye` sous-utilisé
```javascript
// Utilisé dans:
1. validateMembership.reject → aPaye = false
2. refundPayment → aPaye = false

// Utilisé PARTOUT pour afficher l'adhésion?
// ❌ NOT FOUND en tant que indicateur systématique
```

**Problème:** Si l'app vérifie `aPaye` pour afficher "Payé/Non payé", mais que le webhook Stripe n'écrit que `status='actif'`, alors :
- Carte membre voit `status='actif'` → affiche "Actif" ✅
- Section adhésions voit `aPaye=undefined` → affiche "Non payé" ❌

---

### INCOHÉRENCE #3: Paiements sans update du champ de paiement
```javascript
// Scénario: Abonnement mensuel (createSubscription)
1. Créé avec cotisationType='mensuel'
   → memberRef.update({stripeCustomerId, stripeSubscriptionId})
   ⚠️ MAIS: montantPaye et datePaiement restent undefined!

2. Premier invoice.payment_succeeded:
   → memberRef.update({status='actif', montantPaye, datePaiement})

3. Si webhook échoue silencieusement entre 1 et 2:
   → Membre a un abonnement Stripe ✅
   → Membre a status='actif' ❌ (reste sympathisant)
   → Membre a montantPaye=undefined ❌
```

---

### INCOHÉRENCE #4: Pas d'atomicité entre Stripe et Firestore
Le webhook a des transactions Firestore, mais le chemin `createSubscription`:
```javascript
// createSubscription n'est pas en transaction
await memberRef.update({stripeCustomerId, stripeSubscriptionId});

// Si le mobile crash AVANT le premier paiement webhook:
// Stripe connaît l'abonnement, Firestore ne sait pas que c'est "mensuel"
```

---

### INCOHÉRENCE #5: Logique confuse de statut d'abonnement
```javascript
// Plusieurs champs pour le même concept:
1. memberData.cotisationType: 'mensuel' | 'annuel'
2. memberData.status: 'actif' | 'sympathisant' | 'expire'
3. memberData.stripeSubscriptionId: 'sub_...'
4. memberData.abonnementActif: true | false
5. memberData.subscriptionCancelPending: true | false

// Quelle est la "source de vérité"?
```

---

## 4. CARTOGRAPHIE DES PAIEMENTS VERS LE STATUT MEMBRE

### Paiement Ponctuel Annuel (Payment Intent)
```
createPaymentIntent()
    ↓
stripeWebhook: payment_intent.succeeded
    ↓ créer payments/{paymentId}
    ↓ update members/{uid}
      status = 'actif'
      montantPaye = amount
      datePaiement = now()
      stripePaymentId = paymentIntentId
    ↓
onCotisationConfirmation (email)
```

**Champs Firestore modifiés:**
- `status` ✅
- `montantPaye` ✅
- `datePaiement` ✅
- `stripePaymentId` ✅
- `aPaye` ❌ (jamais écrit)

---

### Abonnement Mensuel Récurrent (Subscription)
```
createSubscription()
    ↓ update members/{uid}
      stripeCustomerId = cus_...
      stripeSubscriptionId = sub_...
      cotisationType = 'mensuel'
    ⚠️ status n'est PAS changé (reste sympathisant!)

stripeWebhook: invoice.payment_succeeded (1er mois)
    ↓ créer payments/{invoiceId}
    ↓ update members/{uid}
      status = 'actif'  ✅
      montantPaye = amount
      datePaiement = now()
      cotisation.dateFin = now() + 1 month
    ↓
onCotisationConfirmation (email)
```

**PROBLÈME:** Entre createSubscription et le 1er webhook, le status reste 'sympathisant'!

---

### Abonnement Annulé (Subscription Cancelled)
```
cancelSubscription() [membre]
    ↓ update members/{uid}
      subscriptionCancelPending = true
    ⚠️ status reste 'actif' (attendant l'expiration naturelle)

stripeWebhook: customer.subscription.deleted
    ↓ update members/{uid}
      status = 'expire'
      stripeSubscriptionId = null
```

---

### Adhésion Refusée (Admin)
```
validateMembership(action='reject')
    ↓ update members/{uid}
      status = 'sympathisant'
      aPaye = false
      montantPaye = undefined
```

---

## 5. ANALYSE DU CAS: "Actif" mais "Non payé"

### Scénario le plus probable

#### 1. Abonnement mensuel créé
```javascript
// App appelle createSubscription()
// Firestore update:
{
  cotisationType: 'mensuel',
  stripeCustomerId: 'cus_...',
  stripeSubscriptionId: 'sub_...',
  // ⚠️ status reste 'sympathisant' (valeur précédente)
  // ⚠️ montantPaye reste undefined
  // ⚠️ datePaiement reste undefined
}
```

#### 2. Premier paiement réussi
```javascript
// Stripe déclenche: invoice.payment_succeeded
// Webhook met à jour:
{
  status: 'actif',
  montantPaye: 10.00,
  datePaiement: 2024-02-24T...,
  cotisation: { dateFin: 2024-03-24 }
}
```

#### 3. Affichage dans l'app

**Carte membre:**
```
Affiche: status == 'actif' ? "Actif" : "Inactif"
Résultat: "Actif" ✅
```

**Section "Voir mes adhésions":**
```
Cherche: aPaye == true || paiements récents
Résultat:
  - aPaye = undefined (jamais écrit) ❌
  - montantPaye = 10.00 (écrit par webhook) ✅

Si la logique est: "montrer 'Payé' si aPaye=true ET status='actif'"
→ Résultat: "Non payé" ❌ (car aPaye undefined)

Si la logique est: "montrer 'Payé' si montantPaye > 0 ET status='actif'"
→ Résultat: "Payé" ✅
```

### Scénario alternatif: Webhook échoué

```
1. createSubscription() écrit dans Firestore
2. Stripe crée l'abonnement (côté Stripe c'est OK)
3. Webhook invoice.payment_succeeded échoue silencieusement
4. Membre voit:
   - status = 'sympathisant' (jamais changé)
   - montantPaye = undefined
   - Mais l'app a un abonnement Stripe qui débite chaque mois!
```

---

## 6. CHAMPS FIRESTORE IMPLIQUÉS

### Dans `members/{memberId}`

| Champ | Rôle | Écrit par | Valeurs |
|-------|------|-----------|---------|
| `status` | Statut principal | webhook, validateMembership, checkExpiringCotisations, refundPayment, cancelSubscription | 'sympathisant', 'actif', 'en_attente_paiement', 'expire' |
| `statut` | Doublon? | checkExpiringCotisations | 'sympathisant' |
| `aPaye` | Indicateur de paiement? | validateMembership, refundPayment | true, false |
| `montantPaye` | Montant versé | stripeWebhook | number |
| `datePaiement` | Date du paiement | stripeWebhook | Timestamp |
| `stripePaymentId` | ID paiement Stripe | stripeWebhook | string |
| `stripeSubscriptionId` | ID abonnement Stripe | createSubscription, webhook | string |
| `stripeCustomerId` | ID client Stripe | createSubscription | string |
| `cotisationType` | Type de cotisation | createSubscription | 'mensuel', 'annuel' |
| `cotisation.dateDebut` | Début de la cotisation | webhook | Timestamp |
| `cotisation.dateFin` | Fin de la cotisation | webhook | Timestamp |
| `cotisation.montant` | Montant de la cotisation | ? | number |
| `refunded` | Remboursé? | refundPayment | true, false |
| `abonnementActif` | Abonnement actif? | cancelSubscription | true, false |

---

## 7. PROBLÈMES CRITIQUES IDENTIFIÉS

### Priorité 🔴 CRITIQUE

**Problème 1: Champ `status` vs `statut` double**
- checkExpiringCotisations écrit BOTH `status` et `statut`
- Les autres functions n'écrivent que `status`
- Crée des incohérences si l'app lit l'un des deux

**Problème 2: Champ `aPaye` jamais systématisé**
- Utilisé dans validateMembership et refundPayment
- Jamais écrit par le webhook Stripe (payment_intent.succeeded)
- Si l'app affiche "Payé" basé sur `aPaye`, ça sera toujours "Non payé" pour les paiements Stripe

**Problème 3: Status pas immédiatement "actif" pour abonnement mensuel**
- createSubscription n'écrit pas status='actif'
- Le status reste 'sympathisant' jusqu'au webhook
- Si le webhook échoue, le membre voit "Sympathisant" au lieu de "Actif"

### Priorité 🟠 ÉLEVÉE

**Problème 4: Deux indicateurs de paiement séparés**
- Champ `status` = 'actif' indique adhésion active
- Champ `montantPaye` / `datePaiement` indicent paiement effectué
- L'app doit lire les deux, mais aucune transaction Firestore n'assure la cohérence

**Problème 5: Pas de validation croisée**
- reconcileStripePayments détecte les paiements Stripe manquants
- Mais n'écrit rien dans Firestore - juste email admin
- Les données restent incohérentes

**Problème 6: Expiration des cotisations annuelles mal gérée**
- checkExpiringCotisations passe en sympathisant au jour d'expiration exact
- Mais beaucoup de membres auront des dates d'expiration proches
- Pas de transition douce (sauf pour les emails de rappel)

---

## 8. RECOMMANDATIONS DE FIX

### 1. **Unifier le champ status** 🔴
```javascript
// ✅ À faire dans TOUTES les functions:
// Utiliser UNIQUEMENT "status", jamais "statut"
// Valeurs: 'sympathisant', 'actif', 'en_attente_paiement', 'expire'

// ✅ À faire dans checkExpiringCotisations:
// Remplacer:
await memberDoc.ref.update({
  status: 'sympathisant',
  statut: 'sympathisant',  // SUPPRIMER CETTE LIGNE
  cotisationExpiredAt: timestamp(),
});
```

### 2. **Systématiser le champ `aPaye`** 🟠
```javascript
// ✅ À faire dans stripeWebhook.payment_intent.succeeded:
transaction.update(memberRef, {
  status: 'actif',
  aPaye: true,              // AJOUTER CETTE LIGNE
  montantPaye: montantCotisation,
  datePaiement: timestamp(),
});

// ✅ À faire dans stripeWebhook.invoice.payment_succeeded:
await memberDoc.ref.update({
  status: 'actif',
  aPaye: true,              // AJOUTER CETTE LIGNE
  montantPaye: amountEuros,
});

// ✅ Garder dans refundPayment et validateMembership
```

### 3. **Immédiatement "actif" pour abonnements** 🔴
```javascript
// ✅ À faire dans createSubscription (après update Stripe):
await memberRef.update({
  stripeCustomerId: customer.id,
  stripeSubscriptionId: subscription.id,
  cotisationType: 'mensuel',
  status: 'en_attente_paiement',  // AJOUTER CETTE LIGNE
  // Webhook le passera en 'actif' au premier paiement
});
```

### 4. **Ajouter une fonction de validation webhook** 🟠
```javascript
// ✅ Ajouter après checkExpiringCotisations:
exports.validateWebhookSync = functions
  .pubsub.schedule('0 2 * * *')  // 2h du matin quotidien
  .timeZone('Europe/Paris')
  .onRun(async () => {
    // Pour chaque membre avec stripeSubscriptionId ou stripeCustomerId:
    // 1. Récupérer l'état Stripe
    // 2. Vérifier cohérence avec Firestore
    // 3. Forcer la synchronisation si discrepancy
  });
```

### 5. **Nettoyer les champs abandonnés** 🟠
```javascript
// Audit: quels champs sont réellement lus par l'app?
// - status ✅
- statut ❌ À remplacer
- aPaye ✅ À standardiser
- montantPaye ✅
- datePaiement ✅
- abonnementActif ❌ À consolider avec status
- subscriptionCancelPending ❌ À consolider
```

---

## 9. FICHIERS TOUCHÉS

```
/Users/faicalkriouar/Downloads/el-mouhssinine/functions/index.js

Fonctions à modifier:
1. stripeWebhook (ligne 1546)
   - Ajouter aPaye = true
   - Utiliser UNIQUEMENT status, pas statut

2. createSubscription (ligne 1422)
   - Ajouter status = 'en_attente_paiement'

3. checkExpiringCotisations (ligne 5117)
   - Supprimer statut, utiliser UNIQUEMENT status

4. validateMembership (ligne 3384)
   - Standardiser aPaye

5. refundPayment (ligne 4650)
   - Déjà cohérent, ajouter aPaye = false
```

---

## 10. CONCLUSION

Le problème "Actif mais Non payé" provient d'une **divergence architecturale** entre deux flux de données:

1. **Flux UI de carte membre** → lit `status` → affiche "Actif" si status='actif'
2. **Flux UI d'adhésions** → lit `aPaye` ou `montantPaye` → affiche "Non payé" si undefined

Le webhook Stripe met bien à jour `status='actif'` mais **oublie d'écrire `aPaye=true`** de manière systématique.

L'audit révèle aussi plusieurs **champs dupliqués** (`status`/`statut`, `abonnementActif`/autres) et une **manque de transactions atomiques** entre la création d'un abonnement et le premier paiement.

**Temps de fix estimé:** 2-3 heures pour les changements critiques + tests.

---

## Généré avec l'analyse complète des Cloud Functions
Date: 2026-02-24
Fichier analysé: `/Users/faicalkriouar/Downloads/el-mouhssinine/functions/index.js` (5954 lignes)
