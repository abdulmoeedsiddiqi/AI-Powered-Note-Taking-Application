import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { AvatarMenu } from './AvatarMenu';
import { ThemeToggle } from './ThemeToggle';

const STATIC_NOTES_ROUTES = ['/notes/pinned', '/notes/video', '/notes/trash'];
const SEARCHABLE_ROUTES = ['/notes', '/notes/pinned', '/notes/video'];

function isEditorRoute(pathname: string): boolean {
  return pathname.startsWith('/notes/') && !STATIC_NOTES_ROUTES.includes(pathname);
}

export function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const isSearchable = SEARCHABLE_ROUTES.includes(location.pathname);

  useEffect(() => {
    setSearchInput(searchParams.get('q') ?? '');
    // Only re-sync when the route itself changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!isSearchable) return;
    const current = searchParams.get('q') ?? '';
    const next = debouncedSearch.trim();
    if (next === current) return;

    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set('q', next);
    } else {
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, isSearchable]);

  if (isEditorRoute(location.pathname)) {
    return null;
  }

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img className="topbar-logo" src="/favicon.svg" alt="Notebook" width={24} height={24} />
        <span className="topbar-title">Notebook</span>
      </div>

      {user && (
        <div className="topbar-search">
          <input
            type="search"
            placeholder="Search notes…"
            aria-label="Search notes"
            disabled={!isSearchable}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
      )}

      <div className="topbar-actions">
        {user && (
          <button type="button" className="topbar-new-note" onClick={() => navigate('/notes/new')}>
            + New note
          </button>
        )}
        <ThemeToggle />
        <AvatarMenu />
      </div>
    </header>
  );
}
