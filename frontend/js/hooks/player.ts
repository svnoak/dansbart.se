import { ref, computed, watch, nextTick, type Ref } from 'vue';
import { useConsent } from '../consent';
import { createPlaybackTracker, type PlaybackTracker } from '../analytics';
import { showError } from './useToast';

export interface PlaybackLink {
  platform?: string;
  deepLink?: string;
}

export interface TrackWithPlayback {
  id?: string;
  playbackLinks?: PlaybackLink[];
}

const queue = ref<TrackWithPlayback[]>([]);
const currentIndex = ref(-1);
const isPlaying = ref(false);
const isShuffled = ref(false);
const repeatMode = ref<'none' | 'all' | 'one' | 'stop'>('none');
const { consentStatus } = useConsent();
const activeSource = ref<'youtube' | 'spotify'>('youtube');

const currentTrack = computed(() => {
  if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
    return queue.value[currentIndex.value];
  }
  return null;
});

const currentVideoId = ref<string | null>(null);
const isRestricted = ref(false);
const playbackTracker = ref<PlaybackTracker | null>(null);

const QUEUE_STORAGE_KEY = 'dansbart_queue';
const QUEUE_INDEX_KEY = 'dansbart_queue_index';

const saveQueueToStorage = (): void => {
  try {
    const trackIds = queue.value.map(t => t.id).filter(Boolean);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trackIds));
    localStorage.setItem(QUEUE_INDEX_KEY, String(currentIndex.value));
  } catch {
    showError();
  }
};

const loadQueueFromStorage = async (): Promise<void> => {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) return;
    const trackIds = JSON.parse(stored) as string[];
    if (!Array.isArray(trackIds) || trackIds.length === 0) return;

    const tracks = await Promise.all(
      trackIds.map(async (id) => {
        try {
          const res = await fetch(`/api/tracks/${id}`);
          if (!res.ok) return null;
          return (await res.json()) as TrackWithPlayback;
        } catch {
          return null;
        }
      }),
    );
    const validTracks = tracks.filter((t): t is TrackWithPlayback => t !== null);
    if (validTracks.length > 0) {
      queue.value = validTracks;
      currentIndex.value = -1;
    }
  } catch {
    showError();
  }
};

/** Link object may have deepLink or legacy/alternate URL keys */
type PlaybackLinkWithUrl = PlaybackLink & Record<string, string | undefined>;

function getYouTubeId(track: TrackWithPlayback | null): string | null {
  if (!track?.playbackLinks) return null;
  for (const linkObj of track.playbackLinks) {
    if (linkObj.platform === 'youtube') return linkObj.deepLink ?? null;
    const ext = linkObj as PlaybackLinkWithUrl;
    const val = linkObj.deepLink ?? ext.url ?? ext.deep_link ?? ext.link;
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
}

function getSpotifyId(track: TrackWithPlayback | null): string | null {
  if (!track?.playbackLinks) return null;
  for (const linkObj of track.playbackLinks) {
    if (linkObj.platform === 'spotify') return linkObj.deepLink ?? null;
  }
  return null;
}

export function usePlayer() {
  watch(consentStatus, async (newStatus) => {
    if (newStatus === 'granted' && currentTrack.value) {
      await nextTick();
      loadCurrentTrack();
    }
  });

  watch(queue, () => saveQueueToStorage(), { deep: true });
  watch(currentIndex, () => saveQueueToStorage());

  const loadCurrentTrack = (): void => {
    if (consentStatus.value === null || consentStatus.value === 'denied') {
      window.dispatchEvent(new Event('show-consent-banner'));
      return;
    }
    const track = currentTrack.value;
    if (!track) return;

    if (playbackTracker.value) {
      playbackTracker.value.end();
      playbackTracker.value = null;
    }

    isRestricted.value = false;
    isPlaying.value = true;

    const ytId = getYouTubeId(track);
    const spotId = getSpotifyId(track);
    let selectedPlatform: 'youtube' | 'spotify' | null = null;

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

    if (selectedPlatform && track.id) {
      playbackTracker.value = createPlaybackTracker(track.id, selectedPlatform);
      playbackTracker.value.start();
    }
  };

  const setSource = (source: 'youtube' | 'spotify'): void => {
    if (source === 'spotify' && !getSpotifyId(currentTrack.value)) return;
    if (source === 'youtube' && !getYouTubeId(currentTrack.value)) return;
    activeSource.value = source;
    loadCurrentTrack();
  };

  const playContext = (
    trackList: TrackWithPlayback[],
    startIndex = 0,
    sourcePreference: 'youtube' | 'spotify' | null = null,
  ): void => {
    queue.value = trackList;
    currentIndex.value = startIndex;
    if (sourcePreference) activeSource.value = sourcePreference;
    loadCurrentTrack();
  };

  const playTrack = (
    track: TrackWithPlayback,
    sourcePreference: 'youtube' | 'spotify' = 'youtube',
  ): void => {
    if (sourcePreference) activeSource.value = sourcePreference;
    if (currentTrack.value?.id !== track.id) {
      queue.value = [track];
      currentIndex.value = 0;
    }
    loadCurrentTrack();
  };

  const togglePlay = (): void => {
    if (isPlaying.value) {
      isPlaying.value = false;
      if (playbackTracker.value) playbackTracker.value.pause();
      return;
    }
    if (consentStatus.value !== 'granted') {
      loadCurrentTrack();
      return;
    }
    isPlaying.value = true;
    if (playbackTracker.value) playbackTracker.value.start();
  };

  const nextTrack = (): void => {
    if (queue.value.length === 0) return;
    if (isShuffled.value) {
      currentIndex.value = Math.floor(Math.random() * queue.value.length);
    } else {
      if (currentIndex.value < queue.value.length - 1) {
        currentIndex.value++;
      } else if (repeatMode.value === 'all') {
        currentIndex.value = 0;
      }
    }
    loadCurrentTrack();
  };

  const prevTrack = (): void => {
    if (currentIndex.value > 0) currentIndex.value--;
    loadCurrentTrack();
  };

  const toggleShuffle = (): void => { isShuffled.value = !isShuffled.value; };

  const handlePlayerError = (errorCode: number): void => {
    if ([101, 150, 100].includes(errorCode) && activeSource.value === 'youtube') {
      if (getSpotifyId(currentTrack.value)) {
        activeSource.value = 'spotify';
      } else {
        isRestricted.value = true;
      }
    }
  };

  const cycleRepeatMode = (): void => {
    if (repeatMode.value === 'none') repeatMode.value = 'all';
    else if (repeatMode.value === 'all') repeatMode.value = 'one';
    else if (repeatMode.value === 'one') repeatMode.value = 'stop';
    else repeatMode.value = 'none';
  };

  const closePlayer = (): void => {
    isPlaying.value = false;
    currentIndex.value = -1;
    currentVideoId.value = null;
  };

  const addToQueue = (track: TrackWithPlayback): boolean => {
    if (queue.value.some(t => t.id === track.id)) return false;
    queue.value.push(track);
    return true;
  };

  const removeFromQueue = (index: number): void => {
    if (index < 0 || index >= queue.value.length) return;
    if (index === currentIndex.value) {
      isPlaying.value = false;
      currentVideoId.value = null;
      if (queue.value.length > 1) {
        if (index < queue.value.length - 1) {
          queue.value.splice(index, 1);
          loadCurrentTrack();
        } else {
          currentIndex.value--;
          queue.value.splice(index, 1);
        }
      } else {
        queue.value.splice(index, 1);
        currentIndex.value = -1;
      }
    } else {
      if (index < currentIndex.value) currentIndex.value--;
      queue.value.splice(index, 1);
    }
  };

  const moveInQueue = (fromIndex: number, toIndex: number): void => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= queue.value.length) return;
    if (toIndex < 0 || toIndex >= queue.value.length) return;
    const track = queue.value[fromIndex];
    queue.value.splice(fromIndex, 1);
    queue.value.splice(toIndex, 0, track);
    if (currentIndex.value === fromIndex) {
      currentIndex.value = toIndex;
    } else if (fromIndex < currentIndex.value && toIndex >= currentIndex.value) {
      currentIndex.value--;
    } else if (fromIndex > currentIndex.value && toIndex <= currentIndex.value) {
      currentIndex.value++;
    }
  };

  const clearQueue = (): void => {
    queue.value = [];
    currentIndex.value = -1;
    isPlaying.value = false;
    currentVideoId.value = null;
  };

  const jumpToQueueIndex = (index: number): void => {
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
