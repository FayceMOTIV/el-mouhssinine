# El Mouhssinine - Application Mosquee

Application complete pour la gestion de la Mosquee El Mouhssinine (Lievin, France).

## Structure du projet

```
el-mouhssinine/
├── ElMouhssinine/              # App mobile React Native (iOS/Android)
├── el-mouhssinine-backoffice/  # Backoffice administration (React/Vite)
├── functions/                  # Cloud Functions Firebase
├── firestore.rules             # Regles securite Firestore
├── firestore.indexes.json      # Index Firestore
└── firebase.json               # Configuration Firebase
```

## Application Mobile

- **Stack** : React Native 0.83.1, TypeScript, Firebase
- **Bundle ID** : fr.elmouhssinine.mosquee
- **Build actuel** : 167 (TestFlight)
- **Plateformes** : iOS (App Store via TestFlight)

### Fonctionnalites principales

- Horaires de priere (methode Mawaqit/UOIF)
- Notifications push pour annonces et evenements
- Coran complet (114 sourates + audio + mode lecture page par page)
- Systeme d'adhesion avec paiement Stripe (CB, Apple Pay)
- Messages privees avec la mosquee
- Adhkar et invocations quotidiennes
- Apprentissage de l'alphabet arabe
- Dates islamiques avec countdown
- Recus fiscaux automatiques par email

### Lancer l'app mobile

```bash
cd ElMouhssinine

# Installer les dependances
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android
```

## Backoffice

- **URL** : https://el-mouhssinine.web.app
- **Stack** : React 18, Vite, TailwindCSS, Firebase

### Fonctionnalites backoffice

- Gestion des annonces et evenements
- Gestion des adherents et cotisations
- Configuration des horaires de priere (iqama, jumu'a)
- Envoi de notifications push manuelles
- Gestion des projets de dons
- Messages avec les fideles
- Rappels du jour (hadiths)
- Generation des recus fiscaux
- Dashboard avec statistiques

### Deployer le backoffice

```bash
cd el-mouhssinine-backoffice
npm run build
firebase deploy --only hosting
```

## Cloud Functions

11 fonctions deployees sur Firebase (europe-west1) :

| Fonction | Type | Description |
|----------|------|-------------|
| onNewAnnouncement | Trigger Firestore | Notification automatique nouvelle annonce |
| onNewEvent | Trigger Firestore | Notification automatique nouvel evenement |
| onNewJanaza | Trigger Firestore | Notification janaza (priorite haute) |
| onNewPopup | Trigger Firestore | Notification popup |
| onMessageReply | Trigger Firestore | Notification reponse message |
| sendManualNotification | Callable | Envoi manuel depuis backoffice |
| getNotificationStats | Callable | Stats pour dashboard |
| scheduledJumuaReminder | Scheduled | Rappel Jumu'a (vendredi 11h30) |
| scheduledFajrReminder | Scheduled | Rappel Fajr (quotidien 5h30) |
| cleanupOldNotifications | Scheduled | Nettoyage (dimanche 3h) |
| sendRecuFiscal | Callable | Generation PDF recu fiscal + email |
| getDonsByYear | Callable | Total dons par annee |
| createPaymentIntent | HTTPS | Paiement Stripe |
| stripeWebhook | HTTPS | Webhook Stripe |

### Deployer les Cloud Functions

```bash
firebase deploy --only functions
```

## Configuration Firebase

- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations, messages, payments

### Deployer les regles Firestore

```bash
firebase deploy --only firestore:rules
```

## Configuration requise

### Stripe (paiements)

1. Configurer les cles dans Cloud Functions :
```bash
firebase functions:config:set stripe.secret_key="sk_live_XXX"
firebase functions:config:set stripe.webhook_secret="whsec_XXX"
```

2. Configurer le webhook dans Stripe Dashboard :
- URL : `https://europe-west1-el-mouhssinine.cloudfunctions.net/stripeWebhook`
- Events : `payment_intent.succeeded`, `payment_intent.payment_failed`

### APNs (notifications iOS)

- Key ID : 4YY44LG5M5
- Team ID : 5ZR87TPM89
- Environment : Sandbox & Production

### Email (recus fiscaux)

- SMTP Brevo configure
- Expediteur : centreculturelislamique@orange.fr

## Scripts utiles

### Build iOS et upload TestFlight

```bash
cd ElMouhssinine/ios
pod install
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine -configuration Release -destination 'generic/platform=iOS' -archivePath ./build/ElMouhssinine.xcarchive
xcodebuild -exportArchive -archivePath ./build/ElMouhssinine.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath ./build/export
xcrun altool --upload-app -f ./build/export/ElMouhssinine.ipa -t ios -u EMAIL -p APP_SPECIFIC_PASSWORD
```

## Support

Pour toute question technique, consulter le fichier `CLAUDE.md` qui contient l'historique complet des developpements et corrections.

---

Developpe par Faycal Kriouar - 2026
