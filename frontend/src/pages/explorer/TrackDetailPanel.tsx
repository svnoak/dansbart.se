import Plot from 'react-plotly.js';
import { useNavigate } from 'react-router-dom';
import type { ExplorerTrackDto } from '@/api/models/explorerTrackDto';
import { getStyleColor } from '@/styles/danceStyleColors';
import { deepLinkToEmbedUrl } from './embedUtils';

const PATTERN_TYPE_LABELS: Record<string, string> = {
  even: 'Jämn',
  long_second: 'Lång tvåa',
  short_first: 'Kort etta',
  short_third: 'Kort trea',
};

interface TrackDetailPanelProps {
  track: ExplorerTrackDto;
  onClose: () => void;
}

export function TrackDetailPanel({ track, onClose }: TrackDetailPanelProps) {
  const navigate = useNavigate();
  const styleColor = getStyleColor(track.danceStyle);
  const embedUrl = getFirstEmbedUrl(track);

  const r1 = track.r1Mean ?? 0;
  const r2 = track.r2Mean ?? 0;
  const r3 = track.r3Mean ?? 0;
  const patternLabel = track.patternType ? (PATTERN_TYPE_LABELS[track.patternType] ?? track.patternType) : '—';

  return (
    <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="truncate text-base font-semibold text-[rgb(var(--color-text))]">
            {track.title ?? '—'}
          </h2>
          <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">{track.artistName ?? '—'}</p>
        </div>
        {track.danceStyle && (
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: styleColor.bg, color: styleColor.text }}
          >
            {track.danceStyle}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
          aria-label="Stäng"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {track.meterAmbiguous && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Taktartsanalys osäker — kan vara felklassificerad
        </div>
      )}

      <div className="mb-4 grid grid-cols-[1fr_auto] gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
            Slagstruktur — {patternLabel}
          </p>
          <Plot
            data={[
              {
                type: 'bar',
                orientation: 'h',
                x: [r1, r2, r3],
                y: ['Slag 1', 'Slag 2', 'Slag 3'],
                marker: { color: ['#1E4FAA', '#88305A', '#166534'] },
              },
            ]}
            layout={{
              autosize: true,
              height: 120,
              margin: { t: 4, r: 10, b: 24, l: 54 },
              xaxis: { range: [0, 0.6], zeroline: false, tickformat: '.2f' },
              yaxis: { autorange: 'reversed' },
              shapes: [
                {
                  type: 'line',
                  x0: 0.333,
                  x1: 0.333,
                  y0: -0.5,
                  y1: 2.5,
                  line: { color: '#9CA3AF', dash: 'dash', width: 1 },
                },
              ],
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { size: 11, color: 'inherit' },
            }}
            config={{ displayModeBar: false }}
            useResizeHandler
            style={{ width: '100%' }}
          />
        </div>

        {embedUrl && (
          <iframe
            src={embedUrl}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="h-28 w-44 shrink-0 rounded border-0"
            title={`Spela ${track.title}`}
          />
        )}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-[rgb(var(--color-border))]/20 p-2">
          <p className="text-lg font-bold text-[rgb(var(--color-text))]">
            {track.liltScore != null ? track.liltScore.toFixed(2) : '—'}
          </p>
          <p className="text-[10px] text-[rgb(var(--color-text-muted))] uppercase tracking-wide">Lyft</p>
          {track.liltConsistency != null && (
            <p className="text-[9px] text-[rgb(var(--color-text-muted))]">
              {Math.round(track.liltConsistency * 100)}% konsekvent
            </p>
          )}
        </div>
        <div className="rounded-md bg-[rgb(var(--color-border))]/20 p-2">
          <p className="text-lg font-bold text-[rgb(var(--color-text))]">
            {track.swingRatio != null ? track.swingRatio.toFixed(2) : '—'}
          </p>
          <p className="text-[10px] text-[rgb(var(--color-text-muted))] uppercase tracking-wide">Swing</p>
        </div>
        <div className="rounded-md bg-[rgb(var(--color-border))]/20 p-2">
          <p className="text-lg font-bold text-[rgb(var(--color-text))]">
            {track.tempoBpm != null ? `${Math.round(track.tempoBpm)}` : '—'}
          </p>
          <p className="text-[10px] text-[rgb(var(--color-text-muted))] uppercase tracking-wide">BPM</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-sm font-bold text-[rgb(var(--color-text))]">
            {track.ternaryConfidence != null ? `${Math.round(track.ternaryConfidence * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-[rgb(var(--color-text-muted))] uppercase tracking-wide">Ternär tro</p>
        </div>
        <div>
          <p className="text-sm font-bold text-[rgb(var(--color-text))]">
            {track.bpmStability != null ? `${Math.round(track.bpmStability * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-[rgb(var(--color-text-muted))] uppercase tracking-wide">BPM-stabilitet</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/classify')}
        className="w-full rounded-md bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        Föreslå dansstil
      </button>
    </div>
  );
}

function getFirstEmbedUrl(track: ExplorerTrackDto): string | null {
  const links = track.playbackLinks;
  if (!links?.length) return null;
  const yt = links.find((l) => l.platform?.toUpperCase() === 'YOUTUBE');
  const sp = links.find((l) => l.platform?.toUpperCase() === 'SPOTIFY');
  const link = yt ?? sp ?? links[0];
  if (!link) return null;
  return deepLinkToEmbedUrl(link);
}
