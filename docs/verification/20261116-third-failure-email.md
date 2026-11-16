# Mail d'accompagnement après trois refus de paiement

Demande de Faiçal du 16 novembre 2026 : expliquer doucement comment remplacer
sa carte depuis l'application, sans pression. Le code de départ correspond
exactement au webhook version 115 relu en production.

## Comportement

Le mail applicatif envoyé à chaque refus est remplacé par un accompagnement
au seuil de trois refus d'une même facture mensuelle, une seule fois pour
cette facture. Il s'applique aux nouveaux événements reçus après la demande,
sans campagne de rattrapage ni rejeu manuel de paiement.

Avant l'envoi, le serveur vérifie la facture ouverte avec un montant restant,
l'échéance courante, le rattachement au bon adhérent et l'existence du parcours
de carte mensuelle dans l'app. Il relit ces états après réservation de l'envoi.
Une facture soldée, une ancienne échéance, une inscription jamais terminée ou
un abonnement annulé/en cours d'annulation ne déclenche pas le message.

Le texte utilise les vrais libellés du code mobile de la branche de carte :
`Mes adhésions` puis `Mettre à jour ma carte`. Aucun écran n'a été modifié ni
nouveau build mobile réalisé. Le parcours n'a pas été rejoué sur un appareil
physique pendant cette intervention.

## Message

Objet : **Un petit point sur votre cotisation**

> Salam alaykoum [prénom],
>
> Nous vous écrivons simplement pour vous informer que le paiement de votre
> cotisation mensuelle via l'application El Mouhssinine n'a pas pu aboutir malgré plusieurs tentatives. Cela
> peut arriver, notamment lorsqu'une carte a été renouvelée.
>
> Si vous souhaitez poursuivre votre adhésion, vous pouvez mettre votre carte
> à jour directement dans l'application El Mouhssinine :
>
> 1. Ouvrez l'application et connectez-vous.
> 2. Allez dans « Mes adhésions ».
> 3. Appuyez sur « Mettre à jour ma carte », puis suivez les indications.
>
> L'enregistrement d'une nouvelle carte peut entraîner le règlement de la
> cotisation en attente. Aucun numéro de carte n'est à nous envoyer par mail.
>
> Si vous rencontrez une difficulté ou souhaitez simplement faire le point,
> l'équipe de la mosquée reste à votre écoute :
> centreculturelislamique@orange.fr.
>
> Merci pour votre confiance. Prenez soin de vous.
>
> L'équipe El Mouhssinine

Le mail comporte texte brut et HTML échappé, en couleurs sobres. Les réponses
sont orientées vers le contact de la mosquée. Le template historique
`payment_failed`, au ton alarmant, ne remplace pas ce nouveau texte.

## Non-duplication et erreurs

`payment_failure_emails/{invoiceId}` réserve l'envoi dans une transaction
Firestore et vérifie aussi le marqueur du paiement réussi. Les doublons de
webhook, appels concurrents et quatrième refus ne produisent pas un second
mail accepté.

SMTP n'offre pas de garantie transactionnelle commune avec Firestore. Si
l'acceptation du mail est incertaine ou si son reçu ne peut être persisté après
acceptation, le dossier reste réservé et une erreur est consignée pour
vérification ; aucun renvoi aveugle n'est effectué. Seuls un échec avant SMTP
ou un refus explicite autorisent une nouvelle tentative du webhook. Un
interruption de processus entre réservation et reçu peut laisser `sending` :
ces réservations anciennes doivent être vérifiées par le suivi quotidien,
sans renvoi automatique.

La nouvelle collection est couverte par le refus d'accès client par défaut
des règles existantes. Seul le SDK serveur écrit ses reçus ; pas de modification
des règles ni des secrets.

## Vérifications avant livraison

- 39 scénarios verts sous Node 22 : seuil, doublons, concurrence, vrais libellés,
  dette soldée/ancienne, annulation, succès concurrent, SMTP refusé ou ambigu,
  et les 17 scénarios de renouvellement précédents.
- Deux tests du véritable corps du webhook étaient rouges sur l'ancien code :
  envoi avant trois refus et double envoi au rejeu. Ils passent après correction.
- Chargement réel du module et de ses 55 exports, contrôle syntaxique,
  contrôle sémantique ciblé des nouveaux fichiers et `git diff --check` verts.
- Gitleaks zéro alerte. Le défaut de parseur du lint global est historique,
  documenté dans le rapport du 15 novembre ; il n'a pas été masqué.
- Connexion TLS et authentification du SMTP Brevo existant vérifiées, sans
  transmettre de mail. Aucun prélèvement ni événement de paiement fictif
  n'a été déclenché en production.

## Livraison et retour arrière

Le commit `3400d34360e33a0b89a6517c479120096ceb63ab`, branche
`feat/gentle-third-failure-email-20261116`, a été poussé puis relu avant le
build Cloud `41b24bd7-6966-464d-b61e-e389eb6d1d42`, terminé SUCCESS.
Seul `stripeWebhook` est livré : version **116**, **ACTIVE**, Node 22, mise à
jour le 16 novembre 2026 à **11 h 55 min 00 s Europe/Paris**. Le module
`paymentFailureReminder.js` est inclus dans le paquet.

Garder le runtime Node 22, la configuration
et les références de secrets inchangés. Une source de la version 115 et les
empreintes de configuration sont sauvegardées dans le dossier opérationnel
privé. En cas de retour arrière, préserver les reçus déjà envoyés et éviter
de rétablir les anciens mails à chaque tentative.
