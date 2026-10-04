import { UserIcon } from '@/icons/UserIcon';

interface AvatarPlaceholderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** The name whose first letter the avatar shows. Without it, a person icon. */
  name?: string | null;
}

/** First letter of a name, upper-cased, or null when there is no letter to show. */
function initialOf(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toLocaleUpperCase('sv-SE');
}

/**
 * The round avatar for an artist or a person: the initial in ink on a soft
 * fill. Sizes: sm 32, md 40, lg 56, xl 112 px.
 */
export function AvatarPlaceholder({ className = '', size = 'md', name }: AvatarPlaceholderProps) {
  const sizes = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-14 w-14 text-xl',
    xl: 'h-28 w-28 text-4xl',
  };
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-7 w-7',
    xl: 'h-12 w-12',
  };
  const initial = initialOf(name);
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] font-bold text-[rgb(var(--color-text))] ${sizes[size]} ${className}`}
      aria-hidden
    >
      {initial ?? <UserIcon className={iconSizes[size]} />}
    </div>
  );
}
