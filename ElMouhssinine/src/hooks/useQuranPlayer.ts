import { useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, { State, Event } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupPlayer } from '../services/audioPlayer';
import { getVerseAudioUrl } from '../services/quranApi';

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

// Build 210 - Fix race condition + guard loadAndPlayVerse concurrent
export const useQuranPlayer = ({
  verses,
  reciterCode,
  surahNumber,
  surahName,
  onVerseChange
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

  // Flag pour savoir si on est en train de charger une piste
  const isLoadingTrackRef = useRef(false);
  // Flag pour bloquer les appels re-entrants à handleTrackEnd
  const isHandlingEndRef = useRef(false);
  // Dernier verset dont la fin a été traitée (empêche double-avancement)
  const lastHandledEndForVerseRef = useRef<number>(-1);

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

  // === Init player ===
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        console.log('[QuranPlayer] Initialisation...');
        await setupPlayer();
        if (mounted) {
          setIsPlayerReady(true);
          console.log('[QuranPlayer] Player prêt');
        }
      } catch (error) {
        console.error('[QuranPlayer] Erreur init:', error);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // === EVENT LISTENER pour fin de piste ===
  // Seul PlaybackState.Ended est utilisé pour avancer au verset suivant.
  // PlaybackActiveTrackChanged est ignoré pour éviter les double-avancement.
  useEffect(() => {
    if (!isPlayerReady) return;

    const subs: { remove: () => void }[] = [];
    try {
      subs.push(
        TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
          if (event.state === State.Ended && !isLoadingTrackRef.current) {
            await handleTrackEnd();
          }
        })
      );
    } catch {}

    return () => {
      subs.forEach(s => { try { s.remove(); } catch {} });
    };
  }, [isPlayerReady]);

  // === POLLING pour progression UI (barre de progression fluide) ===
  useEffect(() => {
    if (!isPlayerReady) return;

    const pollInterval = setInterval(async () => {
      if (isLoadingTrackRef.current) return;

      try {
        const state = await TrackPlayer.getPlaybackState();
        const currentState = state.state;

        if (currentState === State.Playing) {
          if (!isPlayingRef.current) {
            setIsPlaying(true);
            setIsLoading(false);
          }

          const position = await TrackPlayer.getPosition();
          const duration = await TrackPlayer.getDuration();

          if (duration > 0) {
            setVerseProgress(position / duration);
          }
        } else if (currentState === State.Paused) {
          if (isPlayingRef.current && !isLoadingTrackRef.current) {
            setIsPlaying(false);
          }
        } else if (currentState === State.Stopped || currentState === State.None) {
          if (isPlayingRef.current && !isLoadingTrackRef.current) {
            setIsPlaying(false);
          }
        } else if (currentState === State.Buffering || currentState === State.Loading) {
          setIsLoading(true);
        } else if (currentState === State.Ready) {
          setIsLoading(false);
        }
      } catch {}
    }, 200);

    return () => clearInterval(pollInterval);
  }, [isPlayerReady]);

  // === Gestion fin de piste ===
  const handleTrackEnd = async () => {
    if (isLoadingTrackRef.current) return;
    if (isHandlingEndRef.current) return;
    isHandlingEndRef.current = true;

    try {
      const idx = currentVerseIndexRef.current;
      const mode = repeatModeRef.current;
      const count = repeatCountRef.current;
      const max = maxRepeatRef.current;
      const versesArray = versesRef.current;

      // Empêcher le double-traitement de la fin du même verset
      // (guard supplémentaire au cas où PlaybackState.Ended fire 2 fois)
      if (lastHandledEndForVerseRef.current === idx && mode !== 'verse') {
        return; // Déjà traité, ne pas avancer une 2ème fois
      }
      lastHandledEndForVerseRef.current = idx;

      // Mode répétition verset
      if (mode === 'verse' && count < max) {
        setRepeatCount(count + 1);
        lastHandledEndForVerseRef.current = -1; // Reset pour permettre re-lecture
        await loadAndPlayVerse(idx);
        return;
      }

      // Mode répétition plage
      if (mode === 'range') {
        if (idx < rangeEndRef.current) {
          await loadAndPlayVerse(idx + 1);
          return;
        } else if (count < max - 1) {
          setRepeatCount(count + 1);
          await loadAndPlayVerse(rangeStartRef.current);
          return;
        }
      }

      setRepeatCount(0);

      // Passer au verset suivant
      if (idx < versesArray.length - 1) {
        await loadAndPlayVerse(idx + 1);
      } else {
        // Fin de sourate
        if (mode === 'surah') {
          await loadAndPlayVerse(0);
        } else {
          setIsPlaying(false);
          await saveProgress();
        }
      }
    } finally {
      isHandlingEndRef.current = false;
    }
  };

  // === Charger et jouer un verset ===
  const loadAndPlayVerse = async (index: number): Promise<boolean> => {
    if (isLoadingTrackRef.current) return false;

    const versesArray = versesRef.current;

    if (!versesArray || versesArray.length === 0) {
      console.warn('[QuranPlayer] Pas de versets');
      return false;
    }

    if (index < 0 || index >= versesArray.length) {
      console.warn('[QuranPlayer] Index invalide:', index);
      return false;
    }

    // Marquer qu'on charge - synchrone AVANT toute opération async
    isLoadingTrackRef.current = true;
    currentVerseIndexRef.current = index;
    setIsLoading(true);
    setVerseProgress(0);

    const verse = versesArray[index];
    const audioUrl = getVerseAudioUrl(verse.number, reciterCodeRef.current);

    // Chargement verset

    try {
      // Arrêter tout d'abord
      await TrackPlayer.reset();

      // Attendre un peu
      await delay(150);

      // Ajouter la piste
      await TrackPlayer.add({
        id: `verse-${verse.number}-${Date.now()}`,
        url: audioUrl,
        title: `${surahNameRef.current || 'Sourate'} - Verset ${verse.numberInSurah}`,
        artist: reciterCodeRef.current,
      });

      // Configurer la vitesse
      await TrackPlayer.setRate(playbackSpeedRef.current);

      // Attendre encore un peu que la piste soit prête
      await delay(100);

      // Lancer la lecture
      await TrackPlayer.play();

      // Mettre à jour l'état
      // On ne reset PAS lastHandledEndForVerseRef à -1, on le met à l'index
      // précédent pour que tout événement retardataire du verset précédent soit ignoré.
      // Il sera autorisé à fire pour CE verset (index) quand il se terminera.
      // Pas de reset nécessaire : la condition L:196 vérifie === idx, pas !== -1.
      setCurrentVerseIndex(index);
      setIsPlaying(true);
      setIsLoading(false);
      isLoadingTrackRef.current = false;
      onVerseChangeRef.current?.(index);

      return true;
    } catch (error) {
      console.error('[QuranPlayer] Erreur lecture:', error);
      isLoadingTrackRef.current = false;
      setIsLoading(false);
      setIsPlaying(false);
      return false;
    }
  };

  // === Helper delay ===
  const delay = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms));

  // === Sauvegarder progression ===
  const saveProgress = async () => {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEY_PREFIX}${surahNumber}`,
        JSON.stringify({ verseIndex: currentVerseIndexRef.current, timestamp: Date.now() })
      );
    } catch {}
  };

  // === Actions exposées ===
  const playVerseAtIndex = useCallback(async (index: number) => {
    // playVerseAtIndex
    await loadAndPlayVerse(index);
  }, []);

  const play = useCallback(async () => {
    // play
    if (isPlayingRef.current) return;

    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Paused) {
        await TrackPlayer.play();
        setIsPlaying(true);
      } else {
        await loadAndPlayVerse(currentVerseIndexRef.current);
      }
    } catch {
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
    // togglePlayPause
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
    // stop
    isLoadingTrackRef.current = true;
    try {
      await TrackPlayer.reset();
    } catch {}
    isLoadingTrackRef.current = false;
    lastHandledEndForVerseRef.current = -1;
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentVerseIndex(0);
    setRepeatCount(0);
    setVerseProgress(0);
    onVerseChangeRef.current?.(0);
  }, []);

  const changeSpeed = useCallback(async (speed?: PlaybackSpeed) => {
    const current = playbackSpeedRef.current;
    const newSpeed = speed ?? PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(current) + 1) % PLAYBACK_SPEEDS.length];
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
    // updateReciterCode
    reciterCodeRef.current = newReciterCode;
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
