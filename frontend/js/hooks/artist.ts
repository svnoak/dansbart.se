import { ref, type Ref } from 'vue';
import { getArtist, getArtistTracks, type getArtistResponse, type getArtistTracksResponse } from '../api/generated/artists/artists';
import type { Artist, Track } from '../api/models';

export function useArtist() {
  const artist: Ref<Artist | null> = ref<Artist | null>(null);
  const tracks: Ref<Track[]> = ref<Track[]>([]);
  const loading = ref<boolean>(false);
  const loadingTracks = ref<boolean>(false);
  const error = ref<string | null>(null);
  const hasMore = ref<boolean>(false);

  const fetchArtist = async (artistId: string): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const response: getArtistResponse = await getArtist(artistId);
      artist.value = response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error.value = message;
      artist.value = null;
    } finally {
      loading.value = false;
    }
  };

  const fetchArtistTracks = async (artistId: string): Promise<void> => {
    loadingTracks.value = true;
    tracks.value = [];

    try {
      const response: getArtistTracksResponse = await getArtistTracks(artistId);
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

