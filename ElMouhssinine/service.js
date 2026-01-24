import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));

  // Quand la lecture se termine
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    console.log('[TrackPlayer] Playback ended');
  });

  // En cas d'erreur
  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    console.error('[TrackPlayer] Playback error:', error);
  });
};
