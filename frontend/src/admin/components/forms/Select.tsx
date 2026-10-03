import type { SelectHTMLAttributes } from 'react';
import { fieldClassName } from '@/ui';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select {...props} className={`${fieldClassName} pr-9 ${className}`}>
      {children}
    </select>
  );
}
