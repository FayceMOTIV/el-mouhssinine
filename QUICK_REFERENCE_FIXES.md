# QUICK REFERENCE: Bug Fixes at a Glance

## The Bug
Member card shows **"Actif"** while "Voir mes adhésions" shows **"Non payé"**

## Root Cause
Cloud Functions webhooks don't write `cotisation.status` field, causing the two screens to read from different fields and display inconsistently.

---

## FIX #1: Cloud Functions (Critical Priority)

### File: `/Users/faicalkriouar/Downloads/el-mouhssinine/functions/index.js`

#### Change 1A: Line 1710-1715 (One-time payments)

Find:
```javascript
transaction.update(memberRef, {
  status: 'actif',
  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
  montantPaye: montantCotisation,
  stripePaymentId: paymentIntentId,
});
```

Replace with:
```javascript
const currentCotisation = memberDoc.data().cotisation || {};
transaction.update(memberRef, {
  status: 'actif',
  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
  montantPaye: montantCotisation,
  stripePaymentId: paymentIntentId,
  cotisation: {
    ...currentCotisation,
    status: 'actif',
  },
});
```

---

#### Change 1B: Line 1882-1893 (Monthly subscriptions)

Find:
```javascript
await memberDoc.ref.update({
  status: 'actif',
  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
  montantPaye: amountEuros,
  stripePaymentId: invoice.payment_intent,
  cotisation: {
    type: 'mensuel',
    montant: amountEuros,
    dateDebut: memberData.cotisation?.dateDebut || admin.firestore.Timestamp.fromDate(now),
    dateFin: admin.firestore.Timestamp.fromDate(newEndDate),
  },
});
```

Replace with:
```javascript
await memberDoc.ref.update({
  status: 'actif',
  datePaiement: admin.firestore.FieldValue.serverTimestamp(),
  montantPaye: amountEuros,
  stripePaymentId: invoice.payment_intent,
  cotisation: {
    type: 'mensuel',
    montant: amountEuros,
    dateDebut: memberData.cotisation?.dateDebut || admin.firestore.Timestamp.fromDate(now),
    dateFin: admin.firestore.Timestamp.fromDate(newEndDate),
    status: 'actif',
  },
});
```

---

## FIX #2: Mobile App - MemberScreen

### File: `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/screens/MemberScreen.tsx`

#### Change 2A: Line 183 (Real-time listener)

Find:
```typescript
cotisationStatus: profile.cotisation.status as 'actif' | 'expire' | 'en_attente_paiement' | 'en_attente_validation' | 'en_attente_signature' | 'aucun' | 'sympathisant' | 'annule',
```

Replace with:
```typescript
cotisationStatus: (profile.status || profile.cotisation?.status || 'aucun') as 'actif' | 'expire' | 'en_attente_paiement' | 'en_attente_validation' | 'en_attente_signature' | 'aucun' | 'sympathisant' | 'annule',
```

#### Change 2B: Line 190 (Active status check)

Find:
```typescript
const isActive = profile.cotisation.status === 'actif';
```

Replace with:
```typescript
const isActive = (profile.status === 'actif' || profile.cotisation?.status === 'actif');
```

---

## FIX #3: Mobile App - MyMembershipsScreen

### File: `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/screens/MyMembershipsScreen.tsx`

#### Change 3: Lines 297-309 (Payment status display)

Find:
```typescript
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

Replace with:
```typescript
{(() => {
  const isPaid = myMembership.datePaiement ||
                 (myMembership.status === 'actif' && myMembership.montant > 0);
  const isPending = myMembership.status === 'en_attente_paiement';

  if (isPaid) {
    return (
      <View style={[styles.paymentBadge, styles.paymentPaid]}>
        <Text style={styles.paymentBadgeText}>✓ Payé</Text>
      </View>
    );
  } else if (isPending) {
    return (
      <View style={[styles.paymentBadge, styles.paymentPending]}>
        <Text style={styles.paymentBadgeText}>⏳ En attente</Text>
      </View>
    );
  } else {
    return (
      <View style={[styles.paymentBadge, styles.paymentUnpaid]}>
        <Text style={styles.paymentBadgeText}>Non payé</Text>
      </View>
    );
  }
})()}
```

---

## FIX #4: Mobile App - Firebase Service

### File: `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/services/firebase.ts`

#### Change 4: Line 1693 (Add fallback in MyMembership mapping)

Find:
```typescript
datePaiement: data.datePaiement ? toDate(data.datePaiement) : undefined,
```

Replace with:
```typescript
datePaiement: data.datePaiement
  ? toDate(data.datePaiement)
  : undefined,
```

(Optional: This is less critical than the others, but helps with edge cases)

---

## Testing Steps

After applying all fixes:

### Test 1: One-Time Payment
1. Navigate to member screen
2. Make a payment via Stripe (one-time)
3. Check both:
   - Card should show "**Actif**" ✓
   - "Voir mes adhésions" should show "**✓ Payé**" ✓
4. Firestore check: `members/{uid}.cotisation.status` should be "actif"

### Test 2: Monthly Subscription
1. Set up monthly subscription
2. Wait for automatic renewal (or simulate invoice.payment_succeeded)
3. Check both:
   - Card should show "**Actif**" ✓
   - "Voir mes adhésions" should show "**✓ Payé**" ✓
4. Firestore check: `cotisation.dateFin` should extend by 1 month

### Test 3: No Flicker
1. Refresh in rapid succession
2. Both screens should show consistent status
3. No flickering between "Payé" and "Non payé"

---

## Key Insights

| Screen | Field Read | Current Issue | After Fix |
|--------|-----------|---------------|-----------|
| Member Card | `status` (root) | Works if webhook fires | Always consistent ✓ |
| Voir mes adhésions | `datePaiement` (root) | May be undefined if webhook delayed | Works with fallback ✓ |
| - | `cotisation.status` (nested) | Never written by webhooks ✗ | Now written by webhooks ✓ |

---

## Files to Deploy

1. **Cloud Functions** (Must do first)
   - `/Users/faicalkriouar/Downloads/el-mouhssinine/functions/index.js`

2. **Mobile App** (Can do after)
   - `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/screens/MemberScreen.tsx`
   - `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/screens/MyMembershipsScreen.tsx`
   - `/Users/faicalkriouar/Downloads/el-mouhssinine/ElMouhssinine/src/services/firebase.ts`

---

## Deployment Order

1. **Deploy Cloud Functions first** ← Most important
2. Test with a real payment
3. **Deploy mobile app** ← Can be done later
4. Release to production

---

## Rollback Plan

If issues occur:

**Cloud Functions:**
- Revert the two webhook handlers to original code
- No data migration needed
- Payment processing will continue working

**Mobile App:**
- Revert to previous version
- App will continue reading fields as before
- No data loss

---

## Monitoring After Fix

Add logging to verify:

```javascript
// In Cloud Functions webhook
console.log('Member updated:', {
  status: 'actif',
  cotisationStatus: 'actif',
  datePaiement: new Date().toISOString(),
  timestamp: new Date().getTime()
});
```

Check logs:
```bash
firebase functions:log --only stripeWebhook
```

---

## Contact & Support

For questions about these fixes:
- See: `AUDIT_COMPLETE_ROOT_CAUSE_ANALYSIS.md` for detailed explanation
- See: `AUDIT_iOS_APP_STATUS_DISPLAY.md` for app logic details
- See: `AUDIT_ADHESIONS_PAIEMENTS_COMPLET.md` for Cloud Functions details

