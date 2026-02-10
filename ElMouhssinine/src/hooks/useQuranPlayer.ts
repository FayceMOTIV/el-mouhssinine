import { useState, useCallback, useEffect } from 'react';
import TrackPlayer, { Event, State, useTrackPlayerEvents, usePlaybackState, useProgress } from 'react-native-track-player';
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

  const playbackState = usePlaybackState();
  const progress = useProgress();

  // Initialiser le player et charger la progression sauvegardée
  useEffect(() => {
    const init = async () => {
      await setupPlayer();
      await loadSavedProgress();
      setIsInitialized(true);
    };
    init();

    return () => {
      // Sauvegarder la progression quand on quitte
      saveProgress();
    };
  }, [surahNumber]);

  // Sauvegarder la progression
  const saveProgress = async () => {
    try {
      const key = `${STORAGE_KEY_PREFIX}${surahNumber}`;
      await AsyncStorage.setItem(key, JSON.stringify({
        verseIndex: currentVerseIndex,
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
        if (verseIndex >= 0 && verseIndex < verses.length) {
          setCurrentVerseIndex(verseIndex);
          onVerseChange?.(verseIndex);
        }
      }
    } catch (error) {
      console.error('Erreur chargement progression:', error);
    }
  };

  // Écouter les événements du player
  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], async (event) => {
    if (event.type === Event.PlaybackState) {
      const state = event.state as State;
      setIsPlaying(state === State.Playing);
      setIsLoading(state === State.Buffering || state === State.Loading);

      // Détecter la fin du verset
      if (state === State.Ended) {
        await handleVerseEnded();
      }
    }

    if (event.type === Event.PlaybackError) {
      console.error('Erreur playback:', event);
      setIsLoading(false);
      setIsPlaying(false);
    }
  });

  // Gérer la fin d'un verset
  const handleVerseEnded = useCallback(async () => {
    // Mode répétition du verset
    if (repeatMode === 'verse' && repeatCount < maxRepeat - 1) {
      setRepeatCount(prev => prev + 1);
      await playVerseAtIndex(currentVerseIndex);
      return;
    }

    // Mode répétition d'une plage
    if (repeatMode === 'range') {
      if (currentVerseIndex < rangeEnd) {
        const nextIndex = currentVerseIndex + 1;
        setCurrentVerseIndex(nextIndex);
        onVerseChange?.(nextIndex);
        await playVerseAtIndex(nextIndex);
        return;
      } else if (repeatCount < maxRepeat - 1) {
        setRepeatCount(prev => prev + 1);
        setCurrentVerseIndex(rangeStart);
        onVerseChange?.(rangeStart);
        await playVerseAtIndex(rangeStart);
        return;
      }
    }

    setRepeatCount(0);

    // Passer au verset suivant
    if (currentVerseIndex < verses.length - 1) {
      const nextIndex = currentVerseIndex + 1;
      setCurrentVerseIndex(nextIndex);
      onVerseChange?.(nextIndex);
      await playVerseAtIndex(nextIndex);
    } else {
      // Fin de la sourate
      if (repeatMode === 'surah') {
        setCurrentVerseIndex(0);
        onVerseChange?.(0);
        await playVerseAtIndex(0);
      } else {
        setIsPlaying(false);
        await saveProgress();
      }
    }
  }, [currentVerseIndex, repeatMode, repeatCount, maxRepeat, rangeStart, rangeEnd, verses.length]);

  // Obtenir l'URL audio d'un verset
  const getAudioUrl = (verseGlobalNumber: number): string => {
    return `https://cdn.islamic.network/quran/audio/128/${reciterCode}/${verseGlobalNumber}.mp3`;
  };

  // Jouer un verset spécifique
  const playVerseAtIndex = async (index: number) => {
    if (index < 0 || index >= verses.length) return;

    setIsLoading(true);
    const verse = verses[index];
    const audioUrl = getAudioUrl(verse.number);

    try {
      await setupPlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: `verse-${verse.number}`,
        url: audioUrl,
        title: `${surahName || 'Sourate'} - Verset ${verse.numberInSurah}`,
        artist: reciterCode,
        artwork: 'https://cdn.islamic.network/quran/images/logo.png',
      });
      await TrackPlayer.setRate(playbackSpeed);
      await TrackPlayer.play();
      setCurrentVerseIndex(index);
    } catch (error) {
      console.error('Erreur lecture audio:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  // Lecture
  const play = async () => {
    if (isPlaying) return;

    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Paused) {
        await TrackPlayer.play();
      } else {
        await playVerseAtIndex(currentVerseIndex);
      }
    } catch (error) {
      await playVerseAtIndex(currentVerseIndex);
    }
  };

  // Pause
  const pause = async () => {
    await TrackPlayer.pause();
  };

  // Toggle Play/Pause
  const togglePlayPause = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  // Aller à un verset spécifique
  const seekToVerse = async (index: number) => {
    if (index < 0 || index >= verses.length) return;

    setRepeatCount(0);
    setCurrentVerseIndex(index);
    onVerseChange?.(index);

    if (isPlaying) {
      await playVerseAtIndex(index);
    }
  };

  // Verset suivant
  const nextVerse = async () => {
    if (currentVerseIndex < verses.length - 1) {
      const nextIndex = currentVerseIndex + 1;
      setCurrentVerseIndex(nextIndex);
      onVerseChange?.(nextIndex);
      if (isPlaying) {
        await playVerseAtIndex(nextIndex);
      }
    }
  };

  // Verset précédent
  const previousVerse = async () => {
    if (currentVerseIndex > 0) {
      const prevIndex = currentVerseIndex - 1;
      setCurrentVerseIndex(prevIndex);
      onVerseChange?.(prevIndex);
      if (isPlaying) {
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
      // Cycle through speeds
      const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
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
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
    setRepeatCount(0);
  };

  // Définir une plage de répétition
  const setRepeatRange = (start: number, end: number) => {
    setRangeStart(Math.max(0, Math.min(start, verses.length - 1)));
    setRangeEnd(Math.max(0, Math.min(end, verses.length - 1)));
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
