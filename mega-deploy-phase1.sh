#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MEGA-DEPLOY PHASE 1 — El Mouhssinine
# Deploy automatique avec backup et verifications
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PROJECT_DIR="$HOME/Downloads/el-mouhssinine"
LOG_FILE="/tmp/mega-deploy-phase1.log"
ERROR_LOG="/tmp/mega-deploy-errors.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠️  $1${NC}" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ❌ $1${NC}" | tee -a "$LOG_FILE" "$ERROR_LOG"; }
success() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✅ $1${NC}" | tee -a "$LOG_FILE"; }
header() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"; echo -e "${BOLD}${BLUE}  $1${NC}" | tee -a "$LOG_FILE"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n" | tee -a "$LOG_FILE"; }

> "$LOG_FILE"
> "$ERROR_LOG"

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   MEGA-DEPLOY PHASE 1 — El Mouhssinine          ║"
echo "  ║   11 fixes | 7 fichiers | 4 critiques           ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "$PROJECT_DIR"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "PRE-FLIGHT CHECKS"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Check Node.js
if ! command -v node &> /dev/null; then
  error "Node.js non installe"
  exit 1
fi
log "Node.js $(node --version)"

# Check Firebase CLI
if ! command -v firebase &> /dev/null; then
  error "Firebase CLI non installe. Run: npm install -g firebase-tools"
  exit 1
fi
log "Firebase CLI $(firebase --version 2>/dev/null | head -1)"

# Check Firebase project
CURRENT_PROJECT=$(firebase use 2>/dev/null | grep -o 'el-mouhssinine' || true)
if [ -z "$CURRENT_PROJECT" ]; then
  warn "Projet Firebase non selectionne, selection..."
  firebase use el-mouhssinine 2>/dev/null || { error "Impossible de selectionner le projet"; exit 1; }
fi
success "Projet Firebase: el-mouhssinine"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "SYNTAX CHECKS"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Check Cloud Functions syntax
log "Verification syntaxe Cloud Functions..."
if node --check functions/index.js 2>&1; then
  success "functions/index.js : syntaxe OK"
else
  error "functions/index.js : erreur de syntaxe"
  exit 1
fi

# Check Firestore Rules exist
if [ -f "firestore.rules" ]; then
  success "firestore.rules : fichier present"
else
  error "firestore.rules : fichier manquant"
  exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "BACKUP"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BACKUP_DIR="/tmp/el-mouhssinine-backup-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

# Backup critical files
cp firestore.rules "$BACKUP_DIR/"
cp functions/index.js "$BACKUP_DIR/"
success "Backup cree: $BACKUP_DIR"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "STRIPE WEBHOOK CONFIGURATION"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if command -v stripe &> /dev/null; then
  log "Stripe CLI detecte, configuration automatique..."
  # Note: Stripe CLI needs to be logged in
  warn "Verifiez manuellement dans le Stripe Dashboard que ces events sont configures:"
  echo "  - charge.dispute.created"
  echo "  - charge.dispute.closed"
  echo ""
  echo "Total attendu: 8 events webhook"
else
  warn "Stripe CLI non installe."
  echo ""
  echo -e "${YELLOW}ACTION MANUELLE REQUISE:${NC}"
  echo "  1. Ouvrir https://dashboard.stripe.com/webhooks"
  echo "  2. Selectionner le webhook el-mouhssinine"
  echo "  3. Ajouter: charge.dispute.created"
  echo "  4. Ajouter: charge.dispute.closed"
  echo "  5. Sauvegarder (total: 8 events)"
  echo ""
fi

read -p "$(echo -e ${YELLOW}Les events Stripe sont-ils configures ? [y/n]: ${NC})" STRIPE_OK
if [ "$STRIPE_OK" != "y" ]; then
  warn "Configure les events Stripe avant de continuer."
  echo "Ouvrir: https://dashboard.stripe.com/webhooks"
  read -p "Appuie sur Entree quand c'est fait..."
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "PHASE 1A — LOW RISK DEPLOY"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Deploy: adminCancelSubscription, refundDonation, refundPayment (modifie)..."
echo ""

if firebase deploy --only functions:adminCancelSubscription,functions:refundDonation,functions:refundPayment 2>&1 | tee -a "$LOG_FILE"; then
  success "Phase 1A: 3 fonctions deployees"
else
  error "Phase 1A echouee. Verifier les logs."
  echo "Log: $LOG_FILE"
  exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "PHASE 1B — MEDIUM RISK DEPLOY"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Deploy: Firestore Rules + stripeWebhook (disputes + validation montant)..."
echo ""

if firebase deploy --only firestore:rules,functions:stripeWebhook 2>&1 | tee -a "$LOG_FILE"; then
  success "Phase 1B: Firestore Rules + stripeWebhook deployes"
else
  error "Phase 1B echouee."
  echo ""
  echo -e "${RED}ROLLBACK POSSIBLE:${NC}"
  echo "  cp $BACKUP_DIR/firestore.rules ./firestore.rules"
  echo "  firebase deploy --only firestore:rules"
  exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "PHASE 1C — HIGH RISK DEPLOY (CRON)"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}reconcileStripePayments = cron hebdomadaire (dimanche 3h)${NC}"
echo "Cette fonction compare les paiements Stripe vs Firestore."
echo ""
read -p "$(echo -e ${YELLOW}Deployer reconcileStripePayments ? [y/n]: ${NC})" DEPLOY_RECON

if [ "$DEPLOY_RECON" = "y" ]; then
  if firebase deploy --only functions:reconcileStripePayments 2>&1 | tee -a "$LOG_FILE"; then
    success "Phase 1C: reconcileStripePayments deploye"
  else
    error "Phase 1C echouee (non-critique, peut etre deploye plus tard)"
  fi
else
  warn "reconcileStripePayments skippee. Deploy manuellement plus tard:"
  echo "  firebase deploy --only functions:reconcileStripePayments"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "POST-DEPLOY VERIFICATION"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Verification des fonctions deployees..."

# List deployed functions
FUNCTIONS_LIST=$(firebase functions:list 2>/dev/null || echo "Impossible de lister les fonctions")
echo "$FUNCTIONS_LIST" | tee -a "$LOG_FILE"

# Check for errors in last 5 minutes
log "Verification des erreurs recentes..."
firebase functions:log --limit 20 2>/dev/null | tee -a "$LOG_FILE" || warn "Impossible de lire les logs"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header "DEPLOY COMPLETE"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo -e "${GREEN}${BOLD}  DEPLOY PHASE 1 TERMINE${NC}"
echo ""
echo "  Fichiers deployes:"
echo "    - functions/index.js (4+ fonctions modifiees/ajoutees)"
echo "    - firestore.rules (3 collections securisees)"
echo ""
echo "  Backup: $BACKUP_DIR"
echo "  Log:    $LOG_FILE"
echo "  Errors: $ERROR_LOG"
echo ""
echo -e "${YELLOW}  PROCHAINES ETAPES:${NC}"
echo "    1. Lancer les tests manuels: ./test-manual-quick.sh"
echo "    2. Lancer le monitoring:     ./monitor-post-deploy.sh 24"
echo "    3. Verifier Stripe Dashboard: https://dashboard.stripe.com/webhooks"
echo ""

# Check if there were any errors
if [ -s "$ERROR_LOG" ]; then
  warn "Des erreurs ont ete detectees. Consulter: $ERROR_LOG"
else
  success "Aucune erreur detectee"
fi
