# El Mouhssinine - Play Store Submission Pack

**Date:** 21 mai 2026
**Version:** 1.1.3 (versionCode 29)
**Bundle ID:** fr.elmouhssinine.mosquee

---

## ✅ État des corrections — Resoumission v29

| # | Refus Google (v28) | Root Cause | Action v29 | Statut |
|---|---------------------|-----------|------------|--------|
| 1 | Broken Functionality — boutons audio non réactifs | TrackPlayer + TTS gatés iOS-only via `Platform.OS === 'ios'` | Guards supprimés, dynamic require conservé (anti-ANR), lazy init player | ✅ Fixé |
| 2 | Broken Functionality — UI unresponsive | isPlayerReady restait false si setup échouait → boutons disabled à vie | setupPlayer retry + fallback `isPlayerReady=true` (lazy init au 1er play) | ✅ Fixé |
| 3 | Description trompeuse — Apple Pay mentionné | Description v28 mentionnait Apple Pay (iOS-only) | Supprimé de la description Android | ✅ Fixé |
| 4 | Description trompeuse — Mode silencieux mosquée | Feature geofencing iOS-only non implémentée Android | Section entière supprimée de la description | ✅ Fixé |
| 5 | Police confidentialité | URL déjà en place depuis v28 | Inchangée | ✅ OK |
| 6 | ProGuard rules manquantes | proguard-rules.pro vide → crash potentiel minification | Rules ajoutées (RN, Firebase, Stripe, TrackPlayer, OkHttp, Kotlin) | ✅ Fixé |
| 7 | KeyboardAvoidingView cassé Android | `behavior={undefined}` sur 6 écrans → clavier masque les inputs | Changé en `behavior='height'` sur Android (6 fichiers) | ✅ Fixé |
| 8 | Font 'System' invalide Android | `fontFamily: 'System'` crash/ignore sur Android | Conditionnel `Platform.OS === 'ios' ? 'System' : 'sans-serif'` (4 fichiers) | ✅ Fixé |

---

## 🔗 Nouvelle URL politique de confidentialité

**`https://el-mouhssinine.web.app/privacy-policy.html`**

À mettre dans : **Play Console → App content → Privacy policy**

---

## 📝 Description Play Store (corrigée, sans déclaration trompeuse)

### Titre court (max 30 caractères)
```
El Mouhssinine - Mosquée
```

### Brève description (max 80 caractères)
```
Horaires de prière, Coran, adhésion — mosquée El Mouhssinine Bourg-en-Bresse
```

### Description longue

```
L'application officielle de la mosquée El Mouhssinine à Bourg-en-Bresse.
Un compagnon spirituel pour les fidèles de la communauté locale.

━━━━━━━━━━━━━━━━━━━━━━━
🕌 HORAIRES DE PRIÈRE
━━━━━━━━━━━━━━━━━━━━━━━
• Horaires précis des 5 prières quotidiennes (méthode Mawaqit/UOIF)
• Rappels sonores personnalisables (avant ou à l'heure de chaque prière)
• Horaire spécial du vendredi (Jumu'a) avec notification dédiée
• Calendrier islamique intégré avec dates importantes

━━━━━━━━━━━━━━━━━━━━━━━
📖 CORAN COMPLET
━━━━━━━━━━━━━━━━━━━━━━━
• 114 sourates avec texte arabe et traduction française
• Récitation audio verset par verset (mode Karaoké)
• Lecture page par page du Mushaf (604 pages)
• Marque-pages et sauvegarde automatique de la progression
• Navigation par sourate, par page ou par juz

━━━━━━━━━━━━━━━━━━━━━━━
💳 ADHÉSION & DONS
━━━━━━━━━━━━━━━━━━━━━━━
• Adhésion à l'association en quelques clics
• Paiement sécurisé via Stripe (CB)
• Dons ponctuels ou mensuels récurrents
• Reçu fiscal automatique par email
• Carte membre digitale avec QR code

━━━━━━━━━━━━━━━━━━━━━━━
📱 ANNONCES & ÉVÉNEMENTS
━━━━━━━━━━━━━━━━━━━━━━━
• Annonces de la mosquée en temps réel
• Programme des événements (conférences, cours, iftars)
• Annonces de prières mortuaires (Janaza)
• Messages privés avec l'équipe de la mosquée

━━━━━━━━━━━━━━━━━━━━━━━
📚 APPRENTISSAGE
━━━━━━━━━━━━━━━━━━━━━━━
• Alphabet arabe avec prononciation audio
• Leçons progressives d'arabe pour débutants
• Adhkar (invocations) du matin et du soir
• Quiz de vocabulaire islamique

━━━━━━━━━━━━━━━━━━━━━━━
🌐 LANGUES
━━━━━━━━━━━━━━━━━━━━━━━
Français et arabe, avec support complet de l'écriture de droite à
gauche (RTL).

━━━━━━━━━━━━━━━━━━━━━━━
À PROPOS DE L'ASSOCIATION
━━━━━━━━━━━━━━━━━━━━━━━
Cette application est développée par et pour l'association Centre
Culturel Islamique El Mouhssinine, située 29 rue de la Croix Blanche
à Bourg-en-Bresse (01000). Elle est destinée aux fidèles de la
communauté locale et à toute personne souhaitant suivre les activités
de la mosquée.

Contact : centreculturelislamique@orange.fr

Politique de confidentialité :
https://el-mouhssinine.web.app/privacy-policy.html
```

---

## 🎥 Vidéo démo (recommandée pour accélérer la review)

**Durée :** 30-45 secondes
**Format :** YouTube non répertorié (unlisted)
**Objectif :** Montrer que l'audio Coran fonctionne sur Android (le point de rejet v28)

### Script de tournage (enregistrement d'écran Android)

1. **[0-5s]** Ouvrir l'application El Mouhssinine
2. **[5-10s]** Écran d'accueil avec horaires de prière
3. **[10-15s]** Aller dans l'onglet Coran → choisir Al-Fatiha
4. **[15-25s]** **Appuyer sur Play → l'audio se lance** (montrer clairement que le bouton est réactif et que la récitation démarre)
5. **[25-30s]** Appuyer sur un verset → mode Karaoké fonctionne
6. **[30-35s]** Naviguer vers une autre sourate → Play fonctionne aussi
7. **[35-45s]** Montrer l'onglet Apprentissage → prononciation audio fonctionne

### Comment enregistrer sur Android

1. Ouvrir le tiroir de notifications (glisser du haut)
2. Chercher l'icône **"Enregistrement d'écran"** (ou "Screen Recorder")
3. Démarrer l'enregistrement
4. Suivre les étapes ci-dessus
5. Arrêter
6. Upload sur YouTube en "Non répertorié"
7. Coller le lien dans la Play Console → section "What's new" ou dans le formulaire d'appel

---

## 📋 Sécurité des données (Data Safety) — rappel

Si le questionnaire affiche encore "Remplir", revenir dedans et :
- Étape 3 "Types de données" : **décocher** `Journaux de plantage` et `Diagnostics` (ou les remplir à l'étape 4)
- Étape 4 : vérifier que tous les types cochés ont bien une finalité
- Étape 5 : le bouton "Enregistrer" doit passer en bleu
- Cliquer **"Enregistrer"** (pas "Enregistrer comme brouillon")

---

## 🚀 Ordre des actions dans la Play Console (resoumission v29)

### Stratégie : Internal Testing Track d'abord (recommandé après rejet)

Google recommande d'utiliser le track de test interne après un rejet.
Cela permet de valider que l'AAB fonctionne avant de soumettre en production.

1. ⬜ **Fiche Play Store** → remplacer la description par la version corrigée ci-dessus (sans Apple Pay, sans Mode Silencieux)
2. ⬜ **What's New (Notes de version)** → coller :
   ```
   v1.1.3 — Corrections Android
   • Lecteur audio Coran : correction du bouton Play qui ne répondait pas
   • Prononciation arabe (TTS) : activée sur Android
   • Corrections d'affichage clavier et polices
   • Améliorations de stabilité
   ```
3. ⬜ **Internal testing → Nouvelle version** → uploader le `.aab` v29
4. ⬜ **Tester sur un appareil Android** → vérifier que le Coran audio marche
5. ⬜ **Promouvoir en Production** → soumettre pour examen
6. ⬜ **(Optionnel) Vidéo démo** → uploader le lien YouTube si demandé
