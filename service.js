module.exports = async function () {
  const TrackPlayer = require('react-native-track-player').default;
  const { Event } = require('react-native-track-player');

  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    console.log('[TrackPlayer] Playback ended');
  });

  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    console.error('[TrackPlayer] Playback error:', error);
  });
};
