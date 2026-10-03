import type { ReactNode, SelectHTMLAttributes } from 'react';
import { fieldClassName, fieldLabelClassName } from './fieldStyles';

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'className'> {
  id: string;
  /** The visible label. Pass `hideLabel` to keep it for screen readers only. */
  label: string;
  hideLabel?: boolean;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}

export function SelectField({ id, label, hideLabel = false, onChange, className = '', children, ...props }: SelectFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : fieldLabelClassName}>
        {label}
      </label>
      <select
        id={id}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClassName} pr-9`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
