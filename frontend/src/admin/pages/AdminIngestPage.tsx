import { useState } from 'react';
import {
  getArtistAlbums1,
  getAlbumTracks1,
  ingestAlbum,
  ingestTrack,
} from '@/api/generated/admin-spotify/admin-spotify';
import { ingest } from '@/api/generated/admin-maintenance/admin-maintenance';
import { Button } from '@/ui';
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

  const addHistory = (url: string, type: string, status: 'success' | 'error') => {
    setHistory((prev) => [
      { url, type, status, time: new Date().toLocaleTimeString('sv-SE') },
      ...prev.slice(0, 19),
    ]);
  };

  const handlePreview = async () => {
    const parsed = parseSpotifyUrl(url);
    if (!parsed.id) {
      toast('Ogiltig Spotify-URL', 'error');
      return;
    }

    setPreviewType(parsed.type);
    setPreviewId(parsed.id);
    setLoadingPreview(true);
    setPreview([]);

    try {
      if (parsed.type === 'artist') {
        const result = await getArtistAlbums1(parsed.id);
        const albums = Array.isArray(result) ? result : Object.values(result);
        setPreview(
          albums.map((a: Record<string, unknown>) => ({
            name: (a.name as string) ?? 'Okänt album',
            id: (a.id as string) ?? '',
            trackCount: (a.totalTracks as number) ?? 0,
          })),
        );
      } else if (parsed.type === 'album') {
        const result = await getAlbumTracks1(parsed.id);
        const tracks = Array.isArray(result) ? result : Object.values(result);
        setPreview(
          tracks.map((t: Record<string, unknown>) => ({
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
        toast('Kunde inte identifiera resurstyp. Ange fullständig URL.', 'error');
      }
    } catch {
      toast('Kunde inte hämta förhandsgranskning', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleIngest = async () => {
    if (!previewId) return;
    setIngesting(true);

    try {
      if (previewType === 'track') {
        await ingestTrack({ spotifyTrackId: previewId });
      } else if (previewType === 'album') {
        await ingestAlbum({ spotifyAlbumId: previewId });
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
      toast('Import misslyckades', 'error');
      addHistory(url, previewType ?? 'unknown', 'error');
    } finally {
      setIngesting(false);
    }
  };

  const handleIngestSingleAlbum = async (albumId: string) => {
    setIngesting(true);
    try {
      await ingestAlbum({ spotifyAlbumId: albumId });
      toast('Album-import startad');
      addHistory(`album:${albumId}`, 'album', 'success');
    } catch {
      toast('Album-import misslyckades', 'error');
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Importera</h1>

      <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-5">
        <p className="text-sm text-[rgb(var(--color-text-muted))] mb-3">
          Klistra in en Spotify-URL eller ID för att importera musik till biblioteket.
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <TextInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/artist/... eller spotify:album:..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePreview();
              }}
            />
          </div>
          <Button
            variant="primary"
            onClick={handlePreview}
            disabled={!url.trim() || loadingPreview}
          >
            {loadingPreview ? 'Hämtar...' : 'Hämta från Spotify'}
          </Button>
        </div>

        {previewType && (
          <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">
            Typ: {typeLabel[previewType] ?? previewType} | ID: {previewId}
          </p>
        )}
      </div>

      {/* Preview results */}
      {preview.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
          <div className="border-b border-[rgb(var(--color-border))] px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[rgb(var(--color-text))]">
              Förhandsgranskning ({preview.length} objekt)
            </h2>
            {(previewType === 'track' || previewType === 'album' || previewType === 'playlist') && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleIngest}
                disabled={ingesting}
              >
                {ingesting ? 'Importerar...' : `Importera ${previewType === 'album' ? 'album' : previewType === 'playlist' ? 'spellista' : 'spår'}`}
              </Button>
            )}
            {previewType === 'artist' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleIngest}
                disabled={ingesting}
              >
                {ingesting ? 'Importerar...' : 'Importera allt'}
              </Button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-[rgb(var(--color-border))]/50">
            {preview.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2">
                <div>
                  <span className="text-sm text-[rgb(var(--color-text))]">{item.name}</span>
                  {item.trackCount != null && (
                    <span className="ml-2 text-xs text-[rgb(var(--color-text-muted))]">
                      {item.trackCount} spår
                    </span>
                  )}
                </div>
                {previewType === 'artist' && item.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleIngestSingleAlbum(item.id)}
                    disabled={ingesting}
                  >
                    Importera album
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <h2 className="text-sm font-medium text-[rgb(var(--color-text))] mb-2">
            Importhistorik (denna session)
          </h2>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={h.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                  {h.status === 'success' ? 'OK' : 'Fel'}
                </span>
                <span className="text-[rgb(var(--color-text-muted))]">{h.time}</span>
                <span className="text-[rgb(var(--color-text))]">{h.type}</span>
                <span className="text-[rgb(var(--color-text-muted))] truncate max-w-[300px]">
                  {h.url}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
