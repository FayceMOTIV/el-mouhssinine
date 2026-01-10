# 🕌 El Mouhssinine - Application Mosquée

Application complète pour la gestion de la Mosquée El Mouhssinine.

## 📁 Structure du projet

```
el-mouhssinine/
├── backoffice-pwa/          # Backoffice administration (PWA)
│   ├── index.html           # Application principale
│   ├── manifest.json        # Configuration PWA
│   └── sw.js               # Service Worker
├── mobile-app/              # Application mobile (PWA)
│   ├── index.html           # Application principale
│   ├── manifest.json        # Configuration PWA
│   └── sw.js               # Service Worker
├── firebase.json            # Configuration Firebase Hosting
├── .firebaserc             # Projet Firebase
└── README.md               # Ce fichier
```

---

## 🚀 ÉTAPE 1 : Déployer le Backoffice sur Firebase Hosting

### 1.1 Installer Firebase CLI

Ouvre le Terminal sur ton Mac et tape :

```bash
npm install -g firebase-tools
```

### 1.2 Se connecter à Firebase

```bash
firebase login
```

Une fenêtre s'ouvrira dans ton navigateur pour te connecter.

### 1.3 Déployer le Backoffice

```bash
cd ~/Downloads/el-mouhssinine   # ou le dossier où tu as extrait les fichiers
firebase deploy --only hosting
```

### 1.4 Accéder au Backoffice

Après le déploiement, tu auras une URL comme :
**https://el-mouhssinine.web.app**

Tu peux l'ajouter à l'écran d'accueil de ton iPhone/Mac comme une app !

---

## 📱 ÉTAPE 2 : Publier l'App Mobile sur TestFlight

### Option A : Utiliser Capacitor (Recommandé)

#### 2.1 Prérequis
- Xcode installé (depuis l'App Store)
- Compte Apple Developer (99€/an) : https://developer.apple.com

#### 2.2 Créer le projet Capacitor

```bash
# Créer un nouveau projet
mkdir el-mouhssinine-ios
cd el-mouhssinine-ios

# Initialiser npm
npm init -y

# Installer Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios

# Initialiser Capacitor
npx cap init "El Mouhssinine" "fr.elmouhssinine.app"
```

#### 2.3 Copier l'application web

```bash
# Créer le dossier www
mkdir www

# Copier les fichiers de mobile-app
cp -r ../el-mouhssinine/mobile-app/* www/
```

#### 2.4 Configurer capacitor.config.json

```json
{
  "appId": "fr.elmouhssinine.app",
  "appName": "El Mouhssinine",
  "webDir": "www",
  "server": {
    "androidScheme": "https"
  }
}
```

#### 2.5 Ajouter la plateforme iOS

```bash
npx cap add ios
npx cap sync ios
```

#### 2.6 Ouvrir dans Xcode

```bash
npx cap open ios
```

#### 2.7 Dans Xcode

1. **Sélectionner ton équipe** : Clic sur le projet > Signing & Capabilities > Team
2. **Configurer l'identifiant** : Bundle Identifier = `fr.elmouhssinine.app`
3. **Build** : Product > Build (⌘+B)
4. **Archive** : Product > Archive

#### 2.8 Publier sur TestFlight

1. Une fois l'archive créée, clique sur **Distribute App**
2. Choisis **App Store Connect**
3. Suis les étapes
4. Va sur https://appstoreconnect.apple.com
5. Crée une nouvelle app si pas déjà fait
6. Va dans TestFlight > Builds
7. Ajoute des testeurs par email

---

### Option B : Utiliser une PWA directement

Si tu n'as pas de compte Apple Developer, tu peux simplement :

1. Déployer l'app mobile sur Firebase Hosting
2. L'ajouter à l'écran d'accueil sur iPhone

```bash
# Modifier firebase.json pour inclure l'app mobile
```

---

## 🔥 Configuration Firebase déjà faite

- **Project ID** : el-mouhssinine
- **API Key** : AIzaSyAA_qoUYwWBTeuUqd0JToHQ8olnbS8OJno
- **Collections** :
  - `members` - Adhérents
  - `events` - Événements
  - `announcements` - Annonces
  - `donations` - Projets de dons
  - `sentNotifications` - Notifications envoyées

---

## 🔒 Sécuriser Firebase (Production)

Une fois en production, va dans Firebase Console > Firestore > Règles et remplace par :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lecture publique
    match /{document=**} {
      allow read: if true;
    }
    
    // Écriture protégée
    match /members/{docId} {
      allow write: if request.auth != null;
    }
    match /events/{docId} {
      allow write: if request.auth != null;
    }
    match /announcements/{docId} {
      allow write: if request.auth != null;
    }
    match /donations/{docId} {
      allow write: if true;
    }
    match /sentNotifications/{docId} {
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📱 Créer les icônes

Tu dois créer des icônes pour la PWA. Utilise un générateur comme :
- https://realfavicongenerator.net
- https://www.pwabuilder.com/imageGenerator

Crée un dossier `icons/` dans chaque app avec :
- icon-72.png
- icon-96.png
- icon-128.png
- icon-144.png
- icon-152.png
- icon-192.png
- icon-384.png
- icon-512.png

---

## 🆘 Aide

### Problème de déploiement Firebase
```bash
firebase login --reauth
```

### Problème Xcode
- Vérifie que tu as accepté les licences : `sudo xcodebuild -license`
- Vérifie que les Command Line Tools sont installés : `xcode-select --install`

### Besoin d'aide ?
Contacte le développeur ou consulte la documentation Firebase :
https://firebase.google.com/docs

---

## ✅ Checklist

- [ ] Firebase CLI installé
- [ ] Connecté à Firebase
- [ ] Backoffice déployé sur Firebase Hosting
- [ ] Icônes créées
- [ ] Compte Apple Developer créé
- [ ] Xcode installé
- [ ] App iOS buildée
- [ ] Archive créée
- [ ] App uploadée sur App Store Connect
- [ ] TestFlight configuré
- [ ] Testeurs invités

---

Bonne chance ! 🚀
