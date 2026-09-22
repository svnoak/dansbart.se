import type { PlaylistDto } from '@/api/models/playlistDto';

export function canEditPlaylist(playlist: PlaylistDto | null, userId: string | undefined): boolean {
  if (!playlist) return false;
  if (playlist.viewerCanManage === true) return true;
  if (!userId) return false;
  const collaborator = playlist.collaborators?.find((c) => c.userId === userId);
  return collaborator?.permission === 'edit' && collaborator?.status === 'accepted';
}
