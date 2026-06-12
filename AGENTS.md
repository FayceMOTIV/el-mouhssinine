# 🤖 Note pour les futurs agents Claude — Projet El Mouhssinine

Lis ce fichier EN ENTIER avant d'agir. Il contient les pièges qui font perdre des heures.
Faiçal est **non-dev** : explique simplement, en langage clair. Réponds en français.

---

## 0. RÈGLE D'OR
> **TOUJOURS `git add` + `commit` + `push` AVANT de builder. Jamais l'inverse.**
> C'est ce qui a causé le chaos des branches en juin 2026. GitHub = source de vérité.

---

## 1. Structure & repos (PIÈGE IMPORTANT)
Il existe **DEUX dossiers** sur le Mac, ne te trompe pas :
- ✅ `~/el-mouhssinine/ElMouhssinine/` = **LA bonne copie** (l'app, branche `main`, = ce qui produit les builds en prod). App **à la racine** (`src/`, `ios/`, `android/`).
- ⚠️ `~/Downloads/el-mouhssinine/` = vieille copie, **NE PAS utiliser**.

Le **backoffice** (`el-mouhssinine-backoffice/`) et les **Cloud Functions** (`functions/`) sont dans le dossier PARENT `~/el-mouhssinine/` (repo git séparé, même remote GitHub).
- GitHub : `FayceMOTIV/el-mouhssinine`, branche unique **`main`** (PUBLIC ⚠️). Tags `archive/*` = anciens états.
- Backoffice live : https://el-mouhssinine.web.app · Firebase project `el-mouhssinine` (region **europe-west1**).

## 2. Hook qui planque ton travail (PIÈGE)
Un hook global `auto_commit.sh` fait `git stash` à chaque fin de tour sur les branches protégées (`main`/`master`).
Si ton travail "disparaît" du working tree → c'est dans `git stash list`. Commit explicitement pour le sécuriser.

## 3. Build iOS — Apple EXIGE le SDK iOS 26 (Xcode 26)
Apple refuse tout upload buildé avec un SDK < iOS 26. **Il FAUT Xcode 26** (`/Applications/Xcode.app`, pas Xcode-16.4).
Mais Xcode 26 / Clang 21 casse 3 libs → **3 patches obligatoires** (déjà en place) :
1. **fmt** : `ios/Pods/fmt/include/fmt/base.h` → `FMT_CONSTEVAL consteval` doit être `FMT_CONSTEVAL constexpr` (régénéré par `pod install`, à re-patcher si besoin — voir Podfile post_install).
2. **Stripe #2357** : `node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h` → `NS_ENUM(NSUInteger, STPPaymentStatus)` doit être `NSInteger`. Sauvegardé durablement dans `patches/` (patch-package).
3. **expo-modules-core** : sur Xcode 26 les `@MainActor` conformances compilent nativement (ne pas y toucher).

**Process build iOS** (après commit+push) :
```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd ios && pod install   # re-vérifier le patch fmt après
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath /tmp/ElM.xcarchive -allowProvisioningUpdates
xcodebuild -exportArchive -archivePath /tmp/ElM.xcarchive -exportPath /tmp/ElM-export \
  -exportOptionsPlist /tmp/ExportOptions-appstore.plist -allowProvisioningUpdates
xcrun altool --upload-app -f /tmp/ElM-export/ElMouhssinine.ipa -t ios \
  --apiKey J438336RNH --apiIssuer 15135f3f-eb88-4d2d-bfe0-7f6b0c74b130
```
- ⚠️ L'upload altool peut échouer sur réseau instable → relancer (l'IPA existe déjà).
- Puis App Store Connect : créer la version → attacher le build → **« Soumettre pour examen »** (étape souvent oubliée !). Tout se pilote par API (clé `J438336RNH`, issuer `15135f3f-eb88-4d2d-bfe0-7f6b0c74b130`, clé `.p8` dans `~/.private_keys/`). Une **mosquée = compte Apple "2k (ARA)"**, nom éditeur partagé avec d'autres apps FaceMedia.

## 4. Build Android
EAS cloud : `eas build --platform android --profile production`. Si la file EAS est longue, build local :
`eas build --platform android --profile production --local --output /tmp/x.aab` MAIS sous **Node 18** + polyfill `toReversed` (Node 20 casse dtrace ; Node 18 casse Metro → polyfill non-énumérable via `NODE_OPTIONS=--require`). Le quota EAS gratuit iOS est vite épuisé.
Puis Google Play Console → Production → téléverser `.aab` → Envoyer pour examen.

## 5. Versions (eas.json = `appVersionSource: "local"`)
Bumper À LA MAIN dans : `app.json` (version + android.versionCode), iOS `MARKETING_VERSION` + `CFBundleVersion` (pbxproj/Info.plist), Android `versionCode`/`versionName` (build.gradle). Page "Plus" de l'app lit `package.json` version.
**Au 2026-06-12** : iOS 1.1.8 LIVE, 1.1.9 (build 317) en examen. Android V38 en review, V39 (vc 39, 1.1.9) AAB prêt. Bundle `fr.elmouhssinine.mosquee`.

## 6. MAJ auto (OTA) — déjà configuré
`expo-updates` activé, runtime = version marketing (ex 1.1.9). `src/utils/checkForUpdates.ts` télécharge en silence (applique au prochain lancement, pas de pop-up).
**Pousser un correctif JS sans passer par les stores** :
```bash
eas update --channel production --message "fix: ..." --environment production
```
⚠️ Un OTA ne marche QUE si le `runtimeVersion` de l'app installée == celui de l'update. Changement natif (lib, permission) = rebuild + store obligatoire.

## 7. Déploiements serveur (depuis le PARENT `~/el-mouhssinine/`)
```bash
firebase deploy --only hosting     # backoffice (build: cd el-mouhssinine-backoffice && npm run build)
firebase deploy --only functions   # Cloud Functions (functions/, Node 20)
firebase deploy --only firestore:rules,storage
```
Secrets dans `functions/.env` (gitignored) : Stripe, Brevo, + stats stores (`ASC_*`, `GPLAY_*`).

## 8. Pièges spécifiques (déjà corrigés, à NE PAS réintroduire)
- **Données mockées** : `src/services/firebase.ts` NE doit JAMAIS retomber sur `mockEvents`/`mockAnnouncements`/etc. en prod (affichait de faux événements). Mocks réservés à `FORCE_DEMO_MODE`. Ne PAS toucher au fallback des **horaires de prière** (Mawaqit, intentionnel).
- **Apple Pay** : interdit sur Android. Tout rendu Apple Pay doit être gaté `Platform.OS === 'ios'`.
- **Backoffice "reflète la base"** : ne jamais inventer de valeur par défaut (ex `montant || 100`). Afficher la vraie donnée ou `—`.
- **orderBy Firestore** masque les docs sans le champ → côté backoffice on récupère tout puis tri client-side (events, annonces, dons).
- **Dons app** : pas de toggle "Notre Mosquée/Autres Causes" dans une page déjà dédiée à un type.
- App ne doit JAMAIS écrire dans `payments/` (webhook admin SDK only). `computeMemberStatus` = source de vérité du statut membre.

## 9. Sécurité (repo PUBLIC)
JAMAIS committer : `pc-api-key.json`, `functions/.env`, `*.jks`, `~/.private_keys/*`, clés `sk_live`. Le `.gitignore` les bloque. `google-services.json` / `GoogleService-Info.plist` = clés CLIENT publiques, OK.

## 10. Stats téléchargements backoffice
Cloud Functions `updateStoreStats` (cron 7h) + `refreshStoreStats` (callable admin) → écrit `settings/storeStats` → carte dashboard. iOS via App Store Connect (vendor `92688440`), Android via service account `stats-telechargements@el-mouhssinine.iam.gserviceaccount.com` (clé `~/.private_keys/playstats-el-mouhssinine.json`, permission Play Console ~24h pour s'activer).

---
**Faiçal valide TOUJOURS avant un build/déploiement/suppression destructive. Preuve avant claim : montre l'output, ne dis pas "c'est fixé" sans vérifier.**
