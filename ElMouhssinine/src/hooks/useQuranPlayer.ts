import { useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, { Event, State } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupPlayer } from '../services/audioPlayer';

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
  console.log('[useQuranPlayer] Build 205 - Init');

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

  // Refs
  const currentVerseIndexRef = useRef(currentVerseIndex);
  const isPlayingRef = useRef(isPlaying);
  const repeatModeRef = useRef(repeatMode);
  const repeatCountRef = useRef(repeatCount);
  const maxRepeatRef = useRef(maxRepeat);
  const rangeStartRef = useRef(rangeStart);
  const rangeEndRef = useRef(rangeEnd);
  const versesRef = useRef(verses);
  const reciterCodeRef = useRef(reciterCode);
  const playbackSpeedRef = useRef(playbackSpeed);
  const surahNameRef = useRef(surahName);
  const onVerseChangeRef = useRef(onVerseChange);

  // Flag pour ignorer les événements pendant le changement de piste
  const isChangingTrackRef = useRef(false);

  // Mettre à jour les refs
  useEffect(() => {
    currentVerseIndexRef.current = currentVerseIndex;
    isPlayingRef.current = isPlaying;
    repeatModeRef.current = repeatMode;
    repeatCountRef.current = repeatCount;
    maxRepeatRef.current = maxRepeat;
    rangeStartRef.current = rangeStart;
    rangeEndRef.current = rangeEnd;
    versesRef.current = verses;
    reciterCodeRef.current = reciterCode;
    playbackSpeedRef.current = playbackSpeed;
    surahNameRef.current = surahName;
    onVerseChangeRef.current = onVerseChange;
  });

  // Initialiser le player
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        console.log('[useQuranPlayer] Setup player...');
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

  // Polling pour la progression
  useEffect(() => {
    if (!isPlaying || !isPlayerReady) {
      return;
    }

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
    }, 250);

    return () => clearInterval(interval);
  }, [isPlaying, isPlayerReady]);

  // Écouter les événements TrackPlayer
  useEffect(() => {
    if (!isPlayerReady) {
      return;
    }

    console.log('[useQuranPlayer] Ajout event listeners...');

    const onPlaybackState = TrackPlayer.addEventListener(
      Event.PlaybackState,
      async (event) => {
        const state = event.state;
        console.log('[useQuranPlayer] State:', state, 'isChangingTrack:', isChangingTrackRef.current);

        // Ignorer les événements pendant le changement de piste
        if (isChangingTrackRef.current) {
          return;
        }

        if (state === State.Playing) {
          setIsPlaying(true);
          setIsLoading(false);
        } else if (state === State.Paused) {
          setIsPlaying(false);
        } else if (state === State.Buffering || state === State.Loading) {
          setIsLoading(true);
        } else if (state === State.Ready) {
          setIsLoading(false);
        } else if (state === State.Stopped || state === State.None) {
          setIsPlaying(false);
          setIsLoading(false);
        } else if (state === State.Ended) {
          console.log('[useQuranPlayer] Verset terminé naturellement');
          handleVerseEnded();
        }
      }
    );

    const onPlaybackError = TrackPlayer.addEventListener(
      Event.PlaybackError,
      (event) => {
        console.error('[useQuranPlayer] Erreur playback:', event);
        isChangingTrackRef.current = false;
        setIsLoading(false);
        setIsPlaying(false);
      }
    );

    return () => {
      onPlaybackState.remove();
      onPlaybackError.remove();
    };
  }, [isPlayerReady]);

  // Gérer la fin d'un verset
  const handleVerseEnded = async () => {
    const currentIdx = currentVerseIndexRef.current;
    const verses = versesRef.current;
    const mode = repeatModeRef.current;
    const count = repeatCountRef.current;
    const max = maxRepeatRef.current;

    console.log('[useQuranPlayer] handleVerseEnded, index:', currentIdx, 'mode:', mode);

    // Mode répétition verset
    if (mode === 'verse' && count < max - 1) {
      setRepeatCount(count + 1);
      await playVerseInternal(currentIdx);
      return;
    }

    // Mode répétition plage
    if (mode === 'range') {
      if (currentIdx < rangeEndRef.current) {
        await playVerseInternal(currentIdx + 1);
        return;
      } else if (count < max - 1) {
        setRepeatCount(count + 1);
        await playVerseInternal(rangeStartRef.current);
        return;
      }
    }

    setRepeatCount(0);

    // Passer au verset suivant
    if (currentIdx < verses.length - 1) {
      await playVerseInternal(currentIdx + 1);
    } else {
      // Fin de sourate
      if (mode === 'surah') {
        await playVerseInternal(0);
      } else {
        console.log('[useQuranPlayer] Fin de sourate');
        setIsPlaying(false);
        try {
          await AsyncStorage.setItem(
            `${STORAGE_KEY_PREFIX}${surahNumber}`,
            JSON.stringify({ verseIndex: currentIdx, timestamp: Date.now() })
          );
        } catch {}
      }
    }
  };

  // Jouer un verset
  const playVerseInternal = async (index: number): Promise<boolean> => {
    const verses = versesRef.current;

    if (!verses || verses.length === 0) {
      console.warn('[useQuranPlayer] Pas de versets');
      return false;
    }

    if (index < 0 || index >= verses.length) {
      console.warn('[useQuranPlayer] Index invalide:', index);
      return false;
    }

    const verse = verses[index];
    const audioUrl = `https://cdn.islamic.network/quran/audio/128/${reciterCodeRef.current}/${verse.number}.mp3`;

    console.log('[useQuranPlayer] Lecture verset', verse.numberInSurah, 'URL:', audioUrl);

    try {
      // Marquer qu'on change de piste (ignorer les événements)
      isChangingTrackRef.current = true;
      setIsLoading(true);
      setVerseProgress(0);

      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: `verse-${verse.number}`,
        url: audioUrl,
        title: `${surahNameRef.current || 'Sourate'} - Verset ${verse.numberInSurah}`,
        artist: reciterCodeRef.current,
      });
      await TrackPlayer.setRate(playbackSpeedRef.current);

      // Fin du changement de piste
      isChangingTrackRef.current = false;

      await TrackPlayer.play();

      setCurrentVerseIndex(index);
      setIsPlaying(true);
      setIsLoading(false);
      onVerseChangeRef.current?.(index);

      console.log('[useQuranPlayer] Lecture démarrée');
      return true;
    } catch (error) {
      console.error('[useQuranPlayer] Erreur lecture:', error);
      isChangingTrackRef.current = false;
      setIsLoading(false);
      setIsPlaying(false);
      return false;
    }
  };

  // Actions exposées
  const playVerseAtIndex = useCallback(async (index: number) => {
    console.log('[useQuranPlayer] playVerseAtIndex:', index);
    await playVerseInternal(index);
  }, []);

  const play = useCallback(async () => {
    if (isPlayingRef.current) return;

    try {
      const playbackState = await TrackPlayer.getPlaybackState();
      if (playbackState.state === State.Paused) {
        await TrackPlayer.play();
        setIsPlaying(true);
      } else {
        await playVerseInternal(currentVerseIndexRef.current);
      }
    } catch {
      await playVerseInternal(currentVerseIndexRef.current);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await TrackPlayer.pause();
      setIsPlaying(false);
    } catch (error) {
      console.error('[useQuranPlayer] Erreur pause:', error);
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
    const currentIdx = currentVerseIndexRef.current;
    if (currentIdx < versesRef.current.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentVerseIndex(nextIdx);
      onVerseChangeRef.current?.(nextIdx);
      if (isPlayingRef.current) {
        await playVerseInternal(nextIdx);
      }
    }
  }, []);

  const previousVerse = useCallback(async () => {
    const currentIdx = currentVerseIndexRef.current;
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentVerseIndex(prevIdx);
      onVerseChangeRef.current?.(prevIdx);
      if (isPlayingRef.current) {
        await playVerseInternal(prevIdx);
      }
    }
  }, []);

  const stop = useCallback(async () => {
    isChangingTrackRef.current = true;
    try {
      await TrackPlayer.reset();
    } catch {}
    isChangingTrackRef.current = false;
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentVerseIndex(0);
    setRepeatCount(0);
    setVerseProgress(0);
    onVerseChangeRef.current?.(0);
  }, []);

  const changeSpeed = useCallback(async (speed?: PlaybackSpeed) => {
    const currentSpeed = playbackSpeedRef.current;
    const newSpeed = speed ?? PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(currentSpeed) + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackSpeed(newSpeed);
    try {
      await TrackPlayer.setRate(newSpeed);
    } catch {}
  }, []);

  const cycleRepeatMode = useCallback(() => {
    const modes: RepeatMode[] = ['none', 'verse', 'surah'];
    const currentMode = repeatModeRef.current;
    const nextIdx = (modes.indexOf(currentMode) + 1) % modes.length;
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

  const saveProgress = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEY_PREFIX}${surahNumber}`,
        JSON.stringify({ verseIndex: currentVerseIndexRef.current, timestamp: Date.now() })
      );
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
