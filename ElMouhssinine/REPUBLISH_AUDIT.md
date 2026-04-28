# REPUBLISH AUDIT — El Mouhssinine Android App

> Generated 2026-04-28 — Pre-migration audit for Google Play republication
> under new package name, following suspension of `com.elmouhssinine`.

---

## a) Stack Detected

| Parameter | Value |
|-----------|-------|
| **Workflow** | **Bare workflow** (native `android/` directory with Kotlin sources, Gradle config) |
| **Expo SDK** | `~55.0.0` (used for expo-updates OTA only) |
| **React Native** | `0.83.1` |
| **expo-updates** | `~55.0.15` — OTA via `https://u.expo.dev/2b193d8f-2732-47c8-938a-336945c5fc84` |
| **Hermes** | Yes (default for RN 0.83) |
| **New Architecture** | Yes (Fabric enabled) |
| **compileSdkVersion** | 36 |
| **targetSdkVersion** | 36 |
| **minSdkVersion** | 24 |
| **Kotlin** | 2.1.20 |
| **NDK** | 27.1.12297006 |
| **buildToolsVersion** | 36.0.0 |

### app.json

```json
{
  "name": "ElMouhssinine",
  "displayName": "ElMouhssinine",
  "expo": {
    "name": "El Mouhssinine",
    "slug": "el-mouhssinine",
    "version": "1.0.0",
    "runtimeVersion": { "policy": "appVersion" },
    "updates": {
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 5000,
      "url": "https://u.expo.dev/2b193d8f-2732-47c8-938a-336945c5fc84"
    },
    "ios": { "bundleIdentifier": "fr.elmouhssinine.mosquee" },
    "android": { "package": "com.elmouhssinine" },
    "extra": { "eas": { "projectId": "2b193d8f-2732-47c8-938a-336945c5fc84" } },
    "owner": "fayce"
  }
}
```

### eas.json

```json
{
  "cli": { "version": ">= 16.28.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "channel": "development" },
    "preview": { "distribution": "internal", "channel": "preview" },
    "production": { "autoIncrement": true, "channel": "production" }
  },
  "submit": { "production": {} }
}
```

---

## b) Current Identity

| Parameter | Value | Source |
|-----------|-------|--------|
| **expo.android.package** | `com.elmouhssinine` | app.json:21 |
| **applicationId** | `com.elmouhssinine` | android/app/build.gradle:87 |
| **namespace** | `com.elmouhssinine` | android/app/build.gradle:85 |
| **expo.name** | `El Mouhssinine` | app.json:5 |
| **displayName** | `ElMouhssinine` | app.json:3 |
| **app_name (strings.xml)** | `ElMouhssinine` | android/app/src/main/res/values/strings.xml |
| **versionCode** | 1 (build.gradle) / 235 (merged manifest via EAS remote) | android/app/build.gradle:90 |
| **versionName** | `1.0` | android/app/build.gradle:91 |
| **iOS bundleIdentifier** | `fr.elmouhssinine.mosquee` | app.json:18 (not in scope) |

---

## c) Permissions Declared

### From AndroidManifest.xml (source — `android/app/src/main/AndroidManifest.xml`)

| Permission | Justified? | Notes |
|-----------|-----------|-------|
| `INTERNET` | YES | Network access |
| `ACCESS_NETWORK_STATE` | YES | Connectivity check |
| `POST_NOTIFICATIONS` | YES | Prayer reminders, announcements |
| `VIBRATE` | YES | Notification feedback |
| `RECEIVE_BOOT_COMPLETED` | **NO — TO REMOVE** | Only used for geofence re-registration at boot |
| `SCHEDULE_EXACT_ALARM` | CONDITIONAL | Used by Notifee for exact prayer reminders — justified but needs Play Console declaration |
| `USE_EXACT_ALARM` | **NO — TO REMOVE** | Reserved for alarm/timer apps per Android 14 policy |
| `ACCESS_FINE_LOCATION` | YES | Qibla direction, foreground proximity check |
| `ACCESS_COARSE_LOCATION` | YES | Fallback for Qibla |
| `WAKE_LOCK` | YES | FCM push processing |

### From merged manifest (added by libraries)

| Permission | Source | Justified? |
|-----------|--------|-----------|
| `FOREGROUND_SERVICE` | react-native-background-fetch + track-player | YES — media playback (Quran) |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | react-native-track-player | YES — Quran audio |
| `com.google.android.c2dm.permission.RECEIVE` | Firebase Messaging | YES — FCM |
| `READ_GSERVICES` | play-services-location | TO REMOVE with geofencing |
| `ACCESS_NOTIFICATION_POLICY` | Notifee | YES — notification management |
| `BROADCAST_CLOSE_SYSTEM_DIALOGS` (max 30) | Notifee | YES — Xiaomi heads-up fix |
| `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX | YES — internal |

### NOT DECLARED (confirmed absent)

- `ACCESS_BACKGROUND_LOCATION` — NOT in source manifest
- `FOREGROUND_SERVICE_LOCATION` — NOT declared
- `CAMERA`, `READ_CONTACTS`, `RECORD_AUDIO` — NOT declared

---

## d) Background Code — Suspect Files

### CRITICAL: Native Kotlin geofencing (TO DELETE)

| File | Content | Action |
|------|---------|--------|
| `android/.../MosqueGeofencingModule.kt` | GeofencingClient.addGeofences() — registers circular geofence around mosque | **DELETE** |
| `android/.../MosqueGeofencingReceiver.kt` | BroadcastReceiver for geofence ENTER transition — sends notification | **DELETE** |
| `android/.../MosqueGeofencingPackage.kt` | ReactPackage that registers MosqueGeofencingModule | **DELETE** |
| `android/.../MosqueGeofenceBootReceiver.kt` | BroadcastReceiver for BOOT_COMPLETED — re-registers geofence | **DELETE** |
| `android/.../MainApplication.kt:21` | `add(MosqueGeofencingPackage())` | **EDIT: remove line** |
| `android/app/build.gradle:119-120` | `implementation 'com.google.android.gms:play-services-location:21.3.0'` | **DELETE** |

### JS/TS references to geofencing

| File:Line | Content | Action |
|-----------|---------|--------|
| `src/services/backgroundLocation.ts` | Entire file — no-op stubs + foreground check | **KEEP foreground check, remove geofencing references** |
| `src/screens/MoreScreen.tsx:84` | `import { getGeofencingStatus }` | **EDIT: remove import** |
| `src/screens/HomeScreen.tsx:875-876` | Comment referencing MosqueGeofencing | **EDIT: remove comment** |
| `src/screens/DonationsScreen.tsx:237-283` | `NativeModules.MosqueGeofencing.getPendingDeepLink` | **EDIT: remove native module calls, keep Linking.getInitialURL fallback** |
| `src/services/monitoring.ts:102` | `GEOFENCE_ENTER` analytics event constant | **DELETE constant** |
| `src/components/ProminentDisclosure.tsx:6` | Comment mentioning ACCESS_BACKGROUND_LOCATION | **EDIT: update comment** |

---

## e) Prominent Disclosure

**EXISTS** — `src/components/ProminentDisclosure.tsx` (265 lines)

- Modal displayed at **first launch**, before any system permission request
- Clear language explaining: foreground location for mosque proximity, data stays on device, no third-party sharing, fully optional
- **Accept** / **Decline** buttons of equal prominence
- Choice persisted in AsyncStorage (`@el_mouhssinine/prominent_disclosure_v1`)
- Privacy policy link included
- **Triggered from**: `AppNavigator.tsx` (wraps navigation)

**Assessment**: MOSTLY COMPLIANT. Needs minor update:
1. Remove reference to ACCESS_BACKGROUND_LOCATION in the comment (line 6)
2. Text mentions "detecting when you approach the mosque" — this should be updated to clarify it's foreground-only after geofencing removal

Additionally, `OnboardingConsentScreen.tsx` shows a GDPR consent screen with data collection summary and link to full privacy policy.

---

## f) Privacy Policy

**Accessible from the app**: YES, via 3 paths:
1. `MoreScreen.tsx:1617` — navigation to `PrivacyPolicy` screen
2. `OnboardingConsentScreen.tsx:88` — "Read full privacy policy" link
3. `ProminentDisclosure.tsx:128` — link to `https://el-mouhssinine.web.app/privacy-policy.html`

**In-app screen**: `PrivacyPolicyScreen.tsx` — full native screen with 10 sections (data collected, purposes, legal basis, rights, sub-processors, etc.)

**Web URL**: `https://el-mouhssinine.web.app/privacy-policy.html`

---

## g) Third-Party SDKs

| SDK | Purpose | Data Collected | Status |
|-----|---------|---------------|--------|
| **Firebase Auth** | Authentication | uid, email, phone | ACTIVE |
| **Firebase Firestore** | Database | Member profiles, payments, messages | ACTIVE |
| **Firebase Cloud Messaging** | Push notifications | FCM token | ACTIVE |
| **Firebase Analytics** | Usage analytics | Screen views, events | ACTIVE |
| **Firebase Crashlytics** | Crash reporting | Crash traces, uid | ACTIVE |
| **Firebase Performance** | Performance traces | Trace metrics | ACTIVE |
| **Stripe** | Payments (memberships, donations) | Payment data (handled by Stripe) | ACTIVE |
| **Sentry** | Error monitoring | **STUB ONLY** — code commented out, DSN = placeholder | INACTIVE |
| **Expo Updates** | OTA updates | Device info for update check | ACTIVE |
| **Notifee** | Local notifications | None beyond notification content | ACTIVE |
| **react-native-track-player** | Quran audio playback | None | ACTIVE |
| **react-native-background-fetch** | Background cache refresh | None | ACTIVE |
| **@react-native-community/geolocation** | Qibla + foreground proximity | Foreground location (not transmitted) | ACTIVE |

No ads, no AdMob, no tracking SDKs.

---

## h) Firebase Configuration

| Parameter | Value |
|-----------|-------|
| **Project ID** | `el-mouhssinine` |
| **Project Number** | `658931173250` |
| **google-services.json location** | `android/app/google-services.json` |
| **package_name in google-services.json** | `com.elmouhssinine` |
| **mobilesdk_app_id** | `1:658931173250:android:299193b985b37d992f319b` |
| **Active services** | Auth, Firestore, FCM, Analytics, Crashlytics, Performance, Cloud Functions |
| **Region** | europe-west1 |

**ACTION REQUIRED**: Must add new Android app in Firebase Console with new package name, download new `google-services.json`.

---

## i) Stripe / Sentry Configuration

### Stripe
- Used via `@stripe/stripe-react-native` for in-app payments
- Publishable key loaded at runtime (not hardcoded in config files requiring package change)
- CB donations redirect to web: `https://el-mouhssinine.web.app/don` (no package dependency)
- Deep link return uses `Linking.getInitialURL()` + native module (to be cleaned up)
- **No package-name dependency in Stripe config**

### Sentry
- `src/services/sentry.ts` — **STUB ONLY** (lines 100-126 active, real Sentry code commented out lines 13-97)
- `@sentry/react-native` is NOT in `package.json` dependencies
- DSN placeholder: `YOUR_SENTRY_DSN_HERE`
- **No action needed** — dead code, not functional

---

## j) All References to `com.elmouhssinine`

```
app.json:21                                    → expo.android.package
android/app/build.gradle:85                    → namespace
android/app/build.gradle:87                    → applicationId
android/app/google-services.json:12            → package_name (to be replaced)
android/.../MainActivity.kt:1                  → package declaration
android/.../MainApplication.kt:1               → package declaration
android/.../MosqueGeofencingModule.kt:1         → package declaration (TO DELETE)
android/.../MosqueGeofencingPackage.kt:1        → package declaration (TO DELETE)
android/.../MosqueGeofencingReceiver.kt:1       → package declaration (TO DELETE)
android/.../MosqueGeofenceBootReceiver.kt:1     → package declaration (TO DELETE)
```

**Total**: 10 files, of which 4 will be deleted entirely (geofencing files).

### References to "elmouhssinine" / "ElMouhssinine" in JS/TS (NOT package name, display name):

| File | Reference | Action |
|------|-----------|--------|
| `app.json:2` | `"name": "ElMouhssinine"` | RENAME |
| `app.json:3` | `"displayName": "ElMouhssinine"` | RENAME |
| `app.json:5` | `"name": "El Mouhssinine"` | RENAME |
| `src/components/ProminentDisclosure.tsx:26` | AsyncStorage key `@el_mouhssinine/...` | KEEP (internal, no user impact) |
| `src/screens/MoreScreen.tsx:105` | `website: 'el-mouhssinine.web.app'` | KEEP (correct URL) |
| `src/screens/DonationsScreen.tsx:2146` | `el-mouhssinine.web.app/don` | KEEP (correct URL) |
| `src/data/mockData.ts:478` | `contact@elmouhssinine.fr` | KEEP (contact email) |
| `src/services/sentry.ts:32` | `release: 'el-mouhssinine@1.0.0'` | KEEP (commented out / dead code) |
| `android/.../res/values/strings.xml` | `app_name = ElMouhssinine` | RENAME |

---

## BLOCKERS

**None identified.** The backend (Cloud Functions, Firestore rules, Storage rules) contains zero references to `com.elmouhssinine`. Stripe config has no package-name dependency. The migration is self-contained within the `ElMouhssinine/` directory.

---

## CHOICES RETAINED

| Decision | Value | Rationale |
|----------|-------|-----------|
| **New package name** | `fr.elmouhssinine.mosquee` | Aligns with iOS bundleIdentifier, uses FR country TLD, clearly distinct from `com.elmouhssinine` |
| **New app display name** | `El Mouhssinine - Centre Culturel Islamique` | Matches brief proposal, descriptive, distinct from old `ElMouhssinine` |
| **New keystore** | YES — new keystore to generate | Required: must fully dissociate from old app identity |
| **Keystore path** | `android/app/release-new.keystore` (gitignored) | Standard location |
| **versionCode** | 1 | Fresh start |
| **versionName** | 1.0.0 | Fresh start |
| **Geofencing** | DELETE entirely (native Kotlin + JS references) | Root cause of repeated rejections — GeofencingClient triggers Google Play background location detection |
| **Foreground proximity** | KEEP `backgroundLocation.ts` foreground check | Works without any dangerous permissions |
| **Icon** | Keep current, document replacement in MANUAL_STEPS.md | User must provide new visual before final build |

### Files to be modified (Step 2+)

**DELETE (4 files):**
- `android/app/src/main/java/com/elmouhssinine/MosqueGeofencingModule.kt`
- `android/app/src/main/java/com/elmouhssinine/MosqueGeofencingPackage.kt`
- `android/app/src/main/java/com/elmouhssinine/MosqueGeofencingReceiver.kt`
- `android/app/src/main/java/com/elmouhssinine/MosqueGeofenceBootReceiver.kt`

**MOVE (2 files — package directory rename):**
- `android/app/src/main/java/com/elmouhssinine/MainActivity.kt` → `.../fr/elmouhssinine/mosquee/MainActivity.kt`
- `android/app/src/main/java/com/elmouhssinine/MainApplication.kt` → `.../fr/elmouhssinine/mosquee/MainApplication.kt`

**EDIT (config files):**
- `app.json` — package, name, displayName
- `android/app/build.gradle` — applicationId, namespace, remove play-services-location
- `android/app/src/main/AndroidManifest.xml` — remove geofencing permissions, receivers
- `android/app/src/main/res/values/strings.xml` — app_name
- `eas.json` — no change needed (appVersionSource: remote handles versionCode)

**EDIT (JS/TS source):**
- `src/screens/DonationsScreen.tsx` — remove NativeModules.MosqueGeofencing calls
- `src/screens/MoreScreen.tsx` — remove geofencing imports and usage
- `src/screens/HomeScreen.tsx` — remove geofencing comments
- `src/services/backgroundLocation.ts` — remove geofencing references
- `src/services/monitoring.ts` — remove GEOFENCE_ENTER constant
- `src/components/ProminentDisclosure.tsx` — update comment

**REPLACE (manual):**
- `android/app/google-services.json` — must be replaced after Firebase Console step
