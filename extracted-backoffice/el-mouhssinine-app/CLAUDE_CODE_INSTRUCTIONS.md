# 🚀 Instructions pour Claude Code - El Mouhssinine

## Contexte
Tu as un projet React Native existant dans `~/Downloads/el-mouhssinine/ElMouhssinine/`.
Cette archive contient le code complet de l'app + backoffice pour implémenter toutes les features de la preview.

## Étapes d'intégration

### 1. Copier les fichiers de l'archive

```bash
# Extraire l'archive
cd ~/Downloads
unzip el-mouhssinine-complete.zip

# Copier les écrans dans le projet existant
cp -r el-mouhssinine-app/src/screens/* ~/Downloads/el-mouhssinine/ElMouhssinine/src/screens/
cp -r el-mouhssinine-app/src/theme/* ~/Downloads/el-mouhssinine/ElMouhssinine/src/theme/
cp -r el-mouhssinine-app/src/services/* ~/Downloads/el-mouhssinine/ElMouhssinine/src/services/
cp -r el-mouhssinine-app/src/types/* ~/Downloads/el-mouhssinine/ElMouhssinine/src/types/
cp -r el-mouhssinine-app/src/navigation/* ~/Downloads/el-mouhssinine/ElMouhssinine/src/navigation/
```

### 2. Installer les dépendances

```bash
cd ~/Downloads/el-mouhssinine/ElMouhssinine

npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install react-native-gesture-handler
npm install @react-native-clipboard/clipboard
npm install react-native-linear-gradient
npm install firebase
npm install @stripe/stripe-react-native

cd ios && pod install && cd ..
```

### 3. Configuration Firebase

1. Va sur https://console.firebase.google.com
2. Crée un projet "el-mouhssinine"
3. Active Authentication (Email/Password)
4. Active Firestore Database
5. Active Cloud Messaging
6. Télécharge:
   - `GoogleService-Info.plist` → ios/ElMouhssinine/
   - `google-services.json` → android/app/

7. Modifie `src/services/firebase.ts` avec ta vraie config:
```javascript
const firebaseConfig = {
  apiKey: "TA_VRAIE_API_KEY",
  authDomain: "el-mouhssinine.firebaseapp.com",
  projectId: "el-mouhssinine",
  // ...
};
```

### 4. Configuration Stripe

1. Va sur https://dashboard.stripe.com
2. Récupère tes clés API (publishable + secret)
3. Configure les webhooks pour:
   - payment_intent.succeeded
   - invoice.paid
   - customer.subscription.deleted

4. Crée les prix:
   - Cotisation mensuelle: 10€/mois
   - Cotisation annuelle: 100€/an

### 5. Build et Test

```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

### 6. TestFlight

```bash
# Archive
cd ios
xcodebuild clean -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine -archivePath ~/ElMouhssinine.xcarchive

# Puis dans Xcode:
# Window > Organizer > Distribute App > App Store Connect
```

---

## Backoffice

### Installation

```bash
cd el-mouhssinine-backoffice
npm install
```

### Configuration

Modifie `src/App.jsx` avec ta config Firebase (même que l'app).

### Lancer en local

```bash
npm start
# Ouvre http://localhost:3000
```

### Déployer sur Firebase Hosting

```bash
firebase init hosting  # Choisir "build" comme dossier public
npm run build
firebase deploy --only hosting
```

---

## Collections Firebase à créer

Voir le fichier `FIREBASE_STRUCTURE.md` pour la structure complète.

Collections principales:
- `prayerTimes` - Horaires de prière
- `announcements` - Annonces
- `events` - Événements
- `janaza` - Prières mortuaires
- `projects` - Projets de dons
- `donations` - Historique des dons
- `members` - Adhérents
- `notifications` - Notifications envoyées
- `settings/mosqueeInfo` - Infos de la mosquée
- `settings/islamicCalendar` - Calendrier hégirien
- `sourates` - Liste des sourates
- `duas` - Invocations

---

## Checklist Features

- [ ] Écran Accueil avec horaires
- [ ] Calendrier Hégirien
- [ ] Annonces
- [ ] Janaza
- [ ] Événements
- [ ] Page Dons
- [ ] Calculateur Zakat
- [ ] Modal paiement
- [ ] Modal RIB
- [ ] Espace Adhérent
- [ ] Login/Register
- [ ] Cotisation mensuelle/annuelle
- [ ] Annulation abonnement
- [ ] Page Spirituel (Coran/Duas)
- [ ] Page Plus (Qibla, infos, etc.)
- [ ] Notifications configurables
- [ ] Backoffice complet

---

## En cas de problème

Si erreur AppIcon:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```

Si erreur pod:
```bash
cd ios
pod deintegrate
pod install
```

Si erreur build:
```bash
npx react-native start --reset-cache
```
