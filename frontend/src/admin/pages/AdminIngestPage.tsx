import { useState } from 'react';
import {
  getSpotifyArtistAlbums,
  getSpotifyAlbumTracks,
  ingestSpotifyAlbum,
  ingestSpotifyTrack,
} from '@/api/generated/spotify-ingest/spotify-ingest';
import { ingest } from '@/api/generated/admin-maintenance/admin-maintenance';
import { Badge, Button, Card, InlineError } from '@/ui';
import { TextInput } from '@/admin/components/forms/TextInput';
import { toast } from '@/admin/components/toastEmitter';

interface PreviewItem {
  name: string;
  id: string;
  trackCount?: number;
}

type ResourceType = 'artist' | 'album' | 'track' | 'playlist' | null;

function parseSpotifyUrl(input: string): { type: ResourceType; id: string } {
  const trimmed = input.trim();

  // Handle spotify: URIs
  const uriMatch = trimmed.match(/^spotify:(artist|album|track|playlist):(\w+)/);
  if (uriMatch) return { type: uriMatch[1] as ResourceType, id: uriMatch[2] };

  // Handle open.spotify.com URLs
  const urlMatch = trimmed.match(
    /open\.spotify\.com\/(artist|album|track|playlist)\/(\w+)/,
  );
  if (urlMatch) return { type: urlMatch[1] as ResourceType, id: urlMatch[2] };

  // If looks like a bare ID (22 char alphanumeric), can't determine type
  if (/^\w{22}$/.test(trimmed)) return { type: null, id: trimmed };

  return { type: null, id: '' };
}

interface IngestHistoryItem {
  url: string;
  type: string;
  status: 'success' | 'error';
  time: string;
}

export function AdminIngestPage() {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [previewType, setPreviewType] = useState<ResourceType>(null);
  const [previewId, setPreviewId] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [history, setHistory] = useState<IngestHistoryItem[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [albumErrors, setAlbumErrors] = useState<Record<string, string>>({});

  const addHistory = (url: string, type: string, status: 'success' | 'error') => {
    setHistory((prev) => [
      { url, type, status, time: new Date().toLocaleTimeString('sv-SE') },
      ...prev.slice(0, 19),
    ]);
  };

  const handlePreview = async () => {
    const parsed = parseSpotifyUrl(url);
    setPreviewError(null);
    if (!parsed.id) {
      setPreviewError('Ogiltig Spotify-URL');
      return;
    }

    setPreviewType(parsed.type);
    setPreviewId(parsed.id);
    setLoadingPreview(true);
    setPreview([]);

    try {
      if (parsed.type === 'artist') {
        const result = await getSpotifyArtistAlbums(parsed.id);
        const albums = Array.isArray(result) ? result : Object.values(result);
        setPreview(
          (albums as Record<string, unknown>[]).map((a) => ({
            name: (a.name as string) ?? 'Okänt album',
            id: (a.id as string) ?? '',
            trackCount: (a.totalTracks as number) ?? 0,
          })),
        );
      } else if (parsed.type === 'album') {
        const result = await getSpotifyAlbumTracks(parsed.id);
        const tracks = Array.isArray(result) ? result : Object.values(result);
        setPreview(
          (tracks as Record<string, unknown>[]).map((t) => ({
            name: (t.name as string) ?? 'Okänd låt',
            id: (t.id as string) ?? '',
          })),
        );
      } else if (parsed.type === 'track') {
        // Single track - no preview needed
        setPreview([{ name: 'Enskilt spår', id: parsed.id }]);
      } else if (parsed.type === 'playlist') {
        // Playlists go through general ingest, no preview
        setPreview([{ name: 'Spellista', id: parsed.id }]);
      } else {
        setPreviewError('Kunde inte identifiera resurstyp. Ange fullständig URL.');
      }
    } catch {
      setPreviewError('Kunde inte hämta förhandsgranskning');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleIngest = async () => {
    if (!previewId) return;
    setIngesting(true);
    setIngestError(null);

    try {
      if (previewType === 'track') {
        await ingestSpotifyTrack({ spotifyTrackId: previewId });
      } else if (previewType === 'album') {
        await ingestSpotifyAlbum({ spotifyAlbumId: previewId });
      } else if (previewType === 'artist' || previewType === 'playlist') {
        await ingest(
          { resourceId: previewId, resourceType: previewType.toUpperCase() },
        );
      }
      toast('Import startad');
      addHistory(url, previewType ?? 'unknown', 'success');
      setPreview([]);
      setUrl('');
    } catch {
      setIngestError('Import misslyckades');
      addHistory(url, previewType ?? 'unknown', 'error');
    } finally {
      setIngesting(false);
    }
  };

  const handleIngestSingleAlbum = async (albumId: string) => {
    setIngesting(true);
    setAlbumErrors((prev) => {
      const next = { ...prev };
      delete next[albumId];
      return next;
    });
    try {
      await ingestSpotifyAlbum({ spotifyAlbumId: albumId });
      toast('Album-import startad');
      addHistory(`album:${albumId}`, 'album', 'success');
    } catch {
      setAlbumErrors((prev) => ({ ...prev, [albumId]: 'Album-import misslyckades' }));
      addHistory(`album:${albumId}`, 'album', 'error');
    } finally {
      setIngesting(false);
    }
  };

  const typeLabel: Record<string, string> = {
    artist: 'Artist',
    album: 'Album',
    track: 'Spår',
    playlist: 'Spellista',
  };

  const importLabel =
    previewType === 'artist'
      ? 'Importera allt'
      : `Importera ${previewType === 'album' ? 'album' : previewType === 'playlist' ? 'spellista' : 'spår'}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Importera
        </h1>
        <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
          Hämta en artist, ett album, en låt eller en spellista från Spotify och lägg den i
          biblioteket. Analysen av låtarna startar i bakgrunden.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <p className="mb-4 text-[15px] text-[rgb(var(--color-text-muted))]">
          Klistra in en Spotify-URL eller ett ID för att importera musik till biblioteket.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="ingest-url" className="text-sm font-medium text-[rgb(var(--color-text))]">
              Spotify-länk eller ID
            </label>
            <TextInput
              id="ingest-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreviewError(null);
                setIngestError(null);
              }}
              placeholder="https://open.spotify.com/artist/... eller spotify:album:..."
              className="min-h-11"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePreview();
              }}
            />
          </div>
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={!url.trim() || loadingPreview}
          >
            {loadingPreview ? 'Hämtar...' : 'Hämta från Spotify'}
          </Button>
        </div>

        {previewError && (
          <div className="mt-2">
            <InlineError>{previewError}</InlineError>
          </div>
        )}

        {previewType && (
          <p className="mt-3 text-[13px] text-[rgb(var(--color-text-muted))]">
            Typ: {typeLabel[previewType] ?? previewType} · ID: {previewId}
          </p>
        )}
      </Card>

      {/* Preview results */}
      {preview.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--color-border))] px-4 py-3 sm:px-5">
            <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">
              Förhandsgranskning
              <span className="ml-2 text-[13px] font-normal text-[rgb(var(--color-text-muted))]">
                {preview.length} objekt
              </span>
            </h2>
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="primary"
                onClick={handleIngest}
                disabled={ingesting}
              >
                {ingesting ? 'Importerar...' : importLabel}
              </Button>
              {ingestError && <InlineError>{ingestError}</InlineError>}
            </div>
          </div>
          <ul className="max-h-96 divide-y divide-[rgb(var(--color-border))] overflow-y-auto">
            {preview.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 sm:px-5">
                <div className="min-w-0">
                  <span className="text-[15px] text-[rgb(var(--color-text))]">{item.name}</span>
                  {item.trackCount != null && (
                    <span className="ml-2 text-[13px] text-[rgb(var(--color-text-muted))]">
                      {item.trackCount} spår
                    </span>
                  )}
                </div>
                {previewType === 'artist' && item.id && (
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIngestSingleAlbum(item.id)}
                      disabled={ingesting}
                    >
                      Importera album
                    </Button>
                    {albumErrors[item.id] && <InlineError>{albumErrors[item.id]}</InlineError>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Importhistorik</h2>
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Den här sessionen</p>
          </div>
          <ul className="divide-y divide-[rgb(var(--color-border))]">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]">
                {h.status === 'success' ? (
                  <Badge style={{ color: 'rgb(var(--color-success))' }}>Startad</Badge>
                ) : (
                  <Badge variant="muted" style={{ color: 'rgb(var(--color-error))' }}>Misslyckades</Badge>
                )}
                <span className="tabular-nums text-[rgb(var(--color-text-muted))]">{h.time}</span>
                <span className="text-[rgb(var(--color-text))]">{typeLabel[h.type] ?? h.type}</span>
                <span className="min-w-0 max-w-full truncate text-[rgb(var(--color-text-muted))] sm:max-w-80">
                  {h.url}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
