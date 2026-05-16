import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

/**
 * Vérifie si une mise à jour OTA est disponible au lancement de l'app.
 * - En mode __DEV__ : ne fait rien
 * - En production : check silencieux, télécharge en arrière-plan, propose le redémarrage
 */
export async function checkForOTAUpdate(): Promise<void> {
  if (__DEV__) return;

  try {
    if (!Updates.isEnabled) return;
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();

      Alert.alert(
        'Mise à jour disponible',
        'Une amélioration est disponible. Redémarrer maintenant ?',
        [
          { text: 'Plus tard', style: 'cancel' },
          {
            text: 'Redémarrer',
            onPress: () => Updates.reloadAsync(),
          },
        ],
      );
    }
  } catch (error) {
    // Silencieux — ne pas bloquer l'app si le check échoue
    console.log('[OTA] Update check failed:', error);
  }
}
