import { useState, useCallback, useEffect, useRef } from 'react';
import TrackPlayer, { Event, State, useTrackPlayerEvents, useProgress } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupPlayer } from '../services/audioPlayer';

interface Verse {
  number: number;        // Numéro global (1-6236)
  numberInSurah: number; // Numéro dans la sourate
  text: string;          // Texte arabe
  translation?: string;  // Traduction
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
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [repeatCount, setRepeatCount] = useState(0);
  const [maxRepeat, setMaxRepeat] = useState(3);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const progress = useProgress();

  // Refs pour accéder aux valeurs actuelles dans les callbacks
  const versesRef = useRef(verses);
  const currentVerseIndexRef = useRef(currentVerseIndex);
  const isPlayingRef = useRef(isPlaying);
  const repeatModeRef = useRef(repeatMode);
  const repeatCountRef = useRef(repeatCount);
  const maxRepeatRef = useRef(maxRepeat);
  const rangeStartRef = useRef(rangeStart);
  const rangeEndRef = useRef(rangeEnd);
  const reciterCodeRef = useRef(reciterCode);
  const playbackSpeedRef = useRef(playbackSpeed);

  // Mettre à jour les refs
  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { currentVerseIndexRef.current = currentVerseIndex; }, [currentVerseIndex]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);
  useEffect(() => { maxRepeatRef.current = maxRepeat; }, [maxRepeat]);
  useEffect(() => { rangeStartRef.current = rangeStart; }, [rangeStart]);
  useEffect(() => { rangeEndRef.current = rangeEnd; }, [rangeEnd]);
  useEffect(() => { reciterCodeRef.current = reciterCode; }, [reciterCode]);
  useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);

  // Initialiser le player
  useEffect(() => {
    const init = async () => {
      try {
        await setupPlayer();
        setIsInitialized(true);
        console.log('[useQuranPlayer] Player initialisé');
      } catch (error) {
        console.error('[useQuranPlayer] Erreur init:', error);
      }
    };
    init();
  }, []);

  // Charger la progression sauvegardée quand les versets sont disponibles
  useEffect(() => {
    if (verses.length > 0 && isInitialized) {
      loadSavedProgress();
    }
  }, [verses.length, isInitialized, surahNumber]);

  // Sauvegarder la progression
  const saveProgress = async () => {
    try {
      const key = `${STORAGE_KEY_PREFIX}${surahNumber}`;
      await AsyncStorage.setItem(key, JSON.stringify({
        verseIndex: currentVerseIndexRef.current,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Erreur sauvegarde progression:', error);
    }
  };

  // Charger la progression sauvegardée
  const loadSavedProgress = async () => {
    try {
      const key = `${STORAGE_KEY_PREFIX}${surahNumber}`;
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        const { verseIndex } = JSON.parse(saved);
        if (verseIndex >= 0 && verseIndex < versesRef.current.length) {
          setCurrentVerseIndex(verseIndex);
          onVerseChange?.(verseIndex);
        }
      }
    } catch (error) {
      console.error('Erreur chargement progression:', error);
    }
  };

  // Obtenir l'URL audio d'un verset
  const getAudioUrl = (verseGlobalNumber: number): string => {
    return `https://cdn.islamic.network/quran/audio/128/${reciterCodeRef.current}/${verseGlobalNumber}.mp3`;
  };

  // Jouer un verset spécifique
  const playVerseAtIndex = async (index: number) => {
    const currentVerses = versesRef.current;

    // Vérifier que les versets sont disponibles
    if (!currentVerses || currentVerses.length === 0) {
      console.warn('[useQuranPlayer] Pas de versets disponibles');
      return;
    }

    if (index < 0 || index >= currentVerses.length) {
      console.warn('[useQuranPlayer] Index invalide:', index);
      return;
    }

    setIsLoading(true);
    const verse = currentVerses[index];
    const audioUrl = getAudioUrl(verse.number);

    console.log('[useQuranPlayer] Lecture verset:', index + 1, 'URL:', audioUrl);

    try {
      await setupPlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: `verse-${verse.number}`,
        url: audioUrl,
        title: `${surahName || 'Sourate'} - Verset ${verse.numberInSurah}`,
        artist: reciterCodeRef.current,
      });
      await TrackPlayer.setRate(playbackSpeedRef.current);
      await TrackPlayer.play();

      setCurrentVerseIndex(index);
      setIsPlaying(true);
      setIsLoading(false);
      onVerseChange?.(index);

      console.log('[useQuranPlayer] Lecture démarrée');
    } catch (error) {
      console.error('[useQuranPlayer] Erreur lecture:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  // Gérer la fin d'un verset
  const handleVerseEnded = async () => {
    console.log('[useQuranPlayer] Verset terminé, index actuel:', currentVerseIndexRef.current);

    const currentVerses = versesRef.current;
    const currentIdx = currentVerseIndexRef.current;
    const currentRepeatMode = repeatModeRef.current;
    const currentRepeatCount = repeatCountRef.current;
    const currentMaxRepeat = maxRepeatRef.current;

    // Mode répétition du verset
    if (currentRepeatMode === 'verse' && currentRepeatCount < currentMaxRepeat - 1) {
      setRepeatCount(prev => prev + 1);
      await playVerseAtIndex(currentIdx);
      return;
    }

    // Mode répétition d'une plage
    if (currentRepeatMode === 'range') {
      if (currentIdx < rangeEndRef.current) {
        const nextIndex = currentIdx + 1;
        await playVerseAtIndex(nextIndex);
        return;
      } else if (currentRepeatCount < currentMaxRepeat - 1) {
        setRepeatCount(prev => prev + 1);
        await playVerseAtIndex(rangeStartRef.current);
        return;
      }
    }

    setRepeatCount(0);

    // Passer au verset suivant
    if (currentIdx < currentVerses.length - 1) {
      const nextIndex = currentIdx + 1;
      console.log('[useQuranPlayer] Passage au verset suivant:', nextIndex + 1);
      await playVerseAtIndex(nextIndex);
    } else {
      // Fin de la sourate
      if (currentRepeatMode === 'surah') {
        console.log('[useQuranPlayer] Fin de sourate, répétition');
        await playVerseAtIndex(0);
      } else {
        console.log('[useQuranPlayer] Fin de sourate');
        setIsPlaying(false);
        await saveProgress();
      }
    }
  };

  // Écouter les événements du player
  useTrackPlayerEvents(
    [Event.PlaybackState, Event.PlaybackError, Event.PlaybackActiveTrackChanged],
    async (event) => {
      if (event.type === Event.PlaybackState) {
        const state = event.state as State;

        // Mettre à jour l'état de lecture
        if (state === State.Playing) {
          setIsPlaying(true);
          setIsLoading(false);
        } else if (state === State.Paused) {
          setIsPlaying(false);
        } else if (state === State.Buffering || state === State.Loading) {
          setIsLoading(true);
        } else if (state === State.Stopped || state === State.None) {
          setIsPlaying(false);
          setIsLoading(false);
        }

        // Détecter la fin du verset (State.Ended ou State.Ready après lecture)
        if (state === State.Ended) {
          console.log('[useQuranPlayer] Event: State.Ended');
          await handleVerseEnded();
        }
      }

      if (event.type === Event.PlaybackActiveTrackChanged) {
        // Quand la track change et qu'il n'y a plus de track, le verset est terminé
        if (event.lastTrack && !event.track && isPlayingRef.current) {
          console.log('[useQuranPlayer] Event: Track ended (no next track)');
          await handleVerseEnded();
        }
      }

      if (event.type === Event.PlaybackError) {
        console.error('[useQuranPlayer] Erreur playback:', event);
        setIsLoading(false);
        setIsPlaying(false);
      }
    }
  );

  // Lecture
  const play = async () => {
    if (isPlayingRef.current) return;

    const currentVerses = versesRef.current;
    if (!currentVerses || currentVerses.length === 0) {
      console.warn('[useQuranPlayer] Impossible de lire: pas de versets');
      return;
    }

    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Paused) {
        await TrackPlayer.play();
        setIsPlaying(true);
      } else {
        await playVerseAtIndex(currentVerseIndexRef.current);
      }
    } catch (error) {
      console.log('[useQuranPlayer] Nouvelle lecture depuis le début');
      await playVerseAtIndex(currentVerseIndexRef.current);
    }
  };

  // Pause
  const pause = async () => {
    await TrackPlayer.pause();
    setIsPlaying(false);
  };

  // Toggle Play/Pause
  const togglePlayPause = async () => {
    if (isPlayingRef.current) {
      await pause();
    } else {
      await play();
    }
  };

  // Aller à un verset spécifique
  const seekToVerse = async (index: number) => {
    const currentVerses = versesRef.current;
    if (!currentVerses || index < 0 || index >= currentVerses.length) return;

    setRepeatCount(0);
    setCurrentVerseIndex(index);
    onVerseChange?.(index);
  };

  // Verset suivant
  const nextVerse = async () => {
    const currentVerses = versesRef.current;
    if (currentVerseIndexRef.current < currentVerses.length - 1) {
      const nextIndex = currentVerseIndexRef.current + 1;
      setCurrentVerseIndex(nextIndex);
      onVerseChange?.(nextIndex);
      if (isPlayingRef.current) {
        await playVerseAtIndex(nextIndex);
      }
    }
  };

  // Verset précédent
  const previousVerse = async () => {
    if (currentVerseIndexRef.current > 0) {
      const prevIndex = currentVerseIndexRef.current - 1;
      setCurrentVerseIndex(prevIndex);
      onVerseChange?.(prevIndex);
      if (isPlayingRef.current) {
        await playVerseAtIndex(prevIndex);
      }
    }
  };

  // Changer la vitesse
  const changeSpeed = async (speed?: PlaybackSpeed) => {
    let newSpeed: PlaybackSpeed;

    if (speed !== undefined) {
      newSpeed = speed;
    } else {
      const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeedRef.current);
      const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
      newSpeed = PLAYBACK_SPEEDS[nextIndex];
    }

    setPlaybackSpeed(newSpeed);
    try {
      await TrackPlayer.setRate(newSpeed);
    } catch (error) {
      // Player might not be initialized
    }
  };

  // Cycle through repeat modes
  const cycleRepeatMode = () => {
    const modes: RepeatMode[] = ['none', 'verse', 'surah'];
    const currentIndex = modes.indexOf(repeatModeRef.current);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
    setRepeatCount(0);
  };

  // Définir une plage de répétition
  const setRepeatRange = (start: number, end: number) => {
    const currentVerses = versesRef.current;
    setRangeStart(Math.max(0, Math.min(start, currentVerses.length - 1)));
    setRangeEnd(Math.max(0, Math.min(end, currentVerses.length - 1)));
    setRepeatMode('range');
    setRepeatCount(0);
  };

  // Arrêter la lecture
  const stop = async () => {
    try {
      await TrackPlayer.reset();
    } catch (error) {
      // Player might not be initialized
    }
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentVerseIndex(0);
    setRepeatCount(0);
    onVerseChange?.(0);
    await saveProgress();
  };

  // Progression dans le verset actuel (0-1)
  const verseProgress = progress.duration > 0 ? progress.position / progress.duration : 0;

  return {
    // État
    currentVerseIndex,
    isPlaying,
    isLoading,
    isInitialized,
    repeatMode,
    repeatCount,
    maxRepeat,
    playbackSpeed,
    verseProgress,
    rangeStart,
    rangeEnd,

    // Actions
    play,
    pause,
    togglePlayPause,
    playVerseAtIndex,
    seekToVerse,
    nextVerse,
    previousVerse,
    stop,
    saveProgress,

    // Configuration
    setRepeatMode,
    setMaxRepeat,
    changeSpeed,
    cycleRepeatMode,
    setRepeatRange,
  };
};

export default useQuranPlayer;
