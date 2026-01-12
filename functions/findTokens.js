/**
 * Script pour chercher les tokens FCM dans Firestore
 */

const admin = require('firebase-admin');
const serviceAccount = require('/Users/faicalkriouar/Downloads/el-mouhssinine-firebase-adminsdk-fbsvc-40536089d3.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'el-mouhssinine',
});

const db = admin.firestore();

async function findTokens() {
  console.log('🔍 Recherche de tokens FCM dans Firestore...\n');

  let found = false;

  // Chercher dans settings
  const settingsSnap = await db.collection('settings').get();
  settingsSnap.forEach(doc => {
    const data = doc.data();
    if (data.fcmToken || data.token) {
      console.log('📱 Token trouvé dans settings/' + doc.id + ':');
      console.log('   ', data.fcmToken || data.token);
      found = true;
    }
  });

  // Chercher dans diverses collections
  const collections = ['fcm_tokens', 'devices', 'users', 'members', 'notifications'];
  for (const col of collections) {
    try {
      const snap = await db.collection(col).limit(10).get();
      if (snap.size > 0) {
        console.log('\n📁 Collection ' + col + ' (' + snap.size + ' docs):');
        snap.forEach(doc => {
          const data = doc.data();
          // Chercher n'importe quel champ contenant "token"
          Object.keys(data).forEach(key => {
            if (key.toLowerCase().includes('token') && typeof data[key] === 'string' && data[key].length > 50) {
              console.log('   ' + doc.id + '.' + key + ': ' + data[key].substring(0, 60) + '...');
              found = true;
            }
          });
        });
      }
    } catch (e) {
      // Collection n'existe pas, ignorer
    }
  }

  if (!found) {
    console.log('❌ Aucun token FCM trouvé dans Firestore.');
    console.log('\n💡 Pour récupérer le token:');
    console.log('   1. Ouvrez Console.app sur Mac');
    console.log('   2. Connectez l\'iPhone et sélectionnez-le');
    console.log('   3. Filtrez par "ElMouhssinine"');
    console.log('   4. Cherchez "[FCM] Token:" dans les logs');
  }

  process.exit(0);
}

findTokens().catch(e => {
  console.error('Erreur:', e.message);
  process.exit(1);
});
