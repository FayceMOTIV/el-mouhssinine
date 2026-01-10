import TrackPlayer, { Capability, State } from 'react-native-track-player';

let isSetup = false;

export const setupPlayer = async () => {
  if (isSetup) return;

  try {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
      ],
    });
    isSetup = true;
  } catch (error) {
    console.log('Player already setup or error:', error);
  }
};

export const playAudio = async (url: string, title: string, artist: string = 'Coran') => {
  await setupPlayer();

  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: 'current',
    url: url,
    title: title,
    artist: artist,
  });
  await TrackPlayer.play();
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
