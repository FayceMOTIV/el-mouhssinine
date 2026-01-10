# 🕌 El Mouhssinine - Application Mobile + Backoffice

Application mobile complète pour la mosquée El Mouhssinine avec backoffice d'administration.

## 📱 Fonctionnalités de l'App

### Accueil
- ✅ Horaires de prière en temps réel
- ✅ Countdown prochaine prière
- ✅ Calendrier Hégirien avec événements islamiques
- ✅ Annonces de la mosquée
- ✅ Prière mortuaire (Janaza)
- ✅ Prochains événements

### Dons
- ✅ Projets internes de la mosquée
- ✅ Projets externes (autres mosquées/causes)
- ✅ Montants prédéfinis + montant libre
- ✅ Paiement CB / Apple Pay / Google Pay
- ✅ RIB pour virement bancaire
- ✅ Calculateur de Zakat

### Adhérent
- ✅ Espace membre avec carte adhérent
- ✅ Cotisation mensuelle (10€/mois) ou annuelle (100€/an)
- ✅ Prélèvement automatique SEPA
- ✅ Annulation abonnement à tout moment
- ✅ Historique des paiements

### Spirituel
- ✅ Lecture du Coran
- ✅ Sourates populaires
- ✅ Invocations (Adhkar matin/soir, après prière, etc.)

### Plus
- ✅ Direction de la Qibla
- ✅ Coordonnées bancaires (RIB)
- ✅ Informations mosquée (adresse, téléphone, email)
- ✅ Paramètres notifications

## 🖥️ Fonctionnalités du Backoffice

- ✅ Dashboard avec statistiques
- ✅ Gestion horaires de prière
- ✅ Gestion annonces
- ✅ Gestion événements
- ✅ Gestion Janaza
- ✅ Gestion projets & dons
- ✅ Gestion adhérents
- ✅ Envoi notifications push
- ✅ Paramètres mosquée

---

## 🚀 Installation

### Prérequis
- Node.js 18+
- React Native CLI
- Xcode (pour iOS)
- Android Studio (pour Android)
- Compte Firebase
- Compte Stripe

### 1. Cloner le projet
```bash
git clone https://github.com/your-repo/el-mouhssinine.git
cd el-mouhssinine
```

### 2. Configuration Firebase

1. Créer un projet sur [Firebase Console](https://console.firebase.google.com)
2. Activer Authentication (Email/Password)
3. Activer Firestore Database
4. Activer Cloud Messaging
5. Télécharger les fichiers de config:
   - `google-services.json` (Android) → `/android/app/`
   - `GoogleService-Info.plist` (iOS) → `/ios/`

6. Mettre à jour `src/services/firebase.ts`:
```javascript
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "el-mouhssinine.firebaseapp.com",
  projectId: "el-mouhssinine",
  // ...
};
```

### 3. Configuration Stripe

1. Créer un compte sur [Stripe Dashboard](https://dashboard.stripe.com)
2. Récupérer les clés API
3. Configurer les webhooks pour les événements:
   - `payment_intent.succeeded`
   - `invoice.paid`
   - `customer.subscription.deleted`

4. Créer les produits pour les cotisations:
   - Cotisation mensuelle: 10€/mois
   - Cotisation annuelle: 100€/an

### 4. Installation App Mobile

```bash
cd el-mouhssinine-app

# Installer les dépendances
npm install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

### 5. Installation Backoffice

```bash
cd el-mouhssinine-backoffice
npm install
npm start
```

Le backoffice sera accessible sur `http://localhost:3000`

---

## 📁 Structure des fichiers

```
el-mouhssinine/
├── el-mouhssinine-app/           # Application mobile React Native
│   ├── src/
│   │   ├── screens/              # Écrans de l'app
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── DonationsScreen.tsx
│   │   │   ├── MemberScreen.tsx
│   │   │   ├── SpiritualScreen.tsx
│   │   │   └── MoreScreen.tsx
│   │   ├── components/           # Composants réutilisables
│   │   ├── navigation/           # Navigation
│   │   ├── services/             # Firebase, Stripe, etc.
│   │   ├── theme/                # Couleurs, styles
│   │   ├── types/                # Types TypeScript
│   │   └── hooks/                # Hooks personnalisés
│   ├── ios/                      # Code natif iOS
│   ├── android/                  # Code natif Android
│   └── FIREBASE_STRUCTURE.md     # Documentation Firebase
│
└── el-mouhssinine-backoffice/    # Backoffice React
    └── src/
        └── App.jsx               # Application complète
```

---

## 🔧 Configuration des notifications

### iOS (APNs)
1. Créer un certificat APNs dans Apple Developer
2. Uploader le certificat dans Firebase Console
3. Activer Push Notifications dans Xcode

### Android (FCM)
1. Le fichier `google-services.json` suffit
2. Firebase Cloud Messaging est automatiquement configuré

### Envoyer une notification
Depuis le backoffice → Notifications → Créer une nouvelle notification

---

## 💳 Intégration Stripe

### Dons ponctuels
```javascript
// Créer un PaymentIntent
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount * 100, // En centimes
  currency: 'eur',
  metadata: { projectId, projectName }
});
```

### Abonnements (cotisations)
```javascript
// Créer un abonnement
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }], // Prix mensuel ou annuel
});
```

---

## 📊 Collections Firebase

Voir le fichier `FIREBASE_STRUCTURE.md` pour la documentation complète des collections et des règles de sécurité.

---

## 🎨 Personnalisation

### Couleurs (src/theme/colors.ts)
```javascript
export const colors = {
  background: '#7f4f24',  // Fond marron
  accent: '#c9a227',      // Doré
  // ...
};
```

### Logo
Remplacer les fichiers dans:
- iOS: `ios/ElMouhssinine/Images.xcassets/AppIcon.appiconset/`
- Android: `android/app/src/main/res/mipmap-*/`

---

## 📱 Déploiement

### TestFlight (iOS)
```bash
cd ios
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine -archivePath ~/ElMouhssinine.xcarchive
# Puis Distribute App dans Xcode Organizer
```

### Google Play (Android)
```bash
cd android
./gradlew bundleRelease
# Le fichier .aab sera dans android/app/build/outputs/bundle/release/
```

### Backoffice (Firebase Hosting)
```bash
cd el-mouhssinine-backoffice
npm run build
firebase deploy --only hosting
```

---

## 🆘 Support

Pour toute question, contactez:
- Email: contact@elmouhssinine.fr
- GitHub Issues

---

## 📄 Licence

MIT License - Libre d'utilisation et de modification.

---

**Développé avec ❤️ pour la communauté**
