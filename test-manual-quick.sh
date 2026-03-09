#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST MANUEL RAPIDE — El Mouhssinine
# Guide interactif pour tester chaque feature de Phase 1
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESULTS_FILE="/tmp/manual-test-results.txt"
PASS=0
FAIL=0
SKIP=0
TOTAL=9

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

> "$RESULTS_FILE"

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   TESTS MANUELS RAPIDES — Phase 1               ║"
echo "  ║   9 tests | ~15-20 min                           ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "Prerequis:"
echo "  - Backoffice: https://el-mouhssinine.web.app"
echo "  - App iOS TestFlight installee"
echo "  - Acces Stripe Dashboard"
echo ""
read -p "Appuie sur Entree pour commencer..."

ask_result() {
  local test_name="$1"
  echo ""
  read -p "$(echo -e ${YELLOW}Resultat ? [p=pass / f=fail / s=skip]: ${NC})" result
  case "$result" in
    p|P) PASS=$((PASS+1)); echo "$test_name: PASS" >> "$RESULTS_FILE"; echo -e "  ${GREEN}✅ PASS${NC}";;
    f|F) FAIL=$((FAIL+1)); echo "$test_name: FAIL" >> "$RESULTS_FILE"; echo -e "  ${RED}❌ FAIL${NC}"; read -p "  Note (optionnel): " note; [ -n "$note" ] && echo "  Note: $note" >> "$RESULTS_FILE";;
    s|S) SKIP=$((SKIP+1)); echo "$test_name: SKIP" >> "$RESULTS_FILE"; echo -e "  ${YELLOW}⏭️  SKIP${NC}";;
    *) SKIP=$((SKIP+1)); echo "$test_name: SKIP" >> "$RESULTS_FILE"; echo -e "  ${YELLOW}⏭️  SKIP${NC}";;
  esac
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 1/9 — FIX C6 : Annulation abonnement admin${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Ouvrir backoffice > Adherents"
echo "  2. Trouver un membre avec abonnement mensuel actif"
echo "  3. Ouvrir sa fiche (cliquer sur la ligne)"
echo "  4. Verifier qu'un bouton rouge 'Annuler l'abonnement' apparait"
echo "  5. Cliquer sur le bouton"
echo "  6. Confirmer dans le dialog"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] Bouton visible uniquement si stripeSubscriptionId existe"
echo "     - [ ] Dialog de confirmation apparait"
echo "     - [ ] Toast 'Abonnement annule' apparait"
echo "     - [ ] Le bouton disparait apres annulation"

ask_result "C6_annulation_abonnement"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 2/9 — FIX D1 : Remboursement don${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Ouvrir backoffice > Dons"
echo "  2. Verifier la colonne 'Actions' (derniere colonne)"
echo "  3. Trouver un don avec status 'succeeded' ou 'completed'"
echo "  4. Cliquer 'Rembourser'"
echo "  5. Un champ montant pre-rempli apparait"
echo "  6. Cliquer OK pour confirmer"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] Colonne Actions visible dans le tableau"
echo "     - [ ] Bouton 'Rembourser' pour les dons valides"
echo "     - [ ] Champ montant editable"
echo "     - [ ] Dialog de confirmation avec montant"
echo "     - [ ] Toast succes/erreur apres action"
echo "     - [ ] Don marque 'Rembourse' apres"

ask_result "D1_remboursement_don"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 3/9 — FIX D3 : Remboursement partiel cotisation${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Ouvrir backoffice > Adherents"
echo "  2. Ouvrir la fiche d'un membre avec cotisation payee"
echo "  3. Verifier le champ 'Montant (optionnel)' a cote du bouton Rembourser"
echo "  4. Entrer un montant partiel (ex: 25 pour une cotisation de 100)"
echo "  5. Cliquer Rembourser"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] Champ montant present a cote du bouton"
echo "     - [ ] Remboursement partiel accepte"
echo "     - [ ] Si vide, remboursement total"
echo "     - [ ] Toast succes apres action"

ask_result "D3_remboursement_partiel"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 4/9 — FIX E1 : Historique paiements app${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Ouvrir l'app iOS > onglet Adherent"
echo "  2. Se connecter avec un compte qui a des paiements"
echo "  3. Scroller vers le bas dans la page membre actif"
echo "  4. Verifier la section 'Historique des paiements'"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] Section visible avec titre et icone"
echo "     - [ ] Chaque paiement affiche: date, type, montant, statut"
echo "     - [ ] Montants corrects (en euros, pas en centimes)"
echo "     - [ ] Badges de statut colores (vert=paye, orange=rembourse, rouge=echoue)"
echo "     - [ ] 'Aucun paiement' si pas de paiements"

ask_result "E1_historique_paiements"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 5/9 — FIX E2 : Recu fiscal dons app${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Ouvrir l'app iOS > onglet Dons"
echo "  2. Se connecter"
echo "  3. Scroller vers la section 'Mes recus fiscaux'"
echo "  4. Verifier les annees 2025 et 2026"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] Section visible avec 2 lignes (2025 + 2026)"
echo "     - [ ] Sous-texte 'Tous les dons de l'annee' sous chaque ligne"
echo "     - [ ] 2025: bouton 'Recevoir par email' actif (annee passee)"
echo "     - [ ] 2026: 'Disponible le 01/01/2027'"
echo "     - [ ] Cliquer sur le bouton 2025 envoie bien l'email"

ask_result "E2_recu_fiscal_dons"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 6/9 — FIX D4 : Webhook disputes Stripe${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Verifier dans Stripe Dashboard > Webhooks"
echo "  2. Confirmer que charge.dispute.created est dans la liste des events"
echo "  3. Confirmer que charge.dispute.closed est dans la liste"
echo "  4. (Optionnel) Utiliser Stripe CLI pour simuler un dispute:"
echo "     stripe trigger charge.dispute.created"
echo "  5. Verifier les logs:"
echo "     firebase functions:log --only stripeWebhook --limit 20"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] Events presents dans le webhook Stripe"
echo "     - [ ] Total: 8 events webhook configures"
echo "     - [ ] (Si simule) Document cree dans collection 'disputes'"
echo "     - [ ] (Si simule) Email d'alerte recu par admin"

ask_result "D4_webhook_disputes"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 7/9 — FIX G2 : Validation montant webhook${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Ce test verifie que le webhook detecte les montants suspects"
echo "  2. Verifier dans functions/index.js la presence de '_montantSuspect'"
echo "  3. (Optionnel) Creer un PaymentIntent test avec montant 0.01€"
echo "     via Stripe Dashboard > Developers > API"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] Code _montantSuspect present dans index.js"
echo "     - [ ] Les cotisations < 1€ sont flaggees"
echo "     - [ ] Status 'montant_suspect' au lieu de 'succeeded'"

ask_result "G2_validation_montant"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 8/9 — FIX B3 : Renouvellement anticipe${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Ce test verifie que le renouvellement anticipe conserve les mois"
echo "  2. Trouver un membre avec cotisation active (date fin dans le futur)"
echo "  3. Verifier dans firebase.ts la logique baseDate"
echo "  4. (Test ideal) Renouveler la cotisation d'un membre actif"
echo "     et verifier que la nouvelle date fin = ancienne date fin + 1 an"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] Code baseDate present dans firebase.ts"
echo "     - [ ] Si dateFin > now, baseDate = dateFin (pas now)"
echo "     - [ ] Nouvelle dateFin = baseDate + 1 an (annuel)"

ask_result "B3_renouvellement_anticipe"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  TEST 9/9 — FIX G4 : Security Rules${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  📝 Instructions:"
echo "  1. Ouvrir Firebase Console > Firestore > Rules"
echo "  2. Verifier les regles deployees"
echo "  3. (Test) Depuis l'app, verifier qu'un user ne peut pas lire"
echo "     les paiements d'un autre user"
echo "  4. Verifier que la collection 'disputes' est inaccessible"
echo ""
echo "  ✅ Checklist:"
echo "     - [ ] donations: allow read if isAuthenticated()"
echo "     - [ ] payments: user lit uniquement ses propres paiements"
echo "     - [ ] disputes: allow read, write: if false"
echo "     - [ ] Default deny: allow read, write: if false (catch-all)"

ask_result "G4_security_rules"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  RAPPORT FINAL — TESTS MANUELS${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  Resultats:" | tee -a "$RESULTS_FILE"
echo "  ----------" | tee -a "$RESULTS_FILE"
echo -e "  Total:  ${BOLD}$TOTAL${NC} tests" | tee -a "$RESULTS_FILE"
echo -e "  Pass:   ${GREEN}${BOLD}$PASS${NC}" | tee -a "$RESULTS_FILE"
echo -e "  Fail:   ${RED}${BOLD}$FAIL${NC}" | tee -a "$RESULTS_FILE"
echo -e "  Skip:   ${YELLOW}${BOLD}$SKIP${NC}" | tee -a "$RESULTS_FILE"
echo ""

SCORE=$(( PASS * 100 / (TOTAL - SKIP > 0 ? TOTAL - SKIP : 1) ))
echo -e "  Score: ${BOLD}${SCORE}%${NC} ($PASS / $((TOTAL - SKIP)))" | tee -a "$RESULTS_FILE"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$PASS" -gt 0 ]; then
  echo -e "  ${GREEN}${BOLD}TOUS LES TESTS PASSES — PRET POUR BUILD 226${NC}"
elif [ "$FAIL" -le 2 ]; then
  echo -e "  ${YELLOW}${BOLD}QUELQUES ECHECS — INVESTIGUER AVANT BUILD${NC}"
else
  echo -e "  ${RED}${BOLD}TROP D'ECHECS — NE PAS FAIRE DE BUILD${NC}"
fi

echo ""
echo "  Rapport detail: $RESULTS_FILE"
echo ""

# Show results file content
echo "---" >> "$RESULTS_FILE"
echo "Date: $(date)" >> "$RESULTS_FILE"
echo "Score: ${SCORE}% ($PASS/$((TOTAL - SKIP)))" >> "$RESULTS_FILE"
