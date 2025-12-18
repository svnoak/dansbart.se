import { ref, computed, watch, nextTick } from 'vue';
import { useConsent } from '../consent.js';
import { createPlaybackTracker } from '../analytics.js';
import { showError } from './useToast.js';

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

// Queue persistence helpers
const QUEUE_STORAGE_KEY = 'dansbart_queue';
const QUEUE_INDEX_KEY = 'dansbart_queue_index';

const saveQueueToStorage = () => {
  try {
    // Only save track IDs to keep storage lightweight
    const trackIds = queue.value.map(t => t.id);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trackIds));
    localStorage.setItem(QUEUE_INDEX_KEY, currentIndex.value.toString());
  } catch {
    showError();
  }
};

const loadQueueFromStorage = async () => {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    const storedIndex = localStorage.getItem(QUEUE_INDEX_KEY);

    if (!stored) return;

    const trackIds = JSON.parse(stored);
    if (!Array.isArray(trackIds) || trackIds.length === 0) return;

    // Fetch full track data for each ID
    const tracks = await Promise.all(
      trackIds.map(async id => {
        try {
          const res = await fetch(`/api/tracks/${id}`);
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      })
    );

    // Filter out any failed fetches
    const validTracks = tracks.filter(t => t !== null);

    if (validTracks.length > 0) {
      queue.value = validTracks;
      currentIndex.value = storedIndex ? parseInt(storedIndex) : -1;

      // Ensure index is within bounds
      if (currentIndex.value >= validTracks.length) {
        currentIndex.value = validTracks.length - 1;
      }
    }
  } catch {
    showError();
  }
};

export function usePlayer() {
  watch(consentStatus, async newStatus => {
    if (newStatus === 'granted' && currentTrack.value) {
      await nextTick();
      loadCurrentTrack();
    }
  });

  // Watch queue and save to localStorage whenever it changes
  watch(queue, () => {
    saveQueueToStorage();
  }, { deep: true });

  watch(currentIndex, () => {
    saveQueueToStorage();
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

  // Queue management functions
  const addToQueue = (track) => {
    // Check if track is already in queue
    if (queue.value.some(t => t.id === track.id)) {
      return false; // Already in queue
    }
    queue.value.push(track);
    return true;
  };

  const removeFromQueue = (index) => {
    if (index < 0 || index >= queue.value.length) return;

    // If removing the current track, stop playback
    if (index === currentIndex.value) {
      isPlaying.value = false;
      currentVideoId.value = null;
      // Move to next track if available
      if (queue.value.length > 1) {
        if (index < queue.value.length - 1) {
          // Current index stays the same, but track changes
          queue.value.splice(index, 1);
          loadCurrentTrack();
        } else {
          // Was last track, move back one
          currentIndex.value--;
          queue.value.splice(index, 1);
        }
      } else {
        // Was the only track
        queue.value.splice(index, 1);
        currentIndex.value = -1;
      }
    } else {
      // Adjust currentIndex if necessary
      if (index < currentIndex.value) {
        currentIndex.value--;
      }
      queue.value.splice(index, 1);
    }
  };

  const moveInQueue = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= queue.value.length) return;
    if (toIndex < 0 || toIndex >= queue.value.length) return;

    const track = queue.value[fromIndex];
    queue.value.splice(fromIndex, 1);
    queue.value.splice(toIndex, 0, track);

    // Update currentIndex if needed
    if (currentIndex.value === fromIndex) {
      currentIndex.value = toIndex;
    } else if (fromIndex < currentIndex.value && toIndex >= currentIndex.value) {
      currentIndex.value--;
    } else if (fromIndex > currentIndex.value && toIndex <= currentIndex.value) {
      currentIndex.value++;
    }
  };

  const clearQueue = () => {
    queue.value = [];
    currentIndex.value = -1;
    isPlaying.value = false;
    currentVideoId.value = null;
  };

  const jumpToQueueIndex = (index) => {
    if (index < 0 || index >= queue.value.length) return;
    currentIndex.value = index;
    loadCurrentTrack();
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
    // Queue management
    queue,
    currentIndex,
    addToQueue,
    removeFromQueue,
    moveInQueue,
    clearQueue,
    jumpToQueueIndex,
    loadQueueFromStorage,
  };
}
