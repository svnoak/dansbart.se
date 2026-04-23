import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ExplorerTrackDto } from '@/api/models/explorerTrackDto';
import { getStyleColor } from '@/styles/danceStyleColors';
import type { XAxisField, ColorByField } from './ExplorerFilterSidebar';
import { X_AXIS_OPTIONS } from './ExplorerFilterSidebar';
import { inferMeter } from './ExplorerScatterPlot';

interface ExplorerScatter3DProps {
  tracks: ExplorerTrackDto[];
  selectedId: string | null;
  xAxis: XAxisField;
  yAxis: XAxisField;
  zAxis: XAxisField;
  colorBy: ColorByField;
  onSelect: (id: string) => void;
}

const STYLE_HEX: Record<string, string> = {
  polska: '#1E4FAA',
  slangpolska: '#3B6FCA',
  vals: '#88305A',
  hambo: '#A0466E',
  menuett: '#2D5F9A',
  ganglat: '#4A7AAA',
  mazurka: '#7A3060',
  polka: '#166534',
  schottis: '#155E63',
  snoa: '#0E7490',
  engelska: '#1A7A40',
};

const METER_HEX: Record<string, string> = {
  '3/4': '#1E4FAA',
  '4/4': '#166534',
  '2/4': '#7C3AED',
  'Tvetydig': '#9CA3AF',
};

function styleToHex(style: string | undefined): string {
  if (!style) return '#9CA3AF';
  const key = style.toLowerCase();
  if (STYLE_HEX[key]) return STYLE_HEX[key];
  for (const [k, v] of Object.entries(STYLE_HEX)) {
    if (key.startsWith(k)) return v;
  }
  return getStyleColor(style).text;
}

function getVal(track: ExplorerTrackDto, field: XAxisField): number | null {
  const v = track[field as keyof ExplorerTrackDto];
  return typeof v === 'number' ? v : null;
}

function axisLabel(field: XAxisField): string {
  return X_AXIS_OPTIONS.find((o) => o.value === field)?.label ?? field;
}

export function ExplorerScatter3D({
  tracks,
  selectedId,
  xAxis,
  yAxis,
  zAxis,
  colorBy,
  onSelect,
}: ExplorerScatter3DProps) {
  const xLabel = axisLabel(xAxis);
  const yLabel = axisLabel(yAxis);
  const zLabel = axisLabel(zAxis);

  const traces = useMemo(() => {
    const groups: Record<string, ExplorerTrackDto[]> = {};
    for (const t of tracks) {
      const key = colorBy === 'meter' ? inferMeter(t) : (t.danceStyle ?? 'Okänd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }

    return Object.entries(groups).flatMap(([groupKey, group]) => {
      const color =
        colorBy === 'meter' ? (METER_HEX[groupKey] ?? '#9CA3AF') : styleToHex(groupKey);

      const makeTrace = (items: ExplorerTrackDto[], hasData: boolean) => ({
        type: 'scatter3d' as const,
        mode: 'markers' as const,
        name: hasData ? groupKey : `${groupKey} (saknar data)`,
        showlegend: items.length > 0 && hasData,
        x: items.map((t) => getVal(t, xAxis) ?? 0),
        y: items.map((t) => getVal(t, yAxis) ?? 0),
        z: items.map((t) => getVal(t, zAxis) ?? 0),
        customdata: items.map((t) => t.id ?? '') as string[],
        text: items.map((t) => `${t.title ?? ''} – ${t.artistName ?? ''}`),
        hovertemplate:
          `<b>%{text}</b><br>${xLabel}: %{x:.3f}<br>${yLabel}: %{y:.3f}<br>${zLabel}: %{z:.3f}<extra></extra>`,
        marker: {
          color: hasData ? color : '#D1D5DB',
          size: items.map((t) => (t.id === selectedId ? 10 : 5)),
          opacity: hasData ? 0.85 : 0.35,
          symbol: (items.map((t) =>
            t.meterAmbiguous ? 'diamond-open' : 'circle',
          )) as string[],
          line: {
            color: items.map((t) =>
              t.id === selectedId ? '#000000' : hasData ? color : '#D1D5DB',
            ),
            width: items.map((t) => (t.id === selectedId ? 2 : 0.5)),
          },
        },
      });

      const withData = group.filter((t) => getVal(t, xAxis) !== null);
      const noData = group.filter((t) => getVal(t, xAxis) === null);

      return [
        ...(withData.length > 0 ? [makeTrace(withData, true)] : []),
        ...(noData.length > 0 ? [makeTrace(noData, false)] : []),
      ];
    });
  }, [tracks, selectedId, xAxis, yAxis, zAxis, xLabel, yLabel, zLabel, colorBy]);

  return (
    <Plot
      data={traces}
      layout={{
        autosize: true,
        margin: { t: 20, r: 20, b: 20, l: 20 },
        scene: {
          xaxis: { title: { text: xLabel } },
          yaxis: { title: { text: yLabel } },
          zaxis: { title: { text: zLabel } },
        },
        legend: { orientation: 'h', y: -0.05, font: { size: 11 } },
        paper_bgcolor: 'transparent',
        font: { color: 'inherit' },
      }}
      config={{ displayModeBar: false }}
      useResizeHandler
      style={{ width: '100%', height: '100%' }}
      onClick={(e) => {
        const pt = e.points[0];
        const id = pt?.customdata as string | undefined;
        if (id) onSelect(id);
      }}
    />
  );
}
