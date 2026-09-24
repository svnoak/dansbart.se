interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}

export function TextField({ id, label, value, onChange, autoComplete }: TextFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[rgb(var(--color-text))]">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
      />
    </div>
  );
}
