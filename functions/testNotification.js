/**
 * Script de test pour envoyer des notifications FCM
 * Usage: node testNotification.js <TOKEN_FCM>
 */

const admin = require('firebase-admin');
const serviceAccount = require('/Users/faicalkriouar/Downloads/el-mouhssinine-firebase-adminsdk-fbsvc-40536089d3.json');

// Initialiser Firebase Admin avec le service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'el-mouhssinine',
});

const fcmToken = process.argv[2];

if (!fcmToken) {
  console.log('❌ Usage: node testNotification.js <TOKEN_FCM>');
  console.log('');
  console.log('Exemple:');
  console.log('  node testNotification.js "cAbCdEfGhIjK..."');
  process.exit(1);
}

console.log('🔔 Test de notification FCM');
console.log('==========================');
console.log('Token:', fcmToken.substring(0, 40) + '...');
console.log('Longueur:', fcmToken.length);
console.log('');

// Test 1: Envoi direct au device token
async function testDirectToDevice() {
  console.log('📱 TEST 1: Envoi direct au device token...');

  const message = {
    token: fcmToken,
    notification: {
      title: '🧪 Test Direct Device',
      body: 'Si tu vois ça, APNs fonctionne!',
    },
    data: {
      type: 'test_direct',
      timestamp: new Date().toISOString(),
    },
    // Configuration spécifique iOS/APNs
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: {
            title: '🧪 Test Direct Device',
            body: 'Si tu vois ça, APNs fonctionne!',
          },
          sound: 'default',
          badge: 1,
          'content-available': 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Succès! Message ID:', response);
    return true;
  } catch (error) {
    console.log('❌ Erreur:', error.code);
    console.log('   Message:', error.message);

    if (error.code === 'messaging/registration-token-not-registered') {
      console.log('');
      console.log('⚠️  Le token n\'est plus valide. Causes possibles:');
      console.log('   - L\'app a été désinstallée');
      console.log('   - Le token a expiré');
      console.log('   - Le token est d\'un autre environnement (sandbox vs prod)');
    }

    if (error.code === 'messaging/invalid-argument') {
      console.log('');
      console.log('⚠️  Token invalide. Vérifiez le format du token.');
    }

    return false;
  }
}

// Test 2: Envoi au topic "general"
async function testToTopic() {
  console.log('');
  console.log('📢 TEST 2: Envoi au topic "general"...');

  const message = {
    topic: 'general',
    notification: {
      title: '🧪 Test Topic General',
      body: 'Message envoyé au topic general',
    },
    data: {
      type: 'test_topic',
      timestamp: new Date().toISOString(),
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: {
            title: '🧪 Test Topic General',
            body: 'Message envoyé au topic general',
          },
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Succès! Message ID:', response);
    return true;
  } catch (error) {
    console.log('❌ Erreur:', error.code);
    console.log('   Message:', error.message);
    return false;
  }
}

// Test 3: Vérifier les infos du token
async function getTokenInfo() {
  console.log('');
  console.log('ℹ️  TEST 3: Vérification des infos du token...');

  // Note: Cette API n'est pas disponible dans firebase-admin standard
  // On peut seulement vérifier si le token est valide en essayant d'envoyer
  console.log('   (Les infos détaillées nécessitent l\'API Instance ID)');
}

// Exécuter les tests
async function runTests() {
  const result1 = await testDirectToDevice();
  const result2 = await testToTopic();
  await getTokenInfo();

  console.log('');
  console.log('==========================');
  console.log('RÉSUMÉ:');
  console.log('  Test direct device:', result1 ? '✅ OK' : '❌ ÉCHOUÉ');
  console.log('  Test topic general:', result2 ? '✅ OK' : '❌ ÉCHOUÉ');
  console.log('');

  if (!result1 && result2) {
    console.log('💡 Le topic fonctionne mais pas le device direct.');
    console.log('   → Problème avec le token spécifique');
  } else if (result1 && !result2) {
    console.log('💡 Le device direct fonctionne mais pas le topic.');
    console.log('   → Problème de souscription au topic');
  } else if (!result1 && !result2) {
    console.log('💡 Aucun test n\'a fonctionné.');
    console.log('   → Vérifiez la configuration APNs dans Firebase Console');
  } else {
    console.log('💡 Les deux tests ont réussi côté serveur!');
    console.log('   → Si vous ne recevez pas les notifs, le problème est côté iOS/APNs');
  }

  process.exit(0);
}

runTests();
