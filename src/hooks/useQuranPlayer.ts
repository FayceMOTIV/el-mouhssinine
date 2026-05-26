import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let TrackPlayer: any = null;
let State: any = {};
let Event: any = {};

try {
  const mod = require('react-native-track-player');
  TrackPlayer = mod.default;
  State = mod.State;
  Event = mod.Event;
} catch {}
import { setupPlayer, resetPlayer } from '../services/audioPlayer';
import { getVerseAudioUrl, reciters } from '../services/quranApi';

interface Verse {
  number: number;
  numberInSurah: number;
  text: string;
  translation?: string;
}

interface UseQuranPlayerProps {
  verses: Verse[];
  reciterCode: string;
  surahNumber: number;
  surahName?: string;
  onVerseChange?: (index: number) => void;
}

export type RepeatMode = 'none' | 'verse' | 'surah' | 'range';
export type PlaybackSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5;

const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1.0, 1.25, 1.5];
const STORAGE_KEY_PREFIX = 'quran_progress_';
// Timeout de sécurité : si isLoadingTrackRef reste bloqué > 8s, on force le reset
const LOADING_TIMEOUT_MS = 8000;

// Build 249 - Fix: deadlock isLoadingTrack + iOS audio + error recovery robuste
export const useQuranPlayer = ({
  verses,
  reciterCode,
  surahNumber,
  surahName,
  onVerseChange,
}: UseQuranPlayerProps) => {
  // === États ===
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [repeatCount, setRepeatCount] = useState(0);
  const [maxRepeat, setMaxRepeat] = useState(3);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [verseProgress, setVerseProgress] = useState(0);

  // === Refs ===
  const versesRef = useRef(verses);
  const reciterCodeRef = useRef(reciterCode);
  const surahNameRef = useRef(surahName);
  const onVerseChangeRef = useRef(onVerseChange);
  const currentVerseIndexRef = useRef(currentVerseIndex);
  const isPlayingRef = useRef(isPlaying);
  const repeatModeRef = useRef(repeatMode);
  const repeatCountRef = useRef(repeatCount);
  const maxRepeatRef = useRef(maxRepeat);
  const rangeStartRef = useRef(rangeStart);
  const rangeEndRef = useRef(rangeEnd);
  const playbackSpeedRef = useRef(playbackSpeed);

  // Guard: empêcher setState sur composant démonté (crash Fabric/New Arch)
  const isMountedRef = useRef(true);
  // Flag pour savoir si on est en train de charger une piste
  const isLoadingTrackRef = useRef(false);
  // Timer de sécurité pour reset isLoadingTrackRef
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag pour bloquer les appels re-entrants à handleTrackEnd
  const isHandlingEndRef = useRef(false);
  // Dernier verset dont la fin a été traitée (empêche double-avancement)
  const lastHandledEndForVerseRef = useRef<number>(-1);
  // Compteur de génération : incrémenté à chaque chargement de piste.
  // Permet de détecter les événements obsolètes (fire du listener précédent
  // après que loadAndPlayVerse a déjà avancé au verset suivant).
  const trackGenRef = useRef(0);

  // Sync refs
  useEffect(() => {
    versesRef.current = verses;
    reciterCodeRef.current = reciterCode;
    surahNameRef.current = surahName;
    onVerseChangeRef.current = onVerseChange;
    currentVerseIndexRef.current = currentVerseIndex;
    isPlayingRef.current = isPlaying;
    repeatModeRef.current = repeatMode;
    repeatCountRef.current = repeatCount;
    maxRepeatRef.current = maxRepeat;
    rangeStartRef.current = rangeStart;
    rangeEndRef.current = rangeEnd;
    playbackSpeedRef.current = playbackSpeed;
  });

  // === Helper: forcer le déblocage de isLoadingTrackRef ===
  const forceUnlockLoading = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    isLoadingTrackRef.current = false;
    if (isMountedRef.current) {
      setIsLoading(false);
    }
  }, []);

  // === Init player ===
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        console.log('[QuranPlayer] Initialisation...');
        const ready = await setupPlayer();
        if (mounted) {
          if (ready) {
            setIsPlayerReady(true);
            console.log('[QuranPlayer] Player prêt');
          } else {
            console.warn('[QuranPlayer] Player non initialisé, retry...');
            await delay(1000);
            const ready2 = await setupPlayer();
            if (mounted) {
              setIsPlayerReady(ready2);
              console.log(
                '[QuranPlayer] Player prêt (2ème tentative):',
                ready2,
              );
            }
          }
        }
      } catch (error) {
        console.error('[QuranPlayer] Erreur init inattendue:', error);
        if (mounted) {
          setIsPlayerReady(false);
        }
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // === EVENT LISTENER pour fin de piste ===
  // PlaybackQueueEnded est le signal fiable sur iOS quand la queue (1 piste) se termine.
  // PlaybackState.Ended est gardé en fallback pour Android.
  useEffect(() => {
    if (!isPlayerReady) return;

    const subs: { remove: () => void }[] = [];
    try {
      // Primaire : PlaybackQueueEnded — fiable sur iOS & Android
      subs.push(
        TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
          if (!isMountedRef.current) return;
          const gen = trackGenRef.current;
          console.log(`[QuranPlayer] PlaybackQueueEnded fired (gen=${gen})`);
          if (!isLoadingTrackRef.current) {
            await handleTrackEnd(gen);
          }
        }),
      );
      // Fallback : PlaybackState.Ended — certaines versions Android l'utilisent
      subs.push(
        TrackPlayer.addEventListener(Event.PlaybackState, async event => {
          if (!isMountedRef.current) return;
          if (event.state === State.Ended && !isLoadingTrackRef.current) {
            const gen = trackGenRef.current;
            console.log(`[QuranPlayer] PlaybackState.Ended fired (gen=${gen})`);
            await handleTrackEnd(gen);
          }
        }),
      );
      // Listener d'erreur : log + déblocage
      subs.push(
        TrackPlayer.addEventListener(Event.PlaybackError, error => {
          console.error('[QuranPlayer] PlaybackError:', error);
          forceUnlockLoading();
          if (isMountedRef.current) setIsPlaying(false);
        }),
      );
    } catch (e) {
      console.error('[QuranPlayer] Erreur addEventListener:', e);
    }

    return () => {
      subs.forEach(s => {
        try {
          s.remove();
        } catch {}
      });
    };
  }, [isPlayerReady]);

  // === POLLING pour progression UI (barre de progression fluide) ===
  // Compteur pour éviter de couper isPlaying sur un état transitoire
  const stoppedCountRef = useRef(0);

  useEffect(() => {
    if (!isPlayerReady) return;

    const pollInterval = setInterval(async () => {
      // Ne rien faire si le composant est démonté (crash Fabric)
      if (!isMountedRef.current) return;
      if (isLoadingTrackRef.current) {
        stoppedCountRef.current = 0;
        return;
      }

      try {
        const state = await TrackPlayer.getPlaybackState();
        if (!isMountedRef.current) return;
        const currentState = state.state;

        if (currentState === State.Playing) {
          stoppedCountRef.current = 0;
          if (!isPlayingRef.current) {
            setIsPlaying(true);
          }
          setIsLoading(false);

          const position = await TrackPlayer.getPosition();
          const duration = await TrackPlayer.getDuration();

          if (duration > 0 && isMountedRef.current) {
            setVerseProgress(position / duration);
          }
        } else if (currentState === State.Paused) {
          stoppedCountRef.current = 0;
          setIsLoading(false);
          if (isPlayingRef.current && !isLoadingTrackRef.current) {
            setIsPlaying(false);
          }
        } else if (
          currentState === State.Stopped ||
          currentState === State.None ||
          currentState === State.Ended
        ) {
          // Si on est en train de charger une piste, ne rien faire :
          // l'état Stopped/None est transitoire (reset → add → play)
          if (isLoadingTrackRef.current) {
            stoppedCountRef.current = 0;
            return;
          }
          // Attendre 3 polls consécutifs (~600ms) avant de couper isPlaying
          stoppedCountRef.current++;
          if (stoppedCountRef.current >= 3 && isPlayingRef.current) {
            setIsPlaying(false);
          }
          setIsLoading(false);
        } else if (
          currentState === State.Buffering ||
          currentState === State.Loading
        ) {
          stoppedCountRef.current = 0;
          setIsLoading(true);
        } else if (currentState === State.Ready) {
          stoppedCountRef.current = 0;
          setIsLoading(false);
        } else if (currentState === State.Error) {
          stoppedCountRef.current = 0;
          setIsLoading(false);
          setIsPlaying(false);
          forceUnlockLoading();
        }
      } catch {}
    }, 200);

    return () => clearInterval(pollInterval);
  }, [isPlayerReady]);

  // === Gestion fin de piste ===
  const handleTrackEnd = async (triggerGen?: number) => {
    if (!isMountedRef.current) return;
    if (isLoadingTrackRef.current) return;
    if (isHandlingEndRef.current) return;

    // Si la génération a changé depuis que l'événement a été capturé,
    // c'est un événement obsolète (ex: PlaybackState.Ended qui fire après
    // que PlaybackQueueEnded a déjà avancé au verset suivant).
    if (triggerGen !== undefined && triggerGen !== trackGenRef.current) {
      console.log(
        `[QuranPlayer] handleTrackEnd SKIP stale event (triggerGen=${triggerGen} current=${trackGenRef.current})`,
      );
      return;
    }

    isHandlingEndRef.current = true;

    try {
      const idx = currentVerseIndexRef.current;
      const mode = repeatModeRef.current;
      const count = repeatCountRef.current;
      const max = maxRepeatRef.current;

      if (!versesRef.current || versesRef.current.length === 0) return;

      console.log(
        `[QuranPlayer] handleTrackEnd idx=${idx} mode=${mode} count=${count} gen=${trackGenRef.current}`,
      );

      // Empêcher le double-traitement de la fin du même verset
      // (guard : PlaybackQueueEnded + PlaybackState.Ended peuvent fire pour la même piste)
      if (lastHandledEndForVerseRef.current === idx) {
        console.log(
          `[QuranPlayer] handleTrackEnd SKIP (déjà traité pour idx=${idx})`,
        );
        return;
      }
      lastHandledEndForVerseRef.current = idx;

      // Mode répétition verset
      if (mode === 'verse' && count < max) {
        if (isMountedRef.current) setRepeatCount(count + 1);
        await loadAndPlayVerse(idx);
        lastHandledEndForVerseRef.current = -1; // Reset APRÈS chargement pour permettre re-lecture
        return;
      }

      // Mode répétition plage
      if (mode === 'range') {
        if (idx < rangeEndRef.current) {
          await loadAndPlayVerse(idx + 1);
          return;
        } else if (count < max - 1) {
          if (isMountedRef.current) setRepeatCount(count + 1);
          await loadAndPlayVerse(rangeStartRef.current);
          return;
        }
      }

      if (isMountedRef.current) setRepeatCount(0);

      // Passer au verset suivant — lire versesRef.current au point d'usage pour eviter stale closure
      if (idx < versesRef.current.length - 1) {
        await loadAndPlayVerse(idx + 1);
      } else {
        // Fin de sourate
        if (mode === 'surah') {
          await loadAndPlayVerse(0);
        } else {
          if (isMountedRef.current) {
            setIsPlaying(false);
          }
          await saveProgress();
        }
      }
    } finally {
      isHandlingEndRef.current = false;
    }
  };

  // === Charger et jouer un verset ===
  const loadAndPlayVerse = async (index: number): Promise<boolean> => {
    // Si déjà en chargement, forcer le déblocage si ça fait trop longtemps
    // (le timeout se charge du cas normal, ici on protège le cas immédiat)
    if (isLoadingTrackRef.current) {
      console.warn(
        '[QuranPlayer] loadAndPlayVerse bloqué par isLoadingTrackRef, skip',
      );
      return false;
    }

    const versesArray = versesRef.current;

    if (!versesArray || versesArray.length === 0) {
      console.warn('[QuranPlayer] Pas de versets');
      return false;
    }

    if (index < 0 || index >= versesArray.length) {
      console.warn('[QuranPlayer] Index invalide:', index);
      return false;
    }

    // Incrémenter la génération AVANT toute opération async.
    // Les événements capturés avant cet instant seront détectés comme obsolètes.
    trackGenRef.current++;

    // Marquer qu'on charge - synchrone AVANT toute opération async
    isLoadingTrackRef.current = true;
    currentVerseIndexRef.current = index;
    if (isMountedRef.current) {
      setIsLoading(true);
      setVerseProgress(0);
    }

    // Timer de sécurité : si loadAndPlayVerse ne se termine pas en 8s,
    // forcer le déblocage pour permettre un nouvel appel
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = setTimeout(() => {
      if (isLoadingTrackRef.current) {
        console.warn(
          '[QuranPlayer] TIMEOUT: forceUnlock isLoadingTrackRef après 8s',
        );
        isLoadingTrackRef.current = false;
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }, LOADING_TIMEOUT_MS);

    const verse = versesArray[index];
    const audioUrl = getVerseAudioUrl(verse.number, reciterCodeRef.current);
    console.log(
      `[QuranPlayer] loadAndPlayVerse(${index}) verse=${verse.number} url=${audioUrl}`,
    );

    try {
      // S'assurer que le player est initialisé AVANT toute opération
      await setupPlayer();
      // Si le player n'était pas marqué prêt (init effect a échoué), le marquer maintenant
      if (!isPlayerReady && isMountedRef.current) {
        setIsPlayerReady(true);
      }

      // Arrêter tout d'abord
      await TrackPlayer.reset();

      // Attendre que reset se propage
      await delay(50);

      // Ajouter la piste avec metadata pour le lock screen
      const reciterInfo = reciters.find(r => r.id === reciterCodeRef.current);
      const artistName = reciterInfo?.name || reciterCodeRef.current;
      await TrackPlayer.add({
        id: `verse-${verse.number}-${Date.now()}`,
        url: audioUrl,
        title: `${surahNameRef.current || 'Sourate'} - Verset ${
          verse.numberInSurah
        }`,
        artist: artistName,
        artwork: 'https://cdn.islamic.network/quran/images/logo.png',
      });

      // Configurer la vitesse
      await TrackPlayer.setRate(playbackSpeedRef.current);

      // Attendre que la piste soit chargée
      await delay(50);

      // Lancer la lecture
      await TrackPlayer.play();
      console.log(`[QuranPlayer] play() OK pour verset ${verse.numberInSurah}`);

      // Vérifier que la lecture a bien démarré (protection bug iOS #2123)
      await delay(150);
      const stateAfterPlay = await TrackPlayer.getPlaybackState();
      if (stateAfterPlay.state === State.Error) {
        console.error('[QuranPlayer] État Error après play(), retry...');
        // Réessayer une fois
        await TrackPlayer.reset();
        await delay(200);
        await TrackPlayer.add({
          id: `verse-${verse.number}-retry-${Date.now()}`,
          url: audioUrl,
          title: `${surahNameRef.current || 'Sourate'} - Verset ${
            verse.numberInSurah
          }`,
          artist: artistName,
          artwork: 'https://cdn.islamic.network/quran/images/logo.png',
        });
        await delay(50);
        await TrackPlayer.play();
        console.log('[QuranPlayer] Retry play() terminé');
      }

      // Mettre à jour l'état IMMÉDIATEMENT après play()
      if (isMountedRef.current) {
        setCurrentVerseIndex(index);
        setIsPlaying(true);
        setIsLoading(false);
      }
      // Petit délai pour laisser TrackPlayer confirmer State.Playing
      await delay(30);

      // Nettoyer le timeout de sécurité
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      isLoadingTrackRef.current = false;
      if (isMountedRef.current) {
        onVerseChangeRef.current?.(index);
      }

      return true;
    } catch (error) {
      console.error('[QuranPlayer] Erreur lecture:', error);
      // Nettoyer le timeout de sécurité
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      isLoadingTrackRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsPlaying(false);
        Alert.alert(
          'Erreur audio',
          'Impossible de lire ce verset. Vérifiez votre connexion internet.',
          [{ text: 'OK' }],
        );
      }
      return false;
    }
  };

  // === Helper delay ===
  const delay = (ms: number) =>
    new Promise<void>(resolve => setTimeout(() => resolve(), ms));

  // === Sauvegarder progression ===
  const saveProgress = async () => {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEY_PREFIX}${surahNumber}`,
        JSON.stringify({
          verseIndex: currentVerseIndexRef.current,
          timestamp: Date.now(),
        }),
      );
    } catch {}
  };

  // === Actions exposées ===
  const playVerseAtIndex = useCallback(async (index: number) => {
    // Vérifier que les versets sont disponibles
    if (!versesRef.current || versesRef.current.length === 0) {
      console.warn(
        '[QuranPlayer] playVerseAtIndex: pas de versets disponibles',
      );
      return;
    }
    await loadAndPlayVerse(index);
  }, []);

  const play = useCallback(async () => {
    if (isPlayingRef.current) return;

    // Vérifier que les versets sont disponibles
    if (!versesRef.current || versesRef.current.length === 0) {
      console.warn('[QuranPlayer] play: pas de versets disponibles');
      return;
    }

    try {
      // S'assurer que le player est initialisé avant toute opération
      await setupPlayer();

      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Paused) {
        await TrackPlayer.play();
        if (isMountedRef.current) setIsPlaying(true);
      } else {
        await loadAndPlayVerse(currentVerseIndexRef.current);
      }
    } catch (error) {
      console.error(
        '[QuranPlayer] play() erreur, tentative loadAndPlayVerse:',
        error,
      );
      await loadAndPlayVerse(currentVerseIndexRef.current);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await TrackPlayer.pause();
      setIsPlaying(false);
    } catch (error) {
      console.error('[QuranPlayer] Erreur pause:', error);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (isPlayingRef.current) {
      await pause();
    } else {
      await play();
    }
  }, [play, pause]);

  const seekToVerse = useCallback((index: number) => {
    if (index < 0 || index >= versesRef.current.length) return;
    setRepeatCount(0);
    setCurrentVerseIndex(index);
    onVerseChangeRef.current?.(index);
  }, []);

  const nextVerse = useCallback(async () => {
    const idx = currentVerseIndexRef.current;
    if (idx < versesRef.current.length - 1) {
      const nextIdx = idx + 1;
      if (isPlayingRef.current) {
        await loadAndPlayVerse(nextIdx);
      } else {
        setCurrentVerseIndex(nextIdx);
        onVerseChangeRef.current?.(nextIdx);
      }
    }
  }, []);

  const previousVerse = useCallback(async () => {
    const idx = currentVerseIndexRef.current;
    if (idx > 0) {
      const prevIdx = idx - 1;
      if (isPlayingRef.current) {
        await loadAndPlayVerse(prevIdx);
      } else {
        setCurrentVerseIndex(prevIdx);
        onVerseChangeRef.current?.(prevIdx);
      }
    }
  }, []);

  const stop = useCallback(async () => {
    // Incrémenter la génération pour invalider tout événement en cours
    trackGenRef.current++;
    isLoadingTrackRef.current = true;
    try {
      await TrackPlayer.reset();
    } catch {}
    isLoadingTrackRef.current = false;
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    lastHandledEndForVerseRef.current = -1;
    if (isMountedRef.current) {
      setIsPlaying(false);
      setIsLoading(false);
      setCurrentVerseIndex(0);
      setRepeatCount(0);
      setVerseProgress(0);
      onVerseChangeRef.current?.(0);
    }
  }, []);

  const changeSpeed = useCallback(async (speed?: PlaybackSpeed) => {
    const current = playbackSpeedRef.current;
    const newSpeed =
      speed ??
      PLAYBACK_SPEEDS[
        (PLAYBACK_SPEEDS.indexOf(current) + 1) % PLAYBACK_SPEEDS.length
      ];
    setPlaybackSpeed(newSpeed);
    try {
      await TrackPlayer.setRate(newSpeed);
    } catch {}
  }, []);

  const cycleRepeatMode = useCallback(() => {
    const modes: RepeatMode[] = ['none', 'verse', 'surah'];
    const current = repeatModeRef.current;
    const nextIdx = (modes.indexOf(current) + 1) % modes.length;
    setRepeatMode(modes[nextIdx]);
    setRepeatCount(0);
  }, []);

  const setRepeatRange = useCallback((start: number, end: number) => {
    const len = versesRef.current.length;
    setRangeStart(Math.max(0, Math.min(start, len - 1)));
    setRangeEnd(Math.max(0, Math.min(end, len - 1)));
    setRepeatMode('range');
    setRepeatCount(0);
  }, []);

  // Permet de forcer le reciterCode ref AVANT de relancer la lecture
  const updateReciterCode = useCallback((newReciterCode: string) => {
    reciterCodeRef.current = newReciterCode;
  }, []);

  // Cleanup on unmount : marquer démonté + clear timeout
  // Ne PAS reset le player si l'audio joue (permet écoute en arrière-plan)
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      // Ne couper l'audio que s'il n'est pas en train de jouer
      // Cela permet d'écouter le Coran même après avoir quitté l'écran
      if (!isPlayingRef.current) {
        resetPlayer();
      }
    };
  }, []);

  return {
    currentVerseIndex,
    isPlaying,
    isLoading,
    isInitialized: isPlayerReady,
    repeatMode,
    repeatCount,
    maxRepeat,
    playbackSpeed,
    verseProgress,
    rangeStart,
    rangeEnd,
    play,
    pause,
    togglePlayPause,
    playVerseAtIndex,
    seekToVerse,
    nextVerse,
    previousVerse,
    stop,
    saveProgress,
    setRepeatMode,
    setMaxRepeat,
    changeSpeed,
    cycleRepeatMode,
    setRepeatRange,
    updateReciterCode,
  };
};

export default useQuranPlayer;
