# TODO - El Mouhssinine App

## Améliorations futures

- [ ] Option langue arabe (FR/AR toggle dans Settings)
- [ ] RTL layout pour l'arabe
- [ ] Phrase condoléances sur écran Janaza détail
- [ ] Bouton "Voir projet" ouvre modal avec liste fichiers
- [ ] Notifications push (après fix Firebase)
- [ ] Connexion réelle Firebase Auth
- [ ] Paiement Stripe
- [ ] AsyncStorage pour persister les favoris Coran
- [ ] Lecteur audio intégré pour les versets
- [ ] Mode hors-ligne pour le Coran

## Notes techniques

- Firebase Auth et Firestore sont désactivés pour TestFlight
- Les données sont mockées (horaires, annonces, janaza, projets)
- L'API Aladhan est utilisée en fallback pour les horaires réels
- L'API Al-Quran Cloud est fonctionnelle pour le Coran
