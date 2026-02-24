interface AvatarPlaceholderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AvatarPlaceholder({ className = '', size = 'md' }: AvatarPlaceholderProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-border))]/60 text-[rgb(var(--color-text-muted))] ${sizes[size]} ${className}`}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-1/2 h-1/2"
      >
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}
