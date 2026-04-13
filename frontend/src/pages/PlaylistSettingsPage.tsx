import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  generateShareToken,
  invalidateShareToken,
  inviteCollaborator,
  updateCollaborator,
  removeCollaborator,
  transferOwnership,
} from '@/api/generated/playlists/playlists';
import { searchUsers } from '@/api/generated/users/users';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { CollaboratorDto } from '@/api/models/collaboratorDto';
import type { UserSummaryDto } from '@/api/models/userSummaryDto';
import { BackArrowIcon } from '@/icons';
import { IconButton, toast } from '@/ui';
import { useAuth } from '@/auth/useAuth';

const PERMISSION_LABELS: Record<string, string> = {
  edit: 'Redaktör',
  view: 'Visare',
};

function statusLabel(status: string | undefined): string {
  if (status === 'pending') return 'Väntande';
  if (status === 'accepted') return 'Accepterad';
  return status ?? '';
}

export function PlaylistSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [playlist, setPlaylist] = useState<PlaylistDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<UserSummaryDto[]>([]);
  const [inviteSelected, setInviteSelected] = useState<UserSummaryDto | null>(null);
  const [invitePermission, setInvitePermission] = useState<'edit' | 'view'>('view');
  const [inviting, setInviting] = useState(false);
  const inviteSearchRef = useRef<HTMLDivElement>(null);

  // Transfer ownership
  const [transferTarget, setTransferTarget] = useState('');
  const [transferConfirm, setTransferConfirm] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteText, setDeleteText] = useState('');

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getPlaylist(id, { signal: controller.signal })
      .then(setPlaylist)
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlaylist(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  // Debounced user search
  useEffect(() => {
    if (inviteSelected || inviteQuery.trim().length < 2) {
      setInviteResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchUsers({ q: inviteQuery.trim(), limit: 8 })
        .then(setInviteResults)
        .catch(() => setInviteResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [inviteQuery, inviteSelected]);

  // Close invite dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (inviteSearchRef.current && !inviteSearchRef.current.contains(e.target as Node)) {
        setInviteResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loading) return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  if (!playlist) return <p className="text-[rgb(var(--color-text-muted))]">Spellistan hittades inte.</p>;

  const isOwner = !!(playlist.owner?.id && user?.id && playlist.owner.id === user.id);
  const myCollaborator = playlist.collaborators?.find((c) => c.userId === user?.id);
  const canManageShare = isOwner || myCollaborator?.permission === 'edit';

  const acceptedCollaborators: CollaboratorDto[] = (playlist.collaborators ?? []).filter(
    (c) => c.status === 'accepted',
  );

  // ── Visibility ─────────────────────────────────────────────────────────────

  async function handleTogglePublic() {
    if (!id) return;
    try {
      await updatePlaylist(id, { isPublic: !playlist!.isPublic });
      setPlaylist((prev) => (prev ? { ...prev, isPublic: !prev.isPublic } : prev));
      toast(playlist!.isPublic ? 'Spellistan är nu privat' : 'Spellistan är nu offentlig');
    } catch {
      toast('Kunde inte ändra synlighet', 'error');
    }
  }

  // ── Share token ─────────────────────────────────────────────────────────────

  async function handleGenerateToken() {
    if (!id) return;
    try {
      const updated = await generateShareToken(id);
      setPlaylist((prev) => (prev ? { ...prev, shareToken: updated.shareToken } : prev));
      toast('Delningslänk skapad');
    } catch {
      toast('Kunde inte skapa delningslänk', 'error');
    }
  }

  async function handleInvalidateToken() {
    if (!id) return;
    try {
      await invalidateShareToken(id);
      setPlaylist((prev) => (prev ? { ...prev, shareToken: undefined } : prev));
      toast('Delningslänk ogiltigförklarad');
    } catch {
      toast('Kunde inte ogiltigförklara länk', 'error');
    }
  }

  function handleCopyLink() {
    if (!playlist?.shareToken) return;
    const url = `${window.location.origin}/shared/${playlist.shareToken}`;
    navigator.clipboard.writeText(url).then(() => toast('Länk kopierad'));
  }

  // ── Collaborators ───────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !inviteSelected?.id) return;
    setInviting(true);
    try {
      await inviteCollaborator(id, { userId: inviteSelected.id, permission: invitePermission });
      const updated = await getPlaylist(id);
      setPlaylist(updated);
      setInviteSelected(null);
      setInviteQuery('');
      setShowInviteForm(false);
      toast('Inbjudan skickad');
    } catch {
      toast('Kunde inte bjuda in', 'error');
    } finally {
      setInviting(false);
    }
  }

  async function handleChangePermission(collaboratorId: string, permission: string) {
    if (!id) return;
    try {
      await updateCollaborator(id, collaboratorId, { permission });
      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              collaborators: prev.collaborators?.map((c) =>
                c.id === collaboratorId ? { ...c, permission } : c,
              ),
            }
          : prev,
      );
    } catch {
      toast('Kunde inte ändra behörighet', 'error');
    }
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    if (!id) return;
    try {
      await removeCollaborator(id, collaboratorId);
      setPlaylist((prev) =>
        prev
          ? { ...prev, collaborators: prev.collaborators?.filter((c) => c.id !== collaboratorId) }
          : prev,
      );
      toast('Användare borttagen');
    } catch {
      toast('Kunde inte ta bort samarbetare', 'error');
    }
  }

  // ── Transfer ownership ──────────────────────────────────────────────────────

  async function handleTransferOwnership() {
    if (!id || !transferTarget) return;
    try {
      await transferOwnership(id, { newOwnerId: transferTarget });
      toast('Ägarskap överlåtet');
      navigate(`/playlists/${id}`);
    } catch {
      toast('Kunde inte överlåta ägarskap', 'error');
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!id) return;
    try {
      await deletePlaylist(id);
      toast('Spellista raderad');
      navigate('/playlists');
    } catch {
      toast('Kunde inte radera spellista', 'error');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Back */}
      <div className="flex items-center gap-3">
        <IconButton aria-label="Tillbaka" onClick={() => navigate(`/playlists/${id}`)}>
          <BackArrowIcon className="h-5 w-5" aria-hidden />
        </IconButton>
        <h1 className="text-xl font-bold text-[rgb(var(--color-text))]">
          Inställningar — {playlist.name}
        </h1>
      </div>

      {/* Synlighet */}
      {isOwner && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Synlighet
          </h2>
          <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--color-text))]">
                {playlist.isPublic ? 'Offentlig' : 'Privat'}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {playlist.isPublic
                  ? 'Alla kan se den här spellistan'
                  : 'Bara du och samarbetare ser den'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleTogglePublic}
              className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
            >
              {playlist.isPublic ? 'Gör privat' : 'Gör offentlig'}
            </button>
          </div>
        </section>
      )}

      {/* Delningslänk */}
      {canManageShare && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Delningslänk
          </h2>
          <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3 space-y-3">
            {playlist.shareToken ? (
              <>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  Alla med länken kan se och spela den här spellistan.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/shared/${playlist.shareToken}`}
                    className="flex-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-1.5 text-xs text-[rgb(var(--color-text-muted))] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    Kopiera
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleInvalidateToken}
                  className="text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] underline"
                >
                  Ogiltigförklara länk
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  Ingen delningslänk är aktiv.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateToken}
                  className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Skapa delningslänk
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* Delad med */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          Delad med
        </h2>

        {/* Owner row */}
        <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] divide-y divide-[rgb(var(--color-border))]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--color-text))]">
                {playlist.owner?.displayName ?? playlist.owner?.username ?? 'Okänd'}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {playlist.owner?.username}
              </p>
            </div>
            <span className="rounded-full bg-[rgb(var(--color-accent))]/10 px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--color-accent))]">
              Ägare
            </span>
          </div>

          {(playlist.collaborators ?? []).map((collab) => (
            <div key={collab.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[rgb(var(--color-text))]">
                  {collab.displayName ?? collab.username ?? collab.userId}
                </p>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  {collab.username}
                  {collab.status === 'pending' && (
                    <span className="ml-1.5 rounded-full bg-[rgb(var(--color-border))] px-1.5 py-0.5 text-[10px]">
                      {statusLabel(collab.status)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isOwner ? (
                  <select
                    value={collab.permission ?? 'view'}
                    onChange={(e) => handleChangePermission(collab.id!, e.target.value)}
                    className="rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-2 py-1 text-xs text-[rgb(var(--color-text))] focus:outline-none"
                  >
                    <option value="edit">Redaktör</option>
                    <option value="view">Visare</option>
                  </select>
                ) : (
                  <span className="text-xs text-[rgb(var(--color-text-muted))]">
                    {PERMISSION_LABELS[collab.permission ?? ''] ?? collab.permission}
                  </span>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCollaborator(collab.id!)}
                    className="text-xs text-[rgb(var(--color-text-muted))] hover:text-red-500"
                  >
                    Ta bort
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invite form — owner only */}
        {isOwner && !showInviteForm && (
          <button
            type="button"
            onClick={() => setShowInviteForm(true)}
            className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]"
          >
            + Bjud in till spellista
          </button>
        )}
        {isOwner && showInviteForm && (
          <form onSubmit={handleInvite} className="flex gap-2">
            <div ref={inviteSearchRef} className="relative flex-1">
              <input
                type="text"
                value={inviteQuery}
                onChange={(e) => {
                  setInviteQuery(e.target.value);
                  setInviteSelected(null);
                }}
                placeholder="Sök efter användare..."
                autoComplete="off"
                className={`w-full rounded-lg border bg-[rgb(var(--color-bg-elevated))] px-3 py-1.5 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none ${
                  inviteSelected
                    ? 'border-[rgb(var(--color-accent))]'
                    : 'border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-accent))]'
                }`}
              />
              {inviteResults.length > 0 && (
                <ul className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-lg">
                  {inviteResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setInviteSelected(u);
                          setInviteQuery(u.displayName ?? u.username ?? '');
                          setInviteResults([]);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[rgb(var(--color-border))]/40"
                      >
                        <span className="font-medium text-[rgb(var(--color-text))]">
                          {u.displayName ?? u.username}
                        </span>
                        {u.username && u.displayName && (
                          <span className="ml-1.5 text-xs text-[rgb(var(--color-text-muted))]">
                            @{u.username}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <select
              value={invitePermission}
              onChange={(e) => setInvitePermission(e.target.value as 'edit' | 'view')}
              className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-2 py-1.5 text-sm text-[rgb(var(--color-text))] focus:outline-none"
            >
              <option value="view">Visare</option>
              <option value="edit">Redaktör</option>
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteSelected}
              className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Bjud in
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInviteForm(false);
                setInviteQuery('');
                setInviteSelected(null);
                setInviteResults([]);
              }}
              className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
            >
              Avbryt
            </button>
          </form>
        )}
      </section>

      {/* Överlåt ägarskap — owner only */}
      {isOwner && acceptedCollaborators.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Överlåt ägarskap
          </h2>
          <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3 space-y-3">
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              Du blir redaktör och den valda användaren blir ny ägare.
            </p>
            <div className="flex gap-2">
              <select
                value={transferTarget}
                onChange={(e) => {
                  setTransferTarget(e.target.value);
                  setTransferConfirm(false);
                }}
                className="flex-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-1.5 text-sm text-[rgb(var(--color-text))] focus:outline-none"
              >
                <option value="">Välj samarbetare</option>
                {acceptedCollaborators.map((c) => (
                  <option key={c.id} value={c.userId ?? ''}>
                    {c.displayName ?? c.username ?? c.userId}
                  </option>
                ))}
              </select>
              {!transferConfirm ? (
                <button
                  type="button"
                  disabled={!transferTarget}
                  onClick={() => setTransferConfirm(true)}
                  className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))] disabled:opacity-50 hover:bg-[rgb(var(--color-border))]/50"
                >
                  Överlåt
                </button>
              ) : (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handleTransferOwnership}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Bekräfta
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferConfirm(false)}
                    className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))]"
                  >
                    Avbryt
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Radera spellista — owner only */}
      {isOwner && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-500">
            Farlig zon
          </h2>
          <div className="rounded-lg border border-red-500/30 bg-[rgb(var(--color-bg-elevated))] px-4 py-3 space-y-3">
            <p className="text-sm font-medium text-[rgb(var(--color-text))]">Radera spellista</p>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              Det här går inte att ångra. Skriv in spellistans namn för att bekräfta.
            </p>
            {!deleteConfirm ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm(true);
                  setTimeout(() => deleteInputRef.current?.focus(), 50);
                }}
                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10"
              >
                Radera spellista
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  ref={deleteInputRef}
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder={playlist.name}
                  className="w-full rounded-lg border border-red-500/50 bg-[rgb(var(--color-bg))] px-3 py-1.5 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deleteText !== playlist.name}
                    onClick={handleDelete}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90"
                  >
                    Radera permanent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirm(false);
                      setDeleteText('');
                    }}
                    className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))]"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
