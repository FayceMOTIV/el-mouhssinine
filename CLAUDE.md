# El Mouhssinine - Contexte Projet

## Structure
```
~/Downloads/el-mouhssinine/
├── ElMouhssinine/          # App mobile React Native
├── el-mouhssinine-backoffice/  # Backoffice React
├── functions/              # Cloud Functions Firebase
├── firestore.rules         # Règles sécurité Firestore
└── firebase.json           # Config Firebase
```

## App Mobile
- **Chemin** : ~/Downloads/el-mouhssinine/ElMouhssinine/
- **Bundle ID** : fr.elmouhssinine.mosquee
- **Build actuel** : 27
- **Stack** : React Native 0.83.1, Firebase, TypeScript

## Backoffice
- **Chemin** : ~/Downloads/el-mouhssinine/el-mouhssinine-backoffice/
- **URL** : https://el-mouhssinine.web.app
- **Stack** : React, Vite, Firebase

## Firebase
- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations

## Cloud Functions (9 déployées)
| Fonction | Type | Description |
|----------|------|-------------|
| onNewAnnouncement | Trigger Firestore | Notif auto nouvelle annonce |
| onNewEvent | Trigger Firestore | Notif auto nouvel événement |
| onNewJanaza | Trigger Firestore | Notif auto janaza (priorité haute) |
| onNewPopup | Trigger Firestore | Notif auto popup |
| sendManualNotification | Callable | Envoi manuel backoffice |
| getNotificationStats | Callable | Stats pour dashboard |
| scheduledJumuaReminder | Scheduled | Vendredi 11h30 |
| scheduledFajrReminder | Scheduled | Tous les jours 5h30 |
| cleanupOldNotifications | Scheduled | Dimanche 3h |

## Fonctionnalités Implémentées
- Horaires prière Mawaqit (méthode 15° + tune)
- Traductions FR/AR complètes + support RTL
- TTS prononciation arabe (expo-speech)
- Notifications push automatiques via FCM
- Coran 114 sourates + audio récitation
- Adhkar (invocations)
- Apprentissage arabe (alphabet + leçons)
- Splash screen personnalisé
- Sécurité Firestore Rules
- Popups et rappels du jour dynamiques
- Dates islamiques avec countdown

## En cours / À fixer
- [ ] Fix TTS son qui ne sort pas
- [ ] Fix header arabe RTL
- [ ] Fix splash timing
- [ ] Fix popup bienvenue

## TODO Futur
- [ ] Config emails SMTP (Brevo)
- [ ] Reçu fiscal PDF
- [ ] Stripe paiements
- [ ] Dashboard stats backoffice

## Commandes utiles

### Build iOS
```bash
cd ElMouhssinine/ios && pod install
xcodebuild archive -workspace ElMouhssinine.xcworkspace -scheme ElMouhssinine -configuration Release -destination 'generic/platform=iOS' -archivePath ./build/ElMouhssinine.xcarchive
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
