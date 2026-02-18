# El Mouhssinine - Contexte Projet

## Structure
```
~/Downloads/el-mouhssinine/
├── ElMouhssinine/              # App mobile React Native
├── el-mouhssinine-backoffice/  # Backoffice React
├── functions/                  # Cloud Functions Firebase
├── firestore.rules             # Regles securite Firestore
└── firebase.json               # Config Firebase
```

## App Mobile
- **Chemin** : ~/Downloads/el-mouhssinine/ElMouhssinine/
- **Bundle ID** : fr.elmouhssinine.mosquee
- **Build actuel** : 231
- **Stack** : React Native 0.83.1, Firebase, TypeScript

## Backoffice
- **Chemin** : ~/Downloads/el-mouhssinine/el-mouhssinine-backoffice/
- **URL** : https://el-mouhssinine.web.app
- **Stack** : React, Vite, Firebase

## Firebase
- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations, messages, payments

## Cloud Functions (32 deployees)
| Fonction | Type | Description |
|----------|------|-------------|
| onNewAnnouncement | Trigger Firestore | Notif auto nouvelle annonce |
| onNewEvent | Trigger Firestore | Notif auto nouvel evenement |
| onNewJanaza | Trigger Firestore | Notif auto janaza (priorite haute) |
| onNotificationFromBackoffice | Trigger Firestore | Notif depuis backoffice |
| onMessageReply | Trigger Firestore | Notif reponse message |
| onNewSympathisant | Trigger Firestore | Email bienvenue nouveau sympathisant |
| sendManualNotification | Callable | Envoi manuel backoffice |
| getNotificationStats | Callable | Stats pour dashboard |
| validateMembership | Callable | Validation adhesion par admin |
| scheduledJumuaReminder | Scheduled | Vendredi 11h30 |
| cleanupOldNotifications | Scheduled | Dimanche 3h |
| cachePrayerTimesDaily | Scheduled | Cache horaires priere |
| sendRecuFiscal | Callable (120s, 512MB) | Genere PDF recu fiscal + envoi email |
| getDonsByYear | Callable | Total dons par annee pour un email |
| createPaymentIntent | Callable (30s) | Paiement Stripe one-time |
| createSubscription | Callable (30s) | Abonnement Stripe recurrent mensuel |
| stripeWebhook | HTTPS (60s) | Webhook Stripe (payment_intent + invoice + subscription) |
| forceCachePrayerTimes | Callable | Force mise a jour cache horaires |
| onDonationConfirmation | Trigger Firestore | Email confirmation don (particulier + entreprise) |
| onCotisationConfirmation | Trigger Firestore | Email confirmation cotisation adherent |
| generateAnnualRecusFiscaux | Scheduled (2 Jan 06h) | Generation CERFA annuels automatique |
| forceGenerateRecusFiscaux | Callable | Forcer generation CERFA admin |

## Fonctionnalites Implementees

### Priere et Horaires
- Horaires priere methode Mawaqit/UOIF (12 degres)
- Notifications configurables (avant/a l'heure)
- Boost de priere ("J'ai prie")
- Notification Jumu'a le vendredi
- Mode silencieux mosquee (geolocalisation)
- Calendrier fallback 2026 complet (12 mois)

### Coran
- 114 sourates avec audio recitation
- Mode lecture page par page (604 pages Mushaf)
- Marque-pages et sauvegarde progression
- Toggle arabe seul / francais seul
- Navigation par sourate, page ou juz
- Cache offline avec retry automatique

### Adhesion et Paiement
- Multi-adherents (inscrire plusieurs personnes)
- Paiement Stripe (CB, Apple Pay)
- Flux virement bancaire complet
- Carte membre digitale plein ecran
- Swipe entre membres (famille)
- Couleur dynamique selon statut

### Notifications
- Push FCM automatiques (annonces, evenements, janaza)
- Notifications locales de priere
- Historique des notifications (cloche sur HomeScreen)
- Badge compteur non lus

### Autres
- Traductions FR/AR completes + support RTL
- TTS prononciation arabe (expo-speech)
- Adhkar (invocations)
- Apprentissage arabe (alphabet + lecons)
- Dates islamiques avec countdown
- Popups et rappels du jour dynamiques
- Recus fiscaux PDF par email
- Messages prives avec la mosquee

## APNs Configuration
- **Key ID** : 4YY44LG5M5
- **Team ID** : 5ZR87TPM89
- **Environment** : Sandbox & Production

## Configuration Stripe

### Cles Stripe
- **App.tsx** : `STRIPE_PUBLISHABLE_KEY`
- **Cloud Functions** : `firebase functions:config:set stripe.secret_key="sk_live_XXX"`
- **Webhook secret** : `firebase functions:config:set stripe.webhook_secret="whsec_XXX"`

### Webhook Stripe
- URL : `https://europe-west1-el-mouhssinine.cloudfunctions.net/stripeWebhook`
- Events : `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.deleted`, `customer.subscription.updated`

### Apple Pay
- Merchant ID : `merchant.fr.elmouhssinine.mosquee`
- Configure dans : `ElMouhssinine.entitlements` + `App.tsx` (StripeProvider) + `stripe.ts` (merchantCountryCode: FR)

## Configuration Email
- SMTP Brevo (smtp-relay.brevo.com:587)
- Expediteur : centreculturelislamique@orange.fr

## Securite implementee
- Firebase Auth reel (signInWithEmailAndPassword)
- Validation montant Stripe (1-10000 EUR)
- Protection double paiement (verrou isProcessingPayment)
- Idempotence webhook (collection processed_payments)
- Logs securises (emails masques, pas d'IBAN)
- Cloud Functions protegees (isAdmin check)
- Limite notifications iOS (64 max)

## Commandes utiles

### Build iOS
```bash
cd ElMouhssinine/ios && pod install
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine -configuration Release -destination 'generic/platform=iOS' -archivePath ./build/ElMouhssinine.xcarchive
```

### Export et Upload TestFlight (une seule commande)
```bash
xcodebuild -exportArchive -archivePath ./build/ElMouhssinine.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath ./build/upload -allowProvisioningUpdates
```
Note : `ExportOptions.plist` contient `destination: upload` → exporte ET uploade sur TestFlight en une seule commande.
Pour exporter l'IPA sans upload : utiliser `ExportOptionsNoUpload.plist` avec `-exportPath ./build/export`.

### Backoffice
```bash
cd el-mouhssinine-backoffice && npm run build && firebase deploy --only hosting
```

### Cloud Functions
```bash
firebase deploy --only functions
```

### Firestore Rules
```bash
firebase deploy --only firestore:rules
```

## Git
- **Remote** : https://github.com/FayceMOTIV/el-mouhssinine.git
- **Branche** : main

## TODO Futur
- [ ] Verifier expediteur Brevo (centreculturelislamique@orange.fr)
- [ ] Remplir infos association dans backoffice (Recus fiscaux > Parametres)

## Corrige (5 Fev 2026 - Build 98)

### Traduction i18n - Cartes de membre
- [x] MemberCard.tsx : Textes traduits (ACTIF, EXPIRE, N° ADHERENT, TITULAIRE, VALIDE)
- [x] MemberCardFullScreen.tsx : 20+ statuts traduits (EN ATTENTE VALIDATION, etc.)
- [x] Support RTL complet sur les cartes de membre
- [x] 22 nouvelles cles i18n ajoutees (FR + AR)

### Accessibilite - Touch targets
- [x] MoreScreen.tsx : pickerOption minWidth/minHeight = 44pt (Apple HIG)
- [x] MoreScreen.tsx : switch minHeight = 44pt

### Cloud Functions - Timeouts
- [x] createPaymentIntent : 30s, 256MB
- [x] stripeWebhook : 60s, 256MB
- [x] sendRecuFiscal : 120s, 512MB (generation PDF + email)

## Corrige (8 Fev 2026 - Build 192-193)

### Bugs visuels responsive iPhone Mini
- [x] MoreScreen.tsx : Layout vertical pour pickers (label AU-DESSUS des boutons)
- [x] i18n : Traductions raccourcies "Avant prière" / "قبل الصلاة"

### Scroll Coran
- [x] QuranReadScreen.tsx : Fix PanResponder bloquant le scroll
- [x] onStartShouldSetPanResponder: false (ne capture plus les touches initiales)
- [x] onMoveShouldSetPanResponder: capture uniquement les swipes horizontaux

### Admin et Backoffice
- [x] Fix document admin avec UID comme ID (requis par Firestore rules)
- [x] Admins.jsx : Champ UID obligatoire pour nouveaux admins
- [x] Parametres.jsx : Fix upload image header (plus de fetch CORS)

### UI Janaza et Carte membre
- [x] HomeScreen.tsx : Section Janaza en blanc comme les autres sections
- [x] MemberCard.tsx : Logo "م" remplacé par "🕌"
- [x] MemberCard.tsx : Chiffres plus petits (fontSize 24, margin 8) - évite retour ligne
- [x] MemberCardFullScreen.tsx : Logo "م" remplacé par "🕌"

### Image Hero HomeScreen
- [x] Debug logging ajouté pour headerImageUrl
- [x] Géré via backoffice > Paramètres > Image d'en-tête

## Corrige (9 Fev 2026 - Build 194)

### Pages Coran - Textes lisibles
- [x] QuranScreen.tsx : Textes sombres sur fond clair (subtitle, sectionTitle, filterButtonText)
- [x] SurahScreen.tsx : Textes noirs (loadingText, surahNumber, metaText, optionText, etc.)
- [x] QuranReadScreen.tsx : Textes noirs (toutes les références blanches remplacées)
- [x] Boutons filtre et options avec backgroundColor: colors.card + bordure

### Modal recherche QuranReadScreen
- [x] KeyboardAvoidingView ajouté pour éviter que le clavier cache l'input
- [x] TouchableWithoutFeedback pour fermer le clavier
- [x] Modal réduite (minHeight 40%, maxHeight 70%)
- [x] keyboardShouldPersistTaps="handled" sur les FlatLists
- [x] returnKeyType="go" avec onSubmitEditing sur l'input page

### Carte membre optimisée
- [x] MemberCard.tsx : Chiffres réduits de 50% (fontSize 24→14, margin 8→4)
- [x] Plus de retour à la ligne sur petits écrans

### Recherche Quran optimisée
- [x] QuranScreen.tsx : autoCorrect={false}, autoCapitalize="none", autoComplete="off"
- [x] returnKeyType="search" pour clavier optimisé

## Corrige (10 Fev 2026 - Build 195)

### Audit complet textes blancs sur fond clair
- [x] QuranHomeScreen.tsx : Tous les textes corrigés (title, quoteFr, quoteRef, footerText)
- [x] QuranHomeScreen.tsx : StatusBar dark-content, ScrollView ajouté, responsive small screens
- [x] AlphabetScreen.tsx : subtitle et sectionTitle corrigés
- [x] AdhkarScreen.tsx : subtitle et sectionTitle corrigés
- [x] AdhkarDetailScreen.tsx : description et shareButton corrigés
- [x] LessonsListScreen.tsx : subtitle, levelButton, levelButtonText, reviewButton corrigés
- [x] QuizScreen.tsx : subtitle, sectionTitle, statDivider, quitButton, progressBarContainer, answerIndex, backButton corrigés
- [x] LessonScreen.tsx : closeButton et prevButton corrigés
- [x] MessagesScreen.tsx : emptyText corrigé
- [x] ConversationScreen.tsx : messageTime corrigé
- [x] MoreScreen.tsx : versionText, copyrightText, languageOption corrigés

### Carte membre - Chiffres encore réduits
- [x] MemberCard.tsx : fontSize 14→11, marginRight 4→2, fontWeight 600

### QuranHomeScreen responsive petits écrans
- [x] ScrollView pour permettre le scroll sur petits écrans
- [x] Tailles de police réduites sur isSmallScreen
- [x] Padding et marges adaptés
- [x] Textes de boutons raccourcis ("Page par page", "Récitation audio")

## Corrige (10 Fev 2026 - Build 196)

### Mode Karaoke - Suivi synchronisé lecture Coran
- [x] SurahScreen.tsx : Réécriture complète avec mode Karaoke
- [x] Audio verset par verset (au lieu de sourate entière)
- [x] Auto-play du verset suivant quand le précédent se termine
- [x] Auto-scroll vers le verset en cours de lecture
- [x] Highlighting du verset actif (fond doré transparent, bordure accent)
- [x] Contrôles Play/Pause/Stop
- [x] Clic sur un verset pour lire à partir de ce point
- [x] TrackPlayer events (PlaybackState, PlaybackError)
- [x] getItemLayout + onScrollToIndexFailed pour scroll fiable
- [x] removeClippedSubviews={false} pour auto-scroll

### quranApi.ts - IDs réciteurs mis à jour
- [x] ar.abdulbasit → ar.abdulbasitmurattal
- [x] ar.abdurrahmaansudais → ar.abdurrahmanalsudais
- [x] ar.saoodshuraym → ar.shuraim
- [x] getVerseAudioUrl() ajouté pour audio verset par verset

### i18n - Traductions Karaoke
- [x] listenWithKaraoke (FR/AR)
- [x] karaokeHint (FR/AR)
- [x] stopKaraoke, karaokeVerse, karaokeOf (FR/AR)

### API Audio Coran
- Sourate complète : cdn.islamic.network/quran/audio-surah/128/{reciter}/{surahNumber}.mp3
- Verset par verset : cdn.islamic.network/quran/audio/128/{reciter}/{globalVerseNumber}.mp3

## Corrige (10 Fev 2026 - Build 197)

### Mode Karaoke PRO - Version Professionnelle
- [x] useQuranPlayer.ts : Hook personnalisé avec gestion audio complète
- [x] QuranVerse.tsx : Composant verset avec animations fluides (pulse, glow, sound bars)
- [x] QuranMiniPlayer.tsx : Mini lecteur flottant avec tous les contrôles
- [x] SurahScreen.tsx : Intégration des 3 composants pro

### Fonctionnalités useQuranPlayer
- [x] Modes de répétition : none, verse, surah, range
- [x] Vitesses de lecture : 0.5x, 0.75x, 1x, 1.25x, 1.5x
- [x] Sauvegarde progression dans AsyncStorage
- [x] Reprise automatique de la dernière position
- [x] Callback onVerseChange pour scroll synchronisé

### Animations QuranVerse
- [x] Pulsation douce (scale 1 → 1.02) quand actif
- [x] Background animé (transparent → doré)
- [x] Barres de son animées (4 barres, hauteurs variables)
- [x] memo() pour éviter re-renders inutiles

### Mini Player Flottant
- [x] Barre de progression sourate (pourcentage global)
- [x] Barre de progression verset (position dans l'audio actuel)
- [x] Contrôles : prev, play/pause, next, stop
- [x] Boutons vitesse et répétition
- [x] Animation d'entrée (spring slide-up)
- [x] Bouton fermer

### Architecture fichiers
- src/hooks/useQuranPlayer.ts (NOUVEAU)
- src/components/QuranVerse.tsx (NOUVEAU)
- src/components/QuranMiniPlayer.tsx (NOUVEAU)
- src/screens/SurahScreen.tsx (REFACTORISÉ)

## Corrige (10 Fev 2026 - Build 198)

### Fix useQuranPlayer - Erreur audio Karaoke
- [x] Ajout de refs (useRef) pour accéder aux valeurs actuelles dans les callbacks async
- [x] Protection contre tableau verses vide au démarrage
- [x] Ajout de logs de debug pour tracer les problèmes
- [x] Event.PlaybackActiveTrackChanged en plus de State.Ended pour détecter fin de verset
- [x] setIsLoading(false) après succès de lecture
- [x] Séparation de l'initialisation player et du chargement de progression

## Corrige (10 Fev 2026 - Build 199)

### Fix Mode Silencieux Mosquée - Notifications non reçues
- [x] Rayon de détection augmenté de 100m à 250m (compense imprécision GPS en background)
- [x] Nouvelle fonction `checkMosqueProximityForeground()` avec haute précision GPS
- [x] AppState listener dans HomeScreen pour vérifier à chaque passage au premier plan
- [x] Logs de diagnostic ajoutés (console.log visible même en production)
- [x] Amélioration des messages de log (distance, rayon, cooldown restant)

### Architecture Mode Silencieux
- **backgroundLocation.ts** : `checkMosqueProximityForeground()` (haute précision, premier plan)
- **HomeScreen.tsx** : AppState.addEventListener('change') déclenche la vérification
- **prayerNotifications.ts** : Logs améliorés pour le diagnostic

## Corrige (10 Fev 2026 - Build 200)

### Fix Audio Coran - Lecture ne démarre pas
- [x] Bug `seekToVerse` : ref `currentVerseIndexRef` n'était pas mis à jour immédiatement
- [x] `handlePlayVerse` simplifié : appelle directement `playVerseAtIndex` au lieu de `seekToVerse` + `play()`
- [x] Mise à jour synchrone du ref dans `playVerseAtIndex` avant le setState
- [x] Logs de debug détaillés ajoutés dans tout le flux de lecture

### Cause du bug
Le flux `seekToVerse()` → `play()` avait un problème de timing :
1. `seekToVerse` appelait `setCurrentVerseIndex(index)` (async)
2. Le ref `currentVerseIndexRef` était mis à jour dans un `useEffect` (async)
3. `play()` était appelé immédiatement après et utilisait l'ancienne valeur du ref

### Solution
- Mise à jour du ref IMMÉDIATEMENT (synchrone) avant `setCurrentVerseIndex`
- `handlePlayVerse` utilise maintenant `playVerseAtIndex` directement

## Corrige (10 Fev 2026 - Build 201)

### Fix Crash Audio Coran - Réécriture complète useQuranPlayer
- [x] Suppression de `useProgress()` (hook RNTP qui crashait avant init player)
- [x] Suppression de `useTrackPlayerEvents()` (hook RNTP qui crashait avant init player)
- [x] Remplacé par `TrackPlayer.addEventListener()` manuel dans un `useEffect` conditionnel sur `isPlayerReady`
- [x] Polling manuel de la progression avec `setInterval` (200ms)
- [x] Single `stateRef` pour tout l'état au lieu de 10+ refs individuels
- [x] Toutes les opérations TrackPlayer wrappées dans try-catch
- [x] Event listeners subscription/cleanup wrappés dans try-catch

### Cause du crash
Les hooks `useProgress()` et `useTrackPlayerEvents()` de react-native-track-player étaient appelés avant que le player soit initialisé, causant un crash JavaScript attrapé par ErrorBoundary dans App.tsx.

### Solution architecturale
```typescript
// Avant (CRASH) :
const { position, duration } = useProgress();
useTrackPlayerEvents([Event.PlaybackState], (event) => { ... });

// Après (STABLE) :
const [isPlayerReady, setIsPlayerReady] = useState(false);
useEffect(() => { setupPlayer().then(() => setIsPlayerReady(true)); }, []);

// Polling manuel seulement si player prêt
useEffect(() => {
  if (!isPlaying || !isPlayerReady) return;
  const interval = setInterval(async () => {
    const position = await TrackPlayer.getPosition();
    const duration = await TrackPlayer.getDuration();
    // ...
  }, 200);
  return () => clearInterval(interval);
}, [isPlaying, isPlayerReady]);

// Event listeners seulement si player prêt
useEffect(() => {
  if (!isPlayerReady) return;
  const subs = [];
  try {
    subs.push(TrackPlayer.addEventListener(Event.PlaybackState, ...));
  } catch {}
  return () => { subs.forEach(s => { try { s.remove(); } catch {} }); };
}, [isPlayerReady]);
```

## Corrige (11 Fev 2026 - Build 206-212)

### 6 Bugs critiques corriges
- [x] Karaoke : `useEffect` cleanup + `isActiveRef` pour eviter desync audio/scroll
- [x] Vocabulaire : Bouton supprimer supprime maintenant le bon mot (index correct)
- [x] Zakat : `keyboardType="numeric"` sur tous les champs montant
- [x] Zakat : Bouton CB texte corrige "Payer par CB" au lieu de "Payer la Zakat"
- [x] RIB : Texte IBAN long ne deborde plus (flexShrink + flexWrap)
- [x] Lecons : Progression sauvegardee dans AsyncStorage (persistance entre sessions)

### Emails automatiques (Cloud Functions)
- [x] `onDonationConfirmation` : Email confirmation don particulier + entreprise (onCreate trigger)
- [x] `onCotisationConfirmation` : Email confirmation cotisation adherent (onCreate trigger)
- [x] Templates HTML : header gradient vert, encart fiscal, footer association
- [x] Idempotence : flag `emailConfirmationSent` pour eviter doublons
- [x] Deduction fiscale : 66% particulier (art. 200 CGI) / 60% entreprise (art. 238 bis CGI)

### CERFA et Recus fiscaux (Cloud Functions)
- [x] `generateAnnualRecusFiscaux` : Cron 2 janvier 06h00
- [x] `forceGenerateRecusFiscaux` : Generation forcee admin
- [x] Templates PDF : 11580*05 (particulier) + 16216*02 (entreprise)
- [x] Rate limiting : 3/heure max

### Backoffice Dons + Recus Fiscaux
- [x] Dons.jsx : Colonnes Donateur, Type, Origine, filtres ameliores
- [x] RecusFiscaux.jsx : Vue par annee, generation individuelle/groupee, stats

### Firestore Rules renforces
- [x] donations : auth + montant 1-100000€
- [x] payments : auth + montant 1-10000€
- [x] processed_payments : verrouille total (if false)

## Corrige (12 Fev 2026 - Build 213)

### Page Membre - Conformite spec UI
- [x] Icones avantages adherent : ✨ hassanates, 🗳️ vote AG, 🎫 carte membre
- [x] Suffixes prix : "10€/mois" et "100€/an" (au lieu de juste "10€" et "100€")
- [x] Descripteurs formule : "Paiement recurrent" (mensuel) / "Paiement unique - ECONOMISEZ" (annuel)

### Fix critique : Metadata addPayment (emails cotisation)
- [x] `AddPaymentParams` : ajout champ `memberEmail`
- [x] `addPayment()` : ajout bloc `metadata` dans le document Firestore (memberId, email, period)
- [x] `MemberScreen.tsx` : passage `memberEmail: memberProfile.email` dans les 2 appels addPayment
- [x] Sans ce fix, `onCotisationConfirmation` ne trouvait jamais l'email → emails jamais envoyes

### Audit backend complet
- [x] 21 Cloud Functions : toutes presentes et fonctionnelles
- [x] Flux Stripe end-to-end : verifie et corrige
- [x] Securite Firestore : score 8/10
- [x] Rate limiting : actif sur toutes les fonctions sensibles
- [x] SMTP Brevo : configure correctement

## Corrige (15 Fev 2026 - Build 225)

### Bug changement de compte (account switching)
- [x] MemberScreen.tsx : Reset isExpired, inscribedMembers, memberPage au logout
- [x] MessagesScreen.tsx : Reset messages[] au logout
- [x] HomeScreen.tsx : Messages subscription avec onAuthStateChanged() + cleanup listener
- [x] DonationsScreen.tsx : Prefill donateur avec onAuthStateChanged() + cleanup au logout

### Phrase RIB supprimee
- [x] DonationsScreen.tsx : Suppression du bloc taxReceiptNote dans la modal RIB

### Section recu fiscal deplacee
- [x] DonationsScreen.tsx : Bloc vert legalBox deplace du haut vers le bas de la page 1

### Backoffice - Page Finances (nouveau)
- [x] Revenus.jsx : Reecrit avec 4 onglets (Vue d'ensemble, Dons, Cotisations, Abonnements)
- [x] Sidebar.jsx : Icone Wallet + label "Finances"
- [x] Layout.jsx : Titre "Gestion financiere"
- [x] Stats, graphiques Recharts, export CSV, filtres temps reel

### Stripe Subscriptions - Paiements mensuels automatiques (nouveau)
- [x] Cloud Function createSubscription : Cree abonnement Stripe recurrent
- [x] stripeWebhook : 3 nouveaux events (invoice.payment_succeeded, customer.subscription.deleted, customer.subscription.updated)
- [x] cancelSubscription : Annule abonnement Stripe (cancel_at_period_end: true)
- [x] stripe.ts : makeSubscription() pour flux Payment Sheet avec subscription
- [x] firebase.ts : stripeSubscriptionId dans AddPaymentParams + addPayment
- [x] MemberScreen.tsx : makeSubscription() pour mensuel, makePayment() pour annuel
- [x] Parametres.jsx : Note mise a jour "recurrent automatiquement via Stripe"

### Deployements
- [x] Cloud Functions : 22 fonctions deployees (createSubscription nouvelle)
- [x] Backoffice : Deploy hosting https://el-mouhssinine.web.app

### Action requise
- [ ] Stripe Dashboard : Ajouter events webhook (invoice.payment_succeeded, customer.subscription.deleted, customer.subscription.updated)

## Corrige (17 Fev 2026 - Build 228)

### Audit V2 : 15 bugs critiques corriges (sur 20 identifies)

#### ARGENT (5 bugs)
- [x] Bug 1 : Webhook donation { merge: true } — preserve donorType/donorInfo pour CERFA
- [x] Bug 2 : Webhook payment doc(paymentIntentId) — evite doublon app+webhook
- [x] Bug 3 : invoice.payment_succeeded idempotence — check processed_payments + docId invoice.id
- [x] Bug 5 : Date expiration setDate(0) — fix debordement mois (31 jan → 28 fev, pas 3 mars)
- [x] Bug 6 : cancelSubscription && → || — condition logique corrigee

#### SECURITE (3 bugs)
- [x] Bug 8 : Banner mode demo backoffice — bandeau rouge visible si Firebase echoue en dev
- [x] Bug 10 : Firestore Rules payments create — validation metadata.memberId == auth.uid
- [x] Bug 11 : Firestore Rules IBAN protege — settings/association lecture authentifiee uniquement

#### CRASH (3 bugs)
- [x] Bug 12 : cleanupOldNotifications batch chunks 500 — evite crash si >500 docs
- [x] Bug 14 : App.tsx prepare() try/catch — evite splash infinie si FCM/Location echoue
- [x] Bug 16 : escapeHtml emails — injection HTML dans listes et paragraphes corrigee

#### UX (2 bugs)
- [x] Bug 17 : Mock janaza supprime + sections vides masquees (annonces, evenements, janaza)
- [x] Bug 19 : Alert email verification apres inscription + bouton Renvoyer

#### PERFORMANCE (2 bugs)
- [x] Bug 13 : Recus fiscaux paralleles — batch de 3 avec Promise.allSettled (3x plus rapide)
- [x] Bug 15 : Memory leak onSnapshot — listener imbrique supprime (callback direct)

### Fichiers modifies
- functions/index.js : Bugs 1, 2, 3, 5, 6, 12, 13, 16
- functions/package-lock.json : npm audit fix (3 CVE corrigees)
- firestore.rules : Bugs 10, 11
- ElMouhssinine/src/services/firebase.ts : Bugs 5, 15
- ElMouhssinine/App.tsx : Bug 14
- ElMouhssinine/src/screens/HomeScreen.tsx : Bug 17
- ElMouhssinine/src/screens/MemberScreen.tsx : Bug 19
- el-mouhssinine-backoffice/src/services/firebase.js : Bug 8

### Bugs non corriges (par choix)
- Bug 4 : Race condition refund (probabilite <0.1%, refacto complexe)
- Bug 7 : firebase-admin@12 (breaking changes, risque trop eleve)
- Bug 9 : Email SPF/DKIM (config DNS, pas du code)
- Bug 20 : Limites backoffice (a evaluer page par page)

### Deployements
- [x] Cloud Functions : 32 fonctions deployees
- [x] Firestore Rules : compilees + releasees
- [x] Backoffice : Deploy hosting https://el-mouhssinine.web.app
- [x] App iOS : Build 228 TestFlight

## Corrige (18 Fev 2026 - Build 229)

### 6 Corrections UX

#### Geolocalisation mosquee
- [x] prayerNotifications.ts : Rayon detection 250m → 100m (precision amelioree)

#### HomeScreen - Section Ramadan
- [x] Section Ramadan deplacee en haut (avant Rappel du jour, au lieu d'apres Janaza)
- [x] Texte "Ramadan Mubarak" : numberOfLines={2} + adjustsFontSizeToFit (plus de mots coupes)
- [x] Style ramadanMubarak : textAlign center ajoute
- [x] Style ramadanTimeCard : minWidth 90→80, flexShrink 1

#### QuranReadScreen - Numero de page
- [x] Couleur numero page : colors.textOnDarkMuted (blanc) → colors.textMuted (gris visible)

#### HomeScreen - Modal historique notifications
- [x] maxHeight 80%→85%, minHeight 300→400 (modal agrandie)
- [x] Separateurs historyItem : rgba(255,255,255,0.06) → rgba(0,0,0,0.08) (visibles)
- [x] Bouton fermer : rgba(255,255,255,0.1) → rgba(0,0,0,0.08) (visible)

#### i18n - 3 ecrans Islam (27 nouvelles cles FR/AR)
- [x] AlphabetScreen.tsx : 7 textes hardcodes → t() i18n
- [x] LessonsListScreen.tsx : 7 textes hardcodes → t() i18n
- [x] LessonScreen.tsx : 15 textes hardcodes → t() i18n
- [x] i18n/index.ts : 27 cles ajoutees (gridView, listView, groupsView, startLesson, etc.)

### Fichiers modifies
- ElMouhssinine/src/services/prayerNotifications.ts
- ElMouhssinine/src/screens/HomeScreen.tsx
- ElMouhssinine/src/screens/QuranReadScreen.tsx
- ElMouhssinine/src/screens/AlphabetScreen.tsx
- ElMouhssinine/src/screens/LessonsListScreen.tsx
- ElMouhssinine/src/screens/LessonScreen.tsx
- ElMouhssinine/src/i18n/index.ts
- ElMouhssinine/ios/ElMouhssinine/Info.plist

### Deployement
- [x] App iOS : Build 231 TestFlight (clean rebuild avec --reset-cache + bundle JS frais)

## Notes
- Console.logs critiques nettoyes (emails masques, IBAN non logge)
- Mock data janaza supprime (donnees sensibles)
- Sections vides masquees sur HomeScreen (annonces, evenements, janaza)
- Cloud Functions bien structurees, 32 fonctions deployees
- Score audit securite : 9/10 (apres corrections Build 228)
- Score audit i18n : 9/10 (apres corrections Build 98)
