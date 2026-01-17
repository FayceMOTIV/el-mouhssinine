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
- **Build actuel** : 74
- **Stack** : React Native 0.83.1, Firebase, TypeScript

## Backoffice
- **Chemin** : ~/Downloads/el-mouhssinine/el-mouhssinine-backoffice/
- **URL** : https://el-mouhssinine.web.app
- **Stack** : React, Vite, Firebase

## Firebase
- **Projet** : el-mouhssinine
- **Region** : europe-west1
- **Collections** : announcements, events, janaza, projects, members, popups, rappels, settings, dates_islamiques, donations

## Cloud Functions (11 deployees)
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
| sendRecuFiscal | Callable | Genere PDF recu fiscal + envoi email |
| getDonsByYear | Callable | Total dons par annee pour un email |

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
- **Multi-adherents** : inscription de plusieurs personnes en un seul paiement
- **Page Dons** : modal details projet avec progression, fichiers, bouton don
- **IA Titres** : prompt optimise pour generation de titres courts (max 40 chars)
- **Sync temps reel** : modifications backoffice visibles instantanement dans l'app

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

## Ajoute (13 Jan 2026)

### Multi-adherents (MemberScreen.tsx + Adherents.jsx)
- [x] Interface AdditionalMember { id, nom, prenom, telephone, adresse, accepteReglement }
- [x] Interface InscritParData { odUserId, nom, prenom }
- [x] Interface CreateMemberData avec paiementId, montant, modePaiement
- [x] Formulaire multi-adherents avec validation checkbox obligatoire
- [x] Recapitulatif avec total avant paiement
- [x] Bouton "+ Ajouter un adherent" et bouton supprimer
- [x] Sauvegarde Firestore avec meme paiementId pour grouper
- [x] Status "en_attente_signature" pour adherents inscrits par tiers
- [x] Backoffice: colonne "Paye par" (Lui-meme / Nom du payeur)
- [x] Backoffice: filtre par payeur (Tous / Lui-meme / Tiers)
- [x] Backoffice: section Paiement dans modal details avec cadenas
- [x] Backoffice: section "Adherents lies" (meme paiementId)
- [x] Backoffice: champs paiement verrouilles si datePaiement existe
- [x] Backoffice: changement status via dropdown (Actif/En attente/Expire)

### Page Dons (DonationsScreen.tsx)
- [x] Bouton "Voir details" toujours visible sur les projets
- [x] Modal details projet avec titre, description, objectif, collecte
- [x] Barre de progression visuelle
- [x] Liste des fichiers attaches
- [x] Bouton "Faire un don" dans la modal

### IA Titres (openai.js)
- [x] TITLE_PROMPT dedie avec regles strictes (max 40 chars, emoji, pas de ponctuation)
- [x] Exemples de bons/mauvais titres dans le prompt
- [x] Detection automatique context.field === 'titre'

## Ajoute (14 Jan 2026 - Build 55)

### Notifications de priere (prayerNotifications.ts)
- [x] Scheduling 7 jours au lieu de 2 jours
- [x] Notification rappel d'ouvrir l'app au jour 6 (FR/AR)
- [x] Note explicative dans MoreScreen.tsx (ouvrir 1x/semaine)

### Firestore Rules (firestore.rules)
- [x] Ajout regles pour collection `messages` (creation, lecture, update)
- [x] Admin peut lire/modifier tous les messages
- [x] Utilisateur peut creer/lire/modifier ses propres messages

## Corrige (14 Jan 2026 - Build 56)

### Auth persistance (auth.ts)
- [x] Uid coherent base sur email (meme email = meme uid)
- [x] Sauvegarde utilisateur dans AsyncStorage apres login/signup
- [x] Restauration automatique au redemarrage de l'app
- [x] L'historique des messages fonctionne maintenant entre sessions

### Backoffice Messages (Messages.jsx)
- [x] Synchronisation selectedMessage avec messages en temps reel
- [x] Les reponses s'affichent maintenant dans la modal apres envoi

### Firestore Index (firestore.indexes.json)
- [x] Index composite pour messages (odUserId + createdAt)
- [x] Requetes de messages fonctionnent correctement

### Cloud Function onMessageReply (index.js)
- [x] Notification push quand la mosquee repond a un message
- [x] Trigger sur update de la collection messages
- [x] Verifie que c'est une reponse de la mosquee (createdBy === 'mosquee')

## Corrige (14 Jan 2026 - Build 57)

### Bouton répondre conversation (ConversationScreen.tsx)
- [x] `handleSendReply` vérifie maintenant le `{ success, error }` de `addUserReplyToMessage`
- [x] Affiche une Alert si `success: false` avec le message d'erreur

### Deep link notification message (AppNavigator.tsx)
- [x] Ajout `setupNotificationOpenedHandler` dans AppNavigator
- [x] Clic sur notif `type: 'message_reply'` navigue vers ConversationScreen
- [x] Passe le `messageId` en paramètre pour afficher la bonne conversation

## Ajoute (14 Jan 2026 - Build 57)

### BO: Dons et Projets (Dons.jsx)
- [x] Separation projets Mosquee (internes) et Autres Causes (externes) en 2 sections
- [x] Section "Projets Mosquee" avec icone mosquee
- [x] Section "Autres Causes" avec badge "Virement uniquement"
- [x] Colonnes specifiques pour projets externes (avec IBAN visible, lieu)
- [x] Alerte si IBAN manquant pour projet externe

### BO: Messages ameliores (Messages.jsx)
- [x] Filtre par sujet du message
- [x] Filtre par periode (7j, 30j, archives +30j)
- [x] Archivage automatique des messages de +30 jours
- [x] Compteur messages archives visible
- [x] Numero de telephone cliquable dans modal details
- [x] Bouton IA magique pour ameliorer les reponses

### App: Parcours adherents multi (MemberScreen.tsx)
- [x] Parcours en 2 etapes avec indicateur visuel (dots)
- [x] Etape 1 : Formulaire adherents (nom, prenom, tel, adresse, reglement)
- [x] Etape 2 : Choix du mode de paiement (CB, Apple Pay, Virement)
- [x] Bouton "Continuer -> Paiement" au lieu de payer directement
- [x] Boutons Retour + Payer sur etape 2
- [x] Recap toujours visible sur les 2 etapes

### App: Projets externes virement only (DonationsScreen.tsx)
- [x] Masque CB/Apple Pay/Google Pay pour projets externes
- [x] Affiche uniquement option "Virement bancaire" pour externes
- [x] Message d'avertissement orange pour projets externes
- [x] Texte explicatif "Utilisez l'IBAN du projet"

## Corrige (14 Jan 2026 - Build 58)

### Popup bienvenue (HomeScreen.tsx)
- [x] Popup bienvenue ne s'affiche plus qu'a la 1ere ouverture de l'app
- [x] Detection via AsyncStorage `app_has_launched_welcome`
- [x] Fonctionne pour titres contenant "bienvenue", "welcome", ou "مرحبا"

### Suppression messages (MessagesScreen.tsx + Messages.jsx)
- [x] Bouton supprimer message dans l'app mobile
- [x] Bouton supprimer message dans le backoffice (tableau + modal)
- [x] Confirmation avant suppression (Alert / ConfirmModal)
- [x] Fonction deleteMessage dans firebase.ts et firebase.js

### Horaires Iqama/Jumua (Horaires.jsx + firebase.js)
- [x] Fix: getIqamaAndJumuaTimes() pour charger depuis Firebase
- [x] Avant: getPrayerTimes() retournait API sans iqama/jumua
- [x] Les donnees iqama/jumua se sauvegardent et chargent correctement

### Horaires de priere - Methode Mawaqit (prayerApi.ts + Horaires.jsx + firebase.js)
- [x] Alignement sur methode "Muslims of France" (UOIF)
- [x] Method ID: 12 sur Aladhan API
- [x] Fajr: 12°, Isha: 12° (identique a Mawaqit France)
- [x] App et BO utilisent maintenant la meme methode de calcul

## Ajoute (15 Jan 2026 - Build 59)

### Integration Stripe (stripe.ts + Cloud Functions)
- [x] Installation @stripe/stripe-react-native
- [x] Service stripe.ts avec makePayment()
- [x] Cloud Function createPaymentIntent (europe-west1)
- [x] Cloud Function stripeWebhook (europe-west1)
- [x] StripeProvider dans App.tsx
- [x] DonationsScreen: paiement CB/Apple Pay/Google Pay via Stripe
- [x] MemberScreen: paiement cotisation via Stripe
- [x] addDonation() et addPayment() dans firebase.ts
- [x] Enregistrement automatique dans collections donations/payments
- [x] Mise a jour montantCollecte des projets apres don
- [x] Mise a jour statut membre apres cotisation

### Page Gestion Revenus (Revenus.jsx)
- [x] Nouvelle page backoffice pour comptabilite
- [x] Filtres par type (cotisations/dons/tous)
- [x] Filtres par periode (jour/semaine/mois/annee/personnalise)
- [x] Stats avec comparaison periode precedente (+/- %)
- [x] Graphique barres (7 derniers jours)
- [x] Graphique camembert (repartition types)
- [x] Tableau des transactions
- [x] Export CSV

## Configuration Stripe (A FAIRE)

### 1. Cles Stripe
Remplacer les placeholders par les vraies cles:
- **App.tsx** ligne 14: `STRIPE_PUBLISHABLE_KEY = 'pk_live_XXX'`
- **Cloud Functions**: `firebase functions:config:set stripe.secret_key="sk_live_XXX"`
- **Webhook secret**: `firebase functions:config:set stripe.webhook_secret="whsec_XXX"`

### 2. Configurer Webhook Stripe
Dans le dashboard Stripe (https://dashboard.stripe.com/webhooks):
- URL: `https://europe-west1-el-mouhssinine.cloudfunctions.net/stripeWebhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

### 3. Apple Pay (optionnel)
- Creer merchant ID dans Apple Developer
- Configurer dans Stripe Dashboard

## Corrige (15 Jan 2026 - Build 60) - AUDIT SECURITE

### Cloud Functions - Securite renforcee (index.js)
- [x] Helper isAdmin() ajoute (verifie si uid dans collection admins)
- [x] sendManualNotification: verification admin obligatoire
- [x] getNotificationStats: verification admin obligatoire
- [x] createPaymentIntent: validation montant max 10000€ + traçabilite userId
- [x] stripeWebhook: idempotence via collection processed_payments
- [x] stripeWebhook: transactions atomiques Firestore (runTransaction)
- [x] stripeWebhook: enregistrement des echecs dans failed_payments

### Protection double paiement (App Mobile)
- [x] DonationsScreen.tsx: verrou isProcessingPayment au debut
- [x] MemberScreen.tsx: handlePayCotisation() protege
- [x] MemberScreen.tsx: handlePayMultipleMembers() protege avec verrou + finally
- [x] Boutons desactives pendant traitement + ActivityIndicator

### Backoffice - Corrections fonctionnelles
- [x] Horaires.jsx: addMinutesToTime() gere minuit et valeurs negatives
- [x] Dons.jsx: validation format IBAN (code pays, cle controle, longueur)

### Composants UI/UX (nouveaux)
- [x] SkeletonLoader.tsx: animations de chargement squelette
- [x] Toast.tsx: notifications non-bloquantes (success/error/info/warning)
- [x] components/index.ts: exports centralises

## Corrige (15 Jan 2026 - Build 61) - SUITE AUDIT

### Auth.ts - Vraie authentification Firebase (auth.ts)
- [x] Remplacement du mode mock par Firebase Auth reel
- [x] signInWithEmailAndPassword() pour connexion
- [x] createUserWithEmailAndPassword() pour inscription
- [x] sendPasswordResetEmail() pour reset mot de passe
- [x] Messages d'erreur traduits en francais
- [x] Profil membre synchronise avec Firestore

### Composants UI/UX supplementaires
- [x] EmptyState.tsx: etats vides illustres (EmptyMessages, EmptyProjects, EmptyEvents, ErrorState)
- [x] AnimatedButton.tsx: boutons avec animation scale + haptic feedback
- [x] AnimatedModal.tsx: modales avec animation fade + scale + slideUp

### HomeScreen - Ameliorations UX
- [x] Skeleton loader pendant chargement initial
- [x] RefreshControl personnalise (couleurs accent)
- [x] Countdown anime avec fade opacity

### MessagesScreen - Ameliorations UX
- [x] EmptyMessages component integre
- [x] Haptic feedback (Vibration) sur envoi message
- [x] RefreshControl import ajoute

### DonationsScreen - Ameliorations UX
- [x] Pull-to-refresh avec RefreshControl personnalise
- [x] Haptic feedback sur copie IBAN/BIC

## Corrige (15 Jan 2026 - Build 62) - FINITIONS UI/UX

### Skeletons integres
- [x] QuranScreen.tsx: skeleton 8 items pendant chargement sourates
- [x] MemberScreen.tsx: MemberProfileSkeleton pendant chargement

### Contraste ameliore (colors.ts)
- [x] Nouvelles couleurs WCAG AA: textOnDark, textOnDarkMuted, placeholderOnDark
- [x] Opacite augmentee: 0.75 pour muted (etait 0.5), 0.6 pour placeholder (etait 0.3)
- [x] Couleurs pour fond clair: textOnLightMuted, placeholderOnLight
- [x] Etats interactifs: buttonDisabled, inputBorder, inputBorderFocus

### Accessibilite (accessibilityLabel + accessibilityRole)
- [x] QuranScreen.tsx: sourates avec label descriptif (numero, nom, versets)
- [x] DonationsScreen.tsx: boutons copie IBAN/BIC avec hints
- [x] HomeScreen.tsx: bouton calendrier hegirien avec hint

### Composants supplementaires deja crees (Build 61)
- EmptyState.tsx avec variantes (EmptyMessages, EmptyProjects, EmptyEvents, ErrorState)
- AnimatedButton.tsx avec animation scale + haptic
- AnimatedModal.tsx avec animation fade/scale/slideUp

## Corrige (15 Jan 2026 - Build 63)

### Bugs corrigés
- [x] Prix dynamique dans card blanche MemberScreen (utilise formulePrices.annuel/mensuel)
- [x] "Gérer mes adhésions" demandait connexion si déjà connecté (onAuthStateChanged)
- [x] Page Messages demandait connexion si déjà connecté (onAuthStateChanged)
- [x] Montants inutiles pour projets externes dans Dons (masqués)
- [x] Inscription adhérent virement bloqué (flux virement complet)
- [x] Icône MessagesScreen changée 💬 → 🔐 pour écran connexion

### Backoffice Virement Flow
- [x] types.js: ajout status EN_ATTENTE_PAIEMENT
- [x] Adherents.jsx: filtre, stats, badge bleu pour "En attente paiement"
- [x] Adherents.jsx: banner virement avec referenceVirement

## Corrige (15 Jan 2026 - Build 64)

### Bugs critiques corrigés (Audit complet)
- [x] addPayment() ne mettait PAS à jour cotisation.dateDebut/dateFin → CORRIGÉ (firebase.ts:601-634)
- [x] Flux virement ignorait includeMyself → CORRIGÉ (MemberScreen.tsx:447-471)
- [x] EN_ATTENTE_PAIEMENT manquant dans types/index.js backoffice → AJOUTÉ
- [x] Grid stats 5 colonnes pour 6 cartes → CORRIGÉ (grid-cols-6)

## Corrige (15 Jan 2026 - Build 65)

### Bug critique : Membre non trouvé si créé via backoffice
- [x] getMemberProfile cherche maintenant aussi par EMAIL (auth.ts:178-244)
- [x] Si membre trouvé par email, le uid est automatiquement lié au document
- [x] Si memberId manquant, il est auto-généré et sauvegardé
- [x] MessagesScreen: loading se termine même si memberProfile est null

## Corrige (15 Jan 2026 - Build 66)

### Bug critique : Document Firestore non créé lors de l'inscription
- [x] Race condition fixée: loadMemberData() appelé après signUp/signIn réussi
- [x] Auto-création du profil si compte Auth existe mais pas de document Firestore
- [x] getMemberProfile crée automatiquement un profil de base si aucun trouvé
- [x] Résultat: nom + numéro adhérent s'affichent TOUJOURS dans la card blanche
- [x] Messages et "Gérer mes adhésions" fonctionnent correctement

### Flux CB complet (maintenant fonctionnel)
1. makePayment() Stripe avec montant correct
2. createMember() pour chaque additionalMember avec status "en_attente_signature"
3. addPayment() pour includeMyself qui met à jour cotisation complète
4. Visible dans "Gérer mes adhésions" + Backoffice

### Flux Virement complet (maintenant fonctionnel)
1. createMember() pour chaque additionalMember avec status "en_attente_paiement"
2. createMember() pour l'utilisateur si includeMyself (NOUVEAU)
3. Alert avec IBAN + référence virement
4. Admin active le statut après réception

## Corrige (16 Jan 2026 - Build 71)

### Design responsive petits ecrans (iPhone mini)
- [x] colors.ts: helpers responsive (isSmallScreen, moderateScale, wp, hp)
- [x] MemberScreen.tsx: padding et fontSize adaptatifs via isSmallScreen
- [x] Boutons et modals s'adaptent aux petits ecrans

### Couleurs ameliorees
- [x] Marron eclairci: #8b5a2b (meilleur contraste)
- [x] Gradient header ajuste: ['#6b4423', '#8b5a2b']

### Validation formulaires
- [x] Validation numeros telephone FR (06/07 + 10 chiffres)
- [x] Validation emails amelioree
- [x] Reference virement affichee apres inscription

## Ajoute (16 Jan 2026 - Build 72)

### Listener temps reel "Mes adhesions" (firebase.ts + MyMembershipsScreen.tsx)
- [x] subscribeToMyMembership() avec onSnapshot Firestore
- [x] MyMembershipsScreen utilise le listener au lieu de fetch unique
- [x] Les modifications du backoffice s'affichent instantanement dans l'app
- [x] Cleanup automatique du listener au unmount

### Backoffice - Nouvelle gestion cotisations (Adherents.jsx)
- [x] Suppression cases a cocher du tableau
- [x] Suppression dropdown changement statut
- [x] Nouveau bouton unique "Gerer" par adherent
- [x] Modal cotisation moderne avec:
  - Header avec avatar et badge statut
  - Section infos cotisation (type, montant, echeance)
  - Toggle Paye/Non paye avec selecteur mode paiement
  - Modes manuels: virement, especes, cheque
  - Modes app (lecture seule): CB, Apple Pay, Google Pay
  - Toggle Signe/Non signe
  - Calcul automatique statut affiche
- [x] Sync temps reel modal avec donnees Firestore

### Backoffice - Import hadiths (Rappels.jsx)
- [x] Bouton "Importer 37 hadiths par defaut"
- [x] Modal confirmation avant import
- [x] Import batch via writeBatch Firestore
- [x] 37 hadiths avec texte FR, AR et source

### Fix sync membership
- [x] Adherents.jsx: status 'actif' au lieu de null pour membres actifs
- [x] firebase.ts: interpretation null comme 'actif' si cotisation valide

## Corrige (16 Jan 2026 - Build 73)

### Boutons temps notification depassent (MoreScreen.tsx)
- [x] Import isSmallScreen depuis colors.ts
- [x] settingLeft: flex: 1 + flexShrink: 1 pour permettre reduction
- [x] settingLabel: fontSize reduit sur petits ecrans + flexShrink
- [x] settingIcon: fontSize 14px (vs 18) sur petits ecrans
- [x] picker: padding reduit (2 vs 4) + flexShrink: 0
- [x] pickerOption: paddingHorizontal 6px (vs 8), minWidth 24px (vs 28)
- [x] pickerOptionText: fontSize 11px (vs 12) sur petits ecrans
- [x] pickerUnit: fontSize 10px + marginLeft reduit

## Ajoute (17 Jan 2026 - Build 74)

### Recus fiscaux (Cloud Functions + Backoffice + App)
- [x] Cloud Function sendRecuFiscal : generation PDF + envoi email
- [x] Cloud Function getDonsByYear : total dons par annee
- [x] Page backoffice RecusFiscaux avec 3 onglets (Parametres, Envoyer, Historique)
- [x] Bouton "Recevoir recu fiscal par email" dans app (MoreScreen)
- [x] Selection annee (3 dernieres annees)
- [x] PDF conforme article 200 CGI + loi 1905
- [x] Archivage PDF dans Firebase Storage
- [x] Historique des recus envoyes dans Firestore

### Configuration email Brevo
- [x] SMTP Brevo configure (smtp-relay.brevo.com:587)
- [x] Email expediteur: centreculturelislamique@orange.fr
- [x] Nodemailer pour envoi emails

### Dashboard backoffice ameliore
- [x] Nouvelle ligne stats: Membres actifs, En attente signature, En attente paiement, Messages non lus
- [x] StatCard avec variantes couleur (success, warning, danger, info)
- [x] Fix getPaymentStats pour supporter amount/montant et createdAt/date
- [x] Lien cliquable vers Messages depuis stat "Messages non lus"

## En cours / A fixer
- [x] ~~Fix TTS son qui ne sort pas~~ DONE
- [x] ~~Activer Firebase Storage (console)~~ DONE (deja actif)
- [x] ~~Integrer Stripe pour paiement reel multi-adherents~~ DONE
- [x] ~~Securite Cloud Functions~~ DONE (Build 60)
- [x] ~~Config emails SMTP (Brevo)~~ DONE (Build 74)
- [x] ~~Recu fiscal PDF~~ DONE (Build 74)
- [x] ~~Dashboard stats backoffice~~ DONE (Build 74)

## TODO Futur
- [ ] Verifier expediteur Brevo (centreculturelislamique@orange.fr)
- [ ] Remplir infos association dans backoffice (Recus fiscaux > Parametres)

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
