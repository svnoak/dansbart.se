import type { InputHTMLAttributes } from 'react';
import { fieldClassName } from '@/ui';

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className = '', ...props }: TextInputProps) {
  return <input {...props} className={`${fieldClassName} ${className}`} />;
}
