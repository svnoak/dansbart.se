import { ref } from 'vue';

export function useAlbum() {
  const album = ref(null);
  const tracks = ref([]);
  const loading = ref(false);
  const loadingTracks = ref(false);
  const error = ref(null);
  const hasMore = ref(true);

  const fetchAlbum = async albumId => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(`/api/albums/${albumId}`);
      if (!response.ok) {
        throw new Error('Album not found');
      }
      album.value = await response.json();
    } catch (err) {
      error.value = err.message;
      album.value = null;
    } finally {
      loading.value = false;
    }
  };

  const fetchAlbumTracks = async (albumId, offset = 0) => {
    if (offset === 0) {
      loadingTracks.value = true;
      tracks.value = [];
    }

    try {
      const response = await fetch(
        `/api/albums/${albumId}/tracks?limit=20&offset=${offset}`
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
    if (!hasMore.value || loadingTracks.value || !album.value) return;
    fetchAlbumTracks(album.value.id, tracks.value.length);
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
