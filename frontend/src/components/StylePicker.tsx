export interface StylePickerOption {
  value: string;
  label: string;
  bold?: boolean;
}

interface StylePickerProps {
  /** 'full' is a labelled button grid with large tap targets (FlagTrackModal, /classify).
   *  'compact' is a native <select> for surfaces with little screen space (SmartNudge) —
   *  a native picker gets the platform's own large picker UI, OS text scaling and
   *  screen-reader support for free. */
  presentation: 'full' | 'compact';
  options: StylePickerOption[];
  placeholder: string;
  onSelect: (value: string) => void;
  compactClassName?: string;
}

export function StylePicker({
  presentation,
  options,
  placeholder,
  onSelect,
  compactClassName,
}: StylePickerProps) {
  if (presentation === 'compact') {
    return (
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        className={
          compactClassName ??
          'w-full bg-white border border-gray-300 text-gray-900 px-4 py-3 rounded text-sm font-medium'
        }
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(o.value)}
          className={`py-6 px-2 rounded-xl font-bold text-sm shadow-sm transition-all border bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-accent))]/50 hover:text-[rgb(var(--color-accent))] hover:shadow-md active:scale-95 break-words leading-tight ${
            o.bold
              ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]'
              : 'border-[rgb(var(--color-border))]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
