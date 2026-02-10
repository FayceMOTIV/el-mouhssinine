import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupPlayer } from '../services/audioPlayer';

// Import TrackPlayer avec protection
let TrackPlayer: any = null;
let Event: any = {};
let State: any = {};

try {
  const TP = require('react-native-track-player');
  TrackPlayer = TP.default || TP;
  Event = TP.Event || {};
  State = TP.State || {};
  console.log('[useQuranPlayer] TrackPlayer importé avec succès');
} catch (e) {
  console.error('[useQuranPlayer] ERREUR import TrackPlayer:', e);
}

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

export const useQuranPlayer = ({
  verses,
  reciterCode,
  surahNumber,
  surahName,
  onVerseChange
}: UseQuranPlayerProps) => {
  // Log de version pour debug
  console.log('[useQuranPlayer] Build 202 - Hook initialisé');

  // États
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

  // Refs pour valeurs actuelles (évite les closures périmées)
  const stateRef = useRef({
    verses,
    currentVerseIndex,
    isPlaying,
    repeatMode,
    repeatCount,
    maxRepeat,
    rangeStart,
    rangeEnd,
    reciterCode,
    playbackSpeed,
    surahName,
  });

  // Mettre à jour le ref à chaque changement
  useEffect(() => {
    stateRef.current = {
      verses,
      currentVerseIndex,
      isPlaying,
      repeatMode,
      repeatCount,
      maxRepeat,
      rangeStart,
      rangeEnd,
      reciterCode,
      playbackSpeed,
      surahName,
    };
  });

  // Ref pour onVerseChange (pour éviter les re-renders)
  const onVerseChangeRef = useRef(onVerseChange);
  useEffect(() => {
    onVerseChangeRef.current = onVerseChange;
  }, [onVerseChange]);

  // Initialiser le player au montage
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        if (!TrackPlayer) {
          console.error('[useQuranPlayer] TrackPlayer non disponible');
          return;
        }
        console.log('[useQuranPlayer] Initialisation...');
        await setupPlayer();
        if (mounted) {
          setIsPlayerReady(true);
          console.log('[useQuranPlayer] Player prêt');
        }
      } catch (error) {
        console.error('[useQuranPlayer] Erreur init:', error);
      }
    };

    init();
    return () => { mounted = false; };
  }, []);

  // Charger la progression sauvegardée
  useEffect(() => {
    if (verses.length > 0 && isPlayerReady) {
      const loadProgress = async () => {
        try {
          const key = `${STORAGE_KEY_PREFIX}${surahNumber}`;
          const saved = await AsyncStorage.getItem(key);
          if (saved) {
            const { verseIndex } = JSON.parse(saved);
            if (verseIndex >= 0 && verseIndex < verses.length) {
              setCurrentVerseIndex(verseIndex);
              onVerseChangeRef.current?.(verseIndex);
            }
          }
        } catch (error) {
          console.error('[useQuranPlayer] Erreur chargement progression:', error);
        }
      };
      loadProgress();
    }
  }, [verses.length, isPlayerReady, surahNumber]);

  // Polling pour la progression audio
  useEffect(() => {
    if (!isPlaying || !isPlayerReady || !TrackPlayer) return;

    const interval = setInterval(async () => {
      try {
        const position = await TrackPlayer.getPosition();
        const duration = await TrackPlayer.getDuration();
        if (duration > 0) {
          setVerseProgress(position / duration);
        }
      } catch {
        // Ignorer
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, isPlayerReady]);

  // Écouter les événements TrackPlayer
  useEffect(() => {
    if (!isPlayerReady || !TrackPlayer || !Event.PlaybackState) {
      console.log('[useQuranPlayer] Skip event listeners - not ready');
      return;
    }

    const subscriptions: Array<{ remove: () => void }> = [];

    try {
      subscriptions.push(
        TrackPlayer.addEventListener(Event.PlaybackState, async (event: any) => {
          try {
            const state = event?.state;

            if (state === State?.Playing) {
              setIsPlaying(true);
              setIsLoading(false);
            } else if (state === State?.Paused) {
              setIsPlaying(false);
            } else if (state === State?.Buffering || state === State?.Loading) {
              setIsLoading(true);
            } else if (state === State?.Stopped || state === State?.None) {
              setIsPlaying(false);
              setIsLoading(false);
            } else if (state === State?.Ended) {
              console.log('[useQuranPlayer] Verset terminé');
              await handleVerseEndedInternal();
            }
          } catch (error) {
            console.error('[useQuranPlayer] Erreur event PlaybackState:', error);
          }
        })
      );

      subscriptions.push(
        TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event: any) => {
          try {
            if (event?.lastTrack && !event?.track && stateRef.current.isPlaying) {
              console.log('[useQuranPlayer] Track terminée');
              await handleVerseEndedInternal();
            }
          } catch (error) {
            console.error('[useQuranPlayer] Erreur event TrackChanged:', error);
          }
        })
      );

      subscriptions.push(
        TrackPlayer.addEventListener(Event.PlaybackError, (event: any) => {
          console.error('[useQuranPlayer] Erreur playback:', event);
          setIsLoading(false);
          setIsPlaying(false);
        })
      );

      console.log('[useQuranPlayer] Event listeners ajoutés');
    } catch (error) {
      console.error('[useQuranPlayer] Erreur ajout event listeners:', error);
    }

    return () => {
      subscriptions.forEach(sub => {
        try {
          sub.remove();
        } catch {}
      });
    };
  }, [isPlayerReady]);

  // Fonction interne pour jouer un verset
  const playVerseInternal = async (index: number): Promise<boolean> => {
    if (!TrackPlayer) {
      console.error('[useQuranPlayer] TrackPlayer non disponible');
      return false;
    }

    const state = stateRef.current;

    if (!state.verses || state.verses.length === 0) {
      console.warn('[useQuranPlayer] Pas de versets');
      return false;
    }

    if (index < 0 || index >= state.verses.length) {
      console.warn('[useQuranPlayer] Index invalide:', index);
      return false;
    }

    const verse = state.verses[index];
    const audioUrl = `https://cdn.islamic.network/quran/audio/128/${state.reciterCode}/${verse.number}.mp3`;

    console.log('[useQuranPlayer] Lecture verset', verse.numberInSurah, 'URL:', audioUrl);

    try {
      setIsLoading(true);
      setVerseProgress(0);

      await setupPlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: `verse-${verse.number}`,
        url: audioUrl,
        title: `${state.surahName || 'Sourate'} - Verset ${verse.numberInSurah}`,
        artist: state.reciterCode,
      });
      await TrackPlayer.setRate(state.playbackSpeed);
      await TrackPlayer.play();

      setCurrentVerseIndex(index);
      setIsPlaying(true);
      setIsLoading(false);
      onVerseChangeRef.current?.(index);

      console.log('[useQuranPlayer] ✅ Lecture démarrée');
      return true;
    } catch (error) {
      console.error('[useQuranPlayer] ❌ Erreur lecture:', error);
      setIsLoading(false);
      setIsPlaying(false);
      return false;
    }
  };

  // Fonction interne pour gérer la fin d'un verset
  const handleVerseEndedInternal = async () => {
    const state = stateRef.current;
    const currentIdx = state.currentVerseIndex;

    // Mode répétition du verset
    if (state.repeatMode === 'verse' && state.repeatCount < state.maxRepeat - 1) {
      setRepeatCount(prev => prev + 1);
      await playVerseInternal(currentIdx);
      return;
    }

    // Mode répétition d'une plage
    if (state.repeatMode === 'range') {
      if (currentIdx < state.rangeEnd) {
        await playVerseInternal(currentIdx + 1);
        return;
      } else if (state.repeatCount < state.maxRepeat - 1) {
        setRepeatCount(prev => prev + 1);
        await playVerseInternal(state.rangeStart);
        return;
      }
    }

    setRepeatCount(0);

    // Passer au verset suivant
    if (currentIdx < state.verses.length - 1) {
      await playVerseInternal(currentIdx + 1);
    } else {
      // Fin de la sourate
      if (state.repeatMode === 'surah') {
        await playVerseInternal(0);
      } else {
        console.log('[useQuranPlayer] Fin de sourate');
        setIsPlaying(false);
        // Sauvegarder
        try {
          const key = `${STORAGE_KEY_PREFIX}${surahNumber}`;
          await AsyncStorage.setItem(key, JSON.stringify({
            verseIndex: currentIdx,
            timestamp: Date.now(),
          }));
        } catch {}
      }
    }
  };

  // Actions exposées
  const playVerseAtIndex = useCallback(async (index: number) => {
    await playVerseInternal(index);
  }, []);

  const play = useCallback(async () => {
    if (stateRef.current.isPlaying) return;
    if (!TrackPlayer) {
      console.error('[useQuranPlayer] play: TrackPlayer non disponible');
      return;
    }

    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state?.state === State?.Paused) {
        await TrackPlayer.play();
        setIsPlaying(true);
      } else {
        await playVerseInternal(stateRef.current.currentVerseIndex);
      }
    } catch {
      await playVerseInternal(stateRef.current.currentVerseIndex);
    }
  }, []);

  const pause = useCallback(async () => {
    if (!TrackPlayer) return;
    try {
      await TrackPlayer.pause();
      setIsPlaying(false);
    } catch (error) {
      console.error('[useQuranPlayer] Erreur pause:', error);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (stateRef.current.isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [play, pause]);

  const seekToVerse = useCallback((index: number) => {
    const state = stateRef.current;
    if (!state.verses || index < 0 || index >= state.verses.length) return;

    setRepeatCount(0);
    setCurrentVerseIndex(index);
    onVerseChangeRef.current?.(index);
  }, []);

  const nextVerse = useCallback(async () => {
    const state = stateRef.current;
    if (state.currentVerseIndex < state.verses.length - 1) {
      const nextIdx = state.currentVerseIndex + 1;
      setCurrentVerseIndex(nextIdx);
      onVerseChangeRef.current?.(nextIdx);
      if (state.isPlaying) {
        await playVerseInternal(nextIdx);
      }
    }
  }, []);

  const previousVerse = useCallback(async () => {
    const state = stateRef.current;
    if (state.currentVerseIndex > 0) {
      const prevIdx = state.currentVerseIndex - 1;
      setCurrentVerseIndex(prevIdx);
      onVerseChangeRef.current?.(prevIdx);
      if (state.isPlaying) {
        await playVerseInternal(prevIdx);
      }
    }
  }, []);

  const stop = useCallback(async () => {
    if (TrackPlayer) {
      try {
        await TrackPlayer.reset();
      } catch {}
    }
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentVerseIndex(0);
    setRepeatCount(0);
    setVerseProgress(0);
    onVerseChangeRef.current?.(0);
  }, []);

  const changeSpeed = useCallback(async (speed?: PlaybackSpeed) => {
    const newSpeed = speed ?? PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(stateRef.current.playbackSpeed) + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackSpeed(newSpeed);
    if (TrackPlayer) {
      try {
        await TrackPlayer.setRate(newSpeed);
      } catch {}
    }
  }, []);

  const cycleRepeatMode = useCallback(() => {
    const modes: RepeatMode[] = ['none', 'verse', 'surah'];
    const nextIdx = (modes.indexOf(stateRef.current.repeatMode) + 1) % modes.length;
    setRepeatMode(modes[nextIdx]);
    setRepeatCount(0);
  }, []);

  const setRepeatRange = useCallback((start: number, end: number) => {
    const len = stateRef.current.verses.length;
    setRangeStart(Math.max(0, Math.min(start, len - 1)));
    setRangeEnd(Math.max(0, Math.min(end, len - 1)));
    setRepeatMode('range');
    setRepeatCount(0);
  }, []);

  const saveProgress = useCallback(async () => {
    try {
      const key = `${STORAGE_KEY_PREFIX}${surahNumber}`;
      await AsyncStorage.setItem(key, JSON.stringify({
        verseIndex: stateRef.current.currentVerseIndex,
        timestamp: Date.now(),
      }));
    } catch {}
  }, [surahNumber]);

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
  };
};

export default useQuranPlayer;
