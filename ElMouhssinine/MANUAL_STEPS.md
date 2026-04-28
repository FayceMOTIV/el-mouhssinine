# MANUAL STEPS — El Mouhssinine Republication

> Steps that require manual action by the developer before the final build.
> Complete these IN ORDER.

---

## 1. Firebase Console — Add New Android App

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project **el-mouhssinine**
3. Click the gear icon → **Project settings**
4. Scroll to **Your apps** → click **Add app** → select Android
5. Enter package name: **`fr.elmouhssinine.mosquee`**
6. Enter app nickname: `El Mouhssinine Android (republished)`
7. Skip the SHA-1 for now (EAS will handle it)
8. Click **Register app**
9. Download the new **`google-services.json`**
10. Replace the file at:
    ```
    ElMouhssinine/android/app/google-services.json
    ```
11. Verify the new file contains `"package_name": "fr.elmouhssinine.mosquee"`
12. Commit the replacement:
    ```bash
    git add ElMouhssinine/android/app/google-services.json
    git commit -m "chore: replace google-services.json for new package"
    ```

**IMPORTANT**: Do NOT delete the old Android app (`com.elmouhssinine`) from Firebase — it's still used by the iOS app's shared backend.

---

## 2. Firebase Console — Add SHA-1 Certificate Fingerprint

After EAS builds the app (or after generating the keystore), you need to register the signing certificate SHA-1:

### If using EAS Build:
```bash
eas credentials --platform android
# Select "Keystore" → view SHA-1 fingerprint
```

### If using local keystore:
```bash
keytool -list -v -keystore android/app/release-new.keystore -alias el-mouhssinine-key
# Copy the SHA1 fingerprint
```

Then in Firebase Console:
1. Project settings → Your apps → select the new Android app
2. Click **Add fingerprint**
3. Paste the SHA-1

---

## 3. App Icon — Visual Differentiation

Google Play detects "clone" apps. The icon MUST be visually different from the old `com.elmouhssinine` app.

**Minimum change**: modify the background color or frame of the icon.

### Required assets:

| Asset | Size | Location |
|-------|------|----------|
| `ic_launcher.png` (mdpi) | 48x48 | `android/app/src/main/res/mipmap-mdpi/` |
| `ic_launcher.png` (hdpi) | 72x72 | `android/app/src/main/res/mipmap-hdpi/` |
| `ic_launcher.png` (xhdpi) | 96x96 | `android/app/src/main/res/mipmap-xhdpi/` |
| `ic_launcher.png` (xxhdpi) | 144x144 | `android/app/src/main/res/mipmap-xxhdpi/` |
| `ic_launcher.png` (xxxhdpi) | 192x192 | `android/app/src/main/res/mipmap-xxxhdpi/` |
| `ic_launcher_round.png` | Same sizes as above | Same directories |

### Adaptive Icon (RECOMMENDED for Google Play):

Create these files:
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml` (or PNG 108x108dp = 432x432px)
- `android/app/src/main/res/drawable/ic_launcher_background.xml` (or a color)

Example `ic_launcher.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
```

Tool: use [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) or Figma to generate all sizes.

---

## 4. Play Store — New Listing (NOT update of old)

This is a **brand new app listing**, not an update to the suspended app.

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. App name: **El Mouhssinine - Centre Culturel Islamique**
4. Default language: **French (France)**
5. App type: **Application**
6. Free or paid: **Free**
7. Declarations: check all that apply (not an ad, educational/non-profit)

### Required assets for the listing:
- **App icon**: 512x512 PNG (hi-res, used in Store listing)
- **Feature graphic**: 1024x500 PNG
- **Screenshots**: minimum 4 phone screenshots (DO NOT reuse old listing screenshots)
- **Short description**: max 80 characters
- **Full description**: max 4000 characters (write NEW text, do not copy from old listing)

### Data Safety section:
Fill in the following:
| Data type | Collected? | Shared? | Purpose |
|-----------|-----------|---------|---------|
| Email address | Yes | No | Account management |
| Name | Yes | No | Account management |
| Phone number | Yes (optional) | No | Account management |
| Payment info | Yes | Yes (Stripe) | Payments for memberships/donations |
| Approximate location | Yes | No | Qibla direction, prayer times |
| Precise location | Yes | No | Mosque proximity (foreground only) |
| Crash logs | Yes | No (Firebase Crashlytics) | App stability |
| Performance diagnostics | Yes | No (Firebase Performance) | App performance |
| App interactions | Yes | No (Firebase Analytics) | Analytics |
| Device identifiers | Yes | No (FCM token) | Push notifications |

### Content Rating:
- Complete the content rating questionnaire (IARC)
- Category: Religious/Educational, no violence, no ads

### Permission Justifications (required for):
- **ACCESS_FINE_LOCATION**: "Used to calculate Qibla direction and detect proximity to the mosque (foreground only, when the app is open). Location data never leaves the device."
- **ACCESS_COARSE_LOCATION**: "Fallback for Qibla direction calculation."
- **POST_NOTIFICATIONS**: "Prayer time reminders, mosque announcements, and event notifications."
- **SCHEDULE_EXACT_ALARM**: "Precise prayer time reminders that must fire at exact times (e.g., Fajr at 5:23 AM)."

---

## 5. Keystore — New Signing Key

### Option A: EAS Build (recommended)
```bash
cd ElMouhssinine
eas credentials --platform android
# Select: "Set up a new keystore"
# EAS will generate and securely store the keystore
# Then build:
eas build --platform android --profile production
```

### Option B: Local keystore
```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore android/app/release-new.keystore \
  -alias el-mouhssinine-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=El Mouhssinine, OU=Mobile, O=Centre Culturel Islamique El Mouhssinine, L=Bourg-en-Bresse, ST=Ain, C=FR"
```

Then update `android/app/build.gradle` signingConfigs:
```gradle
signingConfigs {
    release {
        storeFile file('release-new.keystore')
        storePassword System.getenv("KEYSTORE_PASSWORD") ?: ''
        keyAlias 'el-mouhssinine-key'
        keyPassword System.getenv("KEY_PASSWORD") ?: ''
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        ...
    }
}
```

**IMPORTANT**: Add `release-new.keystore` to `.gitignore`. Back up the keystore securely — if lost, you cannot update the app.

---

## 6. Build the AAB

### With EAS (recommended):
```bash
cd ElMouhssinine
eas build --platform android --profile production
```
The AAB will be available for download from the EAS dashboard.

### Local build:
```bash
cd ElMouhssinine/android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 7. Upload to Play Console

1. In the new app listing, go to **Release** → **Production**
2. Click **Create new release**
3. Upload the AAB file
4. Fill in release notes (in French):
   ```
   Première version de l'application El Mouhssinine - Centre Culturel Islamique.
   
   Fonctionnalités :
   - Horaires de prière précis pour Bourg-en-Bresse
   - Lecture du Coran avec mode karaoké
   - Annonces et événements de la mosquée
   - Gestion des adhésions et cotisations
   - Dons sécurisés via Stripe
   - Notifications de rappel de prière
   - Direction de la Qibla
   ```
5. Review and submit for review

---

## 8. Post-Publication

After approval:
- Notify existing users to download the new app (via push notification from the backoffice, social media, Friday announcement)
- The old `com.elmouhssinine` app remains suspended — users cannot update it
- Keep the old Firebase Android app registered (shared backend with iOS)
