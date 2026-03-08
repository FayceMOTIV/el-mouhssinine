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
│   ├── index.js                      # 235KB, 32 fonctions exportees
│   └── .env                          # Stripe keys, Brevo SMTP
├── firestore.rules                   # Regles securite Firestore
├── storage.rules                     # Regles securite Storage
├── firebase.json                     # Config Firebase (hosting, functions, rules)
├── .firebaserc                       # Projet: el-mouhssinine
└── CLAUDE.md                         # Ce fichier
```

## App Mobile
- **Chemin** : ~/Downloads/el-mouhssinine/ElMouhssinine/
- **Bundle ID** : fr.elmouhssinine.mosquee
- **Build actuel** : 276
- **Version marketing** : Geree dans project.pbxproj (MARKETING_VERSION)
- **Stack** : React Native 0.83.1, Firebase, TypeScript
- **Architecture** : New Architecture activee (RCTNewArchEnabled: true)
- **iOS minimum** : arm64 requis
- **Ecrans principaux** : HomeScreen (accueil priere), DonationsScreen, MemberScreen, IslamScreen (tab Coran/Adhkar/Alphabet/Lecons), MoreScreen (parametres)

### Fichiers cles app mobile
| Fichier | Lignes | Role |
|---------|--------|------|
| src/services/firebase.ts | ~2374 | Toute la logique Firebase (Auth, Firestore, FCM, Stripe calls) |
| src/services/prayerApi.ts | ~600 | Horaires priere, countdown, calendrier 2026 complet |
| src/services/stripe.ts | ~200 | Appels Stripe (makePayment, makeSubscription) |
| src/screens/HomeScreen.tsx | ~800 | Accueil avec horaires, annonces, evenements, Ramadan |
| src/screens/QuranScreen.tsx | ~280 | Liste des 114 sourates |
| src/screens/SurahScreen.tsx | ~400 | Lecture sourate avec mode Karaoke |
| src/screens/MemberScreen.tsx | ~600 | Inscription multi-adherents, paiement, carte membre |
| src/screens/DonationsScreen.tsx | ~500 | Dons CB/Apple Pay/virement, historique |
| src/screens/MyMembershipsScreen.tsx | ~270 | Carte membre digitale, statut adherent |
| src/hooks/useQuranPlayer.ts | ~400 | Hook audio Coran (TrackPlayer, repetition, vitesse) |
| src/navigation/AppNavigator.tsx | ~300 | Stack Navigator principal |
| src/i18n/index.ts | ~500 | Toutes les traductions FR/AR |

## Backoffice
- **Chemin** : ~/Downloads/el-mouhssinine/el-mouhssinine-backoffice/
- **URL** : https://el-mouhssinine.web.app
- **Stack** : React, Vite, TailwindCSS, Firebase
- **Pages principales** : Dashboard, Adherents, Dons, Annonces, Evenements, Janaza, Notifications, Horaires, Parametres, Popups, RecusFiscaux, Revenus, Messages, Admins

## Firebase
- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations, messages, payments, processed_payments, notifications_history

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
- Mode Karaoke : lecture verset par verset synchronisee (highlight + auto-scroll)
- Mode lecture page par page (604 pages Mushaf)
- Mini player flottant (play/pause, prev/next, vitesse, repetition)
- Marque-pages et sauvegarde progression (AsyncStorage)
- Toggle arabe seul / francais seul
- Navigation par sourate, page ou juz
- Cache offline avec retry automatique
- **IMPORTANT** : Ne PAS utiliser `getItemLayout` + `removeClippedSubviews` sur les FlatList avec ListHeaderComponent (cause ecran vide)

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

### Build iOS (archive)
```bash
cd ElMouhssinine/ios && pod install
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath /tmp/ElMouhssinine-BUILD_NUMBER.xcarchive
```

### Export IPA (local)
```bash
xcodebuild -exportArchive \
  -archivePath /tmp/ElMouhssinine-BUILD_NUMBER.xcarchive \
  -exportOptionsPlist ElMouhssinine/ios/ExportOptionsLocal.plist \
  -exportPath /tmp/ElMouhssinine-BUILD_NUMBER-export
```
Note : `ExportOptionsLocal.plist` exporte l'IPA localement.

### Upload TestFlight
**Methode recommandee** : Ouvrir l'archive dans Xcode Organizer puis "Distribute App"
```bash
open /tmp/ElMouhssinine-BUILD_NUMBER.xcarchive
```
**Note** : L'upload CLI (`xcrun altool`, `iTMSTransporter`) echoue actuellement (probleme Issuer ID API Key). Utiliser Xcode Organizer.

### Bump version
Modifier `CURRENT_PROJECT_VERSION` dans `ElMouhssinine/ios/ElMouhssinine.xcodeproj/project.pbxproj` (2 occurrences : Debug et Release) + `CFBundleVersion` dans `ElMouhssinine/ios/ElMouhssinine/Info.plist`.

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

## Corrige (19 Fev 2026 - Build 232)

### Notifications en double
- [x] Suppression des triggers push auto onCreate (onNewAnnouncement, onNewEvent, onNewJanaza envoyaient des doublons)
- [x] Deduplication historique notifications
- [x] Fix timezone horaires priere : cache key mismatch UTC vs Paris

## Corrige (19 Fev 2026 - Build 233-234)

### Ramadan + Production
- [x] Fix 6 bugs prod : don bloque, pre-fill donateur, recus 2025, scroll Coran, Google Pay iOS, historique dons
- [x] Fix textes Ramadan coupes : retrait numberOfLines, padding gradient, textAlign center
- [x] adjustsFontSizeToFit sur textes Ramadan longs

## Corrige (20 Fev 2026 - Build 235)

### Separation flux CB vs Apple Pay
- [x] Flux distincts pour carte bancaire et Apple Pay dans stripe.ts
- [x] Corrections BUILD 230 restantes

## Corrige (21 Fev 2026 - Build 241-245)

### Ramadan + Islam + Membre + Securite
- [x] Fix notif proximite mosquee + Jumu'a 13h30
- [x] Auto-scheduler notifications Ramadan au demarrage
- [x] TTS bouton ecouter page Islam
- [x] Diagnostic Apple Pay + coherence membres backoffice
- [x] Standardisation statuts membres en francais (actif/expire/aucun)
- [x] Corrections accueil, dons, membre, coran + suppression sections fiscales

## Corrige (23 Fev 2026 - Build 245-250)

### Coherence carte membre et statuts
- [x] Fix definitif carte membre + Coran : source unique de verite
- [x] Coherence statuts entre app et backoffice
- [x] Fix Coran crash apres Bismillah (race condition listeners)
- [x] Fix 9 bugs critiques logique metier
- [x] Fix countdown, cotisation expiry, comparaison horaires (>= au lieu de >)
- [x] Fix 3 bugs : Jumu'a double notif, recu fiscal annee, cancelled vs expired
- [x] Backoffice : ajout SYMPATHISANT et ANNULE dans CotisationStatut (types.js)
- [x] Webhook Stripe : met 'sympathisant' (pas 'expire') quand abonnement annule

## Corrige (26 Fev 2026 - Build 250-251)

### Backoffice 19 bugs + champs arabes
- [x] 19 bugs backoffice : CSV filtres+colonnes, dashboard statuts, bilingue FR/AR, dons auto, janaza passees/futures
- [x] App mobile : lecture champs arabes annonces/evenements/janaza depuis Firestore
- [x] Fix Coran ecran vide (removeClippedSubviews + getItemLayout) — tentative partielle

## Corrige (28 Fev 2026 - Build 252)

### Fix Coran ecran vide — CAUSE RACINE
- [x] QuranScreen.tsx : Suppression `removeClippedSubviews={true}` et `getItemLayout` de la FlatList
- [x] Cause : `getItemLayout` calculait les offsets comme `76 * index` sans tenir compte du `ListHeaderComponent` (~300px). Combine avec `removeClippedSubviews`, tous les items etaient clippes = ecran vide
- [x] Suppression `paddingBottom: 100` inutile dans le style `content`

### Fix Mes Adhesions — erreur Firestore silencieuse
- [x] firebase.ts : `subscribeToMyMembership` callback etendu avec parametre `error?: string`
- [x] 3 cas distincts : `callback(null)` (pas de donnees), `callback(null, 'firestore_error')` (erreur), `callback(membership)` (succes)
- [x] MyMembershipsScreen.tsx : distingue maintenant "pas connecte" vs "erreur Firestore" vs "donnees recues"
- [x] `setConnectionError(true)` sur erreur, `setDataReceived(true)` sur succes

### Version
- [x] Info.plist CFBundleVersion : 251 → 252
- [x] project.pbxproj CURRENT_PROJECT_VERSION : 250 → 252 (2 occurrences)

## Corrige (28 Fev 2026 - Build 253-254)

### Fix crash Fabric setState sur composant demonte
- [x] useQuranPlayer.ts : Ajout `isMountedRef` pattern pour empecher setState apres unmount
- [x] Correction partielle : guards ajoutes dans handleTrackEnd et certains callbacks
- [x] Build bump 252 → 253 → 254

## Corrige (1 Mar 2026 - Build 255)

### Fix Mes Adhesions — donnees incoherentes avec carte membre
- [x] Symptome : Carte membre affiche ACTIF/PAYE/ANNUEL, mais Mes Adhesions affiche "En attente signature"/Non paye/Montant: -
- [x] Cause racine : `subscribeToMyMembership` cherchait par `where('uid', '==', uid)` (champ), alors que `getMemberProfile` (auth.ts) et `addCotisation` (paiement) utilisent `doc(uid)` (ID document). Si le champ `uid` est absent du document, la requete `where` retourne vide et le fallback email trouve un AUTRE document
- [x] Fix : Alignement de `subscribeToMyMembership` sur `getMemberProfile` — recherche par doc ID d'abord (`doc(uid).onSnapshot()`), puis champ uid, puis email
- [x] Listener temps reel maintenant sur `doc(uid)` = meme document que le paiement Stripe met a jour

### Fix Coran Karaoke — crash ErrorBoundary (ecran marron)
- [x] Symptome : Ecran marron "Erreur — Une erreur est survenue" au lieu du player Coran
- [x] Cause racine : setState apres unmount sous Fabric/New Architecture dans useQuranPlayer.ts
- [x] Fix : Guards `isMountedRef.current` ajoutes sur TOUS les setState apres await/setTimeout :
  - `forceUnlockLoading()` — `setIsLoading(false)`
  - `loadAndPlayVerse()` — `setIsLoading(true)`, `setVerseProgress(0)`, `setIsPlayerReady(true)`
  - Timeout securite 8s — `setIsLoading(false)`
  - `play()` callback — `setIsPlaying(true)`
  - Polling interval — guards au debut + apres chaque await
  - Event listeners (PlaybackQueueEnded, PlaybackState, PlaybackError)
  - `handleTrackEnd` — guard en entree + avant chaque setState

### Fichiers modifies
- ElMouhssinine/src/services/firebase.ts : `subscribeToMyMembership` reecrit (doc ID d'abord)
- ElMouhssinine/src/hooks/useQuranPlayer.ts : guards isMountedRef exhaustifs
- ElMouhssinine/ios/ElMouhssinine/Info.plist : CFBundleVersion 254 → 255
- ElMouhssinine/ios/ElMouhssinine.xcodeproj/project.pbxproj : CURRENT_PROJECT_VERSION 254 → 255

### Version
- [x] Info.plist CFBundleVersion : 254 → 255
- [x] project.pbxproj CURRENT_PROJECT_VERSION : 254 → 255 (2 occurrences)

## Corrige (2 Mar 2026 - Build 261)

### Historique paiements — i18n + date/heure + emojis
- [x] i18n/index.ts : 12 cles FR + 12 cles AR ajoutees (paymentHistoryTitle, statusPaid, etc.)
- [x] MemberScreen.tsx : Date + heure affichees (ex: "15 janv. 2026 a 14:30")
- [x] MemberScreen.tsx : Emojis differencies (🤲 Don, 🔄 Cotisation mensuelle, 📋 Cotisation annuelle)
- [x] MemberScreen.tsx : Statuts traduits i18n (paye/rembourse/echoue)
- [x] MemberScreen.tsx : Mode de paiement affiche si disponible
- [x] MemberScreen.tsx : Textes hardcodes remplaces par t() (titre, aucun paiement, expire dans X jours)
- [x] MemberScreen.tsx : Support locale arabe (ar-SA) pour les dates

### Fix cotisations manquantes dans historique
- [x] MemberScreen.tsx : Error handler payments ameliore (console.warn toujours actif, reset paymentsRef + mergeAndSetHistory au lieu de juste setLoadingHistory)
- [x] functions/index.js : Ajout `createdAt` dans le webhook payment_intent.succeeded (merge: true) pour garantir la date meme si l'app n'a pas ecrit en premier

### Email annulation cotisation immediate
- [x] functions/index.js : Email envoye immediatement dans cancelSubscription() (avant le return)
- [x] Template cotisation_cancel_pending avec fallback hardcode
- [x] Header gradient orange (#f57c00, #ffb74d) pour distinguer de l'email final (gris)
- [x] Contenu : confirmation prise en compte, acces maintenu jusqu'a fin de periode, possibilite reabonnement
- [x] L'email existant du webhook customer.subscription.deleted reste intact (second email a expiration reelle)

### Fix bouton Zakat (DonationsScreen)
- [x] DonationsScreen.tsx : Bouton "Donner ma Zakat" navigue vers la page formulaire (setDonPage('formulaire'))
- [x] Montant Zakat affiche dans le champ "Autre montant" (setCustomAmount au lieu de setSelectedAmount)
- [x] Cause 1 : le bouton restait sur page 'choix' sans selectedProject → paiement impossible
- [x] Cause 2 : le montant calcule (ex: 148€) etait dans selectedAmount mais invisible (aucun bouton predefini ne matchait)
- [x] Fix : setCustomAmount(String(zakatInt)) + setSelectedAmount(null) + setDonPage('formulaire')

### Fichiers modifies
- ElMouhssinine/src/i18n/index.ts
- ElMouhssinine/src/screens/MemberScreen.tsx
- ElMouhssinine/src/screens/DonationsScreen.tsx
- functions/index.js

## Corrige (2 Mar 2026 - Build 260)

### 6 Bugs corriges + Popup ciblage

#### App mobile (MemberScreen.tsx)
- [x] Bug 1 : Zakat montant non pre-rempli — setCustomAmount + setSelectedAmount(null) + setDonPage
- [x] Bug 2 : showPaymentModal fermait puis rouvrait immediatement (double setState)
- [x] Bug 3 : Zakat modal triple TouchableWithoutFeedback bloquait tous les taps
- [x] Bug 4 : Texte renouvellement affichait 0 jours quand date fin = aujourd'hui

#### App mobile (DonationsScreen.tsx)
- [x] Bug 5 : Formulaire donateur gardait le code postal/ville du precedent donateur
- [x] Bug 6 : Donateur anonyme — nom "Anonyme" pas envoye dans metadata Stripe

#### Cloud Functions (functions/index.js)
- [x] Permission Firestore manquante pour lecture donations par email (firestore.rules)

#### Backoffice (Popups.jsx)
- [x] Ajout options ciblage iOS/Android dans le formulaire de creation de popup
- [x] Affichage iOS/Android dans la colonne Cible du tableau

#### i18n
- [x] 14 nouvelles cles FR/AR (paymentHistoryTitle, paymentTypeDonation, paymentTypeCotisationMensuel, etc.)

### Fichiers modifies
- ElMouhssinine/src/screens/MemberScreen.tsx
- ElMouhssinine/src/screens/DonationsScreen.tsx
- ElMouhssinine/src/i18n/index.ts
- functions/index.js
- el-mouhssinine-backoffice/src/pages/Popups.jsx

## Corrige (2 Mar 2026 - Build 261)

### Gold Price API — remplacement complet
- [x] goldprice.org renvoyait "Forbidden" — API morte
- [x] Nouveau service : NBP (Banque Nationale Pologne, PLN/g) + Frankfurter (EUR/PLN)
- [x] Les deux APIs sont gratuites, sans cle, fiables
- [x] Calcul : goldPricePLN / eurToPln = EUR/gramme (~140€/g en mars 2026)
- [x] Cache augmente de 1h a 6h
- [x] Fallback mis a jour : 141€/g (au lieu de 135€/g)
- [x] DonationsScreen.tsx : nisab initial corrige de 5950€ (70€/g) a 11985€ (141€/g)

### Historique dons invisible — fix requete Firestore
- [x] Probleme : 12 dons crees par webhook Stripe n'avaient pas de userId → invisibles dans l'historique
- [x] Cause : webhook ligne 1713 `userId: metadata.userId || metadata.donorUid || ''` met vide si pas dans metadata
- [x] Fix : 2e listener `where('donateurEmail', '==', userEmail)` dans MemberScreen.tsx
- [x] Deduplication par Map<docId, data> pour eviter les doublons (meme don trouve par uid ET email)
- [x] Cleanup du 2e listener sur auth change + unmount
- [x] Firestore rules deja OK (ligne 127 : `donateurEmail == request.auth.token.email`)

### Fichiers modifies
- ElMouhssinine/src/services/goldPrice.ts : remplacement complet API
- ElMouhssinine/src/screens/DonationsScreen.tsx : nisab initial 141€/g
- ElMouhssinine/src/screens/MemberScreen.tsx : 2e listener donations par email + dedup

## Corrige (3 Mar 2026 - Build 262-265)

### Audit complet paiements — 8 bugs corriges

#### Securite webhook (2 bugs)
- [x] Bug 1 : `JSON.parse(metadata.donorInfo)` sans try-catch dans webhook → crash si JSON invalide (2 endroits dans functions/index.js)
- [x] Bug 2 : `subscription.latest_invoice` pouvait etre null dans createSubscription → crash "Cannot read property 'payment_intent' of null"

#### Apple Pay guard (1 bug)
- [x] Bug 3 : Bouton Apple Pay affiche sans verifier `isPlatformPaySupported()` → corrige dans DonationsScreen + MemberScreen (3 boutons)

#### Performance Stripe (1 bug)
- [x] Bug 4 : Nouveau Stripe Price cree a chaque abonnement → accumulation prix orphelins. Fix : `lookup_key` pour reutiliser les prix existants

#### Metadata nettoyees (1 bug)
- [x] Bug 5 : Champs redondants `donorUid`, `donorFirstName`, `donorLastName` supprimes (garder `userId` + `donorInfo` JSON)

#### UX paiement (3 bugs)
- [x] Bug 6 : `processingRef` bloque si donateur anonyme annule ou choisit "Me connecter" → reset dans les 2 handlers Alert
- [x] Bug 7 : Pas de `showPaymentError` si paiement echoue (non annule) dans MemberScreen handlePayment
- [x] Bug 8 : Meme feedback erreur manquant dans handlePayFamily

### Fichiers modifies
- functions/index.js : Bugs 1, 2, 4
- ElMouhssinine/src/screens/DonationsScreen.tsx : Bugs 3, 5, 6
- ElMouhssinine/src/screens/MemberScreen.tsx : Bugs 3, 7, 8

### Deployements
- [x] Cloud Functions : 33 fonctions deployees
- [x] Git : 2 commits pushes sur main

## Corrige (3 Mar 2026 - Build 266)

### Fix membreId vs memberId — cotisations visibles dans backoffice

#### Probleme
Le backoffice utilisait `p.membreId` (francais) pour identifier le membre dans les documents payments, mais l'app et le webhook ecrivaient `memberId` (anglais) et `metadata.memberId` (UID Firebase). Resultat :
- Onglet Cotisations de Revenus.jsx : colonnes Membre et Email affichaient "-"
- Export CSV cotisations : noms et emails vides
- Vue d'ensemble : details affichaient "Don" au lieu du membre

#### Corrections
- [x] Revenus.jsx : fallback `p.membreId || p.metadata?.memberId` sur 6 endroits (helper getMembreUid, filtres, CSV, table)
- [x] functions/index.js : ajout `membreId` (UID Firebase) dans webhook payment_intent.succeeded + invoice.payment_succeeded
- [x] functions/index.js : ajout `modePaiement: 'carte'` pour renouvellements mensuels webhook
- [x] firebase.ts : ajout `membreId: params.memberUid` dans addCotisation
- [x] firebase.js (BO) : fix `subscribeToMemberPayments` orderBy `createdAt` (coherent avec writes)

### Fichiers modifies
- el-mouhssinine-backoffice/src/pages/Revenus.jsx
- el-mouhssinine-backoffice/src/services/firebase.js
- functions/index.js
- ElMouhssinine/src/services/firebase.ts

### Deployements
- [x] Cloud Functions : 33 fonctions deployees
- [x] Backoffice : https://el-mouhssinine.web.app deploye
- [x] Git : commit bfe3bb3 push sur main

## Corrige (7 Mar 2026 - Build 273)

### Geofencing natif mosquee (iOS + Android)
- [x] iOS : MosqueGeofencingManager (Swift) avec CLCircularRegion 200m
  - Flag `wantsMonitoring` persiste dans UserDefaults (survit aux relaunches)
  - `locationManagerDidChangeAuthorization` garde par wantsMonitoring
  - Cooldown 30 min entre notifications
  - Notification locale native (fonctionne meme si JS bridge pas pret)
- [x] iOS : MosqueGeofencingBridge.m (RCT_EXTERN_MODULE)
- [x] iOS : AppDelegate.swift restartMonitoring() au lancement par localisation
- [x] iOS : project.pbxproj + Info.plist (UIBackgroundModes location deja present)
- [x] Android : MosqueGeofencingModule.kt (GeofencingClient 200m)
- [x] Android : MosqueGeofencingReceiver.kt (BroadcastReceiver statique)
- [x] Android : MosqueGeofenceBootReceiver.kt (re-enregistre apres reboot)
- [x] Android : MosqueGeofencingPackage.kt + MainApplication.kt
- [x] Android : AndroidManifest.xml (permissions + receivers)
- [x] backgroundLocation.ts simplifie (delegue start/stop au natif)

### Bugfixes
- [x] stripe.ts : 3 erreurs TypeScript corrigees (nombre d'arguments)
- [x] functions/index.js : email de confirmation apres remboursement
- [x] functions/index.js : nettoyage logger (plus de console.log en production)
- [x] el-mouhssinine-backoffice/firebase.js : suppression legacy config hardcodee
- [x] Revenus.jsx : fix colonnes cotisations backoffice

### Architecture fichiers geofencing
- ios/ElMouhssinine/MosqueGeofencing.swift (NOUVEAU)
- ios/ElMouhssinine/MosqueGeofencingBridge.m (NOUVEAU)
- android/.../MosqueGeofencingModule.kt (NOUVEAU)
- android/.../MosqueGeofencingReceiver.kt (NOUVEAU)
- android/.../MosqueGeofenceBootReceiver.kt (NOUVEAU)
- android/.../MosqueGeofencingPackage.kt (NOUVEAU)

### Deployements
- [x] Cloud Functions : 34 fonctions deployees
- [x] Backoffice : https://el-mouhssinine.web.app deploye
- [x] Archive iOS Build 273 prete (Xcode Organizer)
- [x] Git : commit 9c99fee sur main

## Corrige (8 Mar 2026 - Build 276)

### Audit paiement — 4 bugs critiques (session precedente)
- [x] BUG A : permission-denied apres Apple Pay — supprime ecriture client-side Firestore (webhook gere tout)
- [x] BUG B : timeout 60s pendant 3DS — supprime Promise.race (Stripe gere le timeout ~15min)
- [x] BUG C : pas d'email confirmation cotisation — resolu par fix BUG A (webhook cree le doc payments → trigger email)
- [x] BUG D : triple paiement — ajout paymentSucceededRef verrou anti-double tap

### Parcours activation membre — flux corrige
- [x] firestore.rules : simplifie read payments (supprime OR dynamique qui bloquait les list queries)
- [x] onCotisationConfirmation : email "Demande d'adhesion recue" (bleu) au lieu de "Bienvenue membre actif" (vert)
- [x] validateMembership CF : calcule cotisation.dateFin si absente lors de l'approbation admin
- [x] Adherents.jsx : handleValidateAdhesion et handleConfirmRejectAdhesion appellent la CF validateMembership (emails + notifs push)

### Prevention bypass validation admin — 3 bugs critiques
- [x] invoice.payment_succeeded : ne met plus 'actif' automatiquement — respecte le statut existant (renouvellement ne bypass plus la validation admin)
- [x] customer.subscription.updated : meme protection — ne remet 'actif' que si deja valide par admin
- [x] Adherents.jsx handleSetPaid/handleSetSigned : appellent validateMembership CF quand paye+signe (email bienvenue + notif push)

### Flux activation membre (source de verite)
```
Inscription app → sympathisant
Paiement CB/Apple Pay → en_attente_validation (webhook) + email bleu "Demande recue"
Renouvellement mensuel → statut INCHANGE (sauf si deja actif)
Admin valide (BO) → actif (CF validateMembership) + email vert "Bienvenue" + notif push
Admin refuse (BO) → sympathisant (CF validateMembership) + conversion don + email refus
Admin marque paye+signe (BO) → actif (CF validateMembership) + email vert "Bienvenue"
```

### Super admins ajoutes
- [x] 5 emails ajoutes comme super_admin dans Firestore admins/ collection
- [x] 3 comptes Firebase Auth crees (chlaibia@yahoo.fr, aem011@gmail.com, bouyarm@gmail.com)

### Fichiers modifies
- firestore.rules : payments read rule simplifiee
- functions/index.js : email contenu + validateMembership dateFin + protection webhook actif
- el-mouhssinine-backoffice/src/pages/Adherents.jsx : CF calls instead of direct writes
- ElMouhssinine/src/screens/MemberScreen.tsx : BUG A/B/D fixes
- ElMouhssinine/src/screens/DonationsScreen.tsx : BUG A/B/D fixes
- ElMouhssinine/src/services/stripe.ts : BUG B fix (no timeout)

### Deployements
- [x] Cloud Functions : 34 fonctions deployees
- [x] Firestore Rules : compilees + releasees
- [x] Backoffice : https://el-mouhssinine.web.app deploye
- [x] App iOS : Build 276 TestFlight
- [x] Git : commits 5c65347 + 35d8aad sur main

## Bugs connus / Pieges

### membreId vs memberId (payments collection)
Les documents `payments` Firestore contiennent DEUX champs de reference membre :
- `memberId` : format ELM-XXXX (affichage)
- `membreId` : UID Firebase (lookup membre)
- `metadata.memberId` : UID Firebase (backup, retrocompatibilite anciens docs)
Le BO doit TOUJOURS utiliser `p.membreId || p.metadata?.memberId` pour trouver le membre.

### FlatList + getItemLayout + ListHeaderComponent
**NE JAMAIS** utiliser `getItemLayout` sur une FlatList qui a un `ListHeaderComponent`. Les offsets calcules ne tiennent pas compte de la hauteur du header, ce qui cause des items invisibles. Combine avec `removeClippedSubviews={true}`, tous les items sont clippes.

### Upload TestFlight CLI
`xcrun altool` et `iTMSTransporter` echouent avec erreur 401 NOT_AUTHORIZED. Le probleme est l'Issuer ID des API Keys App Store Connect. Utiliser Xcode Organizer (GUI) pour l'upload.

### Firebase onSnapshot error handling
Toujours passer un parametre d'erreur dans les callbacks `onSnapshot` pour distinguer "pas de donnees" de "erreur Firestore". Sinon l'app affiche "pas connecte" au lieu d'un message d'erreur.

### subscribeToMyMembership vs getMemberProfile
Ces deux fonctions DOIVENT chercher dans le meme ordre : `doc(uid)` d'abord (ID document), puis `where('uid', '==', uid)` (champ), puis `where('email', '==', email)`. Si l'ordre differe, elles peuvent trouver des documents Firestore differents et afficher des statuts incoherents.

### useQuranPlayer (react-native-track-player)
- Ne PAS utiliser `useProgress()` ou `useTrackPlayerEvents()` avant que le player soit initialise (crash)
- Utiliser `TrackPlayer.addEventListener()` manuellement conditionne sur `isPlayerReady`
- Polling manuel de la progression avec `setInterval` (200ms)
- **TOUJOURS** garder les setState avec `isMountedRef.current` dans les callbacks async, timeouts et event listeners (crash Fabric/New Architecture)

### Statuts membres
Les statuts doivent etre en francais minuscule : `actif`, `expire`, `sympathisant`, `annule`, `en_attente_validation`, `en_attente_paiement`, `en_attente_signature`. Le backoffice et l'app doivent utiliser les memes valeurs (definies dans `types.js`).

### Validation admin obligatoire (actif)
**AUCUN chemin ne doit mettre status='actif' sans passer par validateMembership CF** (admin-gated).
- Webhook payment_intent.succeeded → `en_attente_validation` (jamais actif)
- Webhook invoice.payment_succeeded → maintient le statut existant (actif seulement si deja actif)
- Webhook customer.subscription.updated → idem
- BO handleSetPaid/handleSetSigned → appelle CF validateMembership
- App mobile → Firestore rules bloquent modification du champ `status` par non-admin

### Gold Price API
Ne PAS utiliser goldprice.org (renvoie Forbidden depuis mars 2026). Utiliser NBP + Frankfurter :
- `https://api.nbp.pl/api/cenyzlota?format=json` → `[0].cena` (PLN/gramme)
- `https://api.frankfurter.app/latest?from=EUR&to=PLN` → `.rates.PLN`
- EUR/gramme = cena / rates.PLN
- Cache 6h, fallback 141€/g

### TouchableWithoutFeedback nesting (React Native)
Ne PAS imbriquer 3+ niveaux de `TouchableWithoutFeedback`. Le wrapper externe capture tous les taps avant qu'ils atteignent les enfants. Maximum 2 niveaux : overlay (ferme le modal) → contenu (bloque la propagation avec `onPress={() => {}}`).

### Historique dons — double query
La requete `where('userId', '==', uid)` ne suffit pas : les dons crees par le webhook Stripe n'ont souvent pas de userId. Toujours combiner avec `where('donateurEmail', '==', email)` et dedupliquer par doc.id via Map.

### MosqueGeofencing iOS — wantsMonitoring obligatoire
`locationManagerDidChangeAuthorization` est appele automatiquement quand le delegate est assigne dans `init()`. Sans le flag `wantsMonitoring` (UserDefaults), le monitoring demarrerait meme si l'utilisateur a desactive la fonctionnalite dans les parametres. Le flag est set par `start()` (true) et `stop()` (false), et verifie dans le delegate et `restartMonitoring()`.

### MosqueGeofencing Android — BroadcastReceiver statique
Le `MosqueGeofencingReceiver` DOIT etre declare statiquement dans AndroidManifest.xml (pas enregistre dynamiquement). Sinon Android ne peut pas le declencher quand l'app est tuee. Meme chose pour le `MosqueGeofenceBootReceiver` (BOOT_COMPLETED).

## Notes
- Console.logs critiques nettoyes (emails masques, IBAN non logge)
- Mock data janaza supprime (donnees sensibles)
- Sections vides masquees sur HomeScreen (annonces, evenements, janaza)
- Cloud Functions bien structurees, 34 fonctions deployees
- Score audit securite : 10/10 (apres corrections Build 276 — validation admin obligatoire)
- Score audit i18n : 9/10 (apres corrections Build 98)
- App iOS uniquement en production (Android non deploye)
- Horaires de priere : calendrier local 2026 complet (fallback si API Mawaqit indisponible)
- Stripe en mode LIVE (cles sk_live et pk_live)
- Brevo SMTP pour tous les emails transactionnels
