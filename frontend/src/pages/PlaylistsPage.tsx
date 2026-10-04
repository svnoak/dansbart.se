import { useEffect, useState } from 'react';
import { useAnalyticsFlag } from '@/analytics/useAnalyticsFlag';
import { Link } from 'react-router-dom';
import {
  getMyPlaylists1,
  createPlaylist,
  getInvitations,
  respondToInvitation,
} from '@/api/generated/playlists/playlists';
import type { PlaylistListItemDto } from '@/api/models/playlistListItemDto';
import type { InvitationDto } from '@/api/models/invitationDto';
import { ChevronRightIcon, PlaylistIcon, PlusIcon, StarMarkIcon } from '@/icons';
import { toast, Card, Button, EmptyState, InlineError, LoadError, RowSkeleton } from '@/ui';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/auth/useAuth';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const listClass =
  'overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] divide-y divide-[rgb(var(--color-border))]';

const badgeClass =
  'inline-flex h-6 items-center rounded-[var(--radius-full)] border border-[rgb(var(--color-border))] px-2 text-[13px] font-medium text-[rgb(var(--color-text-muted))]';

const primaryLinkClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] transition-colors hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

export function PlaylistsPage() {
  useAnalyticsFlag('playlists');
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

  const isDark = theme === 'dark';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Spellistor
          </h1>
          <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
            Samla låtar i egna listor och dela dem med andra.
          </p>
        </div>
        {isAuthenticated && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Ny spellista
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-5">
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
                className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
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

      {loading && <RowSkeleton rows={4} label="Laddar spellistor" />}

      {!loading && invitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Inbjudningar</h2>
          <ul className={listClass}>
            {invitations.map((inv) => (
              <li key={inv.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]"
                    aria-hidden
                  >
                    <PlaylistIcon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">
                      {inv.playlistName ?? 'Okänd spellista'}
                    </p>
                    <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">
                      Inbjuden av {inv.invitedByDisplayName ?? inv.invitedByUserId}
                      {inv.permission && (
                        <span> · {inv.permission === 'edit' ? 'Redigera' : 'Se'}</span>
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
                      variant="outline"
                      disabled={respondingId === inv.id}
                      onClick={() => handleRespond(inv.id!, false)}
                    >
                      Avböj
                    </Button>
                  </div>
                </div>
                <InlineError>{respondErrors[inv.id!]}</InlineError>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && !isAuthenticated && (
        <EmptyState
          icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
          title="Logga in för att se dina spellistor"
          description="Med ett konto kan du skapa egna spellistor och dela dem med andra."
          action={
            <Link to="/login" className={primaryLinkClass}>
              Logga in
            </Link>
          }
        />
      )}

      {!loading && isAuthenticated && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Mina spellistor</h2>
          {error ? (
            <LoadError
              message="Det gick inte att hämta spellistorna."
              onRetry={() => setReloadToken((t) => t + 1)}
            />
          ) : playlists.length === 0 ? (
            <EmptyState
              icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
              title="Du har inga spellistor ännu"
              description="Skapa en spellista och lägg till låtar från sökningen."
              action={
                <Button onClick={() => setShowForm(true)}>
                  <PlusIcon className="h-4 w-4" aria-hidden />
                  Skapa spellista
                </Button>
              }
            />
          ) : (
            <>
              <ul className={listClass}>
                {playlists.map((pl) => {
                  const color = pl.danceStyle ? getStyleColor(pl.danceStyle) : null;
                  const tileStyle: React.CSSProperties | undefined = color
                    ? {
                        backgroundColor: isDark ? color.bgDark : color.bg,
                        color: isDark ? color.textDark : color.text,
                      }
                    : undefined;
                  const trackCount = pl.trackCount ?? 0;
                  const summaryParts = [
                    `${trackCount} ${trackCount === 1 ? 'låt' : 'låtar'}`,
                    pl.danceStyle ? capitalize(pl.danceStyle) : 'Blandat',
                  ];
                  if (pl.ownerGroup?.name) summaryParts.push(pl.ownerGroup.name);
                  return (
                    <li key={pl.id}>
                      <Link
                        to={`/playlists/${pl.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:bg-[rgb(var(--color-accent-muted))]"
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] ${
                            color ? '' : 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]'
                          }`}
                          style={tileStyle}
                          aria-hidden
                        >
                          <StarMarkIcon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">{pl.name}</p>
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[rgb(var(--color-text-muted))]">
                            <span className="truncate">
                              {summaryParts.map((part, i) => (
                                <span key={i}>
                                  {i > 0 && ' · '}
                                  {part}
                                </span>
                              ))}
                            </span>
                            {pl.isPublic && <span className={badgeClass}>Offentlig</span>}
                            {pl.ownerDisplayName && (
                              <span className={badgeClass}>Delad av {pl.ownerDisplayName}</span>
                            )}
                          </p>
                          {pl.description && (
                            <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">{pl.description}</p>
                          )}
                        </span>
                        <ChevronRightIcon
                          className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))]"
                          aria-hidden
                        />
                      </Link>
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
