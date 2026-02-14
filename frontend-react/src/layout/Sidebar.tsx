import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useConsent } from '@/consent/ConsentContext';
import { Button } from '@/ui';

function NavLink({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon?: React.ReactNode | null;
  children: string;
}) {
  return (
    <Link
      to={to}
      className={`flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition-colors ${
        icon != null ? '' : 'pl-2'
      } ${
        active
          ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))] border-r-3 border-[rgb(var(--color-accent))]'
          : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50'
      }`}
    >
      {icon != null && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-current opacity-90">
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { consentStatus, openCookieSettings } = useConsent();
  const isSearch = location.pathname === '/search';
  const isHome = location.pathname === '/';
  const isAbout = location.pathname === '/about';
  const isTerms = location.pathname === '/terms';
  const isPrivacy = location.pathname === '/privacy';
  const isInfoPage = isAbout || isTerms || isPrivacy;

  const [omOpen, setOmOpen] = useState(isInfoPage);
  useEffect(() => {
    if (isInfoPage) setOmOpen(true);
  }, [isInfoPage]);

  return (
    <nav className="flex flex-col gap-1" aria-label="Huvudnavigering">
      <NavLink
        to="/search"
        active={isSearch}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        }
      >
        Bibliotek & Sök
      </NavLink>
      <NavLink
        to="/"
        active={isHome}
        icon={
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z" />
          </svg>
        }
      >
        Folkmusikkarta
      </NavLink>
      <NavLink
        to="/search"
        active={false}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M2 4.5A2.5 2.5 0 014.5 2h11A2.5 2.5 0 0118 4.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 012 15.5v-11zM4.5 4a.5.5 0 00-.5.5v11c0 .276.224.5.5.5h11a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-11zM8 7a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zM8 11a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zM8 15a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          </svg>
        }
      >
        Spellistor
      </NavLink>
      <NavLink
        to="/search"
        active={false}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M8.157 2.175a1.5 1.5 0 00-1.147 0l-4.84 2.02a1.5 1.5 0 00-.657.657l-2.02 4.84a1.5 1.5 0 000 1.147l2.02 4.84a1.5 1.5 0 00.657.657l4.84 2.02a1.5 1.5 0 001.147 0l4.84-2.02a1.5 1.5 0 00.657-.657l2.02-4.84a1.5 1.5 0 000-1.147l-2.02-4.84a1.5 1.5 0 00-.657-.657l-4.84-2.02zM7.58 4.758a.75.75 0 01.575 0l3.02 1.262 1.262-3.02a.75.75 0 011.15 0l1.262 3.02 3.02 1.262a.75.75 0 010 1.15l-3.02 1.262-1.262 3.02a.75.75 0 01-1.15 0l-1.262-3.02-3.02-1.262a.75.75 0 010-1.15l3.02-1.262 1.262-3.02z" clipRule="evenodd" />
          </svg>
        }
      >
        Folk Map
      </NavLink>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOmOpen((o) => !o)}
          className={`flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-left text-sm font-medium transition-colors ${
            isInfoPage
              ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
              : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50'
          }`}
          aria-expanded={omOpen}
          aria-controls="sidebar-om-submenu"
          id="sidebar-om-button"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-current opacity-90">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-5 w-5 transition-transform ${omOpen ? 'rotate-90' : ''}`}
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.06l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </span>
          <span>Om</span>
        </button>
        <div
          id="sidebar-om-submenu"
          role="region"
          aria-labelledby="sidebar-om-button"
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${omOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-1 border-l-2 border-[rgb(var(--color-border))] ml-5 pl-2 py-1">
            <NavLink to="/about" active={isAbout}>
              Om oss
            </NavLink>
            <NavLink to="/privacy" active={isPrivacy}>
              Integritetspolicy
            </NavLink>
            <NavLink to="/terms" active={isTerms}>
              Användarvillkor
            </NavLink>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
          Community
        </p>
        <div className="flex flex-col gap-1">
          <NavLink
            to="/search"
            active={false}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
            }
          >
            My Studio
          </NavLink>
          <NavLink
            to="/search"
            active={false}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.5 2A2.5 2.5 0 002 4.5v3.879a2.5 2.5 0 00.732 1.767l7.5 7.5a2.5 2.5 0 003.536 0l3.878-3.878a2.5 2.5 0 000-3.536l-7.5-7.5A2.5 2.5 0 008.38 2H4.5zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            }
          >
            Placeholder
          </NavLink>
        </div>
      </div>

      {consentStatus && (
        <div className="mt-4 px-3">
          <button
            type="button"
            onClick={openCookieSettings}
            className="w-full text-left rounded-none px-3 py-2.5 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))] transition-colors"
          >
            Cookie-inställningar
          </button>
        </div>
      )}

      <div className="m-4">
        <div className="rounded-xl border border-[rgb(var(--color-accent))]/30 bg-[rgb(var(--color-accent-muted))]/30 p-4">
          <p className="text-sm font-medium text-[rgb(var(--color-text))]">Veckans utmaning</p>
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
            Hjälp till att förbättra klassificeringen av dansstilar.
          </p>
          <Link to="/classify" className="mt-3 block">
            <Button variant="primary" size="sm" className="w-full">
              Starta quiz
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
