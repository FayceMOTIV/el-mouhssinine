import * as Updates from 'expo-updates';
import { AppState } from 'react-native';

/**
 * Mises à jour OTA automatiques (EAS Update) — best practice "seamless".
 *
 * Stratégie :
 * - Au lancement ET à chaque retour au premier plan, on vérifie en SILENCE.
 * - Si une mise à jour existe, on la télécharge en arrière-plan.
 * - Elle s'applique AUTOMATIQUEMENT au prochain démarrage de l'app (cold start),
 *   sans pop-up, sans rechargement brutal en pleine utilisation.
 *
 * Résultat : l'utilisateur n'a RIEN à faire. Les correctifs JS/contenu arrivent
 * tout seuls (sans passer par l'App Store / Google Play).
 *
 * En __DEV__ : désactivé.
 */
async function checkAndFetch(): Promise<void> {
  if (__DEV__) return;
  try {
    if (!Updates.isEnabled) return;
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Pas de reloadAsync ici : l'update téléchargée s'applique au prochain
      // démarrage de l'app, ce qui évite un rechargement gênant en pleine session.
    }
  } catch (error) {
    // Silencieux — ne jamais bloquer l'app si le réseau/check échoue.
    console.log('[OTA] Update check failed:', error);
  }
}

let appStateSub: { remove: () => void } | null = null;

export async function checkForOTAUpdate(): Promise<void> {
  // 1) Check au lancement
  await checkAndFetch();

  // 2) Check aussi quand l'utilisateur revient dans l'app (retour premier plan)
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAndFetch();
      }
    });
  }
}
