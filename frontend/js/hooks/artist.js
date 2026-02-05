import { ref } from 'vue';
import { getArtist, getArtistTracks } from '../api/generated/artists/artists';

export function useArtist() {
  const artist = ref(null);
  const tracks = ref([]);
  const loading = ref(false);
  const loadingTracks = ref(false);
  const error = ref(null);
  const hasMore = ref(false);

  const fetchArtist = async artistId => {
    loading.value = true;
    error.value = null;

    try {
      const response = await getArtist(artistId);
      artist.value = response.data;
    } catch (err) {
      error.value = err.message;
      artist.value = null;
    } finally {
      loading.value = false;
    }
  };

  const fetchArtistTracks = async artistId => {
    loadingTracks.value = true;
    tracks.value = [];

    try {
      const response = await getArtistTracks(artistId);
      tracks.value = response.data;
      hasMore.value = false; // API returns all tracks at once
    } catch (err) {
      error.value = err.message;
    } finally {
      loadingTracks.value = false;
    }
  };

  const loadMore = () => {
    // No-op: API returns all tracks at once
  };

  return {
    artist,
    tracks,
    loading,
    loadingTracks,
    error,
    hasMore,
    fetchArtist,
    fetchArtistTracks,
    loadMore,
  };
}
