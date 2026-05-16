# El Mouhssinine - Application Mobile

Application mobile React Native pour la Mosquee El Mouhssinine.

## Informations

- **Bundle ID** : fr.elmouhssinine.mosquee
- **Build** : 167
- **React Native** : 0.83.1
- **TypeScript** : Oui

## Fonctionnalites

### Priere
- Horaires de priere (methode Mawaqit/UOIF - 12 degres)
- Notifications configurables (avant/a l'heure)
- Boost de priere ("J'ai prie")
- Notification speciale Jumu'a le vendredi

### Coran
- 114 sourates avec audio
- Mode lecture page par page (604 pages du Mushaf)
- Marque-pages et sauvegarde de progression
- Affichage arabe seul ou francais seul

### Adhesion
- Inscription membre avec paiement Stripe
- Multi-adherents (inscrire plusieurs personnes)
- Carte membre digitale avec QR code
- Gestion des cotisations

### Autres
- Messages prives avec la mosquee
- Adhkar et invocations
- Apprentissage alphabet arabe
- Dates islamiques avec countdown
- Rappels du jour (hadiths)
- Recus fiscaux par email

## Installation

### Prerequisites

- Node.js 18+
- Xcode 15+ (pour iOS)
- CocoaPods
- Compte Apple Developer (pour TestFlight)

### Lancer en developpement

```bash
# Installer les dependances
npm install

# Installer les pods iOS
cd ios && pod install && cd ..

# Lancer Metro
npm start

# Lancer sur iOS
npm run ios

# Lancer sur Android
npm run android
```

### Build iOS Production

```bash
cd ios
pod install
xcodebuild archive \
  -workspace ElMouhssinine.xcworkspace \
  -scheme ElMouhssinine \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ./build/ElMouhssinine.xcarchive

xcodebuild -exportArchive \
  -archivePath ./build/ElMouhssinine.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath ./build/export

# Upload TestFlight
xcrun altool --upload-app \
  -f ./build/export/ElMouhssinine.ipa \
  -t ios \
  -u EMAIL \
  -p APP_SPECIFIC_PASSWORD
```

## Architecture

```
src/
├── components/          # Composants reutilisables
├── screens/             # Ecrans de l'app
├── services/            # Services (Firebase, API, notifications)
├── i18n/                # Traductions FR/AR
├── navigation/          # React Navigation
├── theme/               # Couleurs et styles
└── types/               # Types TypeScript
```

## Services principaux

- `auth.ts` - Authentification Firebase
- `firebase.ts` - Operations Firestore
- `notifications.ts` - Push notifications FCM
- `prayerNotifications.ts` - Notifications de priere locales
- `prayerApi.ts` - API horaires de priere
- `stripe.ts` - Paiements Stripe

## Configuration

### Firebase

Le fichier `GoogleService-Info.plist` doit etre present dans `ios/`.

### Stripe

La cle publishable est configuree dans `App.tsx`.

### APNs

- Key ID : 4YY44LG5M5
- Team ID : 5ZR87TPM89

## Dependances principales

- `@react-navigation/native` - Navigation
- `@react-native-firebase/*` - Firebase
- `@stripe/stripe-react-native` - Paiements
- `@notifee/react-native` - Notifications locales
- `react-native-localize` - i18n
- `@react-native-async-storage/async-storage` - Stockage local
