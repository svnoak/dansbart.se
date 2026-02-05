import { ref } from 'vue';
import { getAlbum, getAlbumTracks } from '../api/generated/albums/albums';

export function useAlbum() {
  const album = ref(null);
  const tracks = ref([]);
  const loading = ref(false);
  const loadingTracks = ref(false);
  const error = ref(null);
  const hasMore = ref(false);

  const fetchAlbum = async albumId => {
    loading.value = true;
    error.value = null;

    try {
      const response = await getAlbum(albumId);
      album.value = response.data;
    } catch (err) {
      error.value = err.message;
      album.value = null;
    } finally {
      loading.value = false;
    }
  };

  const fetchAlbumTracks = async albumId => {
    loadingTracks.value = true;
    tracks.value = [];

    try {
      const response = await getAlbumTracks(albumId);
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
    album,
    tracks,
    loading,
    loadingTracks,
    error,
    hasMore,
    fetchAlbum,
    fetchAlbumTracks,
    loadMore,
  };
}
