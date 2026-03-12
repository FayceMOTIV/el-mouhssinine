# El Mouhssinine - Contexte Projet

Application mobile iOS pour la mosquee El Mouhssinine (Centre Culturel Islamique).
Bilingue FR/AR avec support RTL. En production sur l'App Store.

## Structure
```
~/Downloads/el-mouhssinine/
├── ElMouhssinine/                    # App mobile React Native (iOS)
│   ├── src/
│   │   ├── screens/                  # 28 ecrans (.tsx)
│   │   ├── services/                 # 13 fichiers services (firebase.ts = 2374 lignes)
│   │   ├── components/               # 14 composants reutilisables
│   │   ├── hooks/                    # useQuranPlayer.ts, useResponsive.ts
│   │   ├── i18n/                     # index.ts (traductions FR/AR)
│   │   ├── navigation/               # AppNavigator.tsx, TabNavigator.tsx
│   │   ├── context/                  # LanguageContext.tsx
│   │   ├── data/                     # adhkar, alphabet, lessons, quizData, vocabulary
│   │   └── theme/                    # colors.ts
│   ├── ios/                          # Xcode project, CocoaPods, export plists
│   └── android/                      # (non utilise en production)
├── el-mouhssinine-backoffice/        # Backoffice React (admin mosquee)
│   ├── src/pages/                    # 22+ pages admin
│   ├── src/components/
│   ├── src/services/
│   └── types.js                      # Types partages (statuts, enums)
├── functions/                        # Cloud Functions Firebase (Node 20)
│   ├── index.js                      # 235KB, 34 fonctions exportees
│   └── .env                          # Stripe keys, Brevo SMTP
├── firestore.rules                   # Regles securite Firestore
├── storage.rules                     # Regles securite Storage
├── firebase.json                     # Config Firebase (hosting, functions, rules)
├── .firebaserc                       # Projet: el-mouhssinine
├── CLAUDE.md                         # Ce fichier
└── CHANGELOG.md                      # Historique detaille builds 98-277
```

## App Mobile
- **Bundle ID** : fr.elmouhssinine.mosquee
- **Build actuel** : 285
- **Stack** : React Native 0.83.1, Firebase, TypeScript
- **Architecture** : New Architecture activee (RCTNewArchEnabled: true)
- **iOS minimum** : arm64 requis

### Fichiers cles
| Fichier | Role |
|---------|------|
| src/services/firebase.ts | Toute la logique Firebase (Auth, Firestore, FCM, Stripe) |
| src/services/prayerApi.ts | Horaires priere, countdown, calendrier 2026 |
| src/services/stripe.ts | Appels Stripe (makePayment, makeSubscription) |
| src/screens/HomeScreen.tsx | Accueil avec horaires, annonces, evenements, Ramadan |
| src/screens/MemberScreen.tsx | Inscription multi-adherents, paiement, carte membre |
| src/screens/DonationsScreen.tsx | Dons CB/Apple Pay/virement, historique |
| src/screens/SurahScreen.tsx | Lecture sourate avec mode Karaoke |
| src/hooks/useQuranPlayer.ts | Hook audio Coran (TrackPlayer, repetition, vitesse) |
| src/i18n/index.ts | Toutes les traductions FR/AR |

## Backoffice
- **URL** : https://el-mouhssinine.web.app
- **Stack** : React, Vite, TailwindCSS, Firebase
- **Pages** : Dashboard, Adherents, Dons, Annonces, Evenements, Janaza, Notifications, Horaires, Parametres, Popups, RecusFiscaux, Revenus, Messages, Admins

## Firebase
- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations, messages, payments, processed_payments, notifications_history, notifications_bo

## Cloud Functions (42 deployees)
| Fonction | Type | Description |
|----------|------|-------------|
| onNewAnnouncement | Trigger Firestore | Notif auto nouvelle annonce |
| onNewEvent | Trigger Firestore | Notif auto nouvel evenement |
| onNewJanaza | Trigger Firestore | Notif auto janaza (priorite haute) |
| onNotificationFromBackoffice | Trigger Firestore | Notif depuis backoffice |
| onMessageReply | Trigger Firestore | Notif reponse message |
| onNewSympathisant | Trigger Firestore | Email bienvenue + push nouveau sympathisant |
| sendManualNotification | Callable | Envoi manuel backoffice |
| getNotificationStats | Callable | Stats pour dashboard |
| validateMembership | Callable | Validation adhesion par admin (approve/reject/request_visit) |
| scheduledJumuaReminder | Scheduled | Vendredi 11h30 |
| cleanupOldNotifications | Scheduled | Dimanche 3h |
| cachePrayerTimesDaily | Scheduled | Cache horaires priere |
| sendRecuFiscal | Callable (120s, 512MB) | Genere PDF recu fiscal + envoi email |
| getDonsByYear | Callable | Total dons par annee pour un email |
| createPaymentIntent | Callable (30s) | Paiement Stripe one-time |
| createSubscription | Callable (30s) | Abonnement Stripe recurrent mensuel |
| stripeWebhook | HTTPS (60s) | Webhook Stripe (5 events) |
| forceCachePrayerTimes | Callable | Force mise a jour cache horaires |
| onDonationConfirmation | Trigger Firestore | Email + push confirmation don |
| onCotisationConfirmation | Trigger Firestore | Email + push confirmation cotisation |
| generateAnnualRecusFiscaux | Scheduled (2 Jan 06h) | Generation CERFA annuels automatique |
| forceGenerateRecusFiscaux | Callable | Forcer generation CERFA admin |
| cancelSubscription | Callable | Annulation abonnement par user |
| adminCancelSubscription | Callable | Annulation immediate par admin |
| refundPayment | Callable | Remboursement Stripe partiel/total |
| deleteMyAccount | Callable | Suppression compte RGPD |
| deleteMemberByAdmin | Callable | Suppression membre par admin RGPD |
| checkExpiringCotisations | Scheduled | Rappels J-30/J-7/J/J+7/J+30 + grace period |
| monitorSilentBugs | Scheduled (10 min) | errors_log + paymentFailed + validation bloquée → WhatsApp |
| createPublicCheckoutSession | HTTPS | Checkout Session pour /don public |
| backfillWebDonations | HTTPS | Backfill donations web manquantes |
| syncProfileToStripe | Callable | Sync profil membre vers Stripe customer |
| refundDonation | Callable | Remboursement don Stripe |
| updatePaymentMethod | Callable | Mise a jour moyen paiement |
| checkPendingPayment | Callable | Verification paiement en attente |
| undoValidation | Callable | Annulation validation adhesion |
| generateAIContent | Callable | Proxy OpenAI (cle serveur uniquement) |
| reconcileStripePayments | Callable | Reconciliation paiements Stripe |
| exportMyData | Callable | Export RGPD donnees personnelles |
| onAuthUserDeleted | Auth trigger | Nettoyage apres suppression compte |

## Configuration

### Stripe
- Webhook : `https://europe-west1-el-mouhssinine.cloudfunctions.net/stripeWebhook`
- Events : `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.deleted`, `customer.subscription.updated`, `checkout.session.completed`
- Apple Pay Merchant ID : `merchant.fr.elmouhssinine.mosquee`
- Mode LIVE (sk_live/pk_live)

### APNs
- Key ID : 4YY44LG5M5 | Team ID : 5ZR87TPM89
- Environment : Sandbox & Production

### Email
- SMTP Brevo (smtp-relay.brevo.com:587)
- Expediteur : centreculturelislamique@orange.fr

## Commandes utiles

### Build iOS
```bash
cd ElMouhssinine/ios && pod install
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath /tmp/ElMouhssinine-BUILD_NUMBER.xcarchive
```

### Upload TestFlight
Ouvrir l'archive dans Xcode Organizer puis "Distribute App" :
```bash
open /tmp/ElMouhssinine-BUILD_NUMBER.xcarchive
```
Note : CLI (`xcrun altool`) echoue — utiliser Xcode Organizer.

### Bump version
Modifier `CURRENT_PROJECT_VERSION` dans `project.pbxproj` (2 occurrences) + `CFBundleVersion` dans `Info.plist`.

### Deploy
```bash
cd el-mouhssinine-backoffice && npm run build && firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## Git
- **Remote** : https://github.com/FayceMOTIV/el-mouhssinine.git
- **Branche** : main

## Bugs connus / Pieges

### Validation admin obligatoire (CRITIQUE)
**AUCUN chemin ne doit mettre status='actif' sans passer par validateMembership CF** (admin-gated).
- Webhook payment_intent.succeeded → `en_attente_validation` (jamais actif)
- Webhook invoice.payment_succeeded → maintient le statut existant
- BO handleSetPaid/handleSetSigned → appelle CF validateMembership
- Firestore rules bloquent modification du champ `status` par non-admin

### Grace period cotisation
Jour J : `gracePeriodEnd = today + 7j`, status reste `actif`
J+7 : si `gracePeriodEnd <= today` → status `sympathisant` + email + push
J+30 : relance email + push

### membreId vs memberId (payments)
- `memberId` : format ELM-XXXX (affichage)
- `membreId` : UID Firebase (lookup)
- BO doit utiliser `p.membreId || p.metadata?.memberId`

### FlatList + getItemLayout + ListHeaderComponent
**NE JAMAIS** combiner ces deux props. Les offsets ignores le header = items invisibles.

### useQuranPlayer (react-native-track-player)
- Ne PAS utiliser `useProgress()` ou `useTrackPlayerEvents()` avant init player
- `TrackPlayer.addEventListener()` conditionne sur `isPlayerReady`
- **TOUJOURS** garder les setState avec `isMountedRef.current` (crash Fabric)

### subscribeToMyMembership vs getMemberProfile
Les deux DOIVENT chercher dans le meme ordre : `doc(uid)` → `where('uid')` → `where('email')`.

### Statuts membres
Francais minuscule : `actif`, `expire`, `sympathisant`, `annule`, `en_attente_validation`, `en_attente_paiement`, `en_attente_signature`.

### Gold Price API
NBP + Frankfurter (pas goldprice.org). Cache 6h, fallback 141EUR/g.

### TouchableWithoutFeedback
Max 2 niveaux d'imbrication. 3+ = taps bloques.

### Historique dons — double query
Combiner `where('userId')` + `where('donateurEmail')`, dedupliquer par doc.id via Map.

### ConfirmModal
Prop `confirmText` (PAS `confirmLabel`). Toujours passer `loading={state}`.

### Notifications backoffice (notifications_bo)
- Helper `createNotifBO()` dans index.js — fire-and-forget
- 10 types : nouveau_membre, paiement, validation_requise, annulation, remboursement, expiration_proche, compte_supprime, don, refus_admin, janaza
- NotificationsBell.jsx (Header.jsx) — onSnapshot temps reel

### MosqueGeofencing
- iOS : `wantsMonitoring` (UserDefaults) obligatoire dans delegate
- Android : BroadcastReceiver statique dans AndroidManifest (pas dynamique)

### Firebase onSnapshot
Toujours passer un parametre d'erreur pour distinguer "pas de donnees" de "erreur Firestore".

## Monitoring (Build 278+)

### Crashlytics + Analytics + Performance
- `src/services/monitoring.ts` — service centralise (logError, trackEvent, startTrace, etc.)
- Crashlytics s'active automatiquement via `FirebaseApp.configure()` (AppDelegate.swift L22)
- Analytics events : payment_started, payment_success, payment_failed, donation_success, geofence_mosque_enter, quran_play, janaza_view
- Performance trace : `payment_flow` autour du flux paiement

### WhatsApp Crash Alert
- CF `alertCrashWhatsApp` — trigger `onNewFatalIssuePublished` (Crashlytics)
- Envoie un WhatsApp via Twilio quand un crash fatal est detecte
- Secrets Firebase : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_TO

### Silent Bug Monitoring (Build 281)
- `logServerError(message, context, data)` dans index.js — fire-and-forget, ecrit dans `errors_log/`
- 16 points de monitoring dans les CF (webhook, FCM, emails, validation, reconciliation)
- `monitorSilentBugs` (every 10 min) : 6 checks — errors_log non alertees, paymentFailed, validation bloquee >30min, dons sans userId, membres actifs expires (drift Stripe), CF errors recentes
- Build 280 : fix historique donations (donateurEmail .lower(), BREVO process.env, merge listeners), page noire /don bypass auth loader

### Stripe Checkout Session donations (Build 284)
- `/don` public page → CF `createPublicCheckoutSession` → Stripe Checkout Session (remplace Payment Link)
- Checkout Session inclut metadata (email, name) pour traçabilite complete
- Webhook `checkout.session.completed` → cree doc donation dans Firestore
- Historique app via fallback `where('donateurEmail', '==', email)` — fonctionne si meme email que Firebase Auth

### Audit securite Build 285 (22 fixes)
- P0: OpenAI API key deplacee cote serveur (CF `generateAIContent` proxy)
- P0: openai.js backoffice utilise httpsCallable (plus de cle exposee)
- P1: emailService.js — suppression VITE_RESEND_API_KEY et VITE_SENDGRID_API_KEY
- P1: Notifications.jsx — ConfirmModal avant envoi notification
- P1: firestore.rules — payments `allow create: if false` (webhook uniquement)
- P1: storage.rules — restrictions taille (5MB) et types MIME
- P1: exportMyData — inclut recus_fiscaux
- P1: DonationsScreen/MessagesScreen/HomeScreen/MoreScreen — try/catch robustes
- P1: goldPrice.ts — AbortController timeout 10s sur fetch
- P1: ProfileEditScreen — validation uid coherence
- P1: DonPublic.jsx — page remerciement apres don reussi (success=1)
- P2: Adherents.jsx — handleRefund loading state
- UX: Suppression bouton virement redondant sur formulaire don app (page 2)

## Quand Faical dit "verifie les bugs" ou "check les crashs"

Executer cette sequence sans attendre d'autres instructions :

1. **Lire les crashs Crashlytics** via Firebase MCP (si connecte) ou demander `firebase login`
2. **Analyser les 5 crashs les plus recents** : stack trace, fichier, ligne, cause
3. **Proposer les fixes** : fichier, ligne, cause (1 phrase), code corrige
4. **Attendre validation** — ne jamais appliquer un fix sans confirmation

## Regles absolues du projet
- NE JAMAIS builder ou deployer sans accord explicite de Faical
- Region Cloud Functions : europe-west1 TOUJOURS
- L'app ne doit JAMAIS ecrire dans `payments/` — webhook admin SDK uniquement
- `computeMemberStatus` dans `utils/memberStatus.ts` = source de verite unique du statut
- `paymentSucceededRef` est un useRef — ne jamais le remplacer par useState
- Animations Quran : useNativeDriver: false obligatoire

## Firebase MCP
```bash
# Configurer (une seule fois) :
claude mcp add firebase -- npx -y firebase-tools@latest mcp
# Verifier :
claude mcp list
```
Une fois actif, Claude Code peut interroger : Crashlytics, Firestore, CF logs, FCM.

## Notes
- 42 Cloud Functions deployees (+ createNotifBO helper + alertCrashWhatsApp + monitorSilentBugs + generateAIContent)
- Score audit securite : 9/10
- App iOS uniquement en production (Android non deploye)
- Calendrier priere local 2026 complet (fallback Mawaqit)
- Stripe en mode LIVE
- Brevo SMTP pour emails transactionnels
- Historique detaille des builds : voir CHANGELOG.md
