# El Mouhssinine — Application mosquée (Bourg-en-Bresse)

Application mobile iOS + Android de la mosquée El Mouhssinine (Centre Culturel Islamique).
React Native 0.83 / Expo. Bilingue FR/AR. En production sur l'App Store et Google Play.

---

## ⭐ Source de vérité (À LIRE EN PREMIER)

- **Branche canonique : `main`** — c'est la SEULE branche officielle.
- **L'app est à la RACINE du dépôt** (`src/`, `ios/`, `android/`, `app.json`…).
- Backoffice web : `el-mouhssinine-backoffice/` · Cloud Functions : `functions/`

> ⚠️ Les anciens états (app dans un sous-dossier `ElMouhssinine/`, branche `master`) sont
> **archivés dans des tags Git** (`archive/main-2026-04-12`, `archive/master-1.1.6-2026-05-28`)
> et ne doivent plus servir.

---

## 🔑 RÈGLE D'OR

> **TOUJOURS committer + pusher sur GitHub AVANT de builder. Jamais l'inverse.**

Si on build sans pusher, GitHub prend du retard et on ne sait plus quelle version est en ligne.
C'est exactement ce qui a causé le désordre des branches en juin 2026.

---

## 🚀 Process de livraison (complet)

### Android (Google Play)
```bash
git add -A && git commit -m "..." && git push          # 1. d'abord GitHub
eas build --platform android --profile production       # 2. build (.aab)
# 3. Google Play Console → Production → nouvelle release → téléverser le .aab → Envoyer pour examen
```

### iOS (App Store)
⚠️ Apple impose le **SDK iOS 26 (Xcode 26+)**. Patches appliqués : Stripe via `patches/`, fmt via
`ios/Podfile` (post_install). 
```bash
git add -A && git commit -m "..." && git push          # 1. d'abord GitHub
cd ios && pod install
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath /tmp/ElMouhssinine.xcarchive -allowProvisioningUpdates
xcodebuild -exportArchive -archivePath /tmp/ElMouhssinine.xcarchive \
  -exportPath /tmp/export -exportOptionsPlist ExportOptions.plist -allowProvisioningUpdates
xcrun altool --upload-app -f /tmp/export/*.ipa -t ios --apiKey <KEY> --apiIssuer <ISSUER>
```

### 🚨 L'étape qui avait été OUBLIÉE (cause du cafouillage)
Après l'upload, le build n'est **PAS** automatiquement en vente. Il faut, dans **App Store Connect** :
créer/ouvrir la version → **attacher le build** → **« Ajouter pour examen »** → **« Soumettre pour
examen »**. **Tant que ce n'est pas soumis ET approuvé par Apple, l'app n'est pas mise à jour.**

---

## 📦 Versions (où changer les numéros)

`eas.json` → `appVersionSource: "local"` : les numéros sont **dans le code**.

| Numéro | Fichier |
|---|---|
| Version marketing (1.1.8) | `app.json` `expo.version` + iOS `MARKETING_VERSION` + Android `versionName` |
| Build iOS (316) | `ios/.../project.pbxproj` `CURRENT_PROJECT_VERSION` |
| Build Android (38) | `android/app/build.gradle` `versionCode` |

Bundle ID : `fr.elmouhssinine.mosquee`

---

## 🔒 Sécurité — ⚠️ DÉPÔT PUBLIC

Ne **JAMAIS** committer : `pc-api-key.json` (clé admin Firebase), `functions/.env` (Stripe/Brevo),
keystores upload `*.jks`, clés `sk_live`/`sk_test`. Le `.gitignore` les bloque.
Les clés CLIENT (`google-services.json`, `GoogleService-Info.plist`) sont publiques par design → OK.

---

## 🛠️ Développement

```bash
npm install
cd ios && pod install && cd ..
npm start          # Metro
npm run ios        # iOS
npm run android    # Android
```

## 📂 Structure

```
.
├── src/                          # App RN (screens/, services/, components/, i18n/, theme/…)
├── ios/                          # Xcode + CocoaPods
├── android/                      # Gradle
├── el-mouhssinine-backoffice/    # Backoffice admin (Vite/React) → el-mouhssinine.web.app
├── functions/                    # Cloud Functions Firebase (Node 20)
├── patches/                      # Patches node_modules (patch-package)
├── app.json / eas.json           # Config Expo / EAS
├── CLAUDE.md                     # Contexte détaillé projet
└── CHANGELOG.md                  # Historique des builds
```

## ✨ Fonctionnalités

Horaires de prière (Mawaqit/UOIF) · Coran 114 sourates + audio + mode page · Adhésion membre
(Stripe, multi-adhérents, carte digitale) · Dons + reçus fiscaux · Messages privés · Annonces ·
Événements · Salat Janaza (notif prioritaire) · Adhkar · Alphabet arabe · Dates islamiques ·
Rappels du jour.

---

## Services clés (`src/services/`)

`firebase.ts` (Firestore/Auth/FCM) · `prayerApi.ts` (horaires) · `stripe.ts` (paiements) ·
`notifications.ts` (FCM) · `notificationHistory.ts` (centre de notifs in-app).

APNs — Key ID `4YY44LG5M5` · Team ID `5ZR87TPM89` · Firebase region `europe-west1`.
