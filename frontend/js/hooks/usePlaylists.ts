/**
 * Playlists composable.
 *
 * Handles playlist CRUD operations and track management.
 */
import { ref, type Ref } from 'vue';
import { useAuth } from './useAuth';
import { showError, showToast } from './useToast';
import type {
  Playlist,
  PlaylistCollaborator,
  InvitationDto,
  UserSummaryDto,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  InviteCollaboratorRequest,
  UpdateCollaboratorRequest,
  ReorderTracksRequest,
  RespondToInvitationRequest,
} from '../api/models';

const { fetchWithAuth, isAuthenticated } = useAuth();

/** Playlist as returned by API (may include snake_case fields) */
type PlaylistWithCount = Playlist & { track_count?: number };

// --- STATE ---
const playlists: Ref<PlaylistWithCount[]> = ref<PlaylistWithCount[]>([]);
const currentPlaylist: Ref<Playlist | null> = ref<Playlist | null>(null);
const sharedPlaylists: Ref<Playlist[]> = ref<Playlist[]>([]);
const pendingInvitations: Ref<InvitationDto[]> = ref<InvitationDto[]>([]);
const loading = ref<boolean>(false);

// --- ACTIONS ---

/**
 * Fetch all playlists for the current user.
 */
async function fetchUserPlaylists(): Promise<void> {
  if (!isAuthenticated.value) return;

  loading.value = true;
  try {
    const response = await fetchWithAuth('/api/playlists/');
    if (!response.ok) throw new Error('Failed to fetch playlists');

    playlists.value = (await response.json()) as PlaylistWithCount[];
  } catch (error) {
    console.error('Fetch playlists error:', error);
    showError('Kunde inte hämta spellistor');
  } finally {
    loading.value = false;
  }
}

/**
 * Fetch a single playlist by ID.
 * Works for both authenticated users (own/shared playlists) and unauthenticated (public playlists).
 */
async function fetchPlaylist(playlistId: string): Promise<Playlist | null> {
  loading.value = true;
  try {
    // Try with auth first if authenticated, otherwise fetch without auth
    let response: Response;
    if (isAuthenticated.value) {
      response = await fetchWithAuth(`/api/playlists/${playlistId}`);
    } else {
      response = await fetch(`/api/playlists/${playlistId}`);
    }

    if (!response.ok) {
      if (response.status === 403) {
        showError('Du har inte åtkomst till denna spellista');
      } else if (response.status === 404) {
        // Playlist not found or not public
        return null;
      } else {
        throw new Error('Playlist not found');
      }
      return null;
    }

    currentPlaylist.value = (await response.json()) as Playlist;
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
async function fetchPlaylistByShareToken(shareToken: string): Promise<Playlist | null> {
  loading.value = true;
  try {
    const response = await fetch(`/api/playlists/share/${shareToken}`);
    if (!response.ok) throw new Error('Playlist not found');

    currentPlaylist.value = (await response.json()) as Playlist;
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
async function createPlaylist(name: string, description = '', isPublic = false): Promise<Playlist | null> {
  try {
    const body: CreatePlaylistRequest & { is_public?: boolean } = {
      name,
      description,
      is_public: isPublic,
    };

    const response = await fetchWithAuth('/api/playlists/', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error('Failed to create playlist');

    const newPlaylist = (await response.json()) as PlaylistWithCount;
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
async function updatePlaylist(playlistId: string, updates: Partial<UpdatePlaylistRequest>): Promise<Playlist | null> {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error('Failed to update playlist');

    const updated = (await response.json()) as Playlist;

    // Update in list
    const index = playlists.value.findIndex((p) => p.id === playlistId);
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
async function deletePlaylist(playlistId: string): Promise<boolean> {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to delete playlist');

    playlists.value = playlists.value.filter((p) => p.id !== playlistId);
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
async function addTrackToPlaylist(playlistId: string, trackId: string, position: number | null = null): Promise<boolean> {
  try {
    const body = {
      track_id: trackId,
      position,
    };

    const response = await fetchWithAuth(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as { detail?: string };
      if (errorBody.detail?.includes('already in playlist')) {
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
async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to remove track');

    showToast('Låt borttagen från spellista', 'success');

    // Update current playlist if viewing
    if (currentPlaylist.value?.id === playlistId && currentPlaylist.value.tracks) {
      currentPlaylist.value.tracks = currentPlaylist.value.tracks.filter((t) => t.track?.id !== trackId);
      (currentPlaylist.value as PlaylistWithCount).track_count = Math.max(
        0,
        ((currentPlaylist.value as PlaylistWithCount).track_count ?? 0) - 1,
      );
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
async function reorderTrack(playlistId: string, trackId: string, newPosition: number): Promise<boolean> {
  try {
    const body: { track_id: string; new_position: number } = {
      track_id: trackId,
      new_position: newPosition,
    };

    const response = await fetchWithAuth(`/api/playlists/${playlistId}/tracks/reorder`, {
      method: 'PUT',
      body: JSON.stringify(body),
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

/**
 * Fetch playlists shared with the current user.
 */
async function fetchSharedPlaylists(): Promise<void> {
  if (!isAuthenticated.value) return;

  loading.value = true;
  try {
    const response = await fetchWithAuth('/api/playlists/shared');
    if (!response.ok) throw new Error('Failed to fetch shared playlists');

    sharedPlaylists.value = (await response.json()) as PlaylistWithCount[];
  } catch (error) {
    console.error('Fetch shared playlists error:', error);
    showError('Kunde inte hämta delade spellistor');
  } finally {
    loading.value = false;
  }
}

/**
 * Fetch pending invitations for the current user.
 */
async function fetchPendingInvitations(): Promise<void> {
  if (!isAuthenticated.value) return;

  try {
    const response = await fetchWithAuth('/api/playlists/invitations?status_filter=pending');
    if (!response.ok) throw new Error('Failed to fetch invitations');

    pendingInvitations.value = (await response.json()) as InvitationDto[];
  } catch (error) {
    console.error('Fetch invitations error:', error);
  }
}

/**
 * Invite a user to collaborate on a playlist.
 */
async function inviteUserToPlaylist(
  playlistId: string,
  username: string,
  permission: InviteCollaboratorRequest['permission'],
): Promise<PlaylistCollaborator | null> {
  try {
    const body: { username: string; permission: InviteCollaboratorRequest['permission'] } = {
      username,
      permission,
    };
    const response = await fetchWithAuth(`/api/playlists/${playlistId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as { detail?: string };
      if (errorBody.detail) {
        showError(errorBody.detail);
      } else {
        throw new Error('Failed to invite user');
      }
      return null;
    }

    const collaboration = (await response.json()) as PlaylistCollaborator;
    showToast(`Inbjudan skickad till @${username}`, 'success');
    return collaboration;
  } catch (error) {
    console.error('Invite user error:', error);
    showError('Kunde inte skicka inbjudan');
    return null;
  }
}

/**
 * Fetch collaborators for a playlist (owner only).
 */
async function fetchPlaylistCollaborators(playlistId: string): Promise<PlaylistCollaborator[]> {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}/collaborators`);
    if (!response.ok) throw new Error('Failed to fetch collaborators');

    return (await response.json()) as PlaylistCollaborator[];
  } catch (error) {
    console.error('Fetch collaborators error:', error);
    showError('Kunde inte hämta medarbetare');
    return [];
  }
}

/**
 * Update a collaborator's permission level (owner only).
 */
async function updateCollaboratorPermission(
  playlistId: string,
  collaboratorId: string,
  permission: UpdateCollaboratorRequest['permission'],
): Promise<PlaylistCollaborator | null> {
  try {
    const response = await fetchWithAuth(
      `/api/playlists/${playlistId}/collaborators/${collaboratorId}?permission=${permission}`,
      {
        method: 'PUT',
      },
    );

    if (!response.ok) throw new Error('Failed to update permission');

    showToast('Behörighet uppdaterad', 'success');
    return (await response.json()) as PlaylistCollaborator;
  } catch (error) {
    console.error('Update permission error:', error);
    showError('Kunde inte uppdatera behörighet');
    return null;
  }
}

/**
 * Remove a collaborator from a playlist.
 */
async function removeCollaborator(playlistId: string, collaboratorId: string): Promise<boolean> {
  try {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to remove collaborator');

    showToast('Medarbetare borttagen', 'success');
    return true;
  } catch (error) {
    console.error('Remove collaborator error:', error);
    showError('Kunde inte ta bort medarbetare');
    return false;
  }
}

/**
 * Accept or reject a playlist invitation.
 */
async function respondToInvitation(invitationId: string, status: 'accepted' | 'rejected'): Promise<boolean> {
  try {
    const body: RespondToInvitationRequest = { accept: status === 'accepted' };
    const response = await fetchWithAuth(`/api/playlists/invitations/${invitationId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error('Failed to respond to invitation');

    const result = (await response.json()) as { message?: string };
    showToast(result.message || `Inbjudan ${status === 'accepted' ? 'accepterad' : 'avvisad'}`, 'success');

    // Refresh invitations and shared playlists
    await fetchPendingInvitations();
    if (status === 'accepted') {
      await fetchSharedPlaylists();
    }

    return true;
  } catch (error) {
    console.error('Respond to invitation error:', error);
    showError('Kunde inte svara på inbjudan');
    return false;
  }
}

/**
 * Copy share link to clipboard.
 * Uses the direct playlist URL (works for public playlists).
 */
async function copyShareLink(playlist: Playlist): Promise<boolean> {
  const isPublic = playlist.isPublic ?? (playlist as { is_public?: boolean }).is_public;
  if (!isPublic) {
    showError('Denna spellista är inte offentlig');
    return false;
  }

  // Use direct playlist URL - works for public playlists without authentication
  const shareUrl = `${window.location.origin}/playlist/${playlist.id}`;

  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('Länk kopierad!', 'success');
    return true;
  } catch (error) {
    console.error('Copy link error:', error);
    showError('Kunde inte kopiera länk');
    return false;
  }
}

/**
 * Search users by username for invitations.
 */
async function searchUsers(username: string): Promise<UserSummaryDto[]> {
  if (!username || username.length < 2) return [];

  try {
    const response = await fetchWithAuth(`/api/users/search?username=${encodeURIComponent(username)}`);
    if (!response.ok) return [];

    return (await response.json()) as UserSummaryDto[];
  } catch (error) {
    console.error('Search users error:', error);
    return [];
  }
}

// Export composable
export function usePlaylists() {
  return {
    playlists,
    currentPlaylist,
    sharedPlaylists,
    pendingInvitations,
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
    fetchSharedPlaylists,
    fetchPendingInvitations,
    inviteUserToPlaylist,
    fetchPlaylistCollaborators,
    updateCollaboratorPermission,
    removeCollaborator,
    respondToInvitation,
    copyShareLink,
    searchUsers,
  };
}

