import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getMyPlaylists1,
  createPlaylist,
  getInvitations,
  respondToInvitation,
} from '@/api/generated/playlists/playlists';
import type { Playlist } from '@/api/models/playlist';
import type { InvitationDto } from '@/api/models/invitationDto';
import { PlaylistIcon, PlusIcon, PlayIcon } from '@/icons';
import { toast } from '@/ui';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';

const TEMPO_LABELS: Record<string, string> = {
  Slow: 'Långsamt',
  SlowMed: 'Lugnt',
  Medium: 'Lagom',
  Fast: 'Snabbt',
  Turbo: 'Väldigt snabbt',
};

export function PlaylistsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getMyPlaylists1({ signal: controller.signal }),
      getInvitations({ signal: controller.signal }),
    ])
      .then(([pls, invs]) => {
        setPlaylists(pls);
        setInvitations(invs);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlaylists([]);
        setInvitations([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function handleRespond(invitationId: string, accept: boolean) {
    setRespondingId(invitationId);
    try {
      await respondToInvitation(invitationId, { accept });
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      if (accept) {
        // Refresh playlist list so accepted playlist appears
        const updated = await getMyPlaylists1();
        setPlaylists(updated);
        toast('Inbjudan accepterad');
      } else {
        toast('Inbjudan avböjd');
      }
    } catch {
      toast('Kunde inte svara på inbjudan', 'error');
    } finally {
      setRespondingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createPlaylist({ name: newName.trim() });
      setPlaylists((prev) => [created, ...prev]);
      setNewName('');
      setShowForm(false);
      toast('Spellista skapad');
    } catch {
      toast('Kunde inte skapa spellista', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">Spellistor</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-accent))] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" aria-hidden />
          Ny spellista
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Namn på spellistan"
            autoFocus
            className="flex-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="rounded-lg bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Skapa
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setNewName('');
            }}
            className="rounded-lg border border-[rgb(var(--color-border))] px-4 py-2 text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
          >
            Avbryt
          </button>
        </form>
      )}

      {loading && <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>}

      {/* Pending invitations */}
      {!loading && invitations.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Inbjudningar
          </h2>
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                    {inv.playlistName ?? 'Okänd spellista'}
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    Inbjuden av {inv.invitedByDisplayName ?? inv.invitedByUserId}
                    {inv.permission && (
                      <span className="ml-1.5">
                        &middot;{' '}
                        {inv.permission === 'edit' ? 'Redaktör' : 'Visare'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={respondingId === inv.id}
                    onClick={() => handleRespond(inv.id!, true)}
                    className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:opacity-90"
                  >
                    Acceptera
                  </button>
                  <button
                    type="button"
                    disabled={respondingId === inv.id}
                    onClick={() => handleRespond(inv.id!, false)}
                    className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-xs text-[rgb(var(--color-text-muted))] disabled:opacity-50 hover:bg-[rgb(var(--color-border))]/50"
                  >
                    Avböj
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && playlists.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Du har inga spellistor ännu.</p>
      )}

      <ul className="space-y-2">
        {playlists.map((pl) => {
          const styleColor = pl.danceStyle ? getStyleColor(pl.danceStyle) : null;
          const tempoLabel = pl.tempoCategory ? TEMPO_LABELS[pl.tempoCategory] : null;
          return (
            <li key={pl.id} className="flex items-stretch gap-2">
              <button
                type="button"
                aria-label={`Spela ${pl.name}`}
                onClick={() => navigate(`/playlists/${pl.id}?autoplay=true`)}
                className="flex shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 hover:border-[rgb(var(--color-accent))]/50 hover:bg-[rgb(var(--color-accent-muted))]/20 transition-colors"
              >
                <PlayIcon className="h-4 w-4 text-[rgb(var(--color-accent))]" aria-hidden />
              </button>

              <Link
                to={`/playlists/${pl.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3 hover:border-[rgb(var(--color-accent))]/50 hover:bg-[rgb(var(--color-accent-muted))]/20 transition-colors"
              >
                <PlaylistIcon className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">{pl.name}</p>
                  {pl.description && (
                    <p className="truncate text-xs text-[rgb(var(--color-text-muted))]">{pl.description}</p>
                  )}
                  {(styleColor || tempoLabel) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {styleColor && pl.danceStyle && (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                            color: theme === 'dark' ? styleColor.textDark : styleColor.text,
                          }}
                        >
                          {pl.danceStyle.charAt(0).toUpperCase() + pl.danceStyle.slice(1)}
                        </span>
                      )}
                      {styleColor && pl.subStyle && (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium opacity-80"
                          style={{
                            backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                            color: theme === 'dark' ? styleColor.textDark : styleColor.text,
                          }}
                        >
                          {pl.subStyle.charAt(0).toUpperCase() + pl.subStyle.slice(1)}
                        </span>
                      )}
                      {tempoLabel && (
                        <span className="inline-flex items-center rounded-full bg-[rgb(var(--color-border))] px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--color-text-muted))]">
                          {tempoLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {(pl.tracks?.length ?? 0) > 0 && (
                  <span className="shrink-0 text-xs text-[rgb(var(--color-text-muted))]">
                    {pl.tracks!.length} {pl.tracks!.length === 1 ? 'låt' : 'låtar'}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
