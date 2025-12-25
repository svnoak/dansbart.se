import { ref } from 'vue';

export function useArtist() {
  const artist = ref(null);
  const tracks = ref([]);
  const loading = ref(false);
  const loadingTracks = ref(false);
  const error = ref(null);
  const hasMore = ref(true);

  const fetchArtist = async artistId => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(`/api/artists/${artistId}`);
      if (!response.ok) {
        throw new Error('Artist not found');
      }
      artist.value = await response.json();
    } catch (err) {
      error.value = err.message;
      artist.value = null;
    } finally {
      loading.value = false;
    }
  };

  const fetchArtistTracks = async (artistId, offset = 0) => {
    if (offset === 0) {
      loadingTracks.value = true;
      tracks.value = [];
    }

    try {
      const response = await fetch(
        `/api/artists/${artistId}/tracks?limit=20&offset=${offset}`
      );
      if (!response.ok) {
        throw new Error('Failed to load tracks');
      }

      const data = await response.json();

      if (offset === 0) {
        tracks.value = data.items;
      } else {
        tracks.value = [...tracks.value, ...data.items];
      }

      hasMore.value = tracks.value.length < data.total;
    } catch (err) {
      error.value = err.message;
    } finally {
      loadingTracks.value = false;
    }
  };

  const loadMore = () => {
    if (!hasMore.value || loadingTracks.value || !artist.value) return;
    fetchArtistTracks(artist.value.id, tracks.value.length);
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
