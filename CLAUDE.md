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
- **Build actuel** : 195
- **Stack** : React Native 0.83.1, Firebase, TypeScript

## Backoffice
- **Chemin** : ~/Downloads/el-mouhssinine/el-mouhssinine-backoffice/
- **URL** : https://el-mouhssinine.web.app
- **Stack** : React, Vite, Firebase

## Firebase
- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations, messages, payments

## Cloud Functions (17 deployees)
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
| createPaymentIntent | Callable (30s) | Paiement Stripe |
| stripeWebhook | HTTPS (60s) | Webhook Stripe |
| forceCachePrayerTimes | Callable | Force mise a jour cache horaires |

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
- Events : `payment_intent.succeeded`, `payment_intent.payment_failed`

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

### Export et Upload TestFlight
```bash
xcodebuild -exportArchive -archivePath ./build/ElMouhssinine.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath ./build/export
xcrun altool --upload-app -f ./build/export/ElMouhssinine.ipa -t ios -u EMAIL -p APP_SPECIFIC_PASSWORD
```

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

## Notes
- Console.logs critiques nettoyes (emails masques, IBAN non logge)
- Mock data present dans les screens (fallback si Firebase vide)
- Cloud Functions bien structurees, pas de probleme critique
- Score audit securite : 8.5/10
- Score audit i18n : 9/10 (apres corrections Build 98)
