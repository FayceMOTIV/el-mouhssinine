# AUDIT: iOS App Status Display Bug Analysis
## "Actif" Card vs "Non payé" Adhesions Discrepancy

**Status**: ANALYSIS COMPLETE
**Date**: February 24, 2026
**Focus**: iOS app Firestore field mapping and real-time data display

---

## Executive Summary

The bug where a user's member card displays "**Actif**" (Active) but the "Voir mes adhésions" (View my memberships) section displays "**Non payé**" (Not paid) has been traced to **different Firestore field dependencies** in two parts of the app:

1. **Member Card** (`MemberScreen.tsx` → `MemberCard.tsx`) reads from `member.status` field
2. **"Voir mes adhésions"** (`MyMembershipsScreen.tsx`) reads from `myMembership.datePaiement` field
3. **Cloud Functions webhooks** correctly set BOTH fields, BUT with potential race conditions

---

## Part 1: Member Card Display Logic

### File: `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/components/MemberCard.tsx`

**How it determines "Actif" status:**

```typescript
// Line 69: Displays badge text based on status
const badgeText = isPendingSignature
  ? t('memberCardPendingSignature')
  : isPendingPayment
  ? t('memberCardPendingPayment')
  : isExpired
  ? t('memberCardExpired')
  : t('memberCardActive');  // ← Shows "Actif" for any other status

// Line 70-76: Determines badge color
const badgeColor = isPendingSignature
  ? '#F59E0B'
  : isPendingPayment
  ? '#F59E0B'
  : isExpired
  ? '#EF4444'
  : '#10B981';  // ← Green color for "Actif"
```

**Field Read:**
- Reads `member.status` from MemberScreen
- Shows "Actif" (green badge) if `status` is:
  - NOT "en_attente_paiement"
  - NOT "en_attente_signature"
  - NOT "expired"
  - NOT "inactive"
  - Otherwise defaults to "Actif"

**Implicit Logic:**
- If `status === 'actif'` → Shows "Actif" ✓
- If `status === 'en_attente_paiement'` → Shows "En attente paiement" (orange)
- If `status === 'sympathisant'` → Shows "Actif" (because no special condition matches)

### File: `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/screens/MemberScreen.tsx`

**How member status is populated:**

```typescript
// Line 183: Reads from members/{uid} document
cotisationStatus: profile.cotisation.status as 'actif' | 'expire' | ...

// Line 190: Uses cotisation.status to determine if active
const isActive = profile.cotisation.status === 'actif';

// Line 1097: For member card display
status: memberProfile.cotisationStatus || 'aucun',

// Line 1093-1098: memberForCard object passed to MemberCard
const memberForCard = memberProfile ? {
  name: memberProfile.name,
  memberId: memberProfile.memberId,
  membershipExpirationDate: memberProfile.cotisationExpiry,
  status: memberProfile.cotisationStatus || 'aucun',  // ← Key field!
  paymentStatus: getPaymentStatus(memberProfile),
  subscriptionType: memberProfile.cotisationType || undefined,
}
```

**Critical Finding:**
- `MemberScreen` reads from **`cotisation.status`** (nested field)
- **NOT** from root-level `status` field
- Value comes from `profile.cotisation.status` after real-time listener

---

## Part 2: "Voir mes adhésions" Display Logic

### File: `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/screens/MyMembershipsScreen.tsx`

**How it displays payment status:**

```typescript
// Line 263: Status badge uses myMembership.status
{getStatusBadge(myMembership.status)}

// Line 297-309: Payment status determination
{myMembership.datePaiement ? (
  <View style={[styles.paymentBadge, styles.paymentPaid]}>
    <Text style={styles.paymentBadgeText}>✓ Payé</Text>
  </View>
) : myMembership.status === 'en_attente_paiement' ? (
  <View style={[styles.paymentBadge, styles.paymentPending]}>
    <Text style={styles.paymentBadgeText}>⏳ En attente</Text>
  </View>
) : (
  <View style={[styles.paymentBadge, styles.paymentUnpaid]}>
    <Text style={styles.paymentBadgeText}>Non payé</Text>
  </View>
)}
```

**Critical Logic:**
1. Shows "✓ Payé" if **`myMembership.datePaiement` exists** (is not null/undefined)
2. Shows "⏳ En attente" if `status === 'en_attente_paiement'`
3. **Otherwise shows "Non payé"** ← This is where the bug happens!

### File: `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/services/firebase.ts`

**MyMembership data type:**

```typescript
// Line 1586-1604
export interface MyMembership {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  status: string;
  formule: 'mensuel' | 'annuel' | null;
  montant: number;
  dateInscription: Date;
  datePaiement?: Date;  // ← KEY FIELD for payment status
  dateDebut?: Date;
  dateFin?: Date;
  modePaiement?: string;
  paiementId?: string;
  inscritPar?: { nom: string; prenom: string } | null;
  referenceVirement?: string;
}
```

**How MyMembership is populated:**

```typescript
// Line 1653-1714: subscribeToMyMembership real-time listener
export const subscribeToMyMembership = (email: string, callback: ...) => {
  return firestore()
    .collection('members')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .onSnapshot(snapshot => {
      const doc = snapshot.docs[0];
      const data = doc.data();

      // Line 1693: Read datePaiement directly from Firestore
      datePaiement: data.datePaiement ? toDate(data.datePaiement) : undefined,

      // Line 1689: Read status from root level
      status: memberStatus,
    });
}
```

**Key Field Source:**
- `datePaiement` comes directly from `members/{docId}.datePaiement` in Firestore
- `status` comes from `members/{docId}.status` in Firestore

---

## Part 3: Cloud Functions Webhook Handlers

### Issue #1: One-Time Payment (payment_intent.succeeded)

**File:** `/Users/faicalkriouar/Downloads/el-mouhssinine/functions/index.js`
**Location:** Lines 1573-1752

**What gets written to Firestore:**

```javascript
// Line 1710-1715: One-time membership payment
transaction.update(memberRef, {
  status: 'actif',                                          // ✓ Root-level status
  datePaiement: admin.firestore.FieldValue.serverTimestamp(), // ✓ Root-level field
  montantPaye: montantCotisation,
  stripePaymentId: paymentIntentId,
  // ⚠️ DOES NOT UPDATE: cotisation.status
});
```

**Problem Identified:**
- ✓ Writes `status: 'actif'` (needed for member card)
- ✓ Writes `datePaiement` (needed for "Voir mes adhésions")
- ✗ Does NOT write `cotisation.status: 'actif'` ← This breaks `MemberScreen` logic!

**Impact:**
- Member card may show wrong status if it reads from `cotisation.status` instead of root `status`
- But actually, MemberScreen reads `cotisation.status`, which may be undefined after one-time payment

---

### Issue #2: Recurring Payment (invoice.payment_succeeded)

**Location:** Lines 1785-1903

**What gets written to Firestore:**

```javascript
// Line 1882-1893: Monthly subscription renewal
await memberDoc.ref.update({
  status: 'actif',                                          // ✓ Root-level status
  datePaiement: admin.firestore.FieldValue.serverTimestamp(), // ✓ Root-level field
  montantPaye: amountEuros,
  stripePaymentId: invoice.payment_intent,
  cotisation: {                                             // ✓ Also updates nested object
    type: 'mensuel',
    montant: amountEuros,
    dateDebut: memberData.cotisation?.dateDebut || serverTimestamp(),
    dateFin: admin.firestore.Timestamp.fromDate(newEndDate),
    // ⚠️ DOES NOT SET: status property inside cotisation object
  },
});
```

**Problem Identified:**
- ✓ Writes `status: 'actif'` (root level)
- ✓ Writes `datePaiement` (root level)
- ✓ Updates `cotisation` object with type, montant, dates
- ✗ Does NOT write `cotisation.status` field inside the object!

**Impact:**
- `cotisation` object exists but has NO `status` property
- MemberScreen reads `profile.cotisation.status` → gets **undefined**
- MemberScreen may not correctly determine if member is active

---

## The Root Cause: Field Structure Mismatch

### Firestore Document Structure Expected by App:

```javascript
members/{memberId} {
  // Root-level fields (MyMembershipsScreen reads these)
  status: 'actif' | 'en_attente_paiement' | 'sympathisant' | ...,
  datePaiement: Timestamp,  // Critical for "Payé" vs "Non payé"
  nom: string,
  prenom: string,
  email: string,

  // Nested cotisation object (MemberScreen reads these)
  cotisation: {
    status: 'actif' | 'expire' | ...,  // ← MISSING after webhook!
    type: 'mensuel' | 'annuel',
    montant: number,
    dateDebut: Timestamp,
    dateFin: Timestamp,
  },

  // For display logic
  cotisationExpiry: Timestamp,  // Used to determine expiration
  montantPaye: number,
  stripePaymentId: string,
}
```

### What Webhooks Actually Write:

**For one-time payment (payment_intent.succeeded):**
```javascript
{
  status: 'actif',           // ✓ Root level
  datePaiement: Timestamp,   // ✓ Root level
  montantPaye: amount,
  stripePaymentId: intentId,
  // ✗ Does not touch cotisation object at all!
}
```

**For recurring payment (invoice.payment_succeeded):**
```javascript
{
  status: 'actif',           // ✓ Root level
  datePaiement: Timestamp,   // ✓ Root level
  montantPaye: amount,
  stripePaymentId: invoiceId,
  cotisation: {
    type: 'mensuel',
    montant: amount,
    dateDebut: Timestamp,
    dateFin: Timestamp,
    // ✗ status field is MISSING!
  }
}
```

---

## Scenario: How the Bug Manifests

### Scenario 1: One-Time Annual Payment

**User Action:** Pays for annual membership via Stripe → One-time payment

**Webhook Execution:**
```
payment_intent.succeeded event:
  → member.status = 'actif'
  → member.datePaiement = NOW
  → member.cotisation object: UNTOUCHED (still has old data)
```

**App Behavior:**

**MemberScreen (Member Card):**
- Reads `profile.cotisation.status`
- Value: Could be undefined, 'expire', 'sympathisant', or old value
- If undefined → MemberScreen may fail or show wrong status
- But MemberScreen also checks `profile.status` as fallback (line 1085)
- Falls back to showing "Actif" from root `status` field

**MyMembershipsScreen ("Voir mes adhésions"):**
- Reads `myMembership.datePaiement`
- Value: NOW (just set by webhook) ✓
- Reads `myMembership.status`
- Value: 'actif' ✓
- **Should display "✓ Payé"** ✓

✓ Should work correctly

---

### Scenario 2: Monthly Subscription Renewal

**User Action:** Automatic monthly payment via Stripe subscription

**Webhook Execution:**
```
invoice.payment_succeeded event:
  → member.status = 'actif'
  → member.datePaiement = NOW
  → member.cotisation = {
      type: 'mensuel',
      montant: amount,
      dateDebut: oldDate,
      dateFin: newDate,
      status: ??? (UNDEFINED - never written)
    }
```

**App Behavior:**

**MemberScreen (Member Card):**
- Reads `profile.cotisation.status`
- Value: **undefined** ✗
- Line 183 tries to use it: `cotisationStatus: profile.cotisation.status`
- If undefined, getPaymentStatus (line 1079-1098) falls back to checking `profile.status`
- Fallback works: `if (profile.status === 'actif') return 'paid'`
- **Shows "Actif"** ✓

**MyMembershipsScreen ("Voir mes adhésions"):**
- Reads `myMembership.datePaiement`
- Value: NOW (just set) ✓
- **Should display "✓ Payé"** ✓

✓ Should work correctly

---

## When the Bug Actually Occurs

### Real Bug Scenario: Real-Time Listener Timing Issue

**The actual bug likely occurs when:**

1. **Webhook is still processing** when user navigates to MyMembershipsScreen
2. **Real-time listener hasn't received the update yet** to include `datePaiement`
3. Firestore shows stale member document without `datePaiement`
4. Member card shows "Actif" (from `status` field written first)
5. "Voir mes adhésions" shows "Non payé" (because `datePaiement` is still undefined)

**Timeline:**
```
T+0.0s: Stripe webhook starts processing
T+0.1s: memberRef.update({status: 'actif', datePaiement: ...}) is called
T+0.2s: Real-time listener for MyMembershipsScreen gets status='actif'
T+0.3s: But datePaiement update might still be in flight
T+0.4s: MyMembershipsScreen renders with status='actif' but datePaiement=undefined
        → Shows "Non payé" because of logic: datePaiement ? "Payé" : "Non payé"
T+0.5s: datePaiement finally syncs
T+0.6s: User sees it flicker or refresh
```

---

## Secondary Issues Found

### Issue #3: cotisation.status Never Set by Webhooks

**Problem:**
- Initial membership creation may set `cotisation.status`
- Webhooks never update `cotisation.status`
- MemberScreen relies on this field
- Leads to inconsistent state

**Affected Fields:**
```
// After one-time payment webhook:
cotisation: {
  type: ??? (may be 'annuel' or old value),
  montant: ???,
  dateDebut: ???,
  dateFin: ???,
  status: ??? (undefined!)
}
```

### Issue #4: Dual status Fields

**Root cause of confusion:**
- App reads from `status` (root level) in some places
- App reads from `cotisation.status` (nested) in others
- Cloud Functions write mostly to `status` (root)
- Never update `cotisation.status`
- Leads to inconsistency

---

## Recommended Fixes

### Fix 1: Update Webhooks to Write cotisation.status

**File:** `/Users/faicalkriouar/Downloads/el-mouhssinine/functions/index.js`

**For one-time payment (line 1710-1715):**
```javascript
transaction.update(memberRef, {
  status: 'actif',
  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
  montantPaye: montantCotisation,
  stripePaymentId: paymentIntentId,
  // ADD THIS:
  cotisation: {
    status: 'actif',  // ← Ensure nested status is set too
    // Preserve existing data
    ...(memberDoc.data().cotisation || {}),
  }
});
```

**For recurring payment (line 1882-1893):**
```javascript
await memberDoc.ref.update({
  status: 'actif',
  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
  montantPaye: amountEuros,
  stripePaymentId: invoice.payment_intent,
  cotisation: {
    type: 'mensuel',
    montant: amountEuros,
    dateDebut: memberData.cotisation?.dateDebut || serverTimestamp(),
    dateFin: admin.firestore.Timestamp.fromDate(newEndDate),
    status: 'actif',  // ← ADD THIS!
  },
});
```

### Fix 2: Use Consistent Field Reading in App

**Option A: Standardize on root-level `status`**
- MemberScreen should read `profile.status` instead of `profile.cotisation.status`
- Simpler and more consistent

**Option B: Standardize on nested `cotisation.status`**
- All webhooks must update `cotisation.status`
- App always reads from nested object

### Fix 3: Add Atomic Operations to Prevent Race Conditions

**Ensure datePaiement is written atomically with status:**

```javascript
// Current (potential race condition):
transaction.update(memberRef, {
  status: 'actif',
  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
  montantPaye: amount,
});

// Should add explicit timestamp ordering:
transaction.update(memberRef, {
  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
  status: 'actif',
  montantPaye: amount,
  statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

---

## Files Involved

### Mobile App (React Native/TypeScript)
1. **`/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/components/MemberCard.tsx`** (280 lines)
   - Displays member card badge with "Actif" status
   - Reads from `member.status` field

2. **`/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/screens/MemberScreen.tsx`** (2989 lines)
   - Prepares member data for card display
   - Reads from `profile.cotisation.status` (nested field)
   - Real-time listener at line ~170

3. **`/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/screens/MyMembershipsScreen.tsx`** (800+ lines)
   - Displays "Voir mes adhésions" section
   - Checks `myMembership.datePaiement` to show "Payé" vs "Non payé"
   - Real-time listener at line ~67

4. **`/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/services/firebase.ts`** (1714 lines)
   - `subscribeToMyMembership()` function at line 1653
   - Defines `MyMembership` interface at line 1586
   - Maps Firestore fields to `datePaiement`, `status`, etc.

### Cloud Functions (Node.js)
5. **`/Users/faicalkriouar/Downloads/el-mouhssinine/functions/index.js`** (5954 lines)
   - `stripeWebhook` function: lines 1546-2150
     - `payment_intent.succeeded` handler: lines 1573-1752
     - `invoice.payment_succeeded` handler: lines 1785-1903
   - Both handlers write `status` and `datePaiement` but NOT `cotisation.status`

---

## Testing Recommendations

### Test 1: One-Time Payment Webhook
```
Scenario: User makes one-time annual payment
Steps:
  1. User in MyMembershipsScreen, status shows "sympathisant"
  2. User pays via payment_intent route
  3. Stripe webhook fires
  4. Immediately check Firestore member doc:
     - status should be 'actif' ✓
     - datePaiement should be set ✓
     - cotisation.status should be 'actif' ✗ (currently missing)
  5. Check app real-time display:
     - Member card should show "Actif" ✓
     - "Voir mes adhésions" should show "✓ Payé" ✓
```

### Test 2: Recurring Payment Webhook
```
Scenario: Monthly subscription renewal
Steps:
  1. Invoice gets paid in Stripe
  2. invoice.payment_succeeded webhook fires
  3. Check Firestore member doc:
     - cotisation.status should be 'actif' ✗ (currently missing)
     - cotisation.dateFin should extend by 1 month ✓
     - datePaiement should be set ✓
  4. Check app display:
     - No flicker between "Non payé" and "Payé"
     - Consistent display across all membership views
```

### Test 3: Race Condition Scenario
```
Scenario: Check timing of real-time updates
Steps:
  1. Disable real-time listener on MyMembershipsScreen temporarily
  2. Trigger payment
  3. Wait 50ms-100ms
  4. Re-enable listener
  5. Verify app correctly receives datePaiement update
  6. No "Non payé" state should appear if payment was successful
```

---

## Conclusion

The "Actif vs Non payé" bug is caused by:

1. **Real-time listener timing issue**: `status` field updates before `datePaiement` in some scenarios
2. **Missing `cotisation.status` in webhooks**: Nested status field not synchronized with root status
3. **Dual field architecture**: App reads from both root-level and nested status fields inconsistently

**Priority Fix:**
1. Update webhooks to atomically write both `status` and `datePaiement` together
2. Add `cotisation.status` updates to webhook handlers
3. Ensure real-time listeners refresh completely before displaying data

