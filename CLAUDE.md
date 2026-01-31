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
- **Build actuel** : 167
- **Stack** : React Native 0.83.1, Firebase, TypeScript

## Backoffice
- **Chemin** : ~/Downloads/el-mouhssinine/el-mouhssinine-backoffice/
- **URL** : https://el-mouhssinine.web.app
- **Stack** : React, Vite, Firebase

## Firebase
- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations, messages, payments

## Cloud Functions (14 deployees)
| Fonction | Type | Description |
|----------|------|-------------|
| onNewAnnouncement | Trigger Firestore | Notif auto nouvelle annonce |
| onNewEvent | Trigger Firestore | Notif auto nouvel evenement |
| onNewJanaza | Trigger Firestore | Notif auto janaza (priorite haute) |
| onNewPopup | Trigger Firestore | Notif auto popup |
| onMessageReply | Trigger Firestore | Notif reponse message |
| sendManualNotification | Callable | Envoi manuel backoffice |
| getNotificationStats | Callable | Stats pour dashboard |
| scheduledJumuaReminder | Scheduled | Vendredi 11h30 |
| scheduledFajrReminder | Scheduled | Tous les jours 5h30 |
| cleanupOldNotifications | Scheduled | Dimanche 3h |
| sendRecuFiscal | Callable | Genere PDF recu fiscal + envoi email |
| getDonsByYear | Callable | Total dons par annee pour un email |
| createPaymentIntent | HTTPS | Paiement Stripe |
| stripeWebhook | HTTPS | Webhook Stripe |

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

## Notes
- Console.logs critiques nettoyes (emails masques, IBAN non logge)
- Mock data present dans les screens (fallback si Firebase vide)
- Cloud Functions bien structurees, pas de probleme critique
- Score audit securite : 8/10
