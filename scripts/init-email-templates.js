/**
 * Script d'initialisation des templates email dans Firestore
 * Collection: email_templates
 *
 * Usage: node scripts/init-email-templates.js
 *
 * Prérequis: GOOGLE_APPLICATION_CREDENTIALS ou firebase login
 */

const admin = require('firebase-admin');

// Initialiser Firebase Admin avec application default credentials
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'el-mouhssinine',
  });
}

const db = admin.firestore();

const templates = [
  {
    id: 'welcome_member',
    title: 'Bienvenue sympathisant',
    description: 'Email envoyé automatiquement quand un nouveau sympathisant s\'inscrit via l\'app',
    trigger: 'Inscription sympathisant',
    cloudFunction: 'onNewSympathisant',
    subject: 'Bienvenue à la {nom_mosquee} !',
    body: `Assalamu alaykum {prenom},

Bienvenue en tant que membre sympathisant de la {nom_mosquee} !

En tant que sympathisant, vous avez accès à :
- Les horaires de prière en temps réel
- Le Coran complet avec audio et traduction
- Les annonces et événements de la mosquée
- Les invocations (adhkar)
- L'alphabet arabe et les leçons
- La messagerie avec le bureau

Pour devenir membre actif (adhérent) :
1. Ouvrez l'application et allez dans "Membre"
2. Cliquez sur "Devenir Membre Actif"
3. Lisez et acceptez les statuts et règlement intérieur
4. Payez votre cotisation (mensuelle ou annuelle)
5. Votre adhésion sera validée par le bureau

En tant que membre actif, vous bénéficiez d'une carte de membre, du droit de vote en AG, et d'un reçu fiscal pour votre cotisation.

Qu'Allah vous bénisse et accepte vos bonnes actions.

Fraternellement,
Le Bureau de la {nom_mosquee}`,
    variables: [
      { name: 'prenom', description: 'Prénom du sympathisant' },
      { name: 'nom_mosquee', description: 'Nom de la mosquée' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'membership_confirmation',
    title: 'Confirmation adhésion',
    description: 'Email envoyé automatiquement après paiement d\'une cotisation réussi',
    trigger: 'Paiement cotisation réussi',
    cloudFunction: 'onCotisationConfirmation',
    subject: 'Bienvenue parmi les membres actifs - El Mouhssinine',
    body: `Salam alaykoum {prenom},

Merci pour votre adhésion au {nom_association} !
Vous êtes désormais membre actif de notre association.

Vos avantages en tant que membre actif :
- Vous soutenez activement votre mosquée et gagnez des hassanates
- Droit de vote aux assemblées générales et élections
- Accès à votre carte de membre numérique
- Reçu fiscal automatique pour réduction d'impôts

Récapitulatif de votre adhésion :
- Type : {type_cotisation} ({montant} €)
- Date de début : {date_debut}
- Prochaine échéance : {date_prochaine_echeance}

Votre carte de membre est disponible dans l'application :
Onglet Adhérent → Voir ma carte de membre

Vous recevrez votre reçu fiscal (CERFA) en début d'année {annee_suivante}.

Qu'Allah vous récompense pour votre soutien.

Barakallahou fikoum,
Le Bureau de {nom_association}`,
    variables: [
      { name: 'prenom', description: 'Prénom du membre' },
      { name: 'nom_association', description: 'Nom de l\'association' },
      { name: 'montant', description: 'Montant de la cotisation' },
      { name: 'type_cotisation', description: 'Type (Mensuelle / Annuelle)' },
      { name: 'date_debut', description: 'Date de début d\'adhésion' },
      { name: 'date_prochaine_echeance', description: 'Prochaine date d\'échéance' },
      { name: 'annee_suivante', description: 'Année suivante (pour CERFA)' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'donation_confirmation_individual',
    title: 'Confirmation don particulier',
    description: 'Email envoyé automatiquement après un don réussi d\'un particulier',
    trigger: 'Don particulier réussi',
    cloudFunction: 'onDonationConfirmation',
    subject: 'Reçu de don - El Mouhssinine',
    body: `Salam alaykoum {prenom},

Nous vous remercions chaleureusement pour votre généreux don de {montant} € à l'association {nom_association}.
Qu'Allah accepte votre don et vous en récompense.

Récapitulatif de votre don :
- Montant : {montant} €
- Date : {date}
- Projet : {projet}
- Référence : {reference}

Avantage fiscal :
En tant que particulier, votre don ouvre droit à une réduction d'impôt de 66% de son montant, dans la limite de 20% de votre revenu imposable (article 200 du Code Général des Impôts).
Montant déductible : {montant_deductible} €

Un reçu fiscal (CERFA n°11580*05) vous sera automatiquement adressé en janvier {annee_suivante}, vous permettant de déclarer votre don lors de votre déclaration de revenus.

Barakallahou fikoum,
Le Bureau de {nom_association}`,
    variables: [
      { name: 'prenom', description: 'Prénom du donateur' },
      { name: 'nom_association', description: 'Nom de l\'association' },
      { name: 'montant', description: 'Montant du don' },
      { name: 'date', description: 'Date du don' },
      { name: 'projet', description: 'Nom du projet' },
      { name: 'reference', description: 'Référence du don' },
      { name: 'montant_deductible', description: 'Montant déductible (66%)' },
      { name: 'annee_suivante', description: 'Année suivante (pour CERFA)' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'donation_confirmation_company',
    title: 'Confirmation don entreprise',
    description: 'Email envoyé automatiquement après un don réussi d\'une entreprise',
    trigger: 'Don entreprise réussi',
    cloudFunction: 'onDonationConfirmation',
    subject: 'Reçu de don entreprise - El Mouhssinine',
    body: `Salam alaykoum,

Nous accusons bonne réception du don de {montant} € effectué par {raison_sociale} au profit de l'association {nom_association}.
Qu'Allah vous récompense pour votre générosité.

Récapitulatif du don :
- Raison sociale : {raison_sociale}
- SIRET : {siret}
- Montant : {montant} €
- Date : {date}
- Projet : {projet}
- Référence : {reference}

Avantage fiscal entreprise :
Ce don ouvre droit à une réduction d'impôt de 60% de son montant, dans la limite de 20 000 € ou 0,5% du chiffre d'affaires HT (article 238 bis du Code Général des Impôts).
Montant déductible : {montant_deductible} €

Un reçu fiscal (CERFA) vous sera automatiquement adressé en janvier {annee_suivante}.

Cordialement,
Le Bureau de {nom_association}`,
    variables: [
      { name: 'raison_sociale', description: 'Raison sociale de l\'entreprise' },
      { name: 'siret', description: 'Numéro SIRET' },
      { name: 'nom_association', description: 'Nom de l\'association' },
      { name: 'montant', description: 'Montant du don' },
      { name: 'date', description: 'Date du don' },
      { name: 'projet', description: 'Nom du projet' },
      { name: 'reference', description: 'Référence du don' },
      { name: 'montant_deductible', description: 'Montant déductible (60%)' },
      { name: 'annee_suivante', description: 'Année suivante (pour CERFA)' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'membership_manual_validation',
    title: 'Validation adhésion (approbation)',
    description: 'Email envoyé quand un admin valide manuellement une adhésion',
    trigger: 'Admin valide une adhésion',
    cloudFunction: 'validateMembership',
    subject: 'Votre adhésion est validée - {nom_mosquee}',
    body: `Assalamu alaykum {prenom},

Nous avons le plaisir de vous informer que votre adhésion à la {nom_mosquee} a été validée !

Vous êtes maintenant membre actif :
- Carte de membre officielle
- Droit de vote en Assemblée Générale
- Reçu fiscal pour votre cotisation

Votre carte de membre est disponible dans l'application.

Qu'Allah vous récompense pour votre engagement.

Fraternellement,
Le Bureau de la {nom_mosquee}`,
    variables: [
      { name: 'prenom', description: 'Prénom du membre' },
      { name: 'nom_mosquee', description: 'Nom de la mosquée' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'message_reply',
    title: 'Réponse à un message',
    description: 'Email envoyé quand la mosquée répond à un message d\'un adhérent',
    trigger: 'Réponse admin à un message',
    cloudFunction: 'onMessageReply',
    subject: 'Réponse à votre message - {nom_mosquee}',
    body: `Assalamu alaykum {prenom},

Nous avons répondu à votre message.

Votre message : {message_original}

Notre réponse : {reponse}

Pour continuer la conversation, ouvrez l'application dans la section Messages.

Fraternellement,
Le Bureau de la {nom_mosquee}`,
    variables: [
      { name: 'prenom', description: 'Prénom du membre' },
      { name: 'nom_mosquee', description: 'Nom de la mosquée' },
      { name: 'message_original', description: 'Message original du membre' },
      { name: 'reponse', description: 'Réponse de la mosquée' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'annual_cerfa',
    title: 'Reçu fiscal annuel (CERFA)',
    description: 'Email envoyé avec le reçu fiscal PDF joint chaque début d\'année',
    trigger: 'Génération CERFA annuelle (2 janvier)',
    cloudFunction: 'generateAnnualRecusFiscaux / sendRecuFiscal',
    subject: 'Reçu fiscal {annee} - {nom_association}',
    body: `Bonjour {nom},

Veuillez trouver ci-joint votre reçu fiscal pour l'année {annee}.

Montant total des dons : {montant_total} €
Numéro du reçu : {reference}

Ce document est à conserver pour votre déclaration de revenus.

Qu'Allah vous récompense pour votre générosité.

{nom_association}`,
    variables: [
      { name: 'nom', description: 'Nom complet du donateur' },
      { name: 'annee', description: 'Année fiscale' },
      { name: 'montant_total', description: 'Montant total des dons' },
      { name: 'reference', description: 'Numéro du reçu fiscal' },
      { name: 'nom_association', description: 'Nom de l\'association' },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

async function initTemplates() {
  console.log('Initialisation des templates email...\n');

  const batch = db.batch();

  for (const template of templates) {
    const { id, ...data } = template;
    const ref = db.collection('email_templates').doc(id);

    // Vérifier si le template existe déjà
    const existing = await ref.get();
    if (existing.exists) {
      console.log(`⏭️  ${id} existe déjà, skip`);
      continue;
    }

    batch.set(ref, data);
    console.log(`✅ ${id} → ${data.title}`);
  }

  await batch.commit();
  console.log('\n✅ Tous les templates ont été initialisés !');
  console.log('Collection : email_templates');
  console.log(`Documents : ${templates.length}`);
  process.exit(0);
}

initTemplates().catch((error) => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});
