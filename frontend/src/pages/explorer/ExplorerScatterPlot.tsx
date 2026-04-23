import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ExplorerTrackDto } from '@/api/models/explorerTrackDto';
import { getStyleColor } from '@/styles/danceStyleColors';
import type { XAxisField, ColorByField } from './ExplorerFilterSidebar';
import { X_AXIS_OPTIONS } from './ExplorerFilterSidebar';

interface ExplorerScatterPlotProps {
  tracks: ExplorerTrackDto[];
  selectedId: string | null;
  xAxis: XAxisField;
  yAxis: XAxisField;
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

export function inferMeter(t: ExplorerTrackDto): string {
  const style = t.danceStyle?.toLowerCase();
  if (style === 'polka' || style === 'galopp') return '2/4';
  if (t.ternaryConfidence != null) {
    if (t.ternaryConfidence >= 0.6) return '3/4';
    if (t.ternaryConfidence < 0.4) return '4/4';
  }
  return 'Tvetydig';
}

function styleToHex(style: string | undefined): string {
  if (!style) return '#9CA3AF';
  const key = style.toLowerCase();
  if (STYLE_HEX[key]) return STYLE_HEX[key];
  for (const [k, v] of Object.entries(STYLE_HEX)) {
    if (key.startsWith(k)) return v;
  }
  return getStyleColor(style).text;
}

function getAxisValue(track: ExplorerTrackDto, field: XAxisField): number | null {
  const val = track[field as keyof ExplorerTrackDto];
  return typeof val === 'number' ? val : null;
}

function axisLabel(field: XAxisField): string {
  return X_AXIS_OPTIONS.find((o) => o.value === field)?.label ?? field;
}

export function ExplorerScatterPlot({
  tracks,
  selectedId,
  xAxis,
  yAxis,
  colorBy,
  onSelect,
}: ExplorerScatterPlotProps) {
  const xLabel = axisLabel(xAxis);
  const yLabel = axisLabel(yAxis);

  const traces = useMemo(() => {
    const groups: Record<string, ExplorerTrackDto[]> = {};
    for (const t of tracks) {
      const key =
        colorBy === 'meter' ? inferMeter(t) : (t.danceStyle ?? 'Okänd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }

    return Object.entries(groups).flatMap(([groupKey, group]) => {
      const color =
        colorBy === 'meter' ? (METER_HEX[groupKey] ?? '#9CA3AF') : styleToHex(groupKey);

      const makeTrace = (
        items: ExplorerTrackDto[],
        isAmbiguous: boolean,
        hasData: boolean,
      ) => {
        const xVals = items.map((t) => (hasData ? (getAxisValue(t, xAxis) ?? 0) : 0));
        const yVals = items.map((t) => (getAxisValue(t, yAxis) ?? 0));
        const symbol = isAmbiguous
          ? ('diamond-open' as const)
          : hasData
            ? ('circle' as const)
            : ('circle-open' as const);
        const markerColor = hasData ? color : '#D1D5DB';
        const opacity = hasData ? 0.85 : 0.4;
        const nameSuffix = isAmbiguous ? ' (osäker takt)' : !hasData ? ' (saknar data)' : '';

        return {
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: `${groupKey}${nameSuffix}`,
          showlegend: items.length > 0 && (hasData || !isAmbiguous),
          x: xVals,
          y: yVals,
          customdata: items.map((t) => t.id ?? '') as string[],
          text: items.map((t) => `${t.title ?? ''} – ${t.artistName ?? ''}`),
          hovertemplate: `<b>%{text}</b><br>${xLabel}: %{x:.3f}<br>${yLabel}: %{y:.3f}<extra></extra>`,
          marker: {
            color: markerColor,
            size: items.map((t) => (t.id === selectedId ? 14 : 8)),
            symbol,
            line: {
              color: items.map((t) => (t.id === selectedId ? '#000000' : markerColor)),
              width: items.map((t) =>
                t.id === selectedId ? 2 : symbol !== 'circle' ? 1.5 : 0.5,
              ),
            },
            opacity,
          },
        };
      };

      const withData = group.filter(
        (t) => getAxisValue(t, xAxis) !== null && !t.meterAmbiguous,
      );
      const withDataAmbiguous = group.filter(
        (t) => getAxisValue(t, xAxis) !== null && t.meterAmbiguous,
      );
      const noData = group.filter((t) => getAxisValue(t, xAxis) === null);

      return [
        makeTrace(withData, false, true),
        makeTrace(withDataAmbiguous, true, true),
        makeTrace(noData, false, false),
      ].filter((tr) => (tr.x as number[]).length > 0);
    });
  }, [tracks, selectedId, xAxis, yAxis, xLabel, yLabel, colorBy]);

  return (
    <Plot
      data={traces}
      layout={{
        autosize: true,
        margin: { t: 20, r: 20, b: 50, l: 55 },
        xaxis: { title: { text: xLabel }, zeroline: false },
        yaxis: { title: { text: yLabel }, zeroline: false },
        dragmode: 'pan',
        legend: { orientation: 'h', y: -0.18, font: { size: 11 } },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: 'inherit' },
      }}
      config={{ displayModeBar: false, scrollZoom: true }}
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
