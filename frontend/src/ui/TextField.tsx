import { fieldClassName, fieldLabelClassName } from './fieldStyles';

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  placeholder?: string;
}

export function TextField({ id, label, value, onChange, autoComplete, autoFocus, placeholder }: TextFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={fieldLabelClassName}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={fieldClassName}
      />
    </div>
  );
}
