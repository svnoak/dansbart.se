/**
 * Library Tab Component (Unified)
 * Complete library management: Tracks, Albums, Artists, and Blocklist
 * Features: Search, filters, bulk operations, collaboration tracking
 */

import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useLibraryApi } from './api.js';
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import RejectionModal from './RejectionModal.js';
import ConfirmationModal from './ConfirmationModal.js';
import InlinePlayer from '../../shared/components/InlinePlayer.js';
import { showError, showToast } from '../../../js/hooks/useToast';

export default {
  components: {
    RejectionModal,
    ConfirmationModal,
    InlinePlayer,
  },
  setup() {
    useAdminAuth();
    const api = useLibraryApi();

    // State
    const view = ref('artists'); // tracks, albums, artists, blocklist, duplicates
    const tracks = ref([]);
    const albums = ref([]);
    const artists = ref([]);
    const blocklist = ref([]);
    const duplicates = ref([]);
    const totalItems = ref(0);
    const searchQuery = ref('');
    const statusFilter = ref('all'); // all, pending, analyzed
    const trackStatusFilter = ref(''); // PENDING, PROCESSING, DONE, FAILED
    const flaggedFilter = ref('');
    const isolatedFilter = ref(''); // For filtering isolated/non-isolated entities
    const rejectedFilter = ref(''); // For filtering rejected entities
    const artistFilter = ref(''); // Filter tracks/albums by artist ID
    const albumFilter = ref(''); // Filter tracks by album ID
    const limit = ref(50);
    const offset = ref(0);
    const loading = ref(false);

    // For displaying selected artist/album name
    const selectedArtistName = ref('');
    const selectedAlbumName = ref('');

    // Bulk selection
    const selectedIds = ref(new Set());

    // Expanded artist details
    const expandedArtist = ref(null);
    const expandedArtistAlbums = ref([]);
    const expandedAlbum = ref(null);
    const expandedAlbumTracks = ref([]);

    // Spotify integration toggle
    const showSpotifyContent = ref(false);

    // Rejection modal state
    const showRejectionModal = ref(false);
    const rejectionEntity = ref(null);
    const rejectionEntityType = ref('artist');
    const collaborationData = ref(null);

    // Confirmation modal state
    const showConfirmationModal = ref(false);
    const confirmationData = ref({
      title: '',
      message: '',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      confirmClass: 'bg-blue-600 hover:bg-blue-500',
      onConfirm: null,
    });

    // Normalize admin track payload: backend sends artists as [{ id, name, ... }] and album as single object
    const normalizeTrack = (t) => {
      const artistNames = Array.isArray(t.artists)
        ? t.artists.map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean)
        : [];
      const albums = t.album != null ? [t.album] : t.albums ?? [];
      return {
        ...t,
        artists: artistNames,
        albums,
        albumId: t.album?.id ?? t.albumId,
        albumTitle: t.album?.title ?? t.albumTitle,
      };
    };

    // Computed
    const pageNumber = computed(() => Math.floor(offset.value / limit.value) + 1);
    const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

    const isAllSelected = computed(() => {
      const currentList = view.value === 'artists' ? artists.value : albums.value;
      return currentList.length > 0 && selectedIds.value.size === currentList.length;
    });

    // Methods
    const loadData = async () => {
      loading.value = true;
      selectedIds.value.clear(); // Clear selection on load

      try {
        const params: Record<string, unknown> = {
          limit: limit.value,
          offset: offset.value,
        };

        if (searchQuery.value) params.search = searchQuery.value;

        let data;

        if (view.value === 'tracks') {
          if (trackStatusFilter.value) params.status = trackStatusFilter.value;
          if (flaggedFilter.value) params.flagged = flaggedFilter.value;
          if (artistFilter.value) params.artistId = artistFilter.value;
          if (albumFilter.value) params.albumId = albumFilter.value;
          data = await api.loadTracks(params);
          tracks.value = data.items.map((t) => ({ ...normalizeTrack(t), loading: false }));
        } else if (view.value === 'albums') {
          if (artistFilter.value) params.artistId = artistFilter.value;
          if (statusFilter.value === 'pending') {
            data = await api.loadPendingAlbums(limit.value, offset.value);
          } else {
            data = await api.loadAlbums(params);
          }
          albums.value = data.items;
        } else if (view.value === 'artists') {
          if (isolatedFilter.value) params.isolated = isolatedFilter.value;
          if (statusFilter.value === 'pending') {
            data = await api.loadPendingArtists(limit.value, offset.value, searchQuery.value);
          } else {
            data = await api.loadArtists(params);
          }
          artists.value = data.items;
        } else if (view.value === 'blocklist') {
          data = await api.loadBlocklist('', limit.value, offset.value);
          blocklist.value = data.items;
        } else if (view.value === 'duplicates') {
          data = await api.loadDuplicateTracks(limit.value, offset.value);
          duplicates.value = data.items;
        }

        totalItems.value = data.total;
      } catch {
        showError(`Failed to load ${view.value}`);
      } finally {
        loading.value = false;
      }
    };

    let searchTimeout;
    const debouncedSearch = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        offset.value = 0;
        loadData();
      }, 300);
    };

    const prevPage = () => {
      offset.value = Math.max(0, offset.value - limit.value);
      loadData();
    };

    const nextPage = () => {
      offset.value += limit.value;
      loadData();
    };

    // Filter helpers
    const filterByArtist = (artistId, artistName) => {
      artistFilter.value = artistId;
      selectedArtistName.value = artistName;
      albumFilter.value = ''; // Clear album filter
      selectedAlbumName.value = '';
      searchQuery.value = ''; // Clear search when filtering
      offset.value = 0;

      // Switch to appropriate view
      if (view.value === 'artists') {
        view.value = 'albums'; // Show albums for this artist
      }

      loadData();
    };

    const filterByAlbum = (albumId, albumName) => {
      albumFilter.value = albumId;
      selectedAlbumName.value = albumName;
      searchQuery.value = ''; // Clear search when filtering
      offset.value = 0;
      view.value = 'tracks'; // Switch to tracks view
      loadData();
    };

    const clearFilters = () => {
      artistFilter.value = '';
      albumFilter.value = '';
      selectedArtistName.value = '';
      selectedAlbumName.value = '';
      offset.value = 0;
      loadData();
    };

    // Bulk selection
    const toggleSelection = id => {
      if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id);
      } else {
        selectedIds.value.add(id);
      }
    };

    const toggleSelectAll = () => {
      const currentList = view.value === 'artists' ? artists.value : albums.value;
      if (selectedIds.value.size === currentList.length) {
        selectedIds.value.clear();
      } else {
        currentList.forEach(item => selectedIds.value.add(item.id));
      }
    };

    const bulkReject = async () => {
      const count = selectedIds.value.size;
      if (count === 0) return;

      const itemType = view.value === 'artists' ? 'artists' : 'albums';
      if (
        !confirm(
          `⚠️ Reject and delete ${count} ${itemType}?\n\nThis will:\n• Delete all their tracks\n• Add them to the blocklist\n• This cannot be undone\n\nContinue?`
        )
      ) {
        return;
      }

      loading.value = true;
      try {
        const ids = Array.from(selectedIds.value).map(id => String(id));

        if (view.value === 'artists') {
          await api.bulkRejectArtists(ids, 'Bulk rejection from library');
          showToast(`Rejected ${count} artists`, 'success');
        } else {
          // Reject albums one by one (no bulk endpoint yet)
          for (const rawId of ids) {
            const id = String(rawId);
            await api.rejectAlbum(id, 'Bulk rejection from library');
          }
          showToast(`Rejected ${count} albums`, 'success');
        }

        loadData();
      } catch (e) {
        showError(e.message || 'Bulk rejection failed');
      } finally {
        loading.value = false;
      }
    };

    // Track actions
    const reanalyze = async track => {
      track.loading = true;
      try {
        const data = await api.reanalyzeTrack(track.id);
        showToast(data.message);
        track.processingStatus = 'PENDING';
        window.dispatchEvent(new CustomEvent('admin:track-updated', { detail: { track } }));
      } catch (e) {
        showError(e.message || 'Re-analysis failed');
      } finally {
        track.loading = false;
      }
    };

    const reclassify = async track => {
      track.loading = true;
      try {
        const data = await api.reclassifyTrack(track.id);
        showToast(`${track.title} → ${data.newStyle}`);
        track.danceStyle = data.newStyle;
        window.dispatchEvent(new CustomEvent('admin:track-updated', { detail: { track } }));
      } catch (e) {
        showError(e.message || 'Reclassification failed');
      } finally {
        track.loading = false;
      }
    };

    const unflagTrack = async track => {
      track.loading = true;
      try {
        await api.unflagTrack(track.id);
        showToast(`Unflagged: ${track.title}`);
        loadData();
        window.dispatchEvent(new CustomEvent('admin:track-unflagged', { detail: { track } }));
      } catch (e) {
        showError(e.message || 'Failed to unflag track');
      } finally {
        track.loading = false;
      }
    };

    const rejectTrack = async track => {
      if (
        !confirm(
          `Reject and delete track "${track.title}"?\n\nThis will remove it from the database and add it to the blocklist.`
        )
      ) {
        return;
      }

      try {
        const data = await api.rejectTrack(track.id, 'Rejected from library');
        showToast(data.message);
        loadData();
      } catch (e) {
        showError(e.message || 'Failed to reject track');
      }
    };

    const deleteTrack = async track => {
      if (
        !confirm(
          `Delete track "${track.title}"?\n\nThis will permanently remove it from the database (but NOT add it to the blocklist).`
        )
      ) {
        return;
      }

      try {
        const data = await api.deleteTrack(track.id);
        showToast(data.message);
        loadData();
      } catch (e) {
        showError(e.message || 'Failed to delete track');
      }
    };

    const mergeDuplicates = async (group) => {
      if (group.type !== 'isrc') {
        showError('Only ISRC-based duplicates can be merged automatically');
        return;
      }

      const isrc = group.identifier;

      try {
        // First, analyze what would be merged (dry run)
        const analysis = await api.analyzeDuplicateIsrc(isrc);

        if (!analysis.mergeable) {
          showError(analysis.reason || 'These tracks cannot be merged');
          return;
        }

        // Show preview and confirmation
        const confirmMessage = `🔀 Merge ${analysis.trackCount} duplicate tracks?\n\n` +
          `Canonical track: "${analysis.canonicalTrackTitle}"\n` +
          `Total unique albums: ${analysis.unique_albums}\n\n` +
          `This will:\n` +
          `• Keep the canonical track (${analysis.canonicalTrackId.substring(0, 8)}...)\n` +
          `• Migrate all album links and playback links\n` +
          `• Migrate user votes and interactions\n` +
          `• Delete ${analysis.trackCount - 1} duplicate track(s)\n\n` +
          `This cannot be undone. Continue?`;

        if (!confirm(confirmMessage)) {
          return;
        }

        // Perform the merge
        showToast('Merging duplicates...');
        const result = await api.mergeDuplicatesByIsrc(isrc, false);

        if (result.status === 'success') {
          showToast(`✅ ${result.message}\n• Merged ${(result.deletedTracks ?? result.deleted)} tracks\n• Migrated ${(result.migratedAlbums ?? 0)} album links`);
          loadData(); // Reload to refresh the list
        } else {
          showError(result.message || 'Failed to merge duplicates');
        }
      } catch (e) {
        showError(e.message || 'Failed to merge duplicates');
      }
    };

    // Artist actions
    const toggleArtistDetails = async artist => {
      if (expandedArtist.value === artist.id) {
        expandedArtist.value = null;
        expandedArtistAlbums.value = [];
      } else {
        expandedArtist.value = artist.id;
        // Load albums for this artist
        try {
          const data = await api.loadAlbums({ artistId: artist.id, limit: 100 });
          let albums = data.items;

          // If Spotify toggle is on, merge with Spotify data
          if (showSpotifyContent.value && artist.spotifyId) {
            try {
              const spotifyData = await api.getSpotifyArtistAlbums(artist.spotifyId);
              // Create a map of library albums by spotify_id for fast lookup
              const libraryAlbumsMap = new Map();
              albums.forEach(album => {
                if (album.spotifyId) {
                  libraryAlbumsMap.set(album.spotifyId, album);
                }
              });

              // Create merged array starting with all Spotify albums
              const mergedAlbums = spotifyData.albums.map(spotifyAlbum => {
                if (libraryAlbumsMap.has(spotifyAlbum.spotify_id)) {
                  // This album exists in library - use library data and mark as in_library
                  const libraryAlbum = libraryAlbumsMap.get(spotifyAlbum.spotify_id);
                  return {
                    ...libraryAlbum,
                    inLibrary: true
                  };
                } else {
                  // This album is not in library - use Spotify data
                  return {
                    ...spotifyAlbum,
                    id: spotifyAlbum.spotify_id,
                    inLibrary: false,
                    totalTracks: spotifyAlbum.totalTracks || 0,
                    doneTracks: 0,
                    pendingTracks: 0,
                  };
                }
              });

              // Sort: library albums first, then Spotify-only albums
              albums = mergedAlbums.sort((a, b) => {
                if (a.inLibrary === b.inLibrary) return 0;
                return a.inLibrary ? -1 : 1;
              });
            } catch (e) {
              console.error('Failed to load Spotify albums:', e);
              // Continue with just library albums
              albums.forEach(album => { album.inLibrary = true; });
            }
          } else {
            // Mark all as in library when not showing Spotify content
            albums.forEach(album => { album.inLibrary = true; });
          }

          expandedArtistAlbums.value = albums;
        } catch {
          showError('Failed to load artist albums');
          expandedArtistAlbums.value = [];
        }
      }
    };

    const toggleAlbumDetails = async album => {
      if (expandedAlbum.value === album.id) {
        expandedAlbum.value = null;
        expandedAlbumTracks.value = [];
      } else {
        expandedAlbum.value = album.id;
        // Load tracks for this album
        try {
          // Only load library tracks if album is in library (has database ID that's not a spotify_id)
          let tracks = [];
          if (album.inLibrary !== false) {
            const data = await api.loadTracks({ albumId: album.id, limit: 100 });
            tracks = data.items.map(normalizeTrack);
          }

          // If Spotify toggle is on and album has spotify_id, merge with Spotify data
          if (showSpotifyContent.value && album.spotifyId) {
            try {
              const spotifyData = await api.getSpotifyAlbumTracks(album.spotifyId);
              // Create a map of library tracks by spotify_id
              const libraryTracksMap = new Map();
              tracks.forEach(track => {
                const spotifyId = getSpotifyTrackId(track);
                if (spotifyId) {
                  libraryTracksMap.set(spotifyId, track);
                }
              });

              // Create merged array starting with all Spotify tracks
              const mergedTracks = spotifyData.tracks.map(spotifyTrack => {
                if (libraryTracksMap.has(spotifyTrack.spotifyId)) {
                  // This track exists in library - use library data and mark as in_library
                  const libraryTrack = libraryTracksMap.get(spotifyTrack.spotifyId);
                  return {
                    ...libraryTrack,
                    inLibrary: true,
                    track_number: spotifyTrack.track_number // Use Spotify's track number for sorting
                  };
                } else {
                  // This track is not in library - use Spotify data
                  return {
                    ...spotifyTrack,
                    id: spotifyTrack.spotifyId,
                    inLibrary: false,
                    status: 'NOT_IN_LIBRARY',
                    playbackLinks: [{
                      platform: 'spotify',
                      deepLink: spotifyTrack.spotifyUrl,
                      isWorking: true
                    }]
                  };
                }
              });

              // Sort by track number
              tracks = mergedTracks.sort((a, b) => {
                const aNum = a.trackNumber ?? 999;
                const bNum = b.trackNumber ?? 999;
                return aNum - bNum;
              });
            } catch (e) {
              console.error('Failed to load Spotify tracks:', e);
              // Continue with just library tracks
              tracks.forEach(track => { track.inLibrary = true; });
            }
          } else {
            // Mark all as in library when not showing Spotify content
            tracks.forEach(track => { track.inLibrary = true; });
          }

          expandedAlbumTracks.value = tracks;
        } catch {
          showError('Failed to load album tracks');
          expandedAlbumTracks.value = [];
        }
      }
    };

    // Spotify ingestion actions
    const ingestAlbum = async (spotifyAlbumId, albumTitle) => {
      // Show confirmation modal
      confirmationData.value = {
        title: 'Ingest Album',
        message: `Ingest album "${albumTitle}" from Spotify?\n\nThis will add all tracks to your library and queue them for analysis.`,
        confirmText: 'Ingest',
        cancelText: 'Cancel',
        confirmClass: 'bg-blue-600 hover:bg-blue-500',
        onConfirm: async () => {
          showConfirmationModal.value = false;

          try {
            const data = await api.ingestSpotifyAlbum(spotifyAlbumId);
            showToast(`${data.message} - ${data.tracksIngested} tracks ingested`);
            // Reload to show new tracks
            loadData();
            // Refresh expanded album if it's open
            if (expandedAlbum.value) {
              const currentAlbum = { id: expandedAlbum.value, spotifyId: spotifyAlbumId };
              expandedAlbum.value = null;
              await toggleAlbumDetails(currentAlbum);
            }
          } catch (e) {
            showError(e.message || 'Failed to ingest album');
          }
        },
      };
      showConfirmationModal.value = true;
    };

    const ingestTrack = async (spotifyTrackId) => {
      try {
        const data = await api.ingestSpotifyTrack(spotifyTrackId);
        showToast(`${data.message}`);
        // Reload to show new track
        loadData();
        // Refresh expanded album if it's open
        if (expandedAlbum.value) {
          const currentAlbumId = expandedAlbum.value;
          expandedAlbum.value = null;
          // Re-open the album to refresh the track list
          setTimeout(() => {
            const albumElement = document.querySelector(`[data-album-id="${currentAlbumId}"]`);
            if (albumElement) {
              (albumElement as HTMLElement).click();
            }
          }, 500);
        }
      } catch (e) {
        showError(e.message || 'Failed to ingest track');
      }
    };

    const approveArtist = async artist => {
      const confirmMsg = `Approve artist "${artist.name}"?\n\n• ${artist.pendingCount} pending tracks will be queued for analysis`;
      if (!confirm(confirmMsg)) return;

      try {
        const data = await api.approveArtist(artist.id);
        showToast(data.message);
        loadData();
        window.dispatchEvent(new CustomEvent('admin:artist-approved'));
      } catch (e) {
        showError(e.message || 'Failed to approve artist');
      }
    };

    const bulkApprove = async () => {
      const count = selectedIds.value.size;
      if (count === 0) return;

      if (
        !confirm(
          `✅ Approve ${count} artists?\n\nThis will:\n• Queue all their pending tracks for analysis\n• They will be processed by the analysis system\n\nContinue?`
        )
      ) {
        return;
      }

      loading.value = true;
      try {
        const ids = Array.from(selectedIds.value).map(id => String(id));
        await api.bulkApproveArtists(ids);
        showToast(`Approved ${count} artists`, 'success');
        selectedIds.value.clear();
        loadData();
        window.dispatchEvent(new CustomEvent('admin:artist-approved'));
      } catch (e) {
        showError(e.message || 'Bulk approval failed');
      } finally {
        loading.value = false;
      }
    };

    const rejectArtist = async artist => {
      // Open the enhanced rejection modal
      rejectionEntity.value = artist;
      rejectionEntityType.value = 'artist';

      try {
        // Fetch collaboration network data
        const networkData = await api.getCollaborationNetwork(artist.id);
        collaborationData.value = networkData;
        showRejectionModal.value = true;
      } catch (e) {
        showError(e.message || 'Failed to load collaboration data');
      }
    };

    const closeRejectionModal = () => {
      showRejectionModal.value = false;
      rejectionEntity.value = null;
      collaborationData.value = null;
    };

    const confirmRejection = async selections => {
      loading.value = true;
      showRejectionModal.value = false;

      try {
        // If only artists and no albums, use bulk reject (supports block-only mode)
        if (selections.artistIds.length > 0 && selections.albumIds.length === 0) {
          const data = await api.bulkRejectArtists(
            selections.artistIds,
            selections.reason,
            selections.deleteContent
          );
          showToast(data.message || 'Artists rejected successfully', 'success');
        } else {
          // Use network rejection for complex cases (always deletes for now)
          const data = await api.rejectNetwork(
            selections.artistIds,
            selections.albumIds,
            selections.reason
          );
          showToast(data.message || 'Network rejected successfully', 'success');
        }
        loadData();
      } catch (e) {
        showError(e.message || 'Rejection failed');
      } finally {
        loading.value = false;
      }
    };

    // Album actions
    const rejectAlbum = async album => {
      if (
        !confirm(
          `Reject and delete album "${album.title}"?\n\n• ${album.trackCount} tracks will be deleted\n• Album will be removed from database`
        )
      ) {
        return;
      }

      try {
        const data = await api.rejectAlbum(album.id, 'Rejected from library');
        showToast(data.message);
        loadData();
      } catch (e) {
        showError(e.message || 'Failed to reject album');
      }
    };

    // Blocklist actions
    const removeFromBlocklist = async item => {
      if (
        !confirm(
          `Remove "${item.entityName}" from blocklist?\n\nThis will allow it to be re-ingested if discovered again.`
        )
      ) {
        return;
      }

      try {
        const data = await api.removeFromBlocklist(item.id);
        showToast(data.message);
        loadData();
      } catch (e) {
        showError(e.message || 'Failed to remove from blocklist');
      }
    };

    // Helper methods
    const getSpotifyTrackId = track => {
      if (!track.playbackLinks) return null;
      const spotifyLink = track.playbackLinks.find(link => link.platform === 'spotify');
      if (!spotifyLink) return null;

      // Extract ID from spotify:track:ID or https://open.spotify.com/track/ID
      const match = spotifyLink.deepLink.match(/(?:spotify:track:|\/track\/)([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    };

    const getSpotifyUrl = (type, id) => {
      if (!id) return null;
      return `https://open.spotify.com/${type}/${id}`;
    };

    const getAlbumSpotifyUrl = tracks => {
      if (!tracks || tracks.length === 0) return null;
      // Find first track with a Spotify link
      for (const track of tracks) {
        const spotifyId = getSpotifyTrackId(track);
        if (spotifyId) {
          // Extract album ID from Spotify track URL
          // We'll just link to the first track for now, which will show the album
          return `https://open.spotify.com/track/${spotifyId}`;
        }
      }
      return null;
    };

    const statusClass = status => {
      const classes = {
        PENDING: 'bg-yellow-600/20 text-yellow-400',
        PROCESSING: 'bg-blue-600/20 text-blue-400',
        DONE: 'bg-green-600/20 text-green-400',
        FAILED: 'bg-red-600/20 text-red-400',
      };
      return classes[status] || 'bg-gray-600/20 text-gray-400';
    };

    // Normalize track status: backend sends camelCase (processingStatus)
    const getTrackStatus = track =>
      (track && (track.processingStatus ?? track.processingStatus)) || '—';

    const confidenceClass = confidence => {
      if (confidence >= 0.9) return 'text-green-400';
      if (confidence >= 0.75) return 'text-blue-400';
      if (confidence >= 0.5) return 'text-yellow-400';
      return 'text-red-400';
    };

    // Watchers
    watch(view, (newView, oldView) => {
      // Only clear filters if manually switching tabs (not from filter functions)
      // Check if we're switching to a view that doesn't match our current filters
      if (oldView && newView !== 'tracks' && albumFilter.value) {
        // Switching away from tracks view while album filter is set - keep it
        return;
      }
      if (oldView && newView !== 'tracks' && newView !== 'albums' && artistFilter.value) {
        // Switching away from albums/tracks while artist filter is set - keep it
        return;
      }

      offset.value = 0;
      searchQuery.value = '';
      statusFilter.value = 'all';
      trackStatusFilter.value = '';
      flaggedFilter.value = '';
      isolatedFilter.value = '';
      rejectedFilter.value = '';
      selectedIds.value.clear();
      expandedArtist.value = null;
      loadData();
    });

    watch(statusFilter, () => {
      offset.value = 0;
      loadData();
    });

    // Event listeners
    const handleTracksIngested = () => loadData();
    const handleArtistApproved = () => loadData();
    const handleTracksReclassified = () => loadData();
    const handleSpiderComplete = () => loadData();

    onMounted(() => {
      loadData();
      window.addEventListener('admin:tracks-ingested', handleTracksIngested);
      window.addEventListener('admin:artist-approved', handleArtistApproved);
      window.addEventListener('admin:tracks-reclassified', handleTracksReclassified);
      window.addEventListener('admin:spider-complete', handleSpiderComplete);
    });

    onUnmounted(() => {
      window.removeEventListener('admin:tracks-ingested', handleTracksIngested);
      window.removeEventListener('admin:artist-approved', handleArtistApproved);
      window.removeEventListener('admin:tracks-reclassified', handleTracksReclassified);
      window.removeEventListener('admin:spider-complete', handleSpiderComplete);
    });

    return {
      view,
      tracks,
      albums,
      artists,
      blocklist,
      duplicates,
      totalItems,
      searchQuery,
      statusFilter,
      trackStatusFilter,
      flaggedFilter,
      isolatedFilter,
      rejectedFilter,
      artistFilter,
      albumFilter,
      selectedArtistName,
      selectedAlbumName,
      limit,
      offset,
      loading,
      expandedArtist,
      expandedArtistAlbums,
      expandedAlbum,
      expandedAlbumTracks,
      showSpotifyContent,
      selectedIds,
      loadData,
      debouncedSearch,
      prevPage,
      nextPage,
      filterByArtist,
      filterByAlbum,
      clearFilters,
      toggleSelection,
      toggleSelectAll,
      isAllSelected,
      bulkReject,
      bulkApprove,
      reanalyze,
      reclassify,
      unflagTrack,
      rejectTrack,
      deleteTrack,
      mergeDuplicates,
      toggleArtistDetails,
      toggleAlbumDetails,
      approveArtist,
      rejectArtist,
      rejectAlbum,
      removeFromBlocklist,
      ingestAlbum,
      ingestTrack,
      getSpotifyTrackId,
      getSpotifyUrl,
      getAlbumSpotifyUrl,
      getTrackStatus,
      statusClass,
      confidenceClass,
      pageNumber,
      totalPages,
      // Rejection modal
      showRejectionModal,
      rejectionEntity,
      rejectionEntityType,
      collaborationData,
      closeRejectionModal,
      confirmRejection,
      // Confirmation modal
      showConfirmationModal,
      confirmationData,
    };
  },
  template: /*html*/ `
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <!-- Rejection Modal -->
            <RejectionModal
                :show="showRejectionModal"
                :entity-type="rejectionEntityType"
                :entity="rejectionEntity"
                :collaboration-data="collaborationData"
                @close="closeRejectionModal"
                @confirm="confirmRejection"
            />

            <!-- Confirmation Modal -->
            <ConfirmationModal
                :show="showConfirmationModal"
                :title="confirmationData.title"
                :message="confirmationData.message"
                :confirm-text="confirmationData.confirmText"
                :cancel-text="confirmationData.cancelText"
                :confirm-class="confirmationData.confirmClass"
                @confirm="confirmationData.onConfirm"
                @cancel="showConfirmationModal = false"
            />

            <div class="flex justify-between items-center mb-6">
                <div class="flex items-center gap-4">
                    <h2 class="font-bold text-xl">📚 Library Manager</h2>

                    <!-- Spotify Integration Toggle -->
                    <label class="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" v-model="showSpotifyContent"
                               class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-600 focus:ring-green-500">
                        <span class="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                            <svg class="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                            </svg>
                            Show missing from Spotify
                        </span>
                    </label>
                </div>

                <!-- Bulk Actions Banner -->
                <div v-if="selectedIds.size > 0" class="flex items-center gap-4 bg-indigo-900/30 border border-indigo-500/30 px-4 py-2 rounded animate-fade-in">
                    <span class="text-sm font-bold text-indigo-200">{{ selectedIds.size }} selected</span>
                    <button v-if="view === 'artists'" @click="bulkApprove" :disabled="loading"
                            class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">
                        ✅ Approve All
                    </button>
                    <button @click="bulkReject" :disabled="loading"
                            class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">
                        🗑️ Reject All
                    </button>
                </div>
            </div>

            <!-- View Tabs -->
            <div class="flex gap-2 mb-4 border-b border-gray-700 pb-2">
                <button @click="view = 'artists'" :class="view === 'artists' ? 'bg-indigo-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    👤 Artists
                </button>
                <button @click="view = 'albums'" :class="view === 'albums' ? 'bg-indigo-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    💿 Albums
                </button>
                <button @click="view = 'tracks'" :class="view === 'tracks' ? 'bg-indigo-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    🎵 Tracks
                </button>
                <button @click="view = 'duplicates'" :class="view === 'duplicates' ? 'bg-yellow-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    🔀 Duplicates
                </button>
                <button @click="view = 'blocklist'" :class="view === 'blocklist' ? 'bg-indigo-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    🚫 Blocklist
                </button>
            </div>

            <!-- Filters Row -->
            <div class="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                <!-- Search -->
                <div class="flex-1">
                    <input v-model="searchQuery" @input="debouncedSearch"
                           :placeholder="'Search ' + view + '...'"
                           class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                </div>

                <!-- Status Filter (Artists/Albums) -->
                <select v-if="view === 'artists' || view === 'albums'" v-model="statusFilter"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="all">All {{ view === 'artists' ? 'Artists' : 'Albums' }}</option>
                    <option value="pending">⏳ Pending Only</option>
                    <option value="analyzed">✅ Analyzed Only</option>
                </select>

                <!-- Collaboration Filter (Artists) -->
                <select v-if="view === 'artists'" v-model="isolatedFilter" @change="loadData"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="">All Artists</option>
                    <option value="true">Solo Artists Only</option>
                    <option value="false">🤝 With Collaborations</option>
                </select>

                <!-- Track Status Filter -->
                <select v-if="view === 'tracks'" v-model="trackStatusFilter" @change="loadData"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="">All Status</option>
                    <option value="PENDING">⏳ Pending</option>
                    <option value="PROCESSING">🔄 Processing</option>
                    <option value="DONE">✅ Done</option>
                    <option value="FAILED">❌ Failed</option>
                </select>

                <!-- Track Flagged Filter -->
                <select v-if="view === 'tracks'" v-model="flaggedFilter" @change="loadData"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="">All Tracks</option>
                    <option value="true">🚩 Flagged Only</option>
                    <option value="false">✅ Not Flagged</option>
                </select>

                <button @click="loadData" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm">
                    🔄 Refresh
                </button>
            </div>

            <!-- Breadcrumb Navigation / Active Filters -->
            <div v-if="artistFilter || albumFilter" class="mb-4 p-3 bg-indigo-900/20 border border-indigo-700/30 rounded">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm text-gray-400 font-bold">📍 Navigation:</span>

                    <!-- Artist breadcrumb -->
                    <div v-if="selectedArtistName" class="flex items-center gap-2">
                        <button @click="artistFilter = ''; selectedArtistName = ''; view = 'artists'; loadData()"
                                class="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors"
                                title="Back to all artists">
                            👤 {{ selectedArtistName }}
                        </button>
                        <span v-if="view === 'albums' || albumFilter" class="text-gray-500">→</span>
                    </div>

                    <!-- Album breadcrumb -->
                    <div v-if="selectedAlbumName && view === 'tracks'" class="flex items-center gap-2">
                        <button @click="albumFilter = ''; selectedAlbumName = ''; view = 'albums'; loadData()"
                                class="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors"
                                title="Back to albums">
                            💿 {{ selectedAlbumName }}
                        </button>
                        <span class="text-gray-500">→</span>
                        <span class="text-sm text-gray-300">Tracks</span>
                    </div>

                    <!-- View indicator when only artist filter -->
                    <span v-else-if="selectedArtistName && view === 'albums'" class="text-sm text-gray-300">
                        Albums
                    </span>

                    <button @click="clearFilters" class="text-sm bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded ml-auto transition-colors"
                            title="Clear all filters and return to main view">
                        ✕ Clear All
                    </button>
                </div>
            </div>

            <!-- Stats -->
            <div class="flex gap-4 mb-4 text-sm text-gray-400">
                <span>Total: {{ totalItems }}</span>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="text-center py-8 text-gray-500">
                <div class="text-2xl mb-2">⏳</div>
                <p>Loading...</p>
            </div>

            <!-- ARTISTS VIEW -->
            <div v-else-if="view === 'artists'">
                <!-- Select All Checkbox -->
                <div v-if="artists.length > 0" class="flex items-center gap-3 p-2 bg-gray-900/50 border-b border-gray-700 mb-2">
                    <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"
                           class="w-4 h-4 rounded border-gray-600 bg-gray-700">
                    <span class="text-xs text-gray-500 uppercase font-bold">Select All (Page)</span>
                </div>

                <div v-if="artists.length === 0" class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-2">🎉</div>
                    <p>{{ searchQuery ? 'No artists found matching your search' : 'No artists found' }}</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="artist in artists" :key="artist.id"
                         class="bg-gray-900 rounded border border-gray-700 overflow-hidden">

                        <div class="p-3 flex items-center gap-3 hover:bg-gray-800/50"
                             :class="expandedArtist === artist.id ? 'cursor-pointer' : ''">

                            <input type="checkbox"
                                   :checked="selectedIds.has(artist.id)"
                                   @change="toggleSelection(artist.id)"
                                   class="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500">

                            <div @click="toggleArtistDetails(artist)" class="flex items-center gap-3 flex-1 cursor-pointer">
                                <img v-if="artist.imageUrl" :src="artist.imageUrl" class="w-12 h-12 rounded object-cover">
                                <div v-else class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-lg">👤</div>

                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-sm truncate">{{ artist.name }}</div>
                                    <div class="text-xs text-gray-400 mt-1">
                                        {{ artist.trackCount }} tracks
                                        <span v-if="(artist.trackCount - artist.pendingCount) > 0" class="text-green-400">({{ (artist.trackCount - artist.pendingCount) }} analyzed)</span>
                                        <span v-if="artist.pendingCount > 0" class="text-yellow-400">({{ artist.pendingCount }} pending)</span>
                                    </div>

                                    <div class="flex gap-2 mt-1">
                                        <span v-if="!artist.is_isolated" class="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded border border-blue-600/30">
                                            🤝 {{ artist.shared_tracks }} collaboration{{ artist.shared_tracks !== 1 ? 's' : '' }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex gap-2">
                                <a v-if="artist.spotifyId" :href="getSpotifyUrl('artist', artist.spotifyId)"
                                   target="_blank" rel="noopener noreferrer"
                                   class="bg-green-700 hover:bg-green-600 px-3 py-2 rounded text-sm flex items-center gap-1"
                                   title="Open in Spotify"
                                   @click.stop>
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                    </svg>
                                    Spotify
                                </a>
                                <button @click.stop="filterByArtist(artist.id, artist.name)"
                                        class="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded text-sm"
                                        title="View albums by this artist">
                                    💿 Albums
                                </button>
                                <button v-if="artist.pendingCount > 0" @click.stop="approveArtist(artist)"
                                        class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm"
                                        title="Approve artist and queue tracks for analysis">
                                    ✅
                                </button>
                                <button @click.stop="rejectArtist(artist)"
                                        class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
                                        title="Reject artist">
                                    🗑️
                                </button>
                                <button @click="toggleArtistDetails(artist)" class="text-gray-400 px-2">
                                    {{ expandedArtist === artist.id ? '▲' : '▼' }}
                                </button>
                            </div>
                        </div>

                        <!-- Expanded Details -->
                        <div v-if="expandedArtist === artist.id" class="p-4 bg-gray-950 border-t border-gray-700 space-y-4">
                            <!-- Collaborations Section -->
                            <div v-if="!artist.is_isolated" class="border-b border-gray-800 pb-3">
                                <div class="text-xs uppercase text-gray-500 font-bold mb-2">🤝 Collaborates With:</div>
                                <div class="flex flex-wrap gap-2">
                                    <button v-for="collab in artist.shared_with_artists" :key="collab"
                                          @click.stop="searchQuery = collab; view = 'artists'; loadData()"
                                          class="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2 py-1 rounded border border-blue-600/30 transition-colors cursor-pointer"
                                          :title="'Search for ' + collab">
                                        👥 {{ collab }}
                                    </button>
                                </div>
                                <div class="text-xs text-gray-500 mt-2">
                                    {{ artist.shared_tracks }} collaborative tracks across {{ artist.shared_albums }} albums
                                </div>
                            </div>

                            <!-- Albums Section -->
                            <div>
                                <div class="text-xs uppercase text-gray-500 font-bold mb-2">
                                    💿 Albums ({{ expandedArtistAlbums.length }})
                                </div>
                                <div v-if="expandedArtistAlbums.length === 0" class="text-sm text-gray-500 italic">
                                    Loading albums...
                                </div>
                                <div v-else class="space-y-2 max-h-64 overflow-y-auto">
                                    <div v-for="album in expandedArtistAlbums" :key="album.id"
                                         class="flex items-center gap-2 p-2 rounded border transition-colors"
                                         :class="album.inLibrary === false ? 'bg-gray-900/50 border-orange-700/50' : 'bg-gray-900 hover:bg-gray-800 border-gray-800'">
                                        <img v-if="album.coverImageUrl" :src="album.coverImageUrl" class="w-8 h-8 rounded object-cover">
                                        <div v-else class="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-xs">💿</div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <div class="text-xs font-medium truncate">{{ album.title }}</div>
                                                <span v-if="album.inLibrary === false" class="text-xs bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded border border-orange-600/30 shrink-0">
                                                    Not in library
                                                </span>
                                            </div>
                                            <div class="text-xs text-gray-500">
                                                {{ album.trackCount }} tracks
                                                <span v-if="(album.trackCount - album.pendingCount) > 0" class="text-green-400">({{ (album.trackCount - album.pendingCount) }} analyzed)</span>
                                            </div>
                                        </div>
                                        <button v-if="album.inLibrary !== false" @click.stop="filterByAlbum(album.id, album.title)"
                                                class="bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-xs shrink-0"
                                                title="View tracks in this album">
                                            🎵 Tracks
                                        </button>
                                        <template v-else>
                                            <button @click.stop="ingestAlbum(album.spotifyId, album.title)"
                                                    class="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs shrink-0"
                                                    title="Ingest this album into library">
                                                Ingest
                                            </button>
                                            <a :href="album.spotifyUrl || getSpotifyUrl('album', album.spotifyId)"
                                               target="_blank" rel="noopener noreferrer"
                                               class="bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-xs shrink-0 flex items-center gap-1"
                                               title="Open in Spotify">
                                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                                </svg>
                                                Spotify
                                            </a>
                                        </template>
                                    </div>
                                </div>
                            </div>

                            <div v-if="artist.is_isolated" class="text-sm text-gray-400 italic">
                                ℹ️ This artist has no collaborations with other artists in your database.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ALBUMS VIEW -->
            <div v-else-if="view === 'albums'">
                <!-- Select All Checkbox -->
                <div v-if="albums.length > 0" class="flex items-center gap-3 p-2 bg-gray-900/50 border-b border-gray-700 mb-2">
                    <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"
                           class="w-4 h-4 rounded border-gray-600 bg-gray-700">
                    <span class="text-xs text-gray-500 uppercase font-bold">Select All (Page)</span>
                </div>

                <div v-if="albums.length === 0" class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-2">🎉</div>
                    <p>{{ searchQuery ? 'No albums found matching your search' : 'No albums found' }}</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="album in albums" :key="album.id"
                         class="bg-gray-900 rounded border border-gray-700 overflow-hidden">

                        <div class="p-3 flex items-center gap-3">
                            <input type="checkbox"
                                   :checked="selectedIds.has(album.id)"
                                   @change="toggleSelection(album.id)"
                                   class="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500">

                            <img v-if="album.coverImageUrl" :src="album.coverImageUrl" class="w-12 h-12 rounded object-cover">
                            <div v-else class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-lg">💿</div>

                            <div @click="toggleAlbumDetails(album)" class="flex-1 min-w-0 cursor-pointer hover:bg-gray-800/50 -m-3 p-3 rounded">
                                <div class="font-bold text-sm truncate">{{ album.title }}</div>
                                <div class="text-xs text-gray-400">{{ album.artistName }}</div>
                                <div class="text-xs text-gray-500 mt-1">
                                    {{ album.trackCount }} tracks
                                    <span v-if="(album.trackCount - album.pendingCount) > 0" class="text-green-400">({{ (album.trackCount - album.pendingCount) }} analyzed)</span>
                                    <span v-if="album.pendingCount > 0" class="text-yellow-400">({{ album.pendingCount }} pending)</span>
                                </div>
                                <!-- Show all artists as clickable badges -->
                                <div v-if="album.allArtists && album.allArtists.length > 0" class="flex flex-wrap gap-1 mt-2">
                                    <button v-for="artistName in album.allArtists" :key="artistName"
                                            @click.stop="searchQuery = artistName; view = 'artists'; loadData()"
                                            class="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2 py-0.5 rounded border border-blue-600/30 transition-colors"
                                            :title="'Search for ' + artistName">
                                        👤 {{ artistName }}
                                    </button>
                                    <span v-if="album.allArtists.length > 1" class="text-xs text-blue-500">
                                        (🤝 Collaboration)
                                    </span>
                                </div>
                            </div>

                            <div class="flex gap-2">
                                <button @click="filterByAlbum(album.id, album.title)"
                                        class="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded text-sm"
                                        title="View tracks in this album">
                                    🎵 Tracks
                                </button>
                                <button @click="rejectAlbum(album)"
                                        class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
                                        title="Reject album">
                                    🗑️
                                </button>
                                <button @click="toggleAlbumDetails(album)" class="text-gray-400 px-2">
                                    {{ expandedAlbum === album.id ? '▲' : '▼' }}
                                </button>
                            </div>
                        </div>

                        <!-- Expanded Album Tracks Preview -->
                        <div v-if="expandedAlbum === album.id" class="p-4 bg-gray-950 border-t border-gray-700">
                            <div class="flex items-center justify-between mb-2">
                                <div class="text-xs uppercase text-gray-500 font-bold">
                                    🎵 Tracks ({{ expandedAlbumTracks.length }})
                                </div>
                                <a v-if="getAlbumSpotifyUrl(expandedAlbumTracks)"
                                   :href="getAlbumSpotifyUrl(expandedAlbumTracks)"
                                   target="_blank" rel="noopener noreferrer"
                                   class="bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-xs flex items-center gap-1"
                                   title="Open in Spotify">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                    </svg>
                                    Spotify
                                </a>
                            </div>
                            <div v-if="expandedAlbumTracks.length === 0" class="text-sm text-gray-500 italic">
                                Loading tracks...
                            </div>
                            <div v-else class="space-y-1 max-h-64 overflow-y-auto">
                                <div v-for="track in expandedAlbumTracks" :key="track.id"
                                     class="flex items-center gap-2 p-2 rounded text-xs transition-colors"
                                     :class="track.inLibrary === false ? 'bg-gray-900/50 border border-orange-700/50' : 'bg-gray-900 hover:bg-gray-800'">
                                    <InlinePlayer
                                        :playback-links="track.playbackLinks || []"
                                        :track-title="track.title"
                                    />
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <div class="font-medium truncate">{{ track.title }}</div>
                                            <span v-if="track.inLibrary === false" class="text-xs bg-orange-600/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-600/30 shrink-0">
                                                Not in library
                                            </span>
                                        </div>
                                        <div class="text-gray-500">{{ track.artists?.join(', ') || '-' }}</div>
                                    </div>
                                    <button v-if="track.inLibrary === false" @click.stop="ingestTrack(track.spotifyId)"
                                            class="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs shrink-0"
                                            title="Ingest this track into library">
                                        Ingest
                                    </button>
                                    <span v-if="getTrackStatus(track) && getTrackStatus(track) !== '—' && getTrackStatus(track) !== 'NOT_IN_LIBRARY'" :class="statusClass(getTrackStatus(track))" class="px-2 py-0.5 rounded text-xs shrink-0">
                                        {{ getTrackStatus(track) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TRACKS VIEW -->
            <div v-else-if="view === 'tracks'" class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="text-xs uppercase text-gray-500 border-b border-gray-700">
                        <tr>
                            <th class="py-2 px-2">Play</th>
                            <th class="py-2 px-2">Title</th>
                            <th class="py-2 px-2">Artist</th>
                            <th class="py-2 px-2">Album</th>
                            <th class="py-2 px-2">Status</th>
                            <th class="py-2 px-2">Style</th>
                            <th class="py-2 px-2">Confidence</th>
                            <th class="py-2 px-2">Flagged</th>
                            <th class="py-2 px-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="track in tracks" :key="track.id"
                            class="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td class="py-2 px-2">
                                <InlinePlayer
                                    :playback-links="track.playbackLinks || []"
                                    :track-title="track.title"
                                />
                            </td>
                            <td class="py-2 px-2 max-w-xs truncate" :title="track.title">
                                {{ track.title }}
                            </td>
                            <td class="py-2 px-2 text-sm max-w-xs">
                                <div v-if="track.artists && track.artists.length > 0" class="flex flex-wrap gap-1">
                                    <button v-for="(artistName, idx) in track.artists" :key="idx"
                                            @click="searchQuery = artistName; view = 'artists'; loadData()"
                                            class="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                                            :title="'Search for ' + artistName">
                                        {{ artistName }}{{ idx < track.artists.length - 1 ? ',' : '' }}
                                    </button>
                                </div>
                                <span v-else class="text-gray-500">-</span>
                            </td>
                            <td class="py-2 px-2 text-sm">
                                <template v-if="track.albums && track.albums.length > 0">
                                    <template v-if="track.albums.length === 1">
                                        <button @click="filterByAlbum(track.albums[0].id, track.albums[0].title)"
                                                class="text-indigo-400 hover:text-indigo-300 underline truncate max-w-xs block text-left"
                                                :title="'View all tracks from: ' + track.albums[0].title">
                                            {{ track.albums[0].title }}
                                        </button>
                                    </template>
                                    <div v-else class="flex flex-wrap gap-1">
                                        <button v-for="album in track.albums" :key="album.id"
                                                @click="filterByAlbum(album.id, album.title)"
                                                class="text-xs text-indigo-400 hover:text-indigo-300 underline bg-indigo-900/20 px-2 py-0.5 rounded"
                                                :title="'View all tracks from: ' + album.title">
                                            {{ album.title }}
                                        </button>
                                    </div>
                                </template>
                                <template v-else-if="track.albumId">
                                    <button @click="filterByAlbum(track.albumId, track.albumTitle)"
                                            class="text-indigo-400 hover:text-indigo-300 underline truncate max-w-xs block text-left"
                                            :title="'View all tracks from: ' + track.albumTitle">
                                        {{ track.albumTitle }}
                                    </button>
                                </template>
                                <span v-else class="text-gray-500">-</span>
                            </td>
                            <td class="py-2 px-2">
                                <span :class="statusClass(getTrackStatus(track))" class="px-2 py-1 rounded text-xs font-medium">
                                    {{ getTrackStatus(track) }}
                                </span>
                            </td>
                            <td class="py-2 px-2">{{ track.danceStyle || '-' }}</td>
                            <td class="py-2 px-2 text-sm">
                                <span v-if="track.confidence" :class="confidenceClass(track.confidence)">
                                    {{ (track.confidence * 100).toFixed(0) }}%
                                </span>
                                <span v-else class="text-gray-500">-</span>
                            </td>
                            <td class="py-2 px-2">
                                <span v-if="track.isFlagged"
                                      class="px-2 py-1 rounded text-xs font-medium bg-amber-600/20 text-amber-400 border border-amber-600/30"
                                      :title="'Flagged: ' + (track.flagReason || 'not_folk_music')">
                                    🚩
                                </span>
                                <span v-else class="text-gray-500 text-xs">-</span>
                            </td>
                            <td class="py-2 px-2">
                                <div class="flex gap-1">
                                    <a v-if="getSpotifyTrackId(track)"
                                       :href="getSpotifyUrl('track', getSpotifyTrackId(track))"
                                       target="_blank" rel="noopener noreferrer"
                                       class="bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-xs flex items-center"
                                       title="Open in Spotify">
                                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                        </svg>
                                    </a>
                                    <button @click="reanalyze(track)" :disabled="track.loading"
                                            class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Full re-analysis">
                                        {{ track.loading ? '...' : '🔄' }}
                                    </button>
                                    <button @click="reclassify(track)" :disabled="track.loading || getTrackStatus(track) !== 'DONE'"
                                            class="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Re-classify only">
                                        🏷️
                                    </button>
                                    <button v-if="track.isFlagged" @click="unflagTrack(track)" :disabled="track.loading"
                                            class="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Remove flag">
                                        {{ track.loading ? '...' : '✓' }}
                                    </button>
                                    <button @click="deleteTrack(track)"
                                            class="bg-orange-600 hover:bg-orange-500 px-2 py-1 rounded text-xs"
                                            title="Delete track (no blocklist)">
                                        ✕
                                    </button>
                                    <button @click="rejectTrack(track)"
                                            class="bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-xs"
                                            title="Reject track & blocklist">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- DUPLICATES VIEW -->
            <div v-else-if="view === 'duplicates'">
                <div v-if="duplicates.length === 0" class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-2">✨</div>
                    <p>No duplicate tracks found!</p>
                </div>

                <div v-else class="space-y-4">
                    <div v-for="group in duplicates" :key="group.identifier"
                         class="bg-gray-900 rounded border border-yellow-700/50 overflow-hidden">
                        <div class="p-3 bg-yellow-900/20 border-b border-yellow-700/30 flex items-center justify-between">
                            <div class="font-bold text-sm text-yellow-400">
                                <span v-if="group.type === 'isrc'">
                                    🔀 ISRC: {{ group.identifier }} ({{ group.count }} tracks)
                                </span>
                                <span v-else-if="group.type === 'spotify_link'">
                                    🔀 Spotify Link: {{ group.identifier.substring(0, 20) }}... ({{ group.count }} tracks)
                                </span>
                                <span v-else>
                                    🔀 Album/Title: {{ group.identifier }} ({{ group.count }} tracks)
                                </span>
                            </div>
                            <button v-if="group.type === 'isrc' && group.count > 1"
                                    @click="mergeDuplicates(group)"
                                    class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-medium transition-colors"
                                    title="Merge all duplicates into a single canonical track">
                                🔀 Merge Duplicates
                            </button>
                        </div>
                        <div class="divide-y divide-gray-700">
                            <div v-for="track in group.tracks" :key="track.id"
                                 class="p-3 hover:bg-gray-800/50 flex items-center gap-3">
                                <InlinePlayer
                                    :playback-links="track.playbackLinks || []"
                                    :track-title="track.title"
                                />
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium text-sm truncate">{{ track.title }}</div>
                                    <div class="text-xs text-gray-400 mt-1">
                                        {{ track.artists?.join(', ') || '-' }}
                                    </div>
                                    <div class="text-xs text-gray-500 mt-1">
                                        <template v-if="track.albums && track.albums.length > 0">
                                            Album<span v-if="track.albums.length > 1">s</span>:
                                            <template v-for="(album, i) in track.albums" :key="album.id">
                                                {{ album.title }}<span v-if="i < track.albums.length - 1">, </span>
                                            </template> •
                                        </template>
                                        <template v-else>
                                            Album: {{ track.albumTitle || 'N/A' }} •
                                        </template>
                                        ISRC: {{ track.isrc || 'N/A' }} •
                                        {{ track.durationMs ? Math.floor(track.durationMs / 1000) + 's' : 'N/A' }} •
                                        <span :class="statusClass(getTrackStatus(track))" class="px-1 py-0.5 rounded">
                                            {{ getTrackStatus(track) }}
                                        </span>
                                    </div>
                                </div>
                                <button @click="deleteTrack(track)"
                                        class="bg-orange-600 hover:bg-orange-500 px-3 py-2 rounded text-sm"
                                        title="Delete this duplicate">
                                    ✕ Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- BLOCKLIST VIEW -->
            <div v-else-if="view === 'blocklist'">
                <div v-if="blocklist.length === 0" class="text-center py-8 text-gray-500">
                    <p>No items in blocklist</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="item in blocklist" :key="item.id"
                         class="p-3 bg-gray-900 rounded border border-gray-700 flex items-start justify-between">
                        <div class="flex-1">
                            <div class="font-bold text-sm">{{ item.entityName }}</div>
                            <div class="text-xs text-gray-400 mt-1">
                                Type: {{ item.entityType }} • Reason: {{ item.reason }}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">
                                Blocked: {{ new Date(item.rejectedAt).toLocaleDateString() }}
                            </div>
                        </div>
                        <button @click="removeFromBlocklist(item)"
                                class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm"
                                title="Remove from blocklist">
                            ↩️ Restore
                        </button>
                    </div>
                </div>
            </div>

            <!-- Pagination -->
            <div class="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
                <button @click="prevPage" :disabled="offset === 0 || loading"
                        class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm">
                    ← Previous
                </button>
                <span class="text-gray-400 text-sm">
                    Page {{ pageNumber }} of {{ totalPages || 1 }}
                </span>
                <button @click="nextPage" :disabled="offset + limit >= totalItems || loading"
                        class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm">
                    Next →
                </button>
            </div>
        </div>
    `,
};
