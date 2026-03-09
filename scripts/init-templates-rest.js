#!/usr/bin/env node
/**
 * Initialize email templates in Firestore via REST API
 * Uses the Firebase CLI refresh token for authentication
 */

const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const PROJECT = 'el-mouhssinine';
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

// Read Firebase CLI refresh token
const configPath = path.join(process.env.HOME, '.config/configstore/firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const refreshToken = config.tokens.refresh_token;

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.access_token) resolve(json.access_token);
        else reject(new Error('Token error: ' + JSON.stringify(json)));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function firestoreRequest(method, docPath, body, token) {
  return new Promise((resolve, reject) => {
    const urlPath = `/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`;
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'firestore.googleapis.com',
      path: urlPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else if (res.statusCode === 409) {
          resolve({ _exists: true });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function sv(s) { return { stringValue: s }; }
function av(arr) {
  return {
    arrayValue: {
      values: arr.map(item => ({
        mapValue: {
          fields: {
            name: sv(item.name),
            description: sv(item.description)
          }
        }
      }))
    }
  };
}

const templates = [
  {
    id: 'welcome_member',
    fields: {
      title: sv('Bienvenue sympathisant'),
      description: sv("Email envoyé automatiquement quand un nouveau sympathisant s'inscrit via l'app"),
      trigger: sv('Inscription sympathisant'),
      cloudFunction: sv('onNewSympathisant'),
      subject: sv('Bienvenue à la {nom_mosquee} !'),
      body: sv(`Assalamu alaykum {prenom},

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
Le Bureau de la {nom_mosquee}`),
      variables: av([
        { name: 'prenom', description: 'Prénom du sympathisant' },
        { name: 'nom_mosquee', description: 'Nom de la mosquée' },
      ]),
      createdAt: { timestampValue: new Date().toISOString() },
    }
  },
  {
    id: 'membership_confirmation',
    fields: {
      title: sv('Confirmation adhésion'),
      description: sv("Email envoyé automatiquement après paiement d'une cotisation réussi"),
      trigger: sv('Paiement cotisation réussi'),
      cloudFunction: sv('onCotisationConfirmation'),
      subject: sv('Bienvenue parmi les membres actifs - El Mouhssinine'),
      body: sv(`Salam alaykoum {prenom},

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
Le Bureau de {nom_association}`),
      variables: av([
        { name: 'prenom', description: 'Prénom du membre' },
        { name: 'nom_association', description: "Nom de l'association" },
        { name: 'montant', description: 'Montant de la cotisation' },
        { name: 'type_cotisation', description: 'Type (Mensuelle / Annuelle)' },
        { name: 'date_debut', description: "Date de début d'adhésion" },
        { name: 'date_prochaine_echeance', description: "Prochaine date d'échéance" },
        { name: 'annee_suivante', description: 'Année suivante (pour CERFA)' },
      ]),
      createdAt: { timestampValue: new Date().toISOString() },
    }
  },
  {
    id: 'donation_confirmation_individual',
    fields: {
      title: sv('Confirmation don particulier'),
      description: sv("Email envoyé automatiquement après un don réussi d'un particulier"),
      trigger: sv('Don particulier réussi'),
      cloudFunction: sv('onDonationConfirmation'),
      subject: sv('Reçu de don - El Mouhssinine'),
      body: sv(`Salam alaykoum {prenom},

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
Le Bureau de {nom_association}`),
      variables: av([
        { name: 'prenom', description: 'Prénom du donateur' },
        { name: 'nom_association', description: "Nom de l'association" },
        { name: 'montant', description: 'Montant du don' },
        { name: 'date', description: 'Date du don' },
        { name: 'projet', description: 'Nom du projet' },
        { name: 'reference', description: 'Référence du don' },
        { name: 'montant_deductible', description: 'Montant déductible (66%)' },
        { name: 'annee_suivante', description: 'Année suivante (pour CERFA)' },
      ]),
      createdAt: { timestampValue: new Date().toISOString() },
    }
  },
  {
    id: 'donation_confirmation_company',
    fields: {
      title: sv('Confirmation don entreprise'),
      description: sv("Email envoyé automatiquement après un don réussi d'une entreprise"),
      trigger: sv('Don entreprise réussi'),
      cloudFunction: sv('onDonationConfirmation'),
      subject: sv('Reçu de don entreprise - El Mouhssinine'),
      body: sv(`Salam alaykoum,

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
Le Bureau de {nom_association}`),
      variables: av([
        { name: 'raison_sociale', description: "Raison sociale de l'entreprise" },
        { name: 'siret', description: 'Numéro SIRET' },
        { name: 'nom_association', description: "Nom de l'association" },
        { name: 'montant', description: 'Montant du don' },
        { name: 'date', description: 'Date du don' },
        { name: 'projet', description: 'Nom du projet' },
        { name: 'reference', description: 'Référence du don' },
        { name: 'montant_deductible', description: 'Montant déductible (60%)' },
        { name: 'annee_suivante', description: 'Année suivante (pour CERFA)' },
      ]),
      createdAt: { timestampValue: new Date().toISOString() },
    }
  },
  {
    id: 'membership_manual_validation',
    fields: {
      title: sv('Validation adhésion (approbation)'),
      description: sv("Email envoyé quand un admin valide manuellement une adhésion"),
      trigger: sv('Admin valide une adhésion'),
      cloudFunction: sv('validateMembership'),
      subject: sv('Votre adhésion est validée - {nom_mosquee}'),
      body: sv(`Assalamu alaykum {prenom},

Nous avons le plaisir de vous informer que votre adhésion à la {nom_mosquee} a été validée !

Vous êtes maintenant membre actif :
- Carte de membre officielle
- Droit de vote en Assemblée Générale
- Reçu fiscal pour votre cotisation

Votre carte de membre est disponible dans l'application.

Qu'Allah vous récompense pour votre engagement.

Fraternellement,
Le Bureau de la {nom_mosquee}`),
      variables: av([
        { name: 'prenom', description: 'Prénom du membre' },
        { name: 'nom_mosquee', description: 'Nom de la mosquée' },
      ]),
      createdAt: { timestampValue: new Date().toISOString() },
    }
  },
  {
    id: 'message_reply',
    fields: {
      title: sv('Réponse à un message'),
      description: sv("Email envoyé quand la mosquée répond à un message d'un adhérent"),
      trigger: sv('Réponse admin à un message'),
      cloudFunction: sv('onMessageReply'),
      subject: sv('Réponse à votre message - {nom_mosquee}'),
      body: sv(`Assalamu alaykum {prenom},

Nous avons répondu à votre message.

Votre message : {message_original}

Notre réponse : {reponse}

Pour continuer la conversation, ouvrez l'application dans la section Messages.

Fraternellement,
Le Bureau de la {nom_mosquee}`),
      variables: av([
        { name: 'prenom', description: 'Prénom du membre' },
        { name: 'nom_mosquee', description: 'Nom de la mosquée' },
        { name: 'message_original', description: 'Message original du membre' },
        { name: 'reponse', description: 'Réponse de la mosquée' },
      ]),
      createdAt: { timestampValue: new Date().toISOString() },
    }
  },
  {
    id: 'annual_cerfa',
    fields: {
      title: sv('Reçu fiscal annuel (CERFA)'),
      description: sv("Email envoyé avec le reçu fiscal PDF joint chaque début d'année"),
      trigger: sv('Génération CERFA annuelle (2 janvier)'),
      cloudFunction: sv('generateAnnualRecusFiscaux / sendRecuFiscal'),
      subject: sv('Reçu fiscal {annee} - {nom_association}'),
      body: sv(`Bonjour {nom},

Veuillez trouver ci-joint votre reçu fiscal pour l'année {annee}.

Montant total des dons : {montant_total} €
Numéro du reçu : {reference}

Ce document est à conserver pour votre déclaration de revenus.

Qu'Allah vous récompense pour votre générosité.

{nom_association}`),
      variables: av([
        { name: 'nom', description: 'Nom complet du donateur' },
        { name: 'annee', description: 'Année fiscale' },
        { name: 'montant_total', description: 'Montant total des dons' },
        { name: 'reference', description: 'Numéro du reçu fiscal' },
        { name: 'nom_association', description: "Nom de l'association" },
      ]),
      createdAt: { timestampValue: new Date().toISOString() },
    }
  },
];

async function main() {
  console.log('Getting access token...');
  const token = await getAccessToken();
  console.log('Token OK\n');

  let success = 0, skipped = 0, errors = 0;

  for (const tmpl of templates) {
    try {
      const result = await firestoreRequest(
        'POST',
        `email_templates?documentId=${tmpl.id}`,
        { fields: tmpl.fields },
        token
      );
      if (result._exists) {
        console.log(`⏭️  ${tmpl.id} existe déjà`);
        skipped++;
      } else {
        console.log(`✅ ${tmpl.id} → ${tmpl.fields.title.stringValue}`);
        success++;
      }
    } catch (err) {
      console.error(`❌ ${tmpl.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nRésultat : ${success} créés, ${skipped} existants, ${errors} erreurs`);

  // Clean up test doc if exists
  try {
    await firestoreRequest('DELETE', 'email_templates/_test', null, token);
  } catch (e) { /* ignore */ }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
