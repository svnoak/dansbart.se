import { useEffect, useState } from 'react';
import { useAnalyticsFlag } from '@/analytics/useAnalyticsFlag';
import { useNavigate } from 'react-router-dom';
import {
  getMyPlaylists1,
  createPlaylist,
  getInvitations,
  respondToInvitation,
} from '@/api/generated/playlists/playlists';
import type { PlaylistListItemDto } from '@/api/models/playlistListItemDto';
import type { InvitationDto } from '@/api/models/invitationDto';
import { PlaylistIcon, PlusIcon } from '@/icons';
import { toast, Card, Badge, Button, InlineError, LoadError, SectionTitle, PageHeader, EmptyState, LinkButton, ListRow, fieldClassName } from '@/ui';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/auth/useAuth';

const TEMPO_LABELS: Record<string, string> = {
  Slow: 'Långsamt',
  SlowMed: 'Lugnt',
  Medium: 'Lagom',
  Fast: 'Snabbt',
  Turbo: 'Väldigt snabbt',
};

export function PlaylistsPage() {
  useAnalyticsFlag('playlists');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistListItemDto[]>([]);
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondErrors, setRespondErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    Promise.all([
      getMyPlaylists1({ page: 0 }, { signal: controller.signal }),
      getInvitations({ signal: controller.signal }),
    ])
      .then(([page0, invs]) => {
        setPlaylists(page0.items ?? []);
        setPage(0);
        setHasMore(page0.hasMore ?? false);
        setInvitations(invs);
        setError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlaylists([]);
        setInvitations([]);
        setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [authLoading, isAuthenticated, reloadToken]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextPage = page + 1;
      const result = await getMyPlaylists1({ page: nextPage });
      setPlaylists((prev) => [...prev, ...(result.items ?? [])]);
      setPage(nextPage);
      setHasMore(result.hasMore ?? false);
    } catch {
      setLoadMoreError('Kunde inte ladda fler spellistor');
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleRespond(invitationId: string, accept: boolean) {
    setRespondingId(invitationId);
    setRespondErrors((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    try {
      await respondToInvitation(invitationId, { accept });
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      if (accept) {
        // Refresh playlist list so accepted playlist appears
        const updated = await getMyPlaylists1({ page: 0 });
        setPlaylists(updated.items ?? []);
        setPage(0);
        setHasMore(updated.hasMore ?? false);
        toast('Inbjudan accepterad');
      } else {
        toast('Inbjudan avböjd');
      }
    } catch {
      setRespondErrors((prev) => ({ ...prev, [invitationId]: 'Kunde inte svara på inbjudan' }));
    } finally {
      setRespondingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createPlaylist({ name: newName.trim() });
      setPlaylists((prev) => [created, ...prev]);
      setNewName('');
      setShowForm(false);
      toast('Spellista skapad');
    } catch {
      setCreateError('Kunde inte skapa spellista');
    } finally {
      setCreating(false);
    }
  }

  function handleCancelForm() {
    setShowForm(false);
    setNewName('');
    setCreateError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spellistor"
        action={
          isAuthenticated && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)}>
              <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden />
              Ny spellista
            </Button>
          )
        }
      />

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="new-playlist-name"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Spellistans namn
              </label>
              <input
                id="new-playlist-name"
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setCreateError(null);
                }}
                autoFocus
                className={fieldClassName}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={creating || !newName.trim()}>
                Skapa spellista
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancelForm}>
                Avbryt
              </Button>
            </div>
            <InlineError>{createError}</InlineError>
          </form>
        </Card>
      )}

      {loading && <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>}

      {!loading && invitations.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Inbjudningar</SectionTitle>
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li key={inv.id} className="space-y-1">
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                      {inv.playlistName ?? 'Okänd spellista'}
                    </p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">
                      Inbjuden av {inv.invitedByDisplayName ?? inv.invitedByUserId}
                      {inv.permission && (
                        <span className="ml-1.5">
                          &middot;{' '}
                          {inv.permission === 'edit' ? 'Redigera' : 'Se'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      disabled={respondingId === inv.id}
                      onClick={() => handleRespond(inv.id!, true)}
                    >
                      Acceptera
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={respondingId === inv.id}
                      onClick={() => handleRespond(inv.id!, false)}
                    >
                      Avböj
                    </Button>
                  </div>
                </Card>
                {respondErrors[inv.id!] && <InlineError>{respondErrors[inv.id!]}</InlineError>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && !isAuthenticated && (
        <EmptyState
          icon={<PlaylistIcon className="h-10 w-10" aria-hidden />}
          action={<LinkButton to="/login">Logga in</LinkButton>}
        >
          Logga in för att skapa och hantera dina egna spellistor.
        </EmptyState>
      )}

      {!loading && isAuthenticated && (
        <section className="space-y-3">
          <SectionTitle>Mina spellistor</SectionTitle>
          {error ? (
            <LoadError
              message="Det gick inte att hämta spellistorna."
              onRetry={() => setReloadToken((t) => t + 1)}
            />
          ) : playlists.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">Du har inga spellistor ännu.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {playlists.map((pl) => {
                  const styleColor = pl.danceStyle ? getStyleColor(pl.danceStyle) : null;
                  const tempoLabel = pl.tempoCategory ? TEMPO_LABELS[pl.tempoCategory] : null;
                  const owner = pl.ownerGroup
                    ? pl.ownerGroup.name
                    : pl.ownerDisplayName
                      ? `Delad av ${pl.ownerDisplayName}`
                      : 'Du';
                  return (
                    <li key={pl.id} className="space-y-1">
                      <ListRow
                        to={`/playlists/${pl.id}`}
                        title={
                          <>
                            {pl.name}
                            <span className="ml-1.5 font-normal text-[rgb(var(--color-text-muted))]">&middot; {owner}</span>
                          </>
                        }
                        subtitle={pl.description}
                        play={{
                          label: `Spela ${pl.name}`,
                          onPlay: () => navigate(`/playlists/${pl.id}?autoplay=true`),
                        }}
                        trailing={
                          (pl.trackCount ?? 0) > 0 ? (
                            <span>{pl.trackCount} {pl.trackCount === 1 ? 'låt' : 'låtar'}</span>
                          ) : undefined
                        }
                      >
                        {styleColor && pl.danceStyle && (
                          <Badge
                            size="md"
                            style={{
                              backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                              color: theme === 'dark' ? styleColor.textDark : styleColor.text,
                            }}
                          >
                            {pl.danceStyle.charAt(0).toUpperCase() + pl.danceStyle.slice(1)}
                          </Badge>
                        )}
                        {styleColor && pl.subStyle && (
                          <Badge
                            size="md"
                            className="opacity-80"
                            style={{
                              backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                              color: theme === 'dark' ? styleColor.textDark : styleColor.text,
                            }}
                          >
                            {pl.subStyle.charAt(0).toUpperCase() + pl.subStyle.slice(1)}
                          </Badge>
                        )}
                        {tempoLabel && (
                          <Badge size="md" variant="muted">
                            {tempoLabel}
                          </Badge>
                        )}
                      </ListRow>
                    </li>
                  );
                })}
              </ul>

              {hasMore && (
                <div className="flex flex-col items-center gap-1">
                  <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
                    Visa fler
                  </Button>
                  <InlineError>{loadMoreError}</InlineError>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
