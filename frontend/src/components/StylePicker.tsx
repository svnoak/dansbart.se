export interface StylePickerOption {
  value: string;
  label: string;
  bold?: boolean;
}

interface StylePickerProps {
  /** 'full' is a labelled button grid with large tap targets (FlagTrackModal, StyleVotePanel).
   *  'compact' is a native <select> for surfaces with little screen space (SmartNudge) —
   *  a native picker gets the platform's own large picker UI, OS text scaling and
   *  screen-reader support for free. */
  presentation: 'full' | 'compact';
  options: StylePickerOption[];
  placeholder?: string;
  onSelect: (value: string) => void;
  /** Colour classes for the 'compact' select; its layout classes always apply. */
  compactClassName?: string;
  disabled?: boolean;
  /** Accessible name for the 'compact' native select — required there since the
   *  placeholder option drops out of the accessible name once a value is picked. */
  ariaLabel?: string;
}

export function StylePicker({
  presentation,
  options,
  placeholder,
  onSelect,
  compactClassName,
  disabled,
  ariaLabel,
}: StylePickerProps) {
  if (presentation === 'compact') {
    return (
      <select
        value=""
        aria-label={ariaLabel}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        className={
          'w-full min-h-11 border px-4 py-3 rounded-[var(--radius)] text-sm font-medium ' +
          (compactClassName ?? 'bg-[rgb(var(--color-bg-elevated))] border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text))]')
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
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(o.value)}
          disabled={disabled}
          className={`min-h-14 px-2 rounded-[var(--radius-lg)] font-semibold text-[15px] transition-colors border bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] active:scale-[0.98] break-words leading-tight disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] ${
            o.bold
              ? 'border-2 border-[rgb(var(--color-link))] text-[rgb(var(--color-link))]'
              : 'border-[rgb(var(--color-border))]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
