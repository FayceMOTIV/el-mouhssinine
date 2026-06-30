# 💡 Idées de features — El Mouhssinine (backlog)

> Notées le 2026-06-12. À revoir **à la rentrée (sept. 2026)** avec le recul des vrais users.
> Légende : 🟢 OTA (rapide, sans review store) · 🔵 Build natif · ⏱️ effort relatif

## 🥇 Top reco (par impact)
1. **Widget iOS écran d'accueil + verrouillage** 🔵 ⏱️⏱️ — prochaine prière + compte à rebours sans ouvrir l'app. LE truc qui rend l'app indispensable au quotidien.
2. **Campagnes de dons avec thermomètre live** 🟢 ⏱️ — compteur animé qui monte, « plus que X€ », partage. Booste directement les dons.
3. **Compteur Tasbih (dhikr)** 🟢 ⏱️ + **Khatma tracker (Coran)** 🟢 ⏱️ — engagement spirituel, rapides à sortir.

## 🟢 Quick wins OTA (sans store)
- **Tasbih digital** : gros bouton, vibration, objectifs 33/99/100, historique.
- **Khatma tracker** : progression sourate par sourate, objectif « Coran en 30j » (Ramadan), barre.
- **Streak de prière** : « X jours d'affilée », stats du mois (réutilise le bouton « J'ai prié »).
- **Campagnes dons thermomètre** : compteur live animé + objectif + partage.
- **Dua / Hadith du jour en notif** : rappel spirituel quotidien (collection `rappels` existe).

## 🔵 Features moyennes (build, gros impact)
- **Widget iOS** (home + lock screen) : prochaine prière + countdown.
- **Apple Watch / complications** : horaires au poignet + vibration discrète à l'heure.
- **Mode Ramadan complet** : countdown Suhoor/Iftar, planning Taraweeh, calendrier, suivi jeûne (`settings/ramadan` existe).
- **RSVP événements + rappels** : « Je participe » → reminder la veille ; backoffice voit qui vient.

## 🤯 Features « de dingue »
- **« Pars maintenant pour la prière »** : calcule le temps de trajet (géoloc) → notif « pars dans 5 min pour Maghrib ». Personne ne le fait.
- **Mode silencieux auto à la mosquée** : réutilise `MosqueGeofencing` (déjà là) → tel en silencieux à l'entrée, réactivé à la sortie.
- **Khutbah/cours en direct + replay audio** : streaming prêche du vendredi + bibliothèque audio des conférences.
- **Assistant IA « Pose ta question »** : chat infos pratiques (horaires, cotisation, règles) — ENCADRÉ, pas de fatwa. Désengorge la messagerie.
- **Carpooling Janaza** : coordonner qui emmène qui au cimetière. Très communautaire.

## 📊 Backoffice (admins)
- **Dashboard engagement** : ouvertures app, rétention, prières loggées, dons par campagne.
- **Segmentation notifs avancée** : cibler « inactifs 30j » pour relance (segmentation membres/sympathisants existe déjà).

---
**Stratégie suggérée** : commencer par 1-2 quick wins 🟢 OTA (Tasbih, thermomètre dons) pour un effet immédiat sans attendre les stores, puis attaquer le Widget iOS 🔵 (le plus gros levier d'engagement).
