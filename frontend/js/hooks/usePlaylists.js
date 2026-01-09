/**
 * Playlists composable.
 *
 * Handles playlist CRUD operations and track management.
 */
import { ref } from 'vue';
import { useAuth } from './useAuth.js';
import { showError, showToast } from './useToast.js';

const { fetchWithAuth, isAuthenticated } = useAuth();

// --- STATE ---
const playlists = ref([]);
const currentPlaylist = ref(null);
const loading = ref(false);

// --- ACTIONS ---

/**
 * Fetch all playlists for the current user.
 */
async function fetchUserPlaylists() {
  if (!isAuthenticated.value) return;

  loading.value = true;
  try {
    const response = await fetchWithAuth('/api/playlists/');
    if (!response.ok) throw new Error('Failed to fetch playlists');

    playlists.value = await response.json();
  } catch (error) {
    console.error('Fetch playlists error:', error);
    showError('Kunde inte hämta spellistor');
  } finally {
    loading.value = false;
  }
}

/**
 * Fetch a single playlist by ID.
 */
async function fetchPlaylist(playlistId) {
  loading.value = true;
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}`);
    if (!response.ok) {
      if (response.status === 403) {
        showError('Du har inte åtkomst till denna spellista');
      } else {
        throw new Error('Playlist not found');
      }
      return null;
    }

    currentPlaylist.value = await response.json();
    return currentPlaylist.value;
  } catch (error) {
    console.error('Fetch playlist error:', error);
    showError('Kunde inte hämta spellista');
    return null;
  } finally {
    loading.value = false;
  }
}

/**
 * Fetch a public playlist by share token (no auth required).
 */
async function fetchPlaylistByShareToken(shareToken) {
  loading.value = true;
  try {
    const response = await fetch(`/api/playlists/share/${shareToken}`);
    if (!response.ok) throw new Error('Playlist not found');

    currentPlaylist.value = await response.json();
    return currentPlaylist.value;
  } catch (error) {
    console.error('Fetch shared playlist error:', error);
    showError('Spellistan kunde inte hittas');
    return null;
  } finally {
    loading.value = false;
  }
}

/**
 * Create a new playlist.
 */
async function createPlaylist(name, description = '', isPublic = false) {
  try {
    const response = await fetchWithAuth('/api/playlists/', {
      method: 'POST',
      body: JSON.stringify({ name, description, is_public: isPublic }),
    });

    if (!response.ok) throw new Error('Failed to create playlist');

    const newPlaylist = await response.json();
    playlists.value.unshift(newPlaylist);
    showToast(`Spellistan "${name}" skapad!`, 'success');
    return newPlaylist;
  } catch (error) {
    console.error('Create playlist error:', error);
    showError('Kunde inte skapa spellista');
    return null;
  }
}

/**
 * Update playlist metadata.
 */
async function updatePlaylist(playlistId, updates) {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error('Failed to update playlist');

    const updated = await response.json();

    // Update in list
    const index = playlists.value.findIndex(p => p.id === playlistId);
    if (index !== -1) {
      playlists.value[index] = updated;
    }

    // Update current playlist if viewing
    if (currentPlaylist.value?.id === playlistId) {
      currentPlaylist.value = { ...currentPlaylist.value, ...updated };
    }

    showToast('Spellistan uppdaterad', 'success');
    return updated;
  } catch (error) {
    console.error('Update playlist error:', error);
    showError('Kunde inte uppdatera spellista');
    return null;
  }
}

/**
 * Delete a playlist.
 */
async function deletePlaylist(playlistId) {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to delete playlist');

    playlists.value = playlists.value.filter(p => p.id !== playlistId);
    showToast('Spellistan borttagen', 'success');
    return true;
  } catch (error) {
    console.error('Delete playlist error:', error);
    showError('Kunde inte ta bort spellista');
    return false;
  }
}

/**
 * Add a track to a playlist.
 */
async function addTrackToPlaylist(playlistId, trackId, position = null) {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId, position }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.detail?.includes('already in playlist')) {
        showToast('Låten finns redan i spellistan', 'info');
        return false;
      }
      throw new Error('Failed to add track');
    }

    showToast('Låt tillagd i spellista', 'success');

    // Refresh playlist if viewing
    if (currentPlaylist.value?.id === playlistId) {
      await fetchPlaylist(playlistId);
    }

    return true;
  } catch (error) {
    console.error('Add track error:', error);
    showError('Kunde inte lägga till låt');
    return false;
  }
}

/**
 * Remove a track from a playlist.
 */
async function removeTrackFromPlaylist(playlistId, trackId) {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to remove track');

    showToast('Låt borttagen från spellista', 'success');

    // Update current playlist if viewing
    if (currentPlaylist.value?.id === playlistId) {
      currentPlaylist.value.tracks = currentPlaylist.value.tracks.filter(
        t => t.track.id !== trackId
      );
      currentPlaylist.value.track_count--;
    }

    return true;
  } catch (error) {
    console.error('Remove track error:', error);
    showError('Kunde inte ta bort låt');
    return false;
  }
}

/**
 * Reorder a track in a playlist.
 */
async function reorderTrack(playlistId, trackId, newPosition) {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}/tracks/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ track_id: trackId, new_position: newPosition }),
    });

    if (!response.ok) throw new Error('Failed to reorder track');

    // Refresh playlist to get updated positions
    if (currentPlaylist.value?.id === playlistId) {
      await fetchPlaylist(playlistId);
    }

    return true;
  } catch (error) {
    console.error('Reorder track error:', error);
    showError('Kunde inte flytta låt');
    return false;
  }
}

// Export composable
export function usePlaylists() {
  return {
    playlists,
    currentPlaylist,
    loading,
    fetchUserPlaylists,
    fetchPlaylist,
    fetchPlaylistByShareToken,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    reorderTrack,
  };
}
