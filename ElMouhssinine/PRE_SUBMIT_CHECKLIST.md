# PRE-SUBMIT CHECKLIST — El Mouhssinine Play Store Republication

> Check every item BEFORE uploading the AAB to Google Play Console.
> A single unchecked item = DO NOT SUBMIT.

---

## Code & Config

- [ ] `google-services.json` replaced with new one for `fr.elmouhssinine.mosquee`
- [ ] Zero references to `com.elmouhssinine` in the codebase (run: `grep -rn "com.elmouhssinine" ElMouhssinine/ --include="*.kt" --include="*.java" --include="*.xml" --include="*.gradle" --include="*.json" --include="*.properties" | grep -v node_modules | grep -v /build/`)
- [ ] Zero geofencing code (run: `grep -rn "GeofencingClient\|addGeofences\|GEOFENCE" ElMouhssinine/ --include="*.kt" --include="*.java" | grep -v node_modules | grep -v /build/`)
- [ ] `ACCESS_BACKGROUND_LOCATION` NOT in any manifest
- [ ] `FOREGROUND_SERVICE_LOCATION` NOT in any manifest
- [ ] `RECEIVE_BOOT_COMPLETED` NOT in source manifest
- [ ] `USE_EXACT_ALARM` NOT in source manifest
- [ ] SHA-1 fingerprint registered in Firebase Console for new package

## Build

- [ ] AAB signed with NEW keystore (not the old `com.elmouhssinine` keystore)
- [ ] Build tested on a physical Android device
- [ ] First launch flow tested: Onboarding Consent → Accept → Prominent Disclosure → Accept → App works
- [ ] First launch flow tested: Onboarding Consent → Accept → Prominent Disclosure → Decline → App works (without location features)
- [ ] Qibla direction works (foreground location)
- [ ] Prayer times display correctly
- [ ] Notifications (prayer reminders) fire correctly
- [ ] Quran audio playback works
- [ ] Donations flow works (opens web page)
- [ ] Membership flow works (Stripe payment)

## Visual Identity

- [ ] New app icon in place (visually different from old app)
- [ ] Adaptive icon configured (`mipmap-anydpi-v26/ic_launcher.xml`)
- [ ] Hi-res icon (512x512) ready for Play Store listing

## Play Store Listing

- [ ] NEW screenshots captured (at least 4 phone screenshots)
- [ ] Screenshots are NOT reused from the old `com.elmouhssinine` listing
- [ ] Feature graphic (1024x500) prepared
- [ ] Short description written (max 80 chars, NEW text)
- [ ] Full description written (max 4000 chars, NEW text)
- [ ] No mention of old package name or old app name in any listing text
- [ ] Privacy policy URL set: `https://el-mouhssinine.web.app/privacy-policy.html`
- [ ] App category set correctly (Education or Social)
- [ ] Content rating questionnaire completed (IARC)

## Data Safety

- [ ] Data Safety section completed in Play Console
- [ ] Foreground location declared (Qibla + proximity, not shared)
- [ ] Payment data declared (shared with Stripe)
- [ ] Email/name declared (account management)
- [ ] Crash logs declared (Firebase Crashlytics)
- [ ] Analytics declared (Firebase Analytics)
- [ ] FCM token declared (push notifications)
- [ ] Data deletion mechanism declared (delete account feature exists in app)

## Permission Justifications

- [ ] `ACCESS_FINE_LOCATION` justified in Play Console declaration
- [ ] `ACCESS_COARSE_LOCATION` justified
- [ ] `POST_NOTIFICATIONS` justified
- [ ] `SCHEDULE_EXACT_ALARM` justified (exact prayer reminders)

## Account & Identity

- [ ] Developer account is in good standing (verified in Play Console)
- [ ] App name in listing: "El Mouhssinine - Centre Culturel Islamique" (different from old)
- [ ] Package name: `fr.elmouhssinine.mosquee` (different from old `com.elmouhssinine`)
- [ ] This is listed as a NEW app, NOT an update to the suspended app

---

## Final Verification Command

Run this before building:
```bash
# Verify zero old package references
grep -rn "com\.elmouhssinine" ElMouhssinine/ \
  --include="*.kt" --include="*.java" --include="*.xml" \
  --include="*.gradle" --include="*.json" --include="*.properties" \
  --include="*.tsx" --include="*.ts" --include="*.js" \
  | grep -v node_modules | grep -v /build/

# Expected output: ONLY google-services.json (if not yet replaced)
# After replacement: ZERO results
```
