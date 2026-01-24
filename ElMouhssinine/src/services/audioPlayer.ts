import TrackPlayer, { Capability, State, AppKilledPlaybackBehavior } from 'react-native-track-player';

let isSetup = false;
let setupPromise: Promise<void> | null = null;

export const setupPlayer = async () => {
  // Si déjà configuré, retourner immédiatement
  if (isSetup) return;

  // Si une configuration est en cours, attendre qu'elle se termine
  if (setupPromise) {
    await setupPromise;
    return;
  }

  setupPromise = (async () => {
    try {
      // Vérifier si le player est déjà initialisé
      try {
        await TrackPlayer.getActiveTrackIndex();
        isSetup = true;
        console.log('[AudioPlayer] Player déjà initialisé');
        return;
      } catch {
        // Le player n'est pas encore initialisé, continuer
      }

      await TrackPlayer.setupPlayer({
        waitForBuffer: true,
      });

      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SeekTo,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.Stop],
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
      });

      isSetup = true;
      console.log('[AudioPlayer] Player configuré avec succès');
    } catch (error: any) {
      // Erreur "player already initialized" = OK
      if (error?.message?.includes('already been initialized')) {
        isSetup = true;
        console.log('[AudioPlayer] Player était déjà initialisé');
      } else {
        console.error('[AudioPlayer] Erreur setup:', error);
        throw error;
      }
    }
  })();

  await setupPromise;
  setupPromise = null;
};

export const playAudio = async (url: string, title: string, artist: string = 'Coran') => {
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
    console.log('[AudioPlayer] Lecture démarrée:', title);
  } catch (error) {
    console.error('[AudioPlayer] Erreur playAudio:', error);
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
    console.log('Error stopping audio:', error);
  }
};

export const getIsPlaying = async () => {
  try {
    const state = await TrackPlayer.getState();
    return state === State.Playing;
  } catch {
    return false;
  }
};
