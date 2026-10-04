import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

/** A labelled field: a 14 px semibold label above its control. */
export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-[rgb(var(--color-text))]"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
