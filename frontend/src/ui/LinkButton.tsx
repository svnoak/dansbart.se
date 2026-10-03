import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';

interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

/** A router link that looks like a Button. Use it when the action is navigation. */
export function LinkButton({ to, variant = 'primary', size = 'md', className = '', children }: LinkButtonProps) {
  return (
    <Link to={to} className={buttonClassName(variant, size, className)}>
      {children}
    </Link>
  );
}
