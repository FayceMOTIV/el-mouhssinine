/**
 * Script pour ajouter un membre test dans Firestore
 * Usage: cd functions && node addTestMember.js
 *
 * Prerequis: gcloud auth application-default login
 */

const admin = require('firebase-admin');

// Utilise les credentials par defaut (GOOGLE_APPLICATION_CREDENTIALS ou gcloud auth)
admin.initializeApp({
  projectId: 'el-mouhssinine'
});

const db = admin.firestore();

async function addTestMember() {
  const testMember = {
    nom: 'Test',
    prenom: 'Tiers',
    telephone: '0612345678',
    adresse: '123 Rue Test, 01000 Bourg-en-Bresse',
    email: '',
    inscritPar: {
      odUserId: 'xxx', // ID utilisateur fictif
      nom: 'Dupont',
      prenom: 'Mohamed'
    },
    status: 'en_attente_signature',
    dateInscription: admin.firestore.FieldValue.serverTimestamp(),
    paiementId: 'PAY-TEST-123',
    montant: 100,
    modePaiement: 'carte',
    formule: 'annuel',
    cotisation: {
      type: 'annuel',
      montant: 100,
      dateDebut: new Date(),
      dateFin: new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate())
    }
  };

  try {
    const docRef = await db.collection('members').add(testMember);
    console.log('Membre test ajouté avec succès ! ID:', docRef.id);
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du membre test:', error);
    process.exit(1);
  }
}

addTestMember();
