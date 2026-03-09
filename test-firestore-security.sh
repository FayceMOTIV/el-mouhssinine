#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST FIRESTORE SECURITY RULES — El Mouhssinine
# Valide les Security Rules avant deploy
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PROJECT_DIR="$HOME/Downloads/el-mouhssinine"
PASS=0
FAIL=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo -e "  ${GREEN}✅ PASS${NC} — $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo -e "  ${RED}❌ FAIL${NC} — $1"; }

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   TEST FIRESTORE SECURITY RULES                 ║"
echo "  ║   El Mouhssinine — Pre-Deploy Validation        ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "$PROJECT_DIR"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BLUE}${BOLD}1. STATIC ANALYSIS — firestore.rules${NC}\n"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Test 1: File exists
if [ -f "firestore.rules" ]; then
  pass "firestore.rules existe"
else
  fail "firestore.rules manquant"
  exit 1
fi

# Test 2: Rules version 2
if grep -q "rules_version = '2'" firestore.rules; then
  pass "rules_version = '2' present"
else
  fail "rules_version incorrecte"
fi

# Test 3: Default deny rule exists
if grep -q "allow read, write: if false" firestore.rules; then
  pass "Regle par defaut: deny all present"
else
  fail "Regle par defaut deny all manquante"
fi

# Test 4: isAdmin helper exists
if grep -q "function isAdmin()" firestore.rules; then
  pass "Fonction helper isAdmin() presente"
else
  fail "Fonction isAdmin() manquante"
fi

# Test 5: isAuthenticated helper exists
if grep -q "function isAuthenticated()" firestore.rules; then
  pass "Fonction helper isAuthenticated() presente"
else
  fail "Fonction isAuthenticated() manquante"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BLUE}${BOLD}2. COLLECTIONS PUBLIQUES (lecture)${NC}\n"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

for collection in announcements events janaza projects popups rappels dates_islamiques settings; do
  if grep -A 2 "match /${collection}/" firestore.rules | grep -q "allow read: if true"; then
    pass "${collection}: lecture publique"
  else
    fail "${collection}: lecture publique manquante"
  fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BLUE}${BOLD}3. COLLECTIONS PROTEGEES${NC}\n"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Test: Members collection has proper access control (spans ~50 lines)
if grep -A 50 "match /members/" firestore.rules | grep -q "isAdmin()"; then
  pass "members: admin access present"
else
  fail "members: admin access manquant"
fi

# Test: Donations collection — authenticated read (FIX G4)
if grep -A 3 "match /donations/" firestore.rules | grep -q "isAuthenticated()"; then
  pass "donations: lecture authentifiee (FIX G4)"
else
  fail "donations: lecture authentifiee manquante (FIX G4)"
fi

# Test: Donations — userId validation on create
if grep -A 20 "match /donations/" firestore.rules | grep -q "userId == request.auth.uid"; then
  pass "donations: validation userId sur creation"
else
  fail "donations: validation userId manquante"
fi

# Test: Payments collection — user reads own payments (FIX G4)
if grep -A 5 "match /payments/" firestore.rules | grep -q "resource.data.metadata.memberId == request.auth.uid"; then
  pass "payments: lecture propres paiements (FIX G4)"
else
  fail "payments: isolation paiements manquante"
fi

# Test: Disputes collection — locked (FIX G4)
if grep -A 2 "match /disputes/" firestore.rules | grep -q "allow read, write: if false"; then
  pass "disputes: verrouille (Cloud Functions only)"
else
  fail "disputes: pas verrouille"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BLUE}${BOLD}4. COLLECTIONS CLOUD FUNCTIONS ONLY${NC}\n"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

for collection in processed_payments failed_payments counters rate_limits; do
  if grep -A 2 "match /${collection}/" firestore.rules | grep -q "allow read, write: if false"; then
    pass "${collection}: verrouille total"
  else
    fail "${collection}: pas verrouille"
  fi
done

# Test: cached_prayer_times — public read, no client write
if grep -A 3 "match /cached_prayer_times/" firestore.rules | grep -q "allow read: if true"; then
  pass "cached_prayer_times: lecture publique"
else
  fail "cached_prayer_times: lecture non publique"
fi

if grep -A 4 "match /cached_prayer_times/" firestore.rules | grep -q "allow write: if false"; then
  pass "cached_prayer_times: ecriture verrouille"
else
  fail "cached_prayer_times: ecriture non verrouillee"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BLUE}${BOLD}5. SECURITE AVANCEE${NC}\n"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Test: Members cannot modify critical fields (affectedKeys spans line ~111)
if grep -q "affectedKeys.*hasAny" firestore.rules; then
  pass "members: protection champs critiques"
else
  fail "members: protection champs critiques manquante"
fi

# Test: Members create validation (email format)
if grep -q "matches('.*@" firestore.rules; then
  pass "members: validation email sur creation"
else
  fail "members: validation email manquante"
fi

# Test: Admins — super_admin only write
if grep -A 5 "match /admins/" firestore.rules | grep -q "role == 'super_admin'"; then
  pass "admins: ecriture super_admin uniquement"
else
  fail "admins: restriction ecriture manquante"
fi

# Test: Donations — amount validation
if grep -A 15 "match /donations/" firestore.rules | grep -q "100000"; then
  pass "donations: validation montant max 100000"
else
  fail "donations: validation montant manquante"
fi

# Test: Payments — amount validation
if grep -A 10 "match /payments/" firestore.rules | grep -q "10000"; then
  pass "payments: validation montant max 10000"
else
  fail "payments: validation montant manquante"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BLUE}${BOLD}6. CLOUD FUNCTIONS SYNTAX CHECK${NC}\n"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if node --check functions/index.js 2>/dev/null; then
  pass "functions/index.js: syntaxe OK"
else
  fail "functions/index.js: erreur de syntaxe"
fi

# Check new functions exist
for func in adminCancelSubscription refundDonation reconcileStripePayments; do
  if grep -q "exports\.$func" functions/index.js; then
    pass "Cloud Function $func: presente"
  else
    fail "Cloud Function $func: manquante"
  fi
done

# Check dispute handlers
if grep -q "charge.dispute.created" functions/index.js; then
  pass "Webhook handler: charge.dispute.created"
else
  fail "Webhook handler: charge.dispute.created manquant"
fi

if grep -q "charge.dispute.closed" functions/index.js; then
  pass "Webhook handler: charge.dispute.closed"
else
  fail "Webhook handler: charge.dispute.closed manquant"
fi

# Check amount validation in webhook
if grep -q "_montantSuspect" functions/index.js; then
  pass "Webhook: validation montant suspect (FIX G2)"
else
  fail "Webhook: validation montant suspect manquante"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  RESULTATS${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "  Total:  ${BOLD}$TOTAL${NC} tests"
echo -e "  Pass:   ${GREEN}${BOLD}$PASS${NC}"
echo -e "  Fail:   ${RED}${BOLD}$FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}ALL TESTS PASSED — SAFE TO DEPLOY${NC}"
  echo ""
  exit 0
else
  echo -e "  ${RED}${BOLD}$FAIL TEST(S) FAILED — FIX BEFORE DEPLOY${NC}"
  echo ""
  exit 1
fi
