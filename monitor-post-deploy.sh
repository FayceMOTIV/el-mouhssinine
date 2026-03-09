#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MONITOR POST-DEPLOY — El Mouhssinine
# Surveillance automatique post-deploy
# Usage: ./monitor-post-deploy.sh [heures] (default: 24)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DURATION_HOURS=${1:-24}
CHECK_INTERVAL=300  # 5 minutes
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="/tmp/monitoring-report-${TIMESTAMP}.txt"
ALERTS=0
WARNINGS=0
CHECKS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$REPORT_FILE"; }
alert() { ALERTS=$((ALERTS+1)); echo -e "${RED}[$(date '+%H:%M:%S')] 🚨 ALERT: $1${NC}" | tee -a "$REPORT_FILE"; }
warning() { WARNINGS=$((WARNINGS+1)); echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  WARNING: $1${NC}" | tee -a "$REPORT_FILE"; }
ok() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ OK: $1${NC}" | tee -a "$REPORT_FILE"; }

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   MONITORING POST-DEPLOY — El Mouhssinine       ║"
echo "  ║   Duree: ${DURATION_HOURS}h | Interval: $((CHECK_INTERVAL/60))min          ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "Rapport: $REPORT_FILE"
echo "Ctrl+C pour arreter"
echo ""

log "=== MONITORING DEMARRE ==="
log "Duree: ${DURATION_HOURS}h | Interval: $((CHECK_INTERVAL/60))min"
log ""

END_TIME=$(($(date +%s) + DURATION_HOURS * 3600))

run_check() {
  CHECKS=$((CHECKS+1))
  local CHECK_NUM=$CHECKS

  log "--- CHECK #${CHECK_NUM} ($(date '+%H:%M:%S')) ---"

  # ━━━ 1. Cloud Functions Errors ━━━
  log "1. Cloud Functions errors..."
  ERRORS=$(firebase functions:log --limit 50 2>/dev/null | grep -c "Error\|error\|ERROR\|CRASH" || echo "0")
  TOTAL_LOGS=$(firebase functions:log --limit 50 2>/dev/null | wc -l | tr -d ' ' || echo "50")

  if [ "$TOTAL_LOGS" -gt 0 ] 2>/dev/null; then
    ERROR_RATE=$(echo "scale=1; $ERRORS * 100 / $TOTAL_LOGS" | bc 2>/dev/null || echo "0")
    if [ "$ERRORS" -gt 2 ]; then
      alert "Cloud Functions: $ERRORS erreurs dans les 50 derniers logs (${ERROR_RATE}%)"
    elif [ "$ERRORS" -gt 0 ]; then
      warning "Cloud Functions: $ERRORS erreur(s) detectee(s)"
    else
      ok "Cloud Functions: 0 erreurs"
    fi
  else
    ok "Cloud Functions: pas de logs recents"
  fi

  # ━━━ 2. Specific function checks ━━━
  log "2. Fonctions specifiques Phase 1..."

  for func in adminCancelSubscription refundDonation stripeWebhook; do
    FUNC_ERRORS=$(firebase functions:log --only $func --limit 20 2>/dev/null | grep -c "Error\|error\|ERROR" || echo "0")
    if [ "$FUNC_ERRORS" -gt 0 ]; then
      warning "$func: $FUNC_ERRORS erreur(s)"
    else
      ok "$func: OK"
    fi
  done

  # ━━━ 3. Stripe Webhook Health ━━━
  log "3. Stripe webhook health..."
  WEBHOOK_ERRORS=$(firebase functions:log --only stripeWebhook --limit 30 2>/dev/null | grep -c "Webhook verification failed\|Invalid signature\|Unauthorized" || echo "0")
  if [ "$WEBHOOK_ERRORS" -gt 0 ]; then
    alert "Stripe webhook: $WEBHOOK_ERRORS erreurs de signature"
  else
    ok "Stripe webhook: signatures OK"
  fi

  # ━━━ 4. Disputes Detection ━━━
  log "4. Detection disputes Stripe..."
  DISPUTE_LOGS=$(firebase functions:log --only stripeWebhook --limit 50 2>/dev/null | grep -c "charge.dispute" || echo "0")
  if [ "$DISPUTE_LOGS" -gt 0 ]; then
    warning "Disputes Stripe detectes ($DISPUTE_LOGS entries). Verifier Stripe Dashboard."
  else
    ok "Aucun litige Stripe detecte"
  fi

  # ━━━ 5. Reconciliation (if deployed) ━━━
  log "5. Reconciliation Stripe/Firestore..."
  RECON_ERRORS=$(firebase functions:log --only reconcileStripePayments --limit 10 2>/dev/null | grep -c "MISMATCH\|mismatch\|Error" || echo "0")
  if [ "$RECON_ERRORS" -gt 0 ]; then
    alert "Reconciliation: $RECON_ERRORS anomalies detectees"
  else
    ok "Reconciliation: OK (ou pas encore execute)"
  fi

  # ━━━ 6. Email functions ━━━
  log "6. Fonctions email..."
  for func in onDonationConfirmation onCotisationConfirmation; do
    MAIL_ERRORS=$(firebase functions:log --only $func --limit 10 2>/dev/null | grep -c "Error\|SMTP\|timeout" || echo "0")
    if [ "$MAIL_ERRORS" -gt 0 ]; then
      warning "$func: $MAIL_ERRORS erreur(s) email"
    else
      ok "$func: OK"
    fi
  done

  # ━━━ Summary ━━━
  log ""
  log "Check #${CHECK_NUM} termine | Alertes cumulees: $ALERTS | Warnings: $WARNINGS"
  log ""
}

# Main loop
while [ "$(date +%s)" -lt "$END_TIME" ]; do
  run_check

  REMAINING=$(( (END_TIME - $(date +%s)) / 60 ))
  echo -e "${BLUE}Prochain check dans $((CHECK_INTERVAL/60))min | Temps restant: ${REMAINING}min${NC}"
  echo ""

  sleep $CHECK_INTERVAL
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "=== MONITORING TERMINE ==="
log ""
log "RAPPORT FINAL"
log "============="
log "Duree: ${DURATION_HOURS}h"
log "Checks effectues: $CHECKS"
log "Alertes critiques: $ALERTS"
log "Warnings: $WARNINGS"
log ""

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  RAPPORT FINAL — MONITORING ${DURATION_HOURS}H${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Checks effectues: ${BOLD}$CHECKS${NC}"
echo -e "  Alertes:          ${RED}${BOLD}$ALERTS${NC}"
echo -e "  Warnings:         ${YELLOW}${BOLD}$WARNINGS${NC}"
echo ""

if [ "$ALERTS" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}MONITORING OK — PRET POUR BUILD 226 TESTFLIGHT${NC}"
  log "VERDICT: OK — PRET POUR BUILD 226"
else
  echo -e "  ${RED}${BOLD}$ALERTS ALERTE(S) DETECTEE(S) — INVESTIGUER AVANT BUILD${NC}"
  log "VERDICT: $ALERTS ALERTE(S) — INVESTIGATION REQUISE"
fi

echo ""
echo "  Rapport complet: $REPORT_FILE"
echo ""
