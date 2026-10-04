import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useConsent } from '@/consent/useConsent';
import { useAuth } from '@/auth/useAuth';
import {
  LibraryIcon,
  PlaylistIcon,
  HeartIcon,
  GroupIcon,
  QueueListIcon,
  MusicNoteIcon,
  StarMarkIcon,
  UserIcon,
} from '@/icons';
import { getInvitations } from '@/api/generated/playlists/playlists';
import { getGroupInvitations } from '@/api/generated/groups/groups';

function NavLink({
  to,
  active,
  icon,
  hint,
  badge,
  onClick,
  children,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  /** A short grey word after the label, for example "namngivna" after Danser. */
  hint?: string;
  badge?: number;
  onClick?: () => void;
  children: string;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 text-sm transition-colors ${
        active
          ? 'bg-[rgb(var(--color-selected))]/10 font-semibold text-[rgb(var(--color-selected))]'
          : 'font-medium text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-current">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-[rgb(var(--color-text-muted))]">{hint}</span>}
      {badge != null && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] px-1.5 text-xs font-bold text-[rgb(var(--color-accent-foreground))]">
          {badge}
        </span>
      )}
    </Link>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="mt-4 mb-1 px-3 text-xs font-semibold text-[rgb(var(--color-text-muted))]">
      {children}
    </p>
  );
}

const SearchIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const HomeIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

const HelpIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" />
    <path d="M12 17v.01" />
  </svg>
);

/**
 * Main navigation, grouped by what a person is doing: Hem and Sök, then
 * Utforska (public browsing), Mitt (things that belong to the person) and
 * Gemenskap (other people). Info pages are small links at the bottom.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { consentStatus, openCookieSettings } = useConsent();
  const { isAuthenticated } = useAuth();
  const [invitationCount, setInvitationCount] = useState(0);
  const [groupInvitationCount, setGroupInvitationCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getInvitations()
      .then((invitations) => {
        if (!cancelled) setInvitationCount(invitations.length);
      })
      .catch(() => {
        if (!cancelled) setInvitationCount(0);
      });
    getGroupInvitations()
      .then((invitations) => {
        if (!cancelled) setGroupInvitationCount(invitations.length);
      })
      .catch(() => {
        if (!cancelled) setGroupInvitationCount(0);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const path = location.pathname;
  const isHome = path === '/';
  const isSearch = path === '/search';
  const isStyles = path === '/dance-styles';
  const isDances = path.startsWith('/dance') && !path.startsWith('/dance-lists') && !isStyles;
  const isArtists = path.startsWith('/artist') || path.startsWith('/album');
  const isPlaylists = path.startsWith('/playlists');
  const isDanceLists = path.startsWith('/dance-lists');
  const isGroups = path.startsWith('/groups');
  const isFavorites = path === '/favorites';
  const isMinaLatar = path === '/mina-latar';
  const isHelp = path.startsWith('/help');

  const footerLink = 'min-h-8 inline-flex items-center text-[13px] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] hover:underline';

  return (
    <nav className="flex h-full flex-col gap-0.5 px-2" aria-label="Huvudnavigering">
      <NavLink to="/" active={isHome} onClick={onNavigate} icon={HomeIcon}>
        Hem
      </NavLink>
      <NavLink to="/search" active={isSearch} onClick={onNavigate} icon={SearchIcon}>
        Sök
      </NavLink>

      <GroupLabel>Utforska</GroupLabel>
      <NavLink
        to="/#dansstilar"
        active={isStyles}
        onClick={onNavigate}
        icon={<StarMarkIcon className="h-5 w-5" aria-hidden />}
      >
        Dansstilar
      </NavLink>
      <NavLink
        to="/dances"
        active={isDances}
        onClick={onNavigate}
        hint="namngivna"
        icon={<MusicNoteIcon className="h-5 w-5" aria-hidden />}
      >
        Danser
      </NavLink>
      <NavLink
        to="/artists"
        active={isArtists}
        onClick={onNavigate}
        icon={<UserIcon className="h-5 w-5" aria-hidden />}
      >
        Artister
      </NavLink>

      <GroupLabel>Mitt</GroupLabel>
      <NavLink
        to="/playlists"
        active={isPlaylists}
        onClick={onNavigate}
        icon={<PlaylistIcon className="h-5 w-5" aria-hidden />}
        badge={invitationCount}
      >
        Spellistor
      </NavLink>
      <NavLink
        to="/dance-lists"
        active={isDanceLists}
        onClick={onNavigate}
        icon={<QueueListIcon className="h-5 w-5" aria-hidden />}
      >
        Danslistor
      </NavLink>
      <NavLink
        to="/favorites"
        active={isFavorites}
        onClick={onNavigate}
        icon={<HeartIcon className="h-5 w-5" aria-hidden />}
      >
        Favoriter
      </NavLink>
      {isAuthenticated && (
        <NavLink
          to="/mina-latar"
          active={isMinaLatar}
          onClick={onNavigate}
          icon={<LibraryIcon className="h-5 w-5" aria-hidden />}
        >
          Mina låtar
        </NavLink>
      )}

      <GroupLabel>Gemenskap</GroupLabel>
      <NavLink
        to="/groups"
        active={isGroups}
        onClick={onNavigate}
        icon={<GroupIcon className="h-5 w-5" aria-hidden />}
        badge={groupInvitationCount}
      >
        Grupper
      </NavLink>
      <NavLink to="/help" active={isHelp} onClick={onNavigate} icon={HelpIcon}>
        Hjälp &amp; nyheter
      </NavLink>

      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-0 border-t border-[rgb(var(--color-border))] px-3 pt-3 mx-1">
        <Link to="/about" onClick={onNavigate} className={footerLink}>Om oss</Link>
        <Link to="/feedback" onClick={onNavigate} className={footerLink}>Feedback</Link>
        <Link to="/privacy" onClick={onNavigate} className={footerLink}>Integritet</Link>
        <Link to="/terms" onClick={onNavigate} className={footerLink}>Villkor</Link>
        {consentStatus && (
          <button type="button" onClick={openCookieSettings} className={footerLink}>
            Cookies
          </button>
        )}
      </div>
    </nav>
  );
}
