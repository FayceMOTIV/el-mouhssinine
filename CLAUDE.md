# El Mouhssinine - Contexte Projet

## Structure
```
~/Downloads/el-mouhssinine/
├── ElMouhssinine/          # App mobile React Native
├── el-mouhssinine-backoffice/  # Backoffice React
├── functions/              # Cloud Functions Firebase
├── firestore.rules         # Regles securite Firestore
└── firebase.json           # Config Firebase
```

## App Mobile
- **Chemin** : ~/Downloads/el-mouhssinine/ElMouhssinine/
- **Bundle ID** : fr.elmouhssinine.mosquee
- **Build actuel** : 46
- **Stack** : React Native 0.83.1, Firebase, TypeScript

## Backoffice
- **Chemin** : ~/Downloads/el-mouhssinine/el-mouhssinine-backoffice/
- **URL** : https://el-mouhssinine.web.app
- **Stack** : React, Vite, Firebase

## Firebase
- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations

## Cloud Functions (9 deployees)
| Fonction | Type | Description |
|----------|------|-------------|
| onNewAnnouncement | Trigger Firestore | Notif auto nouvelle annonce |
| onNewEvent | Trigger Firestore | Notif auto nouvel evenement |
| onNewJanaza | Trigger Firestore | Notif auto janaza (priorite haute) |
| onNewPopup | Trigger Firestore | Notif auto popup |
| sendManualNotification | Callable | Envoi manuel backoffice |
| getNotificationStats | Callable | Stats pour dashboard |
| scheduledJumuaReminder | Scheduled | Vendredi 11h30 |
| scheduledFajrReminder | Scheduled | Tous les jours 5h30 |
| cleanupOldNotifications | Scheduled | Dimanche 3h |

## Fonctionnalites Implementees
- Horaires priere Mawaqit (methode 15 + tune)
- Traductions FR/AR completes + support RTL
- TTS prononciation arabe (expo-speech)
- Notifications push automatiques via FCM
- Coran 114 sourates + audio recitation
- Adhkar (invocations)
- Apprentissage arabe (alphabet + lecons)
- Splash screen personnalise
- Securite Firestore Rules
- Popups et rappels du jour dynamiques
- Dates islamiques avec countdown
- Frequence d'affichage des popups (always/daily/once/weekly)

## APNs Configuration
- **Key ID** : 4YY44LG5M5
- **Team ID** : 5ZR87TPM89
- **Environment** : Sandbox & Production

## Corrige (Build 46)
- [x] Fix notifications FCM iOS (nouvelle cle APNs)
- [x] Suppression debug Alerts dans App.tsx
- [x] Nettoyage console.logs excessifs
- [x] Frequence d'affichage des popups (backoffice + app)
- [x] Type Popup.frequence ajoute

## En cours / A fixer
- [ ] Fix TTS son qui ne sort pas
- [ ] Activer Firebase Storage (console)

## TODO Futur
- [ ] Config emails SMTP (Brevo)
- [ ] Recu fiscal PDF
- [ ] Stripe paiements
- [ ] Dashboard stats backoffice

## Commandes utiles

### Build iOS
```bash
cd ElMouhssinine/ios && pod install
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine -configuration Release -destination 'generic/platform=iOS' -archivePath ./build/ElMouhssinine.xcarchive
```

### Export et Upload TestFlight
```bash
xcodebuild -exportArchive -archivePath ./build/ElMouhssinine.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath ./build/export
xcrun altool --upload-app -f ./build/export/ElMouhssinine.ipa -t ios -u EMAIL -p APP_SPECIFIC_PASSWORD
```

### Backoffice
```bash
cd el-mouhssinine-backoffice && npm run build && firebase deploy --only hosting
```

### Cloud Functions
```bash
firebase deploy --only functions
```

### Firestore Rules
```bash
firebase deploy --only firestore:rules
```

## Git
- **Remote** : https://github.com/FayceMOTIV/el-mouhssinine.git
- **Branche** : main

## Notes Audit (Jan 2026)
- 150+ console.logs dans l'app mobile (a nettoyer progressivement)
- Styles "activites" inutilises dans HomeScreen.tsx
- Mock data present dans les screens (fallback si Firebase vide)
- Cloud Functions bien structurees, pas de probleme critique
