import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/api/http-client';
import { Badge, Button, Card, EmptyState, IconButton, InlineError, LoadError, Pill, RowSkeleton } from '@/ui';
import { Pagination } from '@/admin/components/Pagination';
import { TextInput } from '@/admin/components/forms/TextInput';
import { FormField } from '@/admin/components/forms/FormField';
import { StylePill } from '@/components/TrackRow/StylePill';
import { ChevronDownIcon, CloseIcon, MusicNoteIcon } from '@/icons';
import { toast } from '@/admin/components/toastEmitter';

interface DanceItem {
  id: string;
  name: string;
  slug: string;
  danceDescriptionUrl: string | null;
  danceType: string | null;
  music: string | null;
  confirmedTrackCount: number;
}

interface DancePage {
  items: DanceItem[];
  total: number;
}

interface TrackResult {
  id: string;
  title: string;
  artistName: string | null;
  danceStyle: string | null;
}

const ADMIN_BASE = '/api/admin/dances';

type Tab = 'pending' | 'dances' | 'invalid-styles';

const TABS: { key: Tab; label: string }[] = [
  { key: 'dances', label: 'Alla danser' },
  { key: 'pending', label: 'Väntande förslag' },
  { key: 'invalid-styles', label: 'Ogiltiga dansstilar' },
];

const fieldClass = 'min-h-11 border-[rgb(var(--color-border-strong))] text-[15px]';

interface PendingLink {
  id: string;
  danceId: string;
  trackId: string;
  danceName: string;
  trackTitle: string;
  addedBy: string | null;
  addedAt: string;
}

async function fetchPending(limit: number, offset: number) {
  const res = await apiFetch(`${ADMIN_BASE}/pending?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error('Kunde inte hämta väntande förslag');
  return res.json() as Promise<{ items: PendingLink[]; total: number }>;
}

async function confirmLink(linkId: string) {
  const res = await apiFetch(`${ADMIN_BASE}/track-links/${linkId}/confirm`, { method: 'POST' });
  if (!res.ok) throw new Error('Kunde inte bekräfta förslaget');
}

async function removeLink(danceId: string, trackId: string) {
  const res = await apiFetch(`${ADMIN_BASE}/${danceId}/tracks/${trackId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Kunde inte ta bort länken');
}

async function fetchDances(search: string, limit: number, offset: number) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search) params.set('search', search);
  const res = await apiFetch(`/api/dances?${params}`);
  if (!res.ok) throw new Error('Kunde inte hämta danser');
  return res.json() as Promise<DancePage>;
}

export function AdminDancesPage() {
  const [tab, setTab] = useState<Tab>('dances');
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Danser
          </h1>
          <p className="mt-1 text-[15px] text-[rgb(var(--color-text-muted))]">
            Danserna på sajten och låtarna som hör till dem. Bekräfta förslag från besökare och importera nya danser.
          </p>
        </div>
        <Button variant="primary" onClick={() => setImportOpen(true)}>
          Importera danser
        </Button>
      </header>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Visa">
        {TABS.map(({ key, label }) => (
          <Pill
            key={key}
            active={tab === key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </Pill>
        ))}
      </div>

      {tab === 'pending' && <PendingTab />}
      {tab === 'dances' && <DancesTab />}
      {tab === 'invalid-styles' && <InvalidStylesTab />}
    </div>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!Array.isArray(json)) throw new Error('Filen måste vara en JSON-array');

      const res = await apiFetch(`${ADMIN_BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      if (!res.ok) throw new Error('Importen misslyckades');
      const data = await res.json() as { imported: number; linked: number };
      const linkedMsg = data.linked > 0 ? `, länkade ${data.linked} låtar automatiskt` : '';
      toast(`Importerade ${data.imported} danser${linkedMsg}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel';
      setError(`Importen misslyckades: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  return (
    <Card className="max-w-2xl space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Importera danser</h2>
          <p className="mt-1 text-[15px] text-[rgb(var(--color-text-muted))]">
            Ladda upp en JSON-fil. Danser som redan finns uppdateras utifrån sin slug, och låtar matchas mot musikfältet.
          </p>
        </div>
        <IconButton onClick={onClose} aria-label="Stäng importen" disabled={loading}>
          <CloseIcon className="h-5 w-5" aria-hidden />
        </IconButton>
      </div>

      <pre className="overflow-x-auto rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-3 text-[13px] text-[rgb(var(--color-text))]">{`[
  {
    "name": "Polska",
    "danceDescriptionUrl": "https://www.acla.se/...",
    "danceType": "Tretur",
    "music": "3/4"
  }
]`}</pre>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Välj JSON-fil"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {error && <InlineError>{error}</InlineError>}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? 'Importerar…' : 'Välj JSON-fil'}
        </Button>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Avbryt
        </Button>
      </div>
    </Card>
  );
}

function PendingTab() {
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const data = await fetchPending(limit, off);
      setLinks(data.items ?? []);
      setTotal(data.total ?? 0);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunde inte hämta väntande förslag');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(offset); }, [load, offset]);

  const clearRowError = (id: string) =>
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const handleConfirm = async (link: PendingLink) => {
    clearRowError(link.id);
    try {
      await confirmLink(link.id);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      setTotal((t) => t - 1);
      toast(`Bekräftade "${link.trackTitle}" för ${link.danceName}`);
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [link.id]: err instanceof Error ? err.message : 'Kunde inte bekräfta förslaget' }));
    }
  };

  const handleReject = async (link: PendingLink) => {
    clearRowError(link.id);
    try {
      await removeLink(link.danceId, link.trackId);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      setTotal((t) => t - 1);
      toast('Tog bort förslaget');
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [link.id]: err instanceof Error ? err.message : 'Kunde inte ta bort länken' }));
    }
  };

  if (loading) return <RowSkeleton rows={5} label="Laddar väntande förslag" />;

  if (loadError) return <LoadError message={loadError} onRetry={() => load(offset)} />;

  if (links.length === 0) {
    return (
      <EmptyState
        icon={<MusicNoteIcon className="h-6 w-6" aria-hidden />}
        title="Inga väntande förslag"
        description="När en besökare föreslår en låt till en dans hamnar förslaget här."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{total} förslag</p>
      <Card className="divide-y divide-[rgb(var(--color-border))] overflow-hidden">
        {links.map((link) => (
          <div key={link.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">
                {link.trackTitle}
              </p>
              <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                Föreslagen till {link.danceName}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex shrink-0 gap-2">
                <Button variant="primary" size="sm" onClick={() => handleConfirm(link)}>
                  Bekräfta
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleReject(link)}>
                  Avvisa
                </Button>
              </div>
              {rowErrors[link.id] && <InlineError>{rowErrors[link.id]}</InlineError>}
            </div>
          </div>
        ))}
      </Card>
      {total > limit && (
        <Pagination offset={offset} limit={limit} total={total} onChange={setOffset} />
      )}
    </div>
  );
}

interface EditForm {
  name: string;
  danceDescriptionUrl: string;
  danceType: string;
  music: string;
}

async function updateDance(id: string, form: EditForm) {
  const res = await apiFetch(`${ADMIN_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.name,
      danceDescriptionUrl: form.danceDescriptionUrl || null,
      danceType: form.danceType || null,
      music: form.music || null,
    }),
  });
  if (!res.ok) throw new Error('Kunde inte uppdatera dansen');
  return res.json() as Promise<DanceItem>;
}

async function deleteDance(id: string) {
  const res = await apiFetch(`${ADMIN_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Kunde inte ta bort dansen');
}

function DancesTab() {
  const [dances, setDances] = useState<DanceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', danceDescriptionUrl: '', danceType: '', music: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const limit = 50;

  const load = useCallback(async (q: string, off: number) => {
    setLoading(true);
    try {
      const data = await fetchDances(q, limit, off);
      setDances(data.items ?? []);
      setTotal(data.total ?? 0);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunde inte hämta danser');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(search, offset); }, [load, search, offset]);

  const handleSearch = (value: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setOffset(0);
    }, 300);
  };

  const startEdit = (dance: DanceItem) => {
    setEditingId(dance.id);
    setExpandedId(null);
    setSaveError(null);
    setEditForm({
      name: dance.name,
      danceDescriptionUrl: dance.danceDescriptionUrl ?? '',
      danceType: dance.danceType ?? '',
      music: dance.music ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError(null);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateDance(id, editForm);
      setDances((prev) => prev.map((d) => (d.id === id ? { ...updated, confirmedTrackCount: d.confirmedTrackCount } : d)));
      setEditingId(null);
      toast(`Sparade "${updated.name}"`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kunde inte uppdatera dansen');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dance: DanceItem) => {
    if (!confirm(`Ta bort "${dance.name}"? Alla länkade låtar tas också bort.`)) return;
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[dance.id];
      return next;
    });
    try {
      await deleteDance(dance.id);
      setDances((prev) => prev.filter((d) => d.id !== dance.id));
      setTotal((t) => t - 1);
      toast(`Tog bort "${dance.name}"`);
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [dance.id]: err instanceof Error ? err.message : 'Kunde inte ta bort dansen' }));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="min-w-50 flex-1 sm:max-w-sm">
          <label htmlFor="dances-search" className="sr-only">
            Sök dans
          </label>
          <TextInput
            id="dances-search"
            type="search"
            placeholder="Sök dans…"
            onChange={(e) => handleSearch(e.target.value)}
            className={fieldClass}
          />
        </div>
        <p className="pb-2.5 text-[13px] text-[rgb(var(--color-text-muted))]">{total} danser</p>
      </Card>

      {loading && <RowSkeleton rows={6} label="Laddar danser" />}

      {!loading && loadError && <LoadError message={loadError} onRetry={() => load(search, offset)} />}

      {!loading && !loadError && dances.length === 0 && (
        <EmptyState
          icon={<MusicNoteIcon className="h-6 w-6" aria-hidden />}
          title="Inga danser"
          description={search ? 'Ingen dans matchar sökningen.' : 'Importera danser för att fylla listan.'}
        />
      )}

      {!loading && !loadError && dances.length > 0 && (
        <Card className="divide-y divide-[rgb(var(--color-border))] overflow-hidden">
          {dances.map((dance) =>
            editingId === dance.id ? (
              <form
                key={dance.id}
                className="space-y-4 px-4 py-4"
                onSubmit={(e) => { e.preventDefault(); handleSave(dance.id); }}
              >
                <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Redigera {dance.name}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Namn" htmlFor={`dance-name-${dance.id}`}>
                    <TextInput
                      id={`dance-name-${dance.id}`}
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={fieldClass}
                    />
                  </FormField>
                  <FormField label="Beskrivnings-URL" htmlFor={`dance-url-${dance.id}`}>
                    <TextInput
                      id={`dance-url-${dance.id}`}
                      type="url"
                      value={editForm.danceDescriptionUrl}
                      onChange={(e) => setEditForm((f) => ({ ...f, danceDescriptionUrl: e.target.value }))}
                      className={fieldClass}
                    />
                  </FormField>
                  <FormField label="Danstyp" htmlFor={`dance-type-${dance.id}`}>
                    <TextInput
                      id={`dance-type-${dance.id}`}
                      value={editForm.danceType}
                      onChange={(e) => setEditForm((f) => ({ ...f, danceType: e.target.value }))}
                      className={fieldClass}
                    />
                  </FormField>
                  <FormField label="Musik" htmlFor={`dance-music-${dance.id}`}>
                    <TextInput
                      id={`dance-music-${dance.id}`}
                      value={editForm.music}
                      onChange={(e) => setEditForm((f) => ({ ...f, music: e.target.value }))}
                      className={fieldClass}
                    />
                  </FormField>
                </div>
                {saveError && <InlineError>{saveError}</InlineError>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" type="submit" disabled={saving}>
                    {saving ? 'Sparar…' : 'Spara'}
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                    Avbryt
                  </Button>
                </div>
              </form>
            ) : (
              <div key={dance.id}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(dance.id)}
                    aria-expanded={expandedId === dance.id}
                    aria-controls={`dance-detail-${dance.id}`}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius)] px-1 text-left hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
                  >
                    <ChevronDownIcon
                      className={`h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))] transition-transform ${expandedId === dance.id ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">
                        {dance.name}
                      </span>
                      <span className="block text-[13px] text-[rgb(var(--color-text-muted))]">
                        {[dance.danceType, dance.music].filter(Boolean).join(' · ') || 'Ingen danstyp angiven'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
                      {dance.confirmedTrackCount ?? 0} låtar
                    </span>
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(dance)}>
                        Redigera
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(dance)}>
                        Ta bort
                      </Button>
                    </div>
                    {rowErrors[dance.id] && <InlineError>{rowErrors[dance.id]}</InlineError>}
                  </div>
                </div>
                {expandedId === dance.id && (
                  <div id={`dance-detail-${dance.id}`}>
                    <DanceDetailPanel
                      danceId={dance.id}
                      onTrackCountChange={(delta) =>
                        setDances((prev) =>
                          prev.map((d) =>
                            d.id === dance.id
                              ? { ...d, confirmedTrackCount: d.confirmedTrackCount + delta }
                              : d
                          )
                        )
                      }
                    />
                  </div>
                )}
              </div>
            )
          )}
        </Card>
      )}

      {total > limit && (
        <Pagination offset={offset} limit={limit} total={total} onChange={setOffset} />
      )}
    </div>
  );
}

function TrackLine({ track, state }: { track: TrackResult; state: 'confirmed' | 'guess' }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">{track.title}</span>
        {track.artistName && (
          <span className="block truncate text-[13px] text-[rgb(var(--color-text-muted))]">
            {track.artistName}
          </span>
        )}
      </div>
      {track.danceStyle && <StylePill style={track.danceStyle} state={state} className="shrink-0" />}
    </>
  );
}

function DanceDetailPanel({
  danceId,
  onTrackCountChange,
}: {
  danceId: string;
  onTrackCountChange: (delta: number) => void;
}) {
  const [confirmedTracks, setConfirmedTracks] = useState<TrackResult[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadTracks = useCallback(async () => {
    setLoadingTracks(true);
    try {
      const res = await apiFetch(`/api/dances/${danceId}/tracks`);
      if (!res.ok) throw new Error();
      const data = await res.json() as TrackResult[];
      setConfirmedTracks(data);
      setTracksError(null);
    } catch {
      setTracksError('Kunde inte hämta länkade låtar');
    } finally {
      setLoadingTracks(false);
    }
  }, [danceId]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const handleSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/api/tracks?q=${encodeURIComponent(value)}&limit=10`);
        if (!res.ok) throw new Error();
        const data = await res.json() as { items: TrackResult[] };
        setSearchResults(data.items ?? []);
      } catch {
        // ignore search errors
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const confirmedIds = new Set(confirmedTracks.map((t) => t.id));

  const clearRowError = (id: string) =>
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const handleAdd = async (track: TrackResult) => {
    clearRowError(track.id);
    try {
      const res = await apiFetch(`${ADMIN_BASE}/${danceId}/tracks/${track.id}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setConfirmedTracks((prev) => [...prev, track]);
      onTrackCountChange(1);
      toast(`Lade till "${track.title}"`);
    } catch {
      setRowErrors((prev) => ({ ...prev, [track.id]: 'Kunde inte lägga till låten' }));
    }
  };

  const handleRemove = async (track: TrackResult) => {
    clearRowError(track.id);
    try {
      const res = await apiFetch(`${ADMIN_BASE}/${danceId}/tracks/${track.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setConfirmedTracks((prev) => prev.filter((t) => t.id !== track.id));
      onTrackCountChange(-1);
      toast(`Tog bort "${track.title}"`);
    } catch {
      setRowErrors((prev) => ({ ...prev, [track.id]: 'Kunde inte ta bort låten' }));
    }
  };

  return (
    <div className="space-y-5 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-4">
      <section className="space-y-2">
        <h3 className="text-[15px] font-semibold text-[rgb(var(--color-text))]">Bekräftade låtar</h3>
        {loadingTracks ? (
          <RowSkeleton rows={2} label="Laddar länkade låtar" />
        ) : tracksError ? (
          <LoadError message={tracksError} onRetry={loadTracks} />
        ) : confirmedTracks.length === 0 ? (
          <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Inga bekräftade låtar ännu.</p>
        ) : (
          <ul className="divide-y divide-[rgb(var(--color-border))] rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
            {confirmedTracks.map((track) => (
              <li key={track.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <TrackLine track={track} state="confirmed" />
                <div className="flex flex-col items-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleRemove(track)}>
                    Ta bort
                  </Button>
                  {rowErrors[track.id] && <InlineError>{rowErrors[track.id]}</InlineError>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[15px] font-semibold text-[rgb(var(--color-text))]">Lägg till låt</h3>
        <div className="max-w-sm">
          <label htmlFor={`dance-track-search-${danceId}`} className="sr-only">
            Sök låtar att lägga till
          </label>
          <TextInput
            id={`dance-track-search-${danceId}`}
            type="search"
            placeholder="Sök låtar…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className={`${fieldClass} bg-[rgb(var(--color-bg-elevated))]`}
          />
        </div>
        {searching && (
          <p className="text-[13px] text-[rgb(var(--color-text-muted))]" role="status">Söker…</p>
        )}
        {!searching && searchResults.length > 0 && (
          <ul className="max-w-2xl divide-y divide-[rgb(var(--color-border))] rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
            {searchResults.map((track) => (
              <li key={track.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <TrackLine track={track} state="guess" />
                {confirmedIds.has(track.id) ? (
                  <Badge variant="muted">Tillagd</Badge>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Button variant="secondary" size="sm" onClick={() => handleAdd(track)}>
                      Lägg till
                    </Button>
                    {rowErrors[track.id] && <InlineError>{rowErrors[track.id]}</InlineError>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!searching && query.trim() && searchResults.length === 0 && (
          <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Inga träffar.</p>
        )}
      </section>
    </div>
  );
}

function InvalidStylesTab() {
  const [dances, setDances] = useState<DanceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${ADMIN_BASE}/invalid-styles?limit=${limit}&offset=${off}`);
      if (!res.ok) throw new Error('Kunde inte hämta danser med ogiltig dansstil');
      const data = await res.json() as { items: DanceItem[]; total: number };
      setDances(data.items ?? []);
      setTotal(data.total ?? 0);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunde inte hämta danser med ogiltig dansstil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(offset); }, [load, offset]);

  if (loading) return <RowSkeleton rows={4} label="Laddar danser" />;

  if (loadError) return <LoadError message={loadError} onRetry={() => load(offset)} />;

  if (dances.length === 0) {
    return (
      <EmptyState
        icon={<MusicNoteIcon className="h-6 w-6" aria-hidden />}
        title="Alla danstyper känns igen"
        description="Inga danser har en danstyp som saknas i stilkonfigurationen."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
        {total} danser har en danstyp som saknas i stilkonfigurationen
      </p>
      <Card className="divide-y divide-[rgb(var(--color-border))] overflow-hidden">
        {dances.map((dance) => (
          <div key={dance.id} className="flex flex-wrap items-start gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">{dance.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {dance.danceType && (
                  <Badge variant="muted" className="border-[rgb(var(--color-error))] text-[rgb(var(--color-error))]">
                    Okänd danstyp: {dance.danceType}
                  </Badge>
                )}
                {dance.music && (
                  <span className="text-[13px] text-[rgb(var(--color-text-muted))]">{dance.music}</span>
                )}
              </div>
            </div>
            <span className="mt-0.5 shrink-0 text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
              {dance.confirmedTrackCount ?? 0} låtar
            </span>
          </div>
        ))}
      </Card>
      {total > limit && (
        <Pagination offset={offset} limit={limit} total={total} onChange={setOffset} />
      )}
    </div>
  );
}
