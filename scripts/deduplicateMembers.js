/**
 * Script de déduplication Firestore — collection 'members'
 *
 * 1. Récupère TOUS les documents
 * 2. Groupe par email (toLowerCase().trim())
 * 3. Pour chaque groupe avec 2+ documents :
 *    - Principal = celui qui a un champ uid non vide
 *    - Si aucun uid → le plus récent (createdAt)
 *    - Fusionne les données du doublon dans le principal (sans écraser)
 *    - Supprime le(s) doublon(s)
 * 4. Affiche un rapport
 *
 * Usage : GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/smmafk01_gmail_com_application_default_credentials.json node scripts/deduplicateMembers.js
 */

const admin = require('../functions/node_modules/firebase-admin');

admin.initializeApp({
  projectId: 'el-mouhssinine',
});

const db = admin.firestore();

// Mode DRY-RUN par défaut : ne supprime rien, affiche juste le rapport
// Passer --execute pour vraiment supprimer
const DRY_RUN = !process.argv.includes('--execute');

async function deduplicateMembers() {
  if (DRY_RUN) {
    console.log('═══════════════════════════════════════════════');
    console.log('  MODE DRY-RUN — Aucune modification ne sera faite');
    console.log('  Relancer avec --execute pour appliquer');
    console.log('═══════════════════════════════════════════════\n');
  } else {
    console.log('═══════════════════════════════════════════════');
    console.log('  ⚠️  MODE EXÉCUTION — Les doublons seront supprimés');
    console.log('═══════════════════════════════════════════════\n');
  }

  console.log('🔍 Lecture de tous les membres...');
  const snap = await db.collection('members').get();
  console.log(`   Total documents : ${snap.size}\n`);

  // Collecter tous les docs
  const docs = [];
  snap.forEach(d => {
    docs.push({ id: d.id, _ref: d.ref, ...d.data() });
  });

  // Grouper par email
  const byEmail = {};
  let sansEmail = 0;
  docs.forEach(doc => {
    const email = (doc.email || '').toLowerCase().trim();
    if (!email) {
      sansEmail++;
      return;
    }
    if (!byEmail[email]) byEmail[email] = [];
    byEmail[email].push(doc);
  });

  console.log(`📊 Emails uniques  : ${Object.keys(byEmail).length}`);
  console.log(`📊 Sans email      : ${sansEmail}\n`);

  let totalDoublons = 0;
  let totalSupprimes = 0;
  const rapport = [];

  for (const [email, members] of Object.entries(byEmail)) {
    if (members.length <= 1) continue;

    totalDoublons++;
    console.log(`\n⚠️  DOUBLON : ${email} (${members.length} docs)`);
    console.log('   ─────────────────────────────────────');

    // Afficher tous les docs de ce groupe
    members.forEach(m => {
      const date = m.createdAt && m.createdAt.toDate
        ? m.createdAt.toDate().toISOString().slice(0, 10)
        : m.createdAt
          ? new Date(m.createdAt).toISOString().slice(0, 10)
          : 'N/A';
      const status = m.status || m.cotisation?.status || 'N/A';
      const hasUid = m.uid ? `uid=${m.uid.slice(0, 12)}...` : 'PAS DE UID';
      const hasCotisation = m.cotisation?.dateFin ? 'cotisation=OUI' : 'cotisation=NON';
      console.log(`   📄 ${m.id} | ${hasUid} | status=${status} | ${hasCotisation} | créé=${date}`);
    });

    // Trier : uid en premier, sinon le plus récent
    members.sort((a, b) => {
      // Priorité 1 : a un uid réel (pas mock)
      const aHasRealUid = a.uid && !a.uid.startsWith('mock-');
      const bHasRealUid = b.uid && !b.uid.startsWith('mock-');
      if (aHasRealUid && !bHasRealUid) return -1;
      if (!aHasRealUid && bHasRealUid) return 1;

      // Priorité 2 : a une cotisation active
      const aHasCotisation = a.cotisation && a.cotisation.dateFin;
      const bHasCotisation = b.cotisation && b.cotisation.dateFin;
      if (aHasCotisation && !bHasCotisation) return -1;
      if (!aHasCotisation && bHasCotisation) return 1;

      // Priorité 3 : statut 'actif'
      if (a.status === 'actif' && b.status !== 'actif') return -1;
      if (a.status !== 'actif' && b.status === 'actif') return 1;

      // Priorité 4 : le plus récent
      const dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
      const dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);
      return dateB - dateA;
    });

    const principal = members[0];
    const doublons = members.slice(1);

    console.log(`   ✅ PRINCIPAL : ${principal.id} (uid: ${principal.uid || 'AUCUN'} | status: ${principal.status || 'N/A'})`);

    // Fusionner les données des doublons dans le principal
    const champsFusionnes = [];
    const dataPrincipal = {};
    // Copier les champs du principal
    Object.keys(principal).forEach(key => {
      if (key === 'id' || key === '_ref') return;
      dataPrincipal[key] = principal[key];
    });

    doublons.forEach(doublon => {
      console.log(`   🗑️  DOUBLON  : ${doublon.id} (uid: ${doublon.uid || 'AUCUN'} | status: ${doublon.status || 'N/A'})`);

      // Copier les champs non-vides du doublon si manquants dans le principal
      Object.keys(doublon).forEach(key => {
        if (key === 'id' || key === '_ref') return;
        const valPrincipal = dataPrincipal[key];
        const valDoublon = doublon[key];
        // Copier si le principal n'a pas ce champ ou l'a vide
        const principalVide = valPrincipal === undefined || valPrincipal === null || valPrincipal === '';
        const doublonNonVide = valDoublon !== undefined && valDoublon !== null && valDoublon !== '';
        if (principalVide && doublonNonVide) {
          dataPrincipal[key] = valDoublon;
          champsFusionnes.push(key);
          console.log(`      → Champ récupéré du doublon: ${key}`);
        }
      });
    });

    rapport.push({
      email,
      nbDocs: members.length,
      principalId: principal.id,
      doublonsIds: doublons.map(d => d.id),
      champsFusionnes,
    });

    if (!DRY_RUN) {
      // Mettre à jour le principal avec les données fusionnées
      await db.collection('members').doc(principal.id).set({
        ...dataPrincipal,
        mergedFrom: doublons.map(d => d.id),
        mergedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ Principal mis à jour`);

      // Supprimer les doublons
      for (const doublon of doublons) {
        await db.collection('members').doc(doublon.id).delete();
        console.log(`   ✅ Supprimé: ${doublon.id}`);
        totalSupprimes++;
      }
    } else {
      totalSupprimes += doublons.length;
      console.log(`   [DRY-RUN] Aurait supprimé ${doublons.length} doublon(s)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`RAPPORT FINAL ${DRY_RUN ? '(DRY-RUN)' : '(EXÉCUTÉ)'} :`);
  console.log(`  Total documents      : ${docs.length}`);
  console.log(`  Emails avec doublons : ${totalDoublons}`);
  console.log(`  Documents à supprimer: ${totalSupprimes}`);
  console.log(`  Documents restants   : ${docs.length - totalSupprimes}`);
  console.log('═══════════════════════════════════════════════');

  if (DRY_RUN && totalDoublons > 0) {
    console.log('\n👉 Pour appliquer, relancer avec : node scripts/deduplicateMembers.js --execute');
  }

  process.exit(0);
}

deduplicateMembers().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
