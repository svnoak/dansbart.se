import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/api/http-client';
import { Button } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

interface DanceItem {
  id: string;
  name: string;
  slug: string;
  danceDescriptionUrl: string | null;
  danstyp: string | null;
  musik: string | null;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Danser</h1>
        <Button variant="primary" size="sm" onClick={() => setImportOpen(true)}>
          Importera
        </Button>
      </div>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}

      <div className="flex gap-2 border-b border-[rgb(var(--color-border))]">
        {(
          [
            { key: 'dances', label: 'Alla danser' },
            { key: 'pending', label: 'Väntande förslag' },
            { key: 'invalid-styles', label: 'Ogiltiga dansstilar' },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]'
                : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
            }`}
          >
            {label}
          </button>
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
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
      toast(`Import misslyckades: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  return (
    <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Importera danser</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
          aria-label="Stäng"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Ladda upp en JSON-fil. Befintliga danser uppdateras (upsert på slug). Låtar matchas automatiskt mot musikfältet.
      </p>

      <pre className="rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] px-4 py-3 text-xs text-[rgb(var(--color-text))] overflow-x-auto">{`[
  {
    "name": "Polska",
    "danceDescriptionUrl": "https://www.acla.se/...",
    "danstyp": "Tretur",
    "musik": "3/4"
  }
]`}</pre>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      <div className="flex gap-2">
        <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? 'Importerar...' : 'Välj JSON-fil'}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}

function PendingTab() {
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const data = await fetchPending(limit, off);
      setLinks(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fel vid laddning');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(offset); }, [load, offset]);

  const handleConfirm = async (link: PendingLink) => {
    try {
      await confirmLink(link.id);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      setTotal((t) => t - 1);
      toast(`Bekräftade "${link.trackTitle}" för ${link.danceName}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fel');
    }
  };

  const handleReject = async (link: PendingLink) => {
    try {
      await removeLink(link.danceId, link.trackId);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      setTotal((t) => t - 1);
      toast(`Tog bort förslaget`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fel');
    }
  };

  if (loading) return <p className="text-sm text-[rgb(var(--color-text-muted))]">Laddar...</p>;

  if (links.length === 0) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))]">Inga väntande förslag.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-[rgb(var(--color-text-muted))]">{total} förslag</p>
      <div className="divide-y divide-[rgb(var(--color-border))] rounded-lg border border-[rgb(var(--color-border))]">
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                {link.trackTitle}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {link.danceName}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="primary" size="sm" onClick={() => handleConfirm(link)}>
                Bekräfta
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleReject(link)}>
                Avvisa
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {offset > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(offset - limit)}>
            Föregående
          </Button>
        )}
        {offset + limit < total && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(offset + limit)}>
            Nästa
          </Button>
        )}
      </div>
    </div>
  );
}

interface EditForm {
  name: string;
  danceDescriptionUrl: string;
  danstyp: string;
  musik: string;
}

async function updateDance(id: string, form: EditForm) {
  const res = await apiFetch(`${ADMIN_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.name,
      danceDescriptionUrl: form.danceDescriptionUrl || null,
      danstyp: form.danstyp || null,
      musik: form.musik || null,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', danceDescriptionUrl: '', danstyp: '', musik: '' });
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const limit = 50;

  const load = useCallback(async (q: string, off: number) => {
    setLoading(true);
    try {
      const data = await fetchDances(q, limit, off);
      setDances(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fel vid laddning');
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
    setEditForm({
      name: dance.name,
      danceDescriptionUrl: dance.danceDescriptionUrl ?? '',
      danstyp: dance.danstyp ?? '',
      musik: dance.musik ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const updated = await updateDance(id, editForm);
      setDances((prev) => prev.map((d) => (d.id === id ? { ...updated, confirmedTrackCount: d.confirmedTrackCount } : d)));
      setEditingId(null);
      toast(`Sparade "${updated.name}"`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fel');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dance: DanceItem) => {
    if (!confirm(`Ta bort "${dance.name}"? Alla länkade låtar tas också bort.`)) return;
    try {
      await deleteDance(dance.id);
      setDances((prev) => prev.filter((d) => d.id !== dance.id));
      setTotal((t) => t - 1);
      toast(`Tog bort "${dance.name}"`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fel');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const inputClass = 'w-full rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm focus:outline-none';

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Sök dans..."
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-2 text-sm focus:outline-none"
      />
      <p className="text-sm text-[rgb(var(--color-text-muted))]">{total} danser</p>

      {loading ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">Laddar...</p>
      ) : (
        <div className="divide-y divide-[rgb(var(--color-border))] rounded-lg border border-[rgb(var(--color-border))]">
          {dances.map((dance) =>
            editingId === dance.id ? (
              <div key={dance.id} className="flex flex-col gap-2 px-4 py-3">
                <input
                  className={inputClass}
                  placeholder="Namn"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  className={inputClass}
                  placeholder="Beskrivnings-URL"
                  value={editForm.danceDescriptionUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, danceDescriptionUrl: e.target.value }))}
                />
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Danstyp"
                    value={editForm.danstyp}
                    onChange={(e) => setEditForm((f) => ({ ...f, danstyp: e.target.value }))}
                  />
                  <input
                    className={inputClass}
                    placeholder="Musik"
                    value={editForm.musik}
                    onChange={(e) => setEditForm((f) => ({ ...f, musik: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => handleSave(dance.id)} disabled={saving}>
                    {saving ? 'Sparar...' : 'Spara'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                    Avbryt
                  </Button>
                </div>
              </div>
            ) : (
              <div key={dance.id}>
                <div
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-[rgb(var(--color-bg))]"
                  onClick={() => toggleExpand(dance.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[rgb(var(--color-text))]">
                      {dance.name}
                    </p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">
                      {[dance.danstyp, dance.musik].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                    {dance.confirmedTrackCount ?? 0} låtar
                  </span>
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(dance)}>
                      Redigera
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(dance)}>
                      Ta bort
                    </Button>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 shrink-0 text-[rgb(var(--color-text-muted))] transition-transform ${expandedId === dance.id ? 'rotate-180' : ''}`}
                  >
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
                {expandedId === dance.id && (
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
                )}
              </div>
            )
          )}
        </div>
      )}

      <div className="flex gap-2">
        {offset > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(offset - limit)}>
            Föregående
          </Button>
        )}
        {offset + limit < total && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(offset + limit)}>
            Nästa
          </Button>
        )}
      </div>
    </div>
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
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadTracks = useCallback(async () => {
    setLoadingTracks(true);
    try {
      const res = await apiFetch(`/api/dances/${danceId}/tracks`);
      if (!res.ok) throw new Error();
      const data = await res.json() as TrackResult[];
      setConfirmedTracks(data);
    } catch {
      toast('Kunde inte hämta länkade låtar');
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

  const handleAdd = async (track: TrackResult) => {
    try {
      const res = await apiFetch(`${ADMIN_BASE}/${danceId}/tracks/${track.id}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setConfirmedTracks((prev) => [...prev, track]);
      onTrackCountChange(1);
      toast(`Lade till "${track.title}"`);
    } catch {
      toast('Kunde inte lägga till låten');
    }
  };

  const handleRemove = async (track: TrackResult) => {
    try {
      const res = await apiFetch(`${ADMIN_BASE}/${danceId}/tracks/${track.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setConfirmedTracks((prev) => prev.filter((t) => t.id !== track.id));
      onTrackCountChange(-1);
      toast(`Tog bort "${track.title}"`);
    } catch {
      toast('Kunde inte ta bort låten');
    }
  };

  return (
    <div className="border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-4 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          Bekräftade låtar
        </p>
        {loadingTracks ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Laddar...</p>
        ) : confirmedTracks.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Inga bekräftade låtar.</p>
        ) : (
          <div className="space-y-1">
            {confirmedTracks.map((track) => (
              <div key={track.id} className="flex items-center gap-3 py-1">
                <div className="flex-1 min-w-0">
                  <span className="text-sm block truncate">{track.title}</span>
                  {track.artistName && (
                    <span className="text-xs text-[rgb(var(--color-text-muted))] block truncate">
                      {track.artistName}
                    </span>
                  )}
                </div>
                {track.danceStyle && (
                  <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                    {track.danceStyle}
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleRemove(track)}>
                  Ta bort
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          Lägg till låt
        </p>
        <input
          type="text"
          placeholder="Sök låtar..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full max-w-sm rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-1.5 text-sm focus:outline-none"
        />
        {searching && (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Söker...</p>
        )}
        {!searching && searchResults.length > 0 && (
          <div className="divide-y divide-[rgb(var(--color-border))] rounded border border-[rgb(var(--color-border))] max-w-lg">
            {searchResults.map((track) => (
              <div key={track.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm block truncate">{track.title}</span>
                  {track.artistName && (
                    <span className="text-xs text-[rgb(var(--color-text-muted))] block truncate">
                      {track.artistName}
                    </span>
                  )}
                </div>
                {track.danceStyle && (
                  <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                    {track.danceStyle}
                  </span>
                )}
                {confirmedIds.has(track.id) ? (
                  <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">Tillagd</span>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => handleAdd(track)}>
                    Lägg till
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {!searching && query.trim() && searchResults.length === 0 && (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Inga träffar.</p>
        )}
      </div>
    </div>
  );
}

function InvalidStylesTab() {
  const [dances, setDances] = useState<DanceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${ADMIN_BASE}/invalid-styles?limit=${limit}&offset=${off}`);
      if (!res.ok) throw new Error('Kunde inte hämta');
      const data = await res.json() as { items: DanceItem[]; total: number };
      setDances(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fel vid laddning');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(offset); }, [load, offset]);

  if (loading) return <p className="text-sm text-[rgb(var(--color-text-muted))]">Laddar...</p>;

  if (dances.length === 0) {
    return (
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Inga danser med okänd danstyp.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        {total} danser med danstyp som saknas i stilkonfigurationen
      </p>
      <div className="divide-y divide-[rgb(var(--color-border))] rounded-lg border border-[rgb(var(--color-border))]">
        {dances.map((dance) => (
          <div key={dance.id} className="flex items-start gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[rgb(var(--color-text))]">{dance.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {dance.danstyp && (
                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {dance.danstyp}
                  </span>
                )}
                {dance.musik && (
                  <span className="text-xs text-[rgb(var(--color-text-muted))]">{dance.musik}</span>
                )}
              </div>
            </div>
            <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0 mt-0.5">
              {dance.confirmedTrackCount ?? 0} låtar
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {offset > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(offset - limit)}>
            Föregående
          </Button>
        )}
        {offset + limit < total && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(offset + limit)}>
            Nästa
          </Button>
        )}
      </div>
    </div>
  );
}
