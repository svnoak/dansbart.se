import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { Data } from 'plotly.js';
import type { ExplorerTrackDto } from '@/api/models/explorerTrackDto';
import { inferMeter } from './ExplorerScatterPlot';

interface ExplorerParallelCoordsProps {
  tracks: ExplorerTrackDto[];
  selectedId: string | null;
}

const METER_CODE: Record<string, number> = {
  '3/4': 0,
  'Tvetydig': 1,
  '4/4': 2,
  '2/4': 3,
};

// Colorscale: 3/4=blue, Tvetydig=grey, 4/4=green, 2/4=purple
const COLORSCALE: [number, string][] = [
  [0, '#1E4FAA'],
  [0.33, '#9CA3AF'],
  [0.67, '#166534'],
  [1, '#7C3AED'],
];

type Dimension = {
  field: keyof ExplorerTrackDto;
  label: string;
};

// Only fields present in the current generated model
const DIMENSIONS: Dimension[] = [
  { field: 'tempoBpm', label: 'Tempo (BPM)' },
  { field: 'swingRatio', label: 'Swing' },
  { field: 'liltScore', label: 'Lyft' },
  { field: 'liltConsistency', label: 'Lyft-konsistens' },
  { field: 'asymmetryScore', label: 'Asymmetri' },
  { field: 'asymmetryConsistency', label: 'Asym-konsistens' },
  { field: 'polskaScore', label: 'Polska-känsla' },
  { field: 'hamboScore', label: 'Hambo-känsla' },
  { field: 'r1Mean', label: 'R1 (slag 1)' },
  { field: 'r2Mean', label: 'R2 (slag 2)' },
  { field: 'r3Mean', label: 'R3 (slag 3)' },
  { field: 'ternaryConfidence', label: 'Ternär tro' },
];

function numVal(t: ExplorerTrackDto, field: keyof ExplorerTrackDto): number {
  const v = t[field];
  return typeof v === 'number' ? v : NaN;
}

export function ExplorerParallelCoords({ tracks, selectedId }: ExplorerParallelCoordsProps) {
  const trace = useMemo(() => {
    const lineColor = tracks.map((t) => METER_CODE[inferMeter(t)] ?? 1);

    const dimensions = DIMENSIONS.map((d) => ({
      label: d.label,
      values: tracks.map((t) => numVal(t, d.field)),
    }));

    return {
      type: 'parcoords',
      line: {
        color: lineColor,
        colorscale: COLORSCALE,
        showscale: true,
        colorbar: {
          tickvals: [0, 1, 2, 3],
          ticktext: ['3/4', 'Tvetydig', '4/4', '2/4'],
          len: 0.5,
          thickness: 12,
          title: { text: 'Taktart', side: 'right' },
        },
      },
      dimensions,
      // Highlight selected track with a constraintrange on a hidden dimension is not
      // feasible in parcoords; selection is handled by the detail panel instead.
      ids: tracks.map((t) => t.id ?? ''),
    } as unknown as Data;
  }, [tracks, selectedId]);

  return (
    <Plot
      data={[trace]}
      layout={{
        autosize: true,
        margin: { t: 40, r: 80, b: 20, l: 60 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: 'inherit', size: 11 },
      }}
      config={{ displayModeBar: false }}
      useResizeHandler
      style={{ width: '100%', height: '100%' }}
    />
  );
}
