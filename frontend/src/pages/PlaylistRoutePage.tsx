import { useAuth } from '@/auth/useAuth';
import { RowSkeleton } from '@/ui';
import { PlaylistPage } from '@/pages/PlaylistPage';
import { SharedPlaylistPage } from '@/pages/SharedPlaylistPage';

/**
 * A signed-in person gets the full playlist page. Anyone else gets the read-only page of a
 * public playlist, from the public API.
 */
export function PlaylistRoutePage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <RowSkeleton rows={5} label="Laddar spellistan" />;
  return isAuthenticated ? <PlaylistPage /> : <SharedPlaylistPage source="public" />;
}
