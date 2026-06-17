import * as Updates from 'expo-updates';
import { AppState } from 'react-native';

async function fetchAndApply(reloadImmediately: boolean): Promise<void> {
  if (__DEV__) return;
  try {
    if (!Updates.isEnabled) return;
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew && reloadImmediately) {
        await Updates.reloadAsync();
      }
    }
  } catch (error) {
    console.log('[OTA] Update check failed:', error);
  }
}

let appStateSub: { remove: () => void } | null = null;

export async function checkForOTAUpdate(): Promise<void> {
  // Au lancement : telecharge + applique immediatement (reload transparent)
  await fetchAndApply(true);

  // En arriere-plan : telecharge seulement, applique au prochain cold start
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchAndApply(false);
      }
    });
  }
}
