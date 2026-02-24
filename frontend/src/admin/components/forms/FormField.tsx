import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[rgb(var(--color-text))]"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
