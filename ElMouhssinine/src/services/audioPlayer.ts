import TrackPlayer, {
  Capability,
  State,
  AppKilledPlaybackBehavior,
  IOSCategoryMode,
  IOSCategory,
  IOSCategoryOptions,
} from 'react-native-track-player';
import { logger } from '../utils';

let isSetup = false;
let setupPromise: Promise<void> | null = null;

// Build 249 - Fix: deadlock setupPromise + iOS audio category explicite
export const setupPlayer = async (): Promise<boolean> => {
  // Si déjà configuré, retourner immédiatement
  if (isSetup) return true;

  // Si une configuration est en cours, attendre qu'elle se termine
  if (setupPromise) {
    try {
      await setupPromise;
    } catch {
      // La tentative précédente a échoué, on va réessayer
      setupPromise = null;
    }
    if (isSetup) return true;
  }

  setupPromise = (async () => {
    try {
      // Vérifier si le player est déjà initialisé
      try {
        await TrackPlayer.getActiveTrackIndex();
        isSetup = true;
        logger.log('[AudioPlayer] Player déjà initialisé');
        return;
      } catch {
        // Le player n'est pas encore initialisé, continuer
      }

      await TrackPlayer.setupPlayer({
        waitForBuffer: true,
        // iOS: catégorie Playback pour que l'audio joue même en mode silencieux
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.SpokenAudio,
        iosCategoryOptions: [
          IOSCategoryOptions.AllowAirPlay,
          IOSCategoryOptions.AllowBluetooth,
        ],
      });

      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SeekTo,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
      });

      isSetup = true;
      logger.log('[AudioPlayer] Player configuré avec succès');
    } catch (error) {
      const err = error as Error;
      // Erreur "player already initialized" = OK
      if (err?.message?.includes('already been initialized')) {
        isSetup = true;
        logger.log('[AudioPlayer] Player était déjà initialisé');
      } else {
        logger.error('[AudioPlayer] Erreur setup:', error);
        // Ne pas throw - laisser le player dans un état non-initialisé
        // useQuranPlayer gérera isPlayerReady=false
        return;
      }
    }
  })();

  try {
    await setupPromise;
  } finally {
    // TOUJOURS nettoyer setupPromise, même en cas d'erreur
    // pour éviter un deadlock permanent
    setupPromise = null;
  }
  return isSetup;
};

export const playAudio = async (
  url: string,
  title: string,
  artist: string = 'Coran',
) => {
  try {
    await setupPlayer();

    // Reset et ajouter la nouvelle piste
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: 'current',
      url: url,
      title: title,
      artist: artist,
    });

    // Petit délai pour s'assurer que la piste est chargée
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    await TrackPlayer.play();
    logger.log('[AudioPlayer] Lecture démarrée:', title);
  } catch (error) {
    logger.error('[AudioPlayer] Erreur playAudio:', error);
    throw error;
  }
};

export const pauseAudio = async () => {
  await TrackPlayer.pause();
};

export const stopAudio = async () => {
  try {
    await TrackPlayer.stop();
    await TrackPlayer.reset();
  } catch (error) {
    logger.error('Error stopping audio:', error);
  }
};

export const getIsPlaying = async () => {
  try {
    const state = await TrackPlayer.getPlaybackState();
    return state.state === State.Playing;
  } catch {
    return false;
  }
};

/**
 * Réinitialise l'état du player pour éviter les crashs "already initialized"
 * lors du retour sur l'écran Coran après navigation.
 * Appeler dans le cleanup de useEffect du composant Coran.
 */
export const resetPlayer = async () => {
  try {
    await TrackPlayer.reset();
  } catch {
    // Ignorer si le player n'est pas initialisé
  }
  // NE PAS remettre isSetup=false : TrackPlayer.reset() ne détruit pas
  // le player natif, il vide seulement la queue. Le player reste initialisé.
  // Mettre isSetup=false causerait un double setupPlayer() → crash.
};
