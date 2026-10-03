import type { ReactNode } from 'react';
import { fieldLabelClassName } from '@/ui';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className={fieldLabelClassName}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
