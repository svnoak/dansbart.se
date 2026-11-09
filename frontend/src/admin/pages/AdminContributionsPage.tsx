import { useCallback, useEffect, useState } from 'react';
import {
  approveStyleContribution,
  approveTrackContribution,
  getUnreviewedContributions,
  removeStyleContribution,
  removeTrackContribution,
} from '@/api/generated/admin-contributions/admin-contributions';
import { banUser } from '@/api/generated/admin-users/admin-users';
import type { AdminStyleContributionDto } from '@/api/models/adminStyleContributionDto';
import type { AdminTrackContributionDto } from '@/api/models/adminTrackContributionDto';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { Modal } from '@/admin/components/Modal';
import { FormActions } from '@/admin/components/forms/FormActions';
import { toast } from '@/admin/components/toastEmitter';
import { StylePill } from '@/components/TrackRow/StylePill';
import { Badge, Button, InlineError, LoadError } from '@/ui';

type Confirm =
  | { kind: 'removeTrack'; item: AdminTrackContributionDto }
  | { kind: 'removeStyle'; item: AdminStyleContributionDto }
  | { kind: 'ban'; userId: string; username: string };

function sourceUrl(item: AdminTrackContributionDto): string | null {
  if (!item.externalId) return null;
  return item.source === 'SPOTIFY'
    ? `https://open.spotify.com/track/${item.externalId}`
    : `https://www.youtube.com/watch?v=${item.externalId}`;
}

/** Where the track is in ingest and analysis, in words. */
function trackStatus(item: AdminTrackContributionDto): string {
  if (item.status === 'QUEUED') return 'Hämtas från Spotify';
  if (item.status === 'FAILED') return 'Kunde inte läggas till';
  switch (item.processingStatus) {
    case 'DONE': return 'Analyserad';
    case 'FAILED': return 'Analysen misslyckades';
    case 'PROCESSING': return 'Analyseras';
    default: return 'Väntar på analys';
  }
}

function formatDate(iso?: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Tracks and dance styles that users added and no admin has looked at yet. Everything
 * here is already public: "Behåll" clears it from the list, "Ta bort" undoes it.
 */
export function AdminContributionsPage() {
  const [tracks, setTracks] = useState<AdminTrackContributionDto[]>([]);
  const [styles, setStyles] = useState<AdminStyleContributionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUnreviewedContributions();
      setTracks(result.tracks ?? []);
      setStyles(result.styles ?? []);
      setLoadError(null);
    } catch {
      setLoadError('Kunde inte hämta nya bidrag');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  async function runRowAction(key: string, action: () => Promise<unknown>, success: string, failure: string) {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      await action();
      toast(success);
      void fetchItems();
    } catch {
      setRowErrors((prev) => ({ ...prev, [key]: failure }));
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    setConfirmError(null);
    try {
      if (confirm.kind === 'removeTrack') {
        await removeTrackContribution(confirm.item.submissionId!);
        toast('Låten är borttagen');
      } else if (confirm.kind === 'removeStyle') {
        await removeStyleContribution(confirm.item.id!);
        toast('Dansstilen är dold');
      } else {
        await banUser(confirm.userId);
        toast(`${confirm.username} är avstängd`);
      }
      setConfirm(null);
      void fetchItems();
    } catch {
      setConfirmError('Det gick inte. Försök igen.');
    } finally {
      setBusy(false);
    }
  }

  function userCell(userId?: string, username?: string, banned?: boolean) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] text-[rgb(var(--color-text))]">{username ?? '–'}</span>
        {banned && <Badge>Avstängd</Badge>}
        {!banned && userId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setConfirm({ kind: 'ban', userId, username: username ?? 'Användaren' }); setConfirmError(null); }}
          >
            Stäng av
          </Button>
        )}
      </div>
    );
  }

  const trackColumns: Column<AdminTrackContributionDto>[] = [
    {
      key: 'title',
      header: 'Låt',
      render: (t) => {
        const href = sourceUrl(t);
        return (
          <div>
            <span className="text-[15px] font-medium text-[rgb(var(--color-text))]">
              {t.trackTitle ?? t.title ?? '–'}
            </span>
            {t.artistName && (
              <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{t.artistName}</p>
            )}
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-semibold text-[rgb(var(--color-link))] hover:underline"
              >
                Öppna på {t.source === 'SPOTIFY' ? 'Spotify' : 'YouTube'}
              </a>
            )}
          </div>
        );
      },
    },
    {
      key: 'style',
      header: 'Dansstil',
      render: (t) => (
        <div className="flex flex-wrap items-center gap-2">
          {t.mainStyle && <StylePill style={t.mainStyle} state="confirmed" />}
          {t.subStyle && <span className="text-[13px] text-[rgb(var(--color-text-muted))]">{t.subStyle}</span>}
          {t.tempoCategory && <span className="text-[13px] text-[rgb(var(--color-text-muted))]">{t.tempoCategory}</span>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (t) => <span className="text-[14px]">{trackStatus(t)}</span> },
    { key: 'user', header: 'Tillagd av', render: (t) => userCell(t.userId, t.username, t.userBanned) },
    { key: 'date', header: 'Datum', render: (t) => <span className="text-[14px]">{formatDate(t.createdAt)}</span> },
    {
      key: 'actions',
      header: 'Åtgärd',
      render: (t) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void runRowAction(
                `t-${t.submissionId}`,
                () => approveTrackContribution(t.submissionId!),
                'Låten är granskad',
                'Kunde inte markera låten som granskad',
              )}
            >
              Behåll
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setConfirm({ kind: 'removeTrack', item: t }); setConfirmError(null); }}
            >
              Ta bort
            </Button>
          </div>
          {rowErrors[`t-${t.submissionId}`] && <InlineError>{rowErrors[`t-${t.submissionId}`]}</InlineError>}
        </div>
      ),
    },
  ];

  const styleColumns: Column<AdminStyleContributionDto>[] = [
    {
      key: 'style',
      header: 'Dansstil',
      render: (s) => (
        <div>
          <span className="text-[15px] font-medium text-[rgb(var(--color-text))]">{s.subStyle ?? s.mainStyle}</span>
          <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
            {s.subStyle ? `Variant av ${s.mainStyle}` : 'Egen dans'}
          </p>
        </div>
      ),
    },
    { key: 'user', header: 'Tillagd av', render: (s) => userCell(s.userId, s.username, s.userBanned) },
    { key: 'date', header: 'Datum', render: (s) => <span className="text-[14px]">{formatDate(s.createdAt)}</span> },
    {
      key: 'actions',
      header: 'Åtgärd',
      render: (s) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void runRowAction(
                `s-${s.id}`,
                () => approveStyleContribution(s.id!),
                'Dansstilen är granskad',
                'Kunde inte markera dansstilen som granskad',
              )}
            >
              Behåll
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setConfirm({ kind: 'removeStyle', item: s }); setConfirmError(null); }}
            >
              Dölj
            </Button>
          </div>
          {rowErrors[`s-${s.id}`] && <InlineError>{rowErrors[`s-${s.id}`]}</InlineError>}
        </div>
      ),
    },
  ];

  const confirmTitle = confirm?.kind === 'removeTrack'
    ? 'Ta bort låten?'
    : confirm?.kind === 'removeStyle'
      ? 'Dölj dansstilen?'
      : 'Stäng av användaren?';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Nya bidrag
        </h1>
        <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
          Låtar och dansstilar som användare lagt till och som ingen admin har tittat på än. De är
          redan synliga för alla. Behåll det som stämmer och ta bort resten. Dina egna bidrag visas inte här.
        </p>
      </div>

      {loadError && <LoadError message={loadError} onRetry={() => void fetchItems()} />}

      {!loadError && (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Låtar ({tracks.length})</h2>
            <DataTable
              columns={trackColumns}
              data={tracks}
              keyFn={(t) => t.submissionId ?? ''}
              loading={loading}
              emptyMessage="Inga nya låtar att granska."
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Dansstilar ({styles.length})</h2>
            <DataTable
              columns={styleColumns}
              data={styles}
              keyFn={(s) => s.id ?? ''}
              loading={loading}
              emptyMessage="Inga nya dansstilar att granska."
            />
          </section>
        </>
      )}

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirmTitle}>
        {confirm?.kind === 'removeTrack' && (
          <p className="text-[15px] text-[rgb(var(--color-text))]">
            {confirm.item.createdTrack
              ? `”${confirm.item.trackTitle ?? confirm.item.title}” tas bort ur biblioteket för alla.`
              : 'Låten fanns redan i biblioteket innan och ligger kvar. Bidraget försvinner från listan.'}
          </p>
        )}
        {confirm?.kind === 'removeStyle' && (
          <p className="text-[15px] text-[rgb(var(--color-text))]">
            {confirm.item.subStyle ?? confirm.item.mainStyle} går inte längre att välja. Röster som redan
            getts på dansstilen ligger kvar.
          </p>
        )}
        {confirm?.kind === 'ban' && (
          <p className="text-[15px] text-[rgb(var(--color-text))]">
            {confirm.username} kan inte längre lägga till låtar eller dansstilar. Personen kan fortfarande
            lyssna och rösta, men rösterna väger som en anonym besökares. Du kan häva avstängningen under Användare.
          </p>
        )}
        <div className="mt-3">
          <InlineError>{confirmError}</InlineError>
        </div>
        <FormActions>
          <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
            Avbryt
          </Button>
          <Button variant="danger" onClick={() => void runConfirm()} disabled={busy}>
            {confirm?.kind === 'removeTrack' ? 'Ta bort' : confirm?.kind === 'removeStyle' ? 'Dölj' : 'Stäng av'}
          </Button>
        </FormActions>
      </Modal>
    </div>
  );
}
