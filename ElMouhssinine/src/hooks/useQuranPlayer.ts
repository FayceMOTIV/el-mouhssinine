import { useState, useCallback } from 'react';

// VERSION DEBUG - Build 203
// Hook désactivé pour identifier la source du crash

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

export const useQuranPlayer = ({
  verses,
  reciterCode,
  surahNumber,
  surahName,
  onVerseChange
}: UseQuranPlayerProps) => {
  // Log pour confirmer que ce hook est bien chargé
  console.log('[useQuranPlayer] BUILD 203 - Version STUB chargée');

  // États simples sans TrackPlayer
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [repeatCount, setRepeatCount] = useState(0);
  const [maxRepeat, setMaxRepeat] = useState(3);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [verseProgress, setVerseProgress] = useState(0);

  // Fonctions stub qui ne font rien
  const play = useCallback(async () => {
    console.log('[useQuranPlayer] STUB: play()');
  }, []);

  const pause = useCallback(async () => {
    console.log('[useQuranPlayer] STUB: pause()');
  }, []);

  const togglePlayPause = useCallback(async () => {
    console.log('[useQuranPlayer] STUB: togglePlayPause()');
  }, []);

  const playVerseAtIndex = useCallback(async (index: number) => {
    console.log('[useQuranPlayer] STUB: playVerseAtIndex(', index, ')');
    setCurrentVerseIndex(index);
    onVerseChange?.(index);
  }, [onVerseChange]);

  const seekToVerse = useCallback((index: number) => {
    console.log('[useQuranPlayer] STUB: seekToVerse(', index, ')');
    setCurrentVerseIndex(index);
    onVerseChange?.(index);
  }, [onVerseChange]);

  const nextVerse = useCallback(async () => {
    console.log('[useQuranPlayer] STUB: nextVerse()');
  }, []);

  const previousVerse = useCallback(async () => {
    console.log('[useQuranPlayer] STUB: previousVerse()');
  }, []);

  const stop = useCallback(async () => {
    console.log('[useQuranPlayer] STUB: stop()');
    setIsPlaying(false);
    setCurrentVerseIndex(0);
  }, []);

  const saveProgress = useCallback(async () => {
    console.log('[useQuranPlayer] STUB: saveProgress()');
  }, []);

  const changeSpeed = useCallback(async (speed?: PlaybackSpeed) => {
    console.log('[useQuranPlayer] STUB: changeSpeed()');
  }, []);

  const cycleRepeatMode = useCallback(() => {
    console.log('[useQuranPlayer] STUB: cycleRepeatMode()');
  }, []);

  const setRepeatRange = useCallback((start: number, end: number) => {
    console.log('[useQuranPlayer] STUB: setRepeatRange()');
  }, []);

  return {
    currentVerseIndex,
    isPlaying,
    isLoading,
    isInitialized: true,
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
