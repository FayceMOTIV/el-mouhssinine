# MEGA AUDIT - PARTIE 1 : HomeScreen (Accueil)

**Date**: 13 Février 2026
**Fichier principal**: `src/screens/HomeScreen.tsx` (2641 lignes)
**Fichiers liés audités**:
- `src/services/firebase.ts`
- `src/services/prayerApi.ts`
- `src/services/prayerNotifications.ts`
- `src/services/notificationHistory.ts`
- `src/services/backgroundLocation.ts`

---

## 📋 RÉSUMÉ EXÉCUTIF

**Total bugs identifiés**: 18
- **CRITIQUES**: 5
- **MAJEURS**: 8
- **MINEURS**: 5

---

## 🔴 BUGS CRITIQUES

### BUG #1 - Badge Messages Non Lus : Logique incorrecte
- **Niveau** : CRITIQUE
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 565-575
- **Description** : Le badge du bouton 💬 compte TOUS les messages ayant une dernière réponse de la mosquée, sans vérifier si l'utilisateur a déjà lu cette réponse. Il n'y a pas de système de "lastReadTimestamp" pour tracker si l'utilisateur a vu la dernière réponse.
- **Impact utilisateur** : Le badge reste affiché même après avoir lu les messages. L'utilisateur ne peut jamais faire disparaître le badge de manière persistante.
- **Extrait de code** :
```typescript
// Ligne 565-575
const unsubscribe = subscribeToUserMessages(user.uid, (messages: UserMessage[]) => {
  // Compter les messages avec une réponse de la mosquée non lue
  const unread = messages.filter(m => {
    if (!m.reponses || m.reponses.length === 0) return false;
    const lastReply = m.reponses[m.reponses.length - 1];
    return lastReply.createdBy === 'mosquee';  // ❌ Pas de vérification si déjà lu
  }).length;
  setUnreadMsgCount(unread);
});
```

---

### BUG #2 - Clic 💬 remet badge à zéro mais pas persistant
- **Niveau** : CRITIQUE
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 1095
- **Description** : Au clic sur le bouton 💬, le badge est mis à 0 (`setUnreadMsgCount(0)`), mais c'est juste un reset local sans sauvegarder l'état "lu" dans AsyncStorage ou Firestore. À la prochaine ouverture de l'app, le badge réapparaît.
- **Impact utilisateur** : Le badge revient à chaque redémarrage de l'app même si l'utilisateur a déjà consulté tous ses messages.
- **Extrait de code** :
```typescript
// Ligne 1095
<TouchableOpacity
  onPress={() => { setUnreadMsgCount(0); navigation.navigate('Messages'); }}
  // ❌ Pas de persistance de l'état "lu"
>
```

---

### BUG #3 - Calcul prochaine prière : Ne gère pas le passage à minuit
- **Niveau** : CRITIQUE
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 283-308
- **Description** : La fonction `calculateCountdown()` ajoute 1 jour si la prière est passée (`prayerDate <= now`), mais cette logique est appliquée APRÈS avoir calculé `prayerDate` avec l'heure du jour courant. Entre minuit et Fajr, toutes les prières (Fajr, Dhuhr, etc.) auront un timestamp dans le passé, donc le countdown affichera des valeurs incorrectes ou négatives.
- **Impact utilisateur** : Entre 00h00 et l'heure de Fajr, l'app affiche des countdowns faux, potentiellement négatifs ou pour le mauvais jour.
- **Extrait de code** :
```typescript
// Ligne 283-308
const calculateCountdown = useCallback(() => {
  const now = new Date();
  const [hours, minutes] = nextPrayer.time.split(':').map(Number);
  const prayerDate = new Date();
  prayerDate.setHours(hours, minutes, 0, 0);

  // Si la priere est passee, ajouter un jour
  if (prayerDate <= now) {  // ❌ Logique incorrecte après minuit
    prayerDate.setDate(prayerDate.getDate() + 1);
  }
  // ...
}, [nextPrayer.time]);
```

---

### BUG #4 - Notifications prières : Pas de déduplication lors du reschedule
- **Niveau** : CRITIQUE
- **Fichier** : `src/services/prayerNotifications.ts` ligne 263-300
- **Description** : La fonction `schedulePrayerNotifications()` récupère les notifications existantes pour "réconciliation intelligente" (ligne 292), mais la logique de déduplication n'est jamais appliquée. Les notifications sont toujours créées même si elles existent déjà, causant des doublons.
- **Impact utilisateur** : L'utilisateur reçoit plusieurs notifications identiques pour la même prière (parfois 2-3 fois la même notif à l'heure exacte).
- **Extrait de code** :
```typescript
// Ligne 292-300
const existingNotifs = await getScheduledNotificationsMap();
logger.log(`[PrayerNotif] Existing notifications: ${existingNotifs.size}`);

const now = new Date();
const today = new Date();

logger.log('[PrayerNotif] Current time:', now.toLocaleString('fr-FR'));
const scheduledPrayers: string[] = [];
const validNotificationIds = new Set<string>(); // IDs qui doivent rester
// ❌ validNotificationIds n'est jamais utilisé pour éviter les doublons
```

---

### BUG #5 - Popup "bienvenue" : Détection fragile du type
- **Niveau** : CRITIQUE
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 666-680
- **Description** : La détection d'un popup de bienvenue se base sur une recherche de sous-chaîne dans le titre (`includes('bienvenue')`, `includes('welcome')`, `includes('مرحبا')`). Si l'admin écrit "Bienvenue à tous" pour une annonce normale, elle sera traitée comme popup de première ouverture et ne s'affichera qu'une seule fois.
- **Impact utilisateur** : Les popups importantes peuvent ne jamais s'afficher à cause d'un faux positif sur le mot "bienvenue" dans le titre.
- **Extrait de code** :
```typescript
// Ligne 666-680
const titreNormalized = (popup.titre || '').toLowerCase();
const isWelcomePopup = titreNormalized.includes('bienvenue') ||
                       titreNormalized.includes('welcome') ||
                       (popup.titre || '').includes('مرحبا');
// ❌ Trop fragile, pas de champ dédié "isWelcomePopup" dans Firestore
```

---

## 🟠 BUGS MAJEURS

### BUG #6 - Header Image : Pas de gestion du loading/erreur visuel
- **Niveau** : MAJEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 1066-1087
- **Description** : L'image hero header (`headerImageUrl`) utilise `onLoad` et `onError` pour logger, mais ne gère pas l'affichage d'un état de chargement (spinner) ou d'un placeholder si l'image est cassée. L'utilisateur voit juste un espace vide.
- **Impact utilisateur** : Sur connexion lente, l'utilisateur voit un grand espace blanc en haut de l'écran pendant plusieurs secondes. Si l'image est cassée, rien ne s'affiche.
- **Extrait de code** :
```typescript
// Ligne 1066-1073
{headerImageUrl ? (
  <Image
    source={{ uri: headerImageUrl }}
    style={styles.headerImage}
    resizeMode="cover"
    onLoad={() => logger.log('[HomeScreen] Header image loaded successfully')}
    onError={(e) => logger.error('[HomeScreen] Header image error:', e.nativeEvent.error)}
    // ❌ Pas de ActivityIndicator ni de placeholder
  />
) : (
```

---

### BUG #7 - Badge Notifications : Pas de sync avec le modal
- **Niveau** : MAJEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 1110-1124
- **Description** : Le badge du bouton 🔔 affiche `unreadNotifCount`, mais quand l'utilisateur ouvre le modal historique et clique sur une notification pour l'expand (ligne 947), celle-ci n'est pas automatiquement marquée comme lue. Il faut cliquer sur "Tout marquer comme lu" pour mettre à jour le badge.
- **Impact utilisateur** : Le badge reste même après avoir consulté toutes les notifications dans le modal.
- **Extrait de code** :
```typescript
// Ligne 944-947
<TouchableOpacity
  key={notif.id}
  activeOpacity={0.7}
  onPress={() => setExpandedNotifId(isExpanded ? null : notif.id)}
  // ❌ Pas d'appel à markNotificationAsRead(notif.id)
>
```

---

### BUG #8 - Horaires prières : Pas de vérification si API retourne données vides
- **Niveau** : MAJEUR
- **Fichier** : `src/services/prayerApi.ts` ligne 194-276
- **Description** : Si l'API Mawaqit retourne un JSON valide mais avec `calendar[month][dayStr] = []` (tableau vide), le code ne vérifie pas et essaie d'accéder aux index `calendarTimes[0]`, `calendarTimes[1]`, etc., causant un crash ou des valeurs `undefined`.
- **Impact utilisateur** : L'app crash ou affiche "undefined:undefined" pour toutes les prières si l'API retourne des données malformées.
- **Extrait de code** :
```typescript
// Ligne 240-244
if (data.calendar && data.calendar[month] && data.calendar[month][dayStr]) {
  const calendarTimes = data.calendar[month][dayStr];
  times = [calendarTimes[0], calendarTimes[2], calendarTimes[3], calendarTimes[4], calendarTimes[5]];
  shuruq = calendarTimes[1];
  // ❌ Pas de vérification calendarTimes.length >= 6
}
```

---

### BUG #9 - Janaza : Crash si `prayerDate` est undefined
- **Niveau** : MAJEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 1283-1339
- **Description** : Le code normalise `dateValue = janazaItem.prayerDate || janazaItem.date`, puis fait `dateValue instanceof Date ? dateValue : new Date(dateValue)`. Si `prayerDate` et `date` sont tous deux `undefined` ou `null`, `new Date(undefined)` retourne une date invalide ("Invalid Date") et `.getDay()` crashe.
- **Impact utilisateur** : L'app crash si un document Janaza dans Firestore a un champ `date` manquant.
- **Extrait de code** :
```typescript
// Ligne 1285-1286
const dateValue = janazaItem.prayerDate || janazaItem.date;
const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
// ❌ Si dateValue est undefined, new Date(undefined) = Invalid Date
// Puis dateObj.getDay() crashe
```

---

### BUG #10 - Countdown : Animation fade bloque le render toutes les secondes
- **Niveau** : MAJEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 302-305
- **Description** : Chaque seconde, l'animation `Animated.sequence()` est déclenchée (fade out puis fade in en 200ms total). Si l'animation n'a pas le temps de finir avant la prochaine seconde, elles s'empilent, causant des saccades visuelles et potentiellement des memory leaks.
- **Impact utilisateur** : Le countdown "clignote" de manière saccadée, surtout sur les appareils bas de gamme.
- **Extrait de code** :
```typescript
// Ligne 302-305
Animated.sequence([
  Animated.timing(countdownOpacity, { toValue: 0.5, duration: 100, useNativeDriver: true }),
  Animated.timing(countdownOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
]).start();
// ❌ Pas de stop() de l'animation précédente
```

---

### BUG #11 - Date hijri : Adjustment hardcodé à -1
- **Niveau** : MAJEUR
- **Fichier** : `src/services/prayerApi.ts` ligne 542
- **Description** : La requête API Aladhan utilise `?adjustment=-1` pour s'aligner sur le calendrier français (Mawaqit/GMP). Cependant, cet ajustement peut changer selon les années lunaires et les observations réelles. Un ajustement fixe peut être faux à certaines périodes.
- **Impact utilisateur** : La date hijri affichée peut être décalée de 1 jour par rapport à la réalité (surtout en début de mois lunaire).
- **Extrait de code** :
```typescript
// Ligne 542
const response = await fetchWithTimeout(`${ALADHAN_API}/gToH/${dateKey}?adjustment=-1`);
// ❌ Adjustment hardcodé, devrait être configurable dans Firebase
```

---

### BUG #12 - Jumu'a : Condition "jour 4 ou 5" incorrecte
- **Niveau** : MAJEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 1255
- **Description** : La section Jumu'a s'affiche si `new Date().getDay() === 5 || new Date().getDay() === 4` (vendredi OU jeudi). Le problème : elle s'affiche toute la journée du jeudi, même à 00h01, alors que le rappel Jumu'a ne devrait s'afficher que le vendredi, ou au plus tôt jeudi soir après Maghrib.
- **Impact utilisateur** : La carte Jumu'a apparaît dès minuit jeudi, perturbant l'UI et créant de la confusion ("pourquoi Jumu'a s'affiche un jeudi matin ?").
- **Extrait de code** :
```typescript
// Ligne 1255
{jumuaTimes?.jumua1 && (new Date().getDay() === 5 || new Date().getDay() === 4) && (
  // ❌ Affichage dès 00h00 jeudi, trop tôt
```

---

### BUG #13 - Popup queue : Pas de gestion si Firebase update pendant l'affichage
- **Niveau** : MAJEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 392-412
- **Description** : La file d'attente des popups (`popupQueue`) est construite au premier `subscribeToPopups()`. Si Firebase envoie une nouvelle popup pendant qu'une autre est affichée, le `useEffect` se re-déclenche, mais la logique de queue n'est pas synchronisée : la nouvelle popup écrase la queue existante.
- **Impact utilisateur** : Si 3 popups sont en file d'attente et qu'une 4ème arrive pendant l'affichage de la 1ère, les popups 2 et 3 disparaissent.
- **Extrait de code** :
```typescript
// Ligne 392-412
const unsubPopups = subscribeToPopups(async (popups) => {
  // ...
  if (queue.length > 0) {
    setPopupQueue(queue.slice(1)); // Reste de la file
    setActivePopup(queue[0]); // Premiere popup
    setShowPopup(true);
    // ❌ Pas de merge avec la queue existante (popupQueue state)
  }
});
```

---

### BUG #14 - Évènements : Pas de filtrage des dates passées
- **Niveau** : MAJEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 1438-1475
- **Description** : La section "📅 Événements à venir" affiche TOUS les événements Firebase avec `actif: true`, sans vérifier si leur date est dans le futur. Les événements passés (hier, la semaine dernière) restent affichés indéfiniment.
- **Impact utilisateur** : L'utilisateur voit des événements déjà passés dans la liste "à venir", créant de la confusion.
- **Extrait de code** :
```typescript
// Ligne 1440-1469
{(events || []).length > 0 ? (
  (events || []).map((event) => {
    const { day, month } = formatDate(event.date);
    // ❌ Pas de filtre `event.date > new Date()`
    return (
      <TouchableOpacity ...>
```

---

## 🟡 BUGS MINEURS

### BUG #15 - Refresh Pull : Pas de feedback si erreur API
- **Niveau** : MINEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 648-653
- **Description** : Le `onRefresh()` appelle `loadPrayerData()` qui peut échouer (erreur réseau, API down). En cas d'échec, `loadError` est set, mais le RefreshControl se ferme immédiatement sans montrer visuellement que le refresh a échoué.
- **Impact utilisateur** : L'utilisateur tire pour rafraîchir, l'indicateur tourne puis disparaît, mais rien ne change. Pas de feedback visuel clair.
- **Extrait de code** :
```typescript
// Ligne 648-653
const onRefresh = async () => {
  setRefreshing(true);
  setLoadError(null);
  await loadPrayerData(); // ❌ Pas de then/catch pour afficher un Toast
  setRefreshing(false);
};
```

---

### BUG #16 - Mode Ramadan : Affiche Suhoor = Fajr au lieu de Fajr-30min
- **Niveau** : MINEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 1358-1370
- **Description** : La carte Ramadan affiche "Fin Suhoor" avec l'heure de Fajr. Mais en réalité, il faut arrêter de manger ~10-15 min AVANT Fajr (Imsak). L'heure affichée est donc trompeuse.
- **Impact utilisateur** : Les utilisateurs qui se fient à l'app peuvent continuer de manger trop tard et invalider leur jeûne.
- **Extrait de code** :
```typescript
// Ligne 1366
<Text style={styles.ramadanTimeValue}>
  {prayerTimes.find(p => p.name === 'Fajr')?.time || '--:--'}
  // ❌ Devrait être Fajr - 10 min (Imsak)
</Text>
```

---

### BUG #17 - Calendrier hégirien : Approximation non visible dans le modal dates
- **Niveau** : MINEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 814-816
- **Description** : Le modal affiche `{t('approximateDates')}` qui informe que les dates sont approximatives, mais le texte est en petit et gris pâle (style `approximatif`). Sur fond sombre, c'est quasi invisible.
- **Impact utilisateur** : Les utilisateurs ne voient pas l'avertissement et pensent que les dates islamiques sont exactes au jour près.
- **Extrait de code** :
```typescript
// Ligne 814-816
<Text style={styles.approximatif}>
  {t('approximateDates')}
  // Style fontSize.xs + color textMuted = quasi invisible
</Text>
```

---

### BUG #18 - "J'ai prié" button : Pas de confirmation visuelle après clic
- **Niveau** : MINEUR
- **Fichier** : `src/screens/HomeScreen.tsx` ligne 633-646
- **Description** : Après avoir cliqué sur "✅ J'ai prié", le bouton disparaît immédiatement (car `hasPrayedCurrentPrayer` devient true). Il n'y a qu'une vibration de 100ms, mais pas de Toast, pas d'animation, pas de message de confirmation.
- **Impact utilisateur** : L'utilisateur ne sait pas si son clic a été enregistré. Il peut cliquer plusieurs fois par réflexe.
- **Extrait de code** :
```typescript
// Ligne 633-646
const handlePrayed = useCallback(async () => {
  if (!currentPrayer || !boostSettings?.enabled) return;
  try {
    setHasPrayedCurrentPrayer(true);
    await markPrayerAsPrayed(currentPrayer.name);
    Vibration.vibrate(100); // ❌ Pas de Toast ni d'animation
  } catch (error) {
    logger.warn('[HomeScreen] Erreur annulation boost:', error);
  }
}, [currentPrayer, boostSettings?.enabled]);
```

---

## 📊 BUGS PAR CATÉGORIE

### HEADER (Logo + Icônes notifications/messages)
- ✅ Logo mosquée affiché (emoji 🕌)
- ✅ Nom mosquée visible
- ✅ Icône 🔔 notifications visible
- ✅ Icône 💬 messagerie visible
- ❌ **BUG #1** : Badge 💬 compte incorrect (toutes réponses mosquée)
- ❌ **BUG #2** : Badge 💬 reset non persistant
- ❌ **BUG #7** : Badge 🔔 pas de sync avec modal
- ✅ Clic 🔔 ouvre modal historique
- ✅ Clic 💬 navigue vers Messages

### HEURES DE PRIÈRES
- ✅ API Aladhan/Mawaqit appelée
- ✅ 5 prières affichées (Fajr, Dhuhr, Asr, Maghrib, Isha)
- ✅ Prochaine prière en surbrillance
- ❌ **BUG #3** : Countdown faux entre minuit et Fajr
- ✅ Iqama affiché si configuré
- ✅ Responsive petits écrans
- ❌ **BUG #8** : Crash si API retourne données vides
- ❌ **BUG #11** : Date hijri adjustment hardcodé

### ANNONCES/ÉVÉNEMENTS
- ✅ Carrousel/liste affiche annonces
- ✅ Images chargent (si présentes)
- ✅ Clic annonce → Alert avec détails
- ✅ Pas de crash si aucune annonce
- ❌ **BUG #14** : Événements passés affichés dans "à venir"

### ACTIONS RAPIDES
- ✅ Boutons visibles et fonctionnels
- ✅ Navigation correcte (Services modal)

### MODAL NOTIFICATIONS
- ✅ Liste notifications affichée
- ✅ Tri par date (récent en premier)
- ✅ Types affichés avec icônes
- ✅ Expand/collapse fonctionne
- ❌ **BUG #7** : Pas de marquage auto comme lu au clic
- ✅ Bouton "Tout marquer comme lu" fonctionne

### POPUPS & RAPPELS
- ✅ Popup du jour s'affiche
- ✅ Rappels dynamiques depuis Firebase
- ✅ Fermeture popup fonctionne
- ❌ **BUG #5** : Détection "bienvenue" fragile
- ❌ **BUG #13** : Queue popups écrasée si update Firebase

### JANAZA SECTION
- ✅ Section janaza en blanc (fond card)
- ❌ **BUG #9** : Crash si prayerDate undefined

### DATES ISLAMIQUES
- ✅ Section dates islamiques affichée
- ✅ Countdown correct
- ❌ **BUG #17** : Avertissement "approximatif" invisible

### AUTRES
- ❌ **BUG #4** : Notifications prières dupliquées
- ❌ **BUG #6** : Image hero pas de loading/erreur visuel
- ❌ **BUG #10** : Animation countdown saccadée
- ❌ **BUG #12** : Jumu'a affichée dès jeudi 00h00
- ❌ **BUG #15** : Refresh pull pas de feedback erreur
- ❌ **BUG #16** : Suhoor = Fajr au lieu de Imsak
- ❌ **BUG #18** : Bouton "J'ai prié" pas de confirmation visuelle

---

## 🎯 RECOMMANDATIONS PRIORITAIRES

### Critiques à corriger immédiatement :
1. **BUG #1 + #2** : Implémenter système `lastReadMessageTimestamp` dans AsyncStorage
2. **BUG #3** : Refactoriser `calculateCountdown()` pour gérer minuit correctement
3. **BUG #4** : Ajouter déduplication dans `schedulePrayerNotifications()`
4. **BUG #5** : Ajouter champ `type: 'welcome' | 'announcement'` dans Firestore popups

### Majeurs à corriger dans les 2 prochaines versions :
5. **BUG #6** : Ajouter `<ActivityIndicator />` et placeholder image
6. **BUG #7** : Auto-mark notification comme lue au clic expand
7. **BUG #8** : Valider longueur tableau API avant accès
8. **BUG #9** : Valider `dateValue` avant `new Date()`
9. **BUG #11** : Rendre `adjustment` configurable dans Firebase
10. **BUG #12** : Jumu'a seulement vendredi ou jeudi après 18h
11. **BUG #13** : Merger queue popups au lieu d'écraser
12. **BUG #14** : Filtrer événements passés (`event.date > now`)

### Mineurs (améliorations UX) :
13. **BUG #15** : Afficher Toast "Erreur de chargement" si refresh échoue
14. **BUG #16** : Suhoor = Imsak (Fajr - 10 min)
15. **BUG #17** : Grossir texte "approximatif" + couleur plus visible
16. **BUG #18** : Toast "✅ Prière enregistrée" après clic "J'ai prié"

---

## 📝 NOTES TECHNIQUES

### Points positifs du code :
- Architecture bien structurée avec séparation des concerns (services, screens, components)
- Gestion fallback robuste (mock data si Firebase vide)
- Support RTL complet
- Logs détaillés pour debug
- Gestion permissions notifications
- Cache intelligent pour API

### Points d'amélioration architecturale :
- Trop de logique métier dans le composant HomeScreen (2641 lignes)
- Pas de tests unitaires pour les calculs critiques (countdown, next prayer)
- Dépendance forte à AsyncStorage sans abstraction
- Pas de retry automatique sur les appels API
- Logs en production (devrait être conditionné par `__DEV__`)

---

**Fin du rapport d'audit - Partie 1**
*Prochaine étape : Audit des autres screens (Messages, Quran, More, etc.)*
