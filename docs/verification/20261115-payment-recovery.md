# Règlement des cotisations après un refus bancaire — 15 novembre 2026

## Défaut reproduit

Après un renouvellement encaissé, le webhook remettait le compteur d'échecs à
zéro, mais conservait `paymentFailed: true` et `status: expire`. Le monitoring
continuait donc à annoncer un impayé alors que Stripe indiquait une facture
soldée. Le code de la branche backend de départ est identique au `index.js`
effectivement déployé (SHA-256
`7a0987b262adb24fc1df5c54d48fdfcc2aba89dc4fd669f97aecda9ba3133ee5`).

## Correctif

- Nettoyer les trois indicateurs d'échec uniquement lorsque l'échéance courante
  est réglée et l'abonnement actif chez Stripe.
- Restaurer un statut expiré pour impayé uniquement avec les preuves existantes
  d'une validation du bureau. Préserver les autres statuts.
- Ignorer un ancien événement d'échec pour une facture déjà payée ; protéger
  aussi la course avec le succès dans une transaction Firestore.
- Répondre 500 si un échec ne peut pas être vérifié/enregistré, afin de permettre
  une nouvelle livraison Stripe.

Le runtime Node 20 n'est plus proposé au déploiement par Cloud Functions dans
le projet/région. Le paquet passe à Node 22 ; seul `stripeWebhook` doit être
redéployé. Aucune application mobile, règle d'accès ou autre fonction n'est
incluse dans cette livraison.

## Vérifications

- 17 scénarios du véritable corps du webhook, exécuté avec Stripe et le
  stockage transactionnel simulés aux frontières :
  `node --test functions/__tests__/renewal-webhook.test.cjs`.
- Rouge avant correction : neuf échecs sur les treize scénarios initiaux.
  Après correction et quatre cas supplémentaires : 17/17 verts sous Node
  22.23.2.
- Syntaxe JS valide et chargement réel du module avec ses dépendances :
  55 exports, webhook présent.
- `git diff --check` vert ; Gitleaks ne trouve aucun secret dans `functions/`.
- Le lint historique n'est pas vert : son parseur ES2018 refuse déjà `??` à
  la ligne 25 du fichier déployé avant ce changement. Le même défaut est
  reproduit sur la base et le correctif, sans changement de configuration lint.
  Un contrôle sémantique ES2022 relève aussi une instruction inaccessible
  préexistante dans une autre fonction ; aucun de ces défauts n'est masqué.

## Contrôle des données et limites

95 dossiers membres et les 53 abonnements Stripe ont été lus avec pagination ;
15 abonnements sont explicitement liés aux dossiers membres. Un seul indicateur
d'impayé était faux après un règlement : dossier corrigé et relu avec une garde
`updateTime`, sauvegarde privée des champs avant modification, sans changer la
période de cotisation ou créer un paiement.

Le monitoring programmé de 08:56 UTC a ensuite indiqué
`monitorSilentBugs: OK — aucune anomalie`.

Trois échéances sont réellement impayées et restent inchangées. Deux
inscriptions non terminées et un abonnement actif sans lien avec un dossier
sont à distinguer du défaut corrigé. Les détails personnels et reçus de données
restent dans le dossier opérationnel privé, hors Git.

Aucun prélèvement, remboursement, mail ou push manuel n'est nécessaire pour
cette réparation. Les essais du webhook sont locaux ; aucun faux événement de
paiement n'est injecté en production. Une nouvelle échéance réelle n'a pas été
provoquée pour tester le changement.

## Retour arrière

Le code déployé précédent est sauvegardé hors Git dans un dossier privé. Le
retour arrière de code conserve le runtime supporté Node 22 et les paramètres
de déploiement, sans rétablir de faux impayé dans les dossiers réparés. Toute
restauration des données doit vérifier à nouveau Stripe et l'`updateTime` du
dossier, afin de préserver les modifications concurrentes.
