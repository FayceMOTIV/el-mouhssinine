/**
 * Script de migration Firestore : standardiser les statuts membres en français
 *
 * Corrige les documents existants dans la collection 'members' :
 * - 'active' → 'actif'
 * - 'expired' → 'expire'
 * - 'none' → 'aucun'
 * - 'pending' → 'en_attente_paiement'
 * - 'cancelled' / 'canceled' → 'annule'
 * - 'inactive' → 'aucun'
 * - Supprime le champ 'statut' redondant
 *
 * Usage : node scripts/migrate-status-to-french.js
 * (exécuter depuis la racine du projet, utilise le service account Firebase)
 */

const admin = require('../functions/node_modules/firebase-admin');

// Initialiser avec les credentials par défaut (GOOGLE_APPLICATION_CREDENTIALS ou gcloud auth)
admin.initializeApp({
  projectId: 'el-mouhssinine',
});

const db = admin.firestore();

const STATUS_MAP = {
  'active': 'actif',
  'expired': 'expire',
  'none': 'aucun',
  'pending': 'en_attente_paiement',
  'cancelled': 'annule',
  'canceled': 'annule',
  'inactive': 'aucun',
};

// Valeurs déjà correctes (ne pas toucher)
const VALID_STATUSES = [
  'actif', 'expire', 'aucun', 'sympathisant',
  'en_attente_paiement', 'en_attente_validation',
  'en_attente_signature', 'annule',
];

async function migrate() {
  console.log('=== Migration des statuts membres vers le français ===\n');

  const membersSnapshot = await db.collection('members').get();
  console.log(`Total membres trouvés : ${membersSnapshot.size}\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const details = [];

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of membersSnapshot.docs) {
    const data = doc.data();
    const updates = {};
    const changes = [];

    // 1. Corriger le champ 'status' racine
    if (data.status && STATUS_MAP[data.status]) {
      updates.status = STATUS_MAP[data.status];
      changes.push(`status: '${data.status}' → '${updates.status}'`);
    }

    // 2. Supprimer le champ 'statut' redondant
    if (data.statut !== undefined) {
      updates.statut = admin.firestore.FieldValue.delete();
      changes.push(`statut: '${data.statut}' → SUPPRIMÉ`);
    }

    // 3. Corriger cotisation.status si présent
    if (data.cotisation && data.cotisation.status && STATUS_MAP[data.cotisation.status]) {
      updates['cotisation.status'] = STATUS_MAP[data.cotisation.status];
      changes.push(`cotisation.status: '${data.cotisation.status}' → '${updates['cotisation.status']}'`);
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      batchCount++;
      updated++;
      details.push({ id: doc.id, nom: data.nom || data.prenom || '?', changes });

      // Firestore batch limit = 500
      if (batchCount >= 450) {
        console.log(`Commit batch intermédiaire (${batchCount} ops)...`);
        await batch.commit();
        batchCount = 0;
      }
    } else {
      skipped++;
    }
  }

  // Commit final
  if (batchCount > 0) {
    await batch.commit();
  }

  // Rapport
  console.log('\n=== RAPPORT DE MIGRATION ===\n');
  console.log(`Membres mis à jour : ${updated}`);
  console.log(`Membres déjà corrects : ${skipped}`);
  console.log(`Erreurs : ${errors}\n`);

  if (details.length > 0) {
    console.log('Détail des modifications :');
    details.forEach(d => {
      console.log(`  [${d.id}] ${d.nom} : ${d.changes.join(', ')}`);
    });
  }

  console.log('\n=== Migration terminée ===');
  process.exit(0);
}

migrate().catch(err => {
  console.error('ERREUR FATALE :', err);
  process.exit(1);
});
