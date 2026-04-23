export type XAxisField =
  | 'tempoBpm'
  | 'swingRatio'
  | 'bounciness'
  | 'articulation'
  | 'polskaScore'
  | 'hamboScore'
  | 'asymmetryScore'
  | 'liltScore'
  | 'loudness'
  | 'punchiness'
  | 'voiceProbability'
  | 'ternaryConfidence';

export const X_AXIS_OPTIONS: { value: XAxisField; label: string }[] = [
  { value: 'tempoBpm', label: 'Tempo (BPM)' },
  { value: 'swingRatio', label: 'Swing' },
  { value: 'bounciness', label: 'Studsbarhet' },
  { value: 'articulation', label: 'Artikulation' },
  { value: 'polskaScore', label: 'Polska-känsla' },
  { value: 'hamboScore', label: 'Hambo-känsla' },
  { value: 'asymmetryScore', label: 'Asymmetri' },
  { value: 'liltScore', label: 'Lyft' },
  { value: 'punchiness', label: 'Punch' },
  { value: 'loudness', label: 'Loudness' },
  { value: 'ternaryConfidence', label: 'Ternär tro' },
  { value: 'voiceProbability', label: 'Röst' },
];

export type ColorByField = 'meter' | 'danceStyle';

interface ExplorerFilters {
  meter: string;
  minBpm: number;
  maxBpm: number;
  minAsymmetry: number;
  maxAsymmetry: number;
  showAmbiguous: boolean;
  xAxis: XAxisField;
  yAxis: XAxisField;
  zAxis: XAxisField;
  colorBy: ColorByField;
}

interface ExplorerFilterSidebarProps {
  filters: ExplorerFilters;
  trackCount: number;
  onChange: (patch: Partial<ExplorerFilters>) => void;
}

const METER_OPTIONS = [
  { value: '', label: 'Alla' },
  { value: '3/4', label: '3/4' },
  { value: '4/4', label: '4/4' },
];

const COLOR_BY_OPTIONS: { value: ColorByField; label: string }[] = [
  { value: 'meter', label: 'Taktart' },
  { value: 'danceStyle', label: 'Dansstil' },
];

function AxisButtonGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: XAxisField;
  onChange: (v: XAxisField) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-semibold text-[rgb(var(--color-text))]">{label}</p>
      <div className="flex flex-wrap gap-1">
        {X_AXIS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              value === opt.value
                ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
                : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:border-[rgb(var(--color-accent))]/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExplorerFilterSidebar({ filters, trackCount, onChange }: ExplorerFilterSidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 text-sm">
      <AxisButtonGroup
        label="X-axel"
        value={filters.xAxis}
        onChange={(v) => onChange({ xAxis: v })}
      />

      <AxisButtonGroup
        label="Y-axel"
        value={filters.yAxis}
        onChange={(v) => onChange({ yAxis: v })}
      />

      <AxisButtonGroup
        label="Z-axel"
        value={filters.zAxis}
        onChange={(v) => onChange({ zAxis: v })}
      />

      <div>
        <p className="mb-2 font-semibold text-[rgb(var(--color-text))]">Färglägg efter</p>
        <div className="flex gap-1">
          {COLOR_BY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ colorBy: opt.value })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                filters.colorBy === opt.value
                  ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:border-[rgb(var(--color-accent))]/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold text-[rgb(var(--color-text))]">Taktart</p>
        <div className="flex gap-1">
          {METER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ meter: opt.value })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                filters.meter === opt.value
                  ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:border-[rgb(var(--color-accent))]/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold text-[rgb(var(--color-text))]">Tempo (BPM)</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-2 text-[rgb(var(--color-text-muted))]">
            <span className="w-8 text-right text-xs">{filters.minBpm}</span>
            <input
              type="range"
              min={40}
              max={filters.maxBpm}
              value={filters.minBpm}
              onChange={(e) => onChange({ minBpm: Number(e.target.value) })}
              className="flex-1 accent-[rgb(var(--color-accent))]"
            />
            <span className="w-16 text-xs">Min BPM</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[rgb(var(--color-text-muted))]">
            <span className="w-8 text-right text-xs">{filters.maxBpm}</span>
            <input
              type="range"
              min={filters.minBpm}
              max={300}
              value={filters.maxBpm}
              onChange={(e) => onChange({ maxBpm: Number(e.target.value) })}
              className="flex-1 accent-[rgb(var(--color-accent))]"
            />
            <span className="w-16 text-xs">Max BPM</span>
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold text-[rgb(var(--color-text))]">Asymmetri</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-2 text-[rgb(var(--color-text-muted))]">
            <span className="w-8 text-right text-xs">{Math.round(filters.minAsymmetry * 100)}%</span>
            <input
              type="range"
              min={0}
              max={filters.maxAsymmetry}
              step={0.01}
              value={filters.minAsymmetry}
              onChange={(e) => onChange({ minAsymmetry: Number(e.target.value) })}
              className="flex-1 accent-[rgb(var(--color-accent))]"
            />
            <span className="w-16 text-xs">Min</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[rgb(var(--color-text-muted))]">
            <span className="w-8 text-right text-xs">{Math.round(filters.maxAsymmetry * 100)}%</span>
            <input
              type="range"
              min={filters.minAsymmetry}
              max={0.5}
              step={0.01}
              value={filters.maxAsymmetry}
              onChange={(e) => onChange({ maxAsymmetry: Number(e.target.value) })}
              className="flex-1 accent-[rgb(var(--color-accent))]"
            />
            <span className="w-16 text-xs">Max</span>
          </label>
        </div>
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2 text-[rgb(var(--color-text-muted))]">
          <input
            type="checkbox"
            checked={filters.showAmbiguous}
            onChange={(e) => onChange({ showAmbiguous: e.target.checked })}
            className="accent-[rgb(var(--color-accent))]"
          />
          <span className="text-xs">Visa osäker taktart</span>
        </label>
      </div>

      <p className="mt-auto border-t border-[rgb(var(--color-border))] pt-3 text-center text-xs text-[rgb(var(--color-text-muted))]">
        {trackCount} låtar
      </p>
    </aside>
  );
}
