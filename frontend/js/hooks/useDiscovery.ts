import { ref, reactive, type Ref } from 'vue';
import {
  getPopularTracks,
  getRecentTracks,
  getCuratedTracks,
  getStyleOverview,
  getCuratedPlaylists,
  type getPopularTracksResponse,
  type getRecentTracksResponse,
  type getCuratedTracksResponse,
  type getStyleOverviewResponse,
  type getCuratedPlaylistsResponse,
} from '../api/generated/discovery/discovery';
import type { Track, StyleOverviewDto, CuratedPlaylistDto } from '../api/models';

type DiscoveryLoadingState = {
  popular: boolean;
  recent: boolean;
  curated: boolean;
  styles: boolean;
  playlists: boolean;
};

export function useDiscovery() {
  const popularTracks: Ref<Track[]> = ref<Track[]>([]);
  const recentTracks: Ref<Track[]> = ref<Track[]>([]);
  const curatedTracks: Ref<Track[]> = ref<Track[]>([]);
  const styleOverview: Ref<StyleOverviewDto[]> = ref<StyleOverviewDto[]>([]);
  const playlists: Ref<CuratedPlaylistDto[]> = ref<CuratedPlaylistDto[]>([]);

  const loading = reactive<DiscoveryLoadingState>({
    popular: false,
    recent: false,
    curated: false,
    styles: false,
    playlists: false,
  });

  const error = ref<string | null>(null);

  // Fetch sections independently for progressive loading
  const fetchPopular = async (): Promise<void> => {
    loading.popular = true;
    try {
      const response: getPopularTracksResponse = await getPopularTracks({ limit: 3 });
      popularTracks.value = response.data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      error.value = message;
      popularTracks.value = [];
    } finally {
      loading.popular = false;
    }
  };

  const fetchRecent = async (): Promise<void> => {
    loading.recent = true;
    try {
      const response: getRecentTracksResponse = await getRecentTracks({ limit: 3 });
      recentTracks.value = response.data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      error.value = message;
      recentTracks.value = [];
    } finally {
      loading.recent = false;
    }
  };

  const fetchCurated = async (): Promise<void> => {
    loading.curated = true;
    try {
      const response: getCuratedTracksResponse = await getCuratedTracks({ limit: 3 });
      curatedTracks.value = response.data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      error.value = message;
      curatedTracks.value = [];
    } finally {
      loading.curated = false;
    }
  };

  const fetchStyleOverview = async (): Promise<void> => {
    loading.styles = true;
    try {
      const response: getStyleOverviewResponse = await getStyleOverview();
      styleOverview.value = response.data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      error.value = message;
      styleOverview.value = [];
    } finally {
      loading.styles = false;
    }
  };

  const fetchPlaylists = async (): Promise<void> => {
    loading.playlists = true;
    try {
      const response: getCuratedPlaylistsResponse = await getCuratedPlaylists();
      playlists.value = response.data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      error.value = message;
      playlists.value = [];
    } finally {
      loading.playlists = false;
    }
  };

  return {
    popularTracks,
    recentTracks,
    curatedTracks,
    styleOverview,
    playlists,
    loading,
    error,
    fetchPopular,
    fetchRecent,
    fetchCurated,
    fetchStyleOverview,
    fetchPlaylists,
  };
}

