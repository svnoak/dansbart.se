import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';

export type { ButtonSize, ButtonVariant };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={buttonClassName(variant, size, className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
