import { ref, computed, watch, nextTick } from 'vue';
import { useConsent } from '../consent.js';
import { createPlaybackTracker } from '../analytics.js';

// GLOBAL STATE
const queue = ref([]);
const currentIndex = ref(-1);
const isPlaying = ref(false);
const isShuffled = ref(false);
const repeatMode = ref('none');
const { consentStatus } = useConsent();

const activeSource = ref('youtube');

const currentTrack = computed(() => {
  if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
    return queue.value[currentIndex.value];
  }
  return null;
});

const currentVideoId = ref(null);
const isRestricted = ref(false);
const playbackTracker = ref(null); // Analytics tracker for current playback

export function usePlayer() {
  watch(consentStatus, async newStatus => {
    if (newStatus === 'granted' && currentTrack.value) {
      await nextTick();
      loadCurrentTrack();
    }
  });

  // --- HELPERS ---
  const getYouTubeId = track => {
    if (!track?.playback_links) return null;
    for (const linkObj of track.playback_links) {
      // Use platform field if available
      if (linkObj.platform === 'youtube') {
        return linkObj.deep_link;
      }
      // Fallback for old format: check if it looks like a YouTube URL
      const val = linkObj.deep_link || linkObj;
      if (typeof val === 'string' && val.includes('youtube.com')) {
        const match = val.match(/[?&]v=([^&]+)/);
        return match ? match[1] : null;
      }
      if (typeof val === 'string' && val.includes('youtu.be')) {
        const match = val.match(/youtu\.be\/([^?]+)/);
        return match ? match[1] : null;
      }
    }
    return null;
  };

  const getSpotifyId = track => {
    if (!track?.playback_links) return null;
    for (const linkObj of track.playback_links) {
      if (linkObj.platform === 'spotify') {
        return linkObj.deep_link;
      }
    }
    return null;
  };

  // --- ACTIONS ---

  const loadCurrentTrack = () => {
    if (
      typeof consentStatus !== 'undefined' &&
      (consentStatus.value === null || consentStatus.value === 'denied')
    ) {
      window.dispatchEvent(new Event('show-consent-banner'));
      return;
    }

    const track = currentTrack.value;
    if (!track) return;

    // End previous tracking if exists
    if (playbackTracker.value) {
      playbackTracker.value.end();
      playbackTracker.value = null;
    }

    isRestricted.value = false;
    isPlaying.value = true;

    const ytId = getYouTubeId(track);
    const spotId = getSpotifyId(track);

    let selectedPlatform = null;

    if (activeSource.value === 'youtube') {
      if (ytId) {
        currentVideoId.value = ytId;
        selectedPlatform = 'youtube';
      } else if (spotId) {
        activeSource.value = 'spotify';
        selectedPlatform = 'spotify';
      } else {
        nextTrack();
        return;
      }
    } else if (activeSource.value === 'spotify') {
      if (spotId) {
        currentVideoId.value = null;
        selectedPlatform = 'spotify';
      } else if (ytId) {
        activeSource.value = 'youtube';
        currentVideoId.value = ytId;
        selectedPlatform = 'youtube';
      } else {
        nextTrack();
        return;
      }
    }

    // Create new playback tracker
    if (selectedPlatform && track.id) {
      playbackTracker.value = createPlaybackTracker(track.id, selectedPlatform);
      playbackTracker.value.start();
    }
  };

  // Explicitly switch source
  const setSource = source => {
    if (source === 'spotify' && !getSpotifyId(currentTrack.value)) return;
    if (source === 'youtube' && !getYouTubeId(currentTrack.value)) return;

    activeSource.value = source;
    loadCurrentTrack(); // Reload to apply change
  };

  // 1. Play Context (List of tracks)
  const playContext = (tracks, startIndex = 0, sourcePreference = null) => {
    queue.value = tracks;
    currentIndex.value = startIndex;
    // If caller provided a source preference (e.g. 'spotify' from TrackCard), apply it
    if (sourcePreference) activeSource.value = sourcePreference;
    loadCurrentTrack();
  };

  // 2. Play Single Track (Helper for buttons)
  const playTrack = (track, sourcePreference = 'youtube') => {
    // Find track in queue or replace queue?
    // For simplicity here, we assume the UI handles queue setting,
    // but if called directly, we set the preference and load.
    if (sourcePreference) activeSource.value = sourcePreference;

    // (If track is not in queue, you might want to add it here)
    // For this example, we assume queue logic handles it or we just play:
    if (currentTrack.value?.id !== track.id) {
      // Simplified: just play it
      queue.value = [track];
      currentIndex.value = 0;
    }
    loadCurrentTrack();
  };

  // Standard Controls
  const togglePlay = () => {
    if (isPlaying.value) {
      isPlaying.value = false;
      // Pause tracking
      if (playbackTracker.value) {
        playbackTracker.value.pause();
      }
      return;
    }

    if (consentStatus.value !== 'granted') {
      loadCurrentTrack();
      return;
    }

    isPlaying.value = true;
    // Resume tracking
    if (playbackTracker.value) {
      playbackTracker.value.start();
    }
  };

  const nextTrack = () => {
    if (queue.value.length === 0) return;
    if (isShuffled.value) {
      currentIndex.value = Math.floor(Math.random() * queue.value.length);
    } else {
      if (currentIndex.value < queue.value.length - 1) {
        currentIndex.value++;
      } else if (repeatMode.value === 'all') {
        currentIndex.value = 0; // Loop back to start
      }
    }
    loadCurrentTrack();
  };

  const prevTrack = () => {
    if (currentIndex.value > 0) currentIndex.value--;
    loadCurrentTrack();
  };

  const toggleShuffle = () => (isShuffled.value = !isShuffled.value);

  const handlePlayerError = errorCode => {
    // If YT fails (restricted), try switching to Spotify automatically
    if ([101, 150, 100].includes(errorCode) && activeSource.value === 'youtube') {
      if (getSpotifyId(currentTrack.value)) {
        activeSource.value = 'spotify';
      } else {
        isRestricted.value = true;
      }
    }
  };

  const cycleRepeatMode = () => {
    if (repeatMode.value === 'none') repeatMode.value = 'all';
    else if (repeatMode.value === 'all') repeatMode.value = 'one';
    else repeatMode.value = 'none';
  };

  const closePlayer = () => {
    isPlaying.value = false;
    currentIndex.value = -1;
    currentVideoId.value = null;
  };

  return {
    currentTrack,
    currentVideoId,
    activeSource,
    isRestricted,
    isPlaying,
    isShuffled,
    playContext,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    toggleShuffle,
    setSource,
    handlePlayerError,
    closePlayer,
    getYouTubeId,
    getSpotifyId,
    repeatMode,
    cycleRepeatMode,
  };
}
