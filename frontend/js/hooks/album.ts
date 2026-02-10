import { ref, type Ref } from 'vue';
import { getAlbum, getAlbumTracks, type getAlbumResponse, type getAlbumTracksResponse } from '../api/generated/albums/albums';
import type { Album, Track } from '../api/models';

export function useAlbum() {
  const album: Ref<Album | null> = ref<Album | null>(null);
  const tracks: Ref<Track[]> = ref<Track[]>([]);
  const loading = ref<boolean>(false);
  const loadingTracks = ref<boolean>(false);
  const error = ref<string | null>(null);
  const hasMore = ref<boolean>(false);

  const fetchAlbum = async (albumId: string): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const response: getAlbumResponse = await getAlbum(albumId);
      album.value = response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error.value = message;
      album.value = null;
    } finally {
      loading.value = false;
    }
  };

  const fetchAlbumTracks = async (albumId: string): Promise<void> => {
    loadingTracks.value = true;
    tracks.value = [];

    try {
      const response: getAlbumTracksResponse = await getAlbumTracks(albumId);
      tracks.value = response.data;
      hasMore.value = false; // API returns all tracks at once
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error.value = message;
    } finally {
      loadingTracks.value = false;
    }
  };

  const loadMore = (): void => {
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

