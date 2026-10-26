import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  X,
  FileText,
  Briefcase,
  Compass,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { verificationService } from '@/features/verification/services/verificationService';
import { candidateService } from '@/features/candidates/services/candidateService';
import { ApplicationRole } from '@/features/candidates/types';
import { VerificationApplication } from '@/features/verification/types';

interface SearchPageItem {
  type: 'page';
  id: string;
  title: string;
  subtitle: string;
  path: string;
  keywords: string[];
}

export const HeaderSearch: React.FC = () => {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const userRoles = currentUser?.roles || [];
  const permissions = currentUser?.permissions || [];
  const isAdmin = userRoles.includes('admin') || permissions.includes('users:manage');
  const isReviewer = permissions.includes('documents:verify') || permissions.includes('candidates:approve') || isAdmin;
  const canVerify = isAdmin || isReviewer;

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Safe global '/' keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        const isEditable =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target?.isContentEditable;

        if (!isEditable) {
          e.preventDefault();
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Fetch candidate applications for search (respects auth: admin/reviewer see all, candidates see their own)
  const {
    data: applications = [],
    isLoading: isAppsLoading,
    isError: isAppsError,
  } = useQuery<VerificationApplication[]>({
    queryKey: ['header-search-applications', canVerify ? 'all' : 'my'],
    queryFn: async () => {
      if (canVerify) {
        return verificationService.getApplications();
      }
      const myApps = await candidateService.getMyApplications();
      return (myApps.applications || []) as unknown as VerificationApplication[];
    },
    staleTime: 1000 * 30, // 30s
    enabled: !!currentUser,
  });

  // Fetch active designation roles
  const {
    data: roles = [],
    isLoading: isRolesLoading,
  } = useQuery<ApplicationRole[]>({
    queryKey: ['header-search-roles', isAdmin ? 'all' : 'active'],
    queryFn: async () => {
      if (isAdmin) {
        return candidateService.getAllRoles();
      }
      return candidateService.getActiveRoles();
    },
    staleTime: 1000 * 60 * 5, // 5m
    enabled: !!currentUser,
  });

  // Static searchable portal navigation pages based on user roles
  const portalPages: SearchPageItem[] = useMemo(() => {
    const pages: SearchPageItem[] = [
      {
        type: 'page',
        id: 'page-dashboard',
        title: 'Candidate Overview',
        subtitle: 'Dashboard analytics & key enrollment metrics',
        path: '/dashboard',
        keywords: ['overview', 'dashboard', 'analytics', 'metrics', 'home', 'stats'],
      },
      {
        type: 'page',
        id: 'page-candidates',
        title: 'Candidate Applications',
        subtitle: 'Submit and manage candidate enrollment forms',
        path: '/candidates',
        keywords: ['candidates', 'apply', 'enrollment', 'form', 'submission', 'new'],
      },
    ];

    if (canVerify) {
      pages.push({
        type: 'page',
        id: 'page-documents',
        title: 'Candidate Verification',
        subtitle: 'Review submissions & verify uploaded documents',
        path: '/documents',
        keywords: ['documents', 'verification', 'verify', 'review', 'checklist', 'status'],
      });
      pages.push({
        type: 'page',
        id: 'page-audit',
        title: 'Audit & Activity Logs',
        subtitle: 'Immutable compliance trail of candidate actions',
        path: '/audit',
        keywords: ['audit', 'logs', 'compliance', 'history', 'activity', 'security'],
      });
    }

    if (isAdmin) {
      pages.push({
        type: 'page',
        id: 'page-roles',
        title: 'Role Management',
        subtitle: 'Configure designation roles & job titles',
        path: '/roles',
        keywords: ['roles', 'designation', 'job', 'titles', 'permissions', 'manage'],
      });
    }

    pages.push({
      type: 'page',
      id: 'page-profile',
      title: 'Profile & Settings',
      subtitle: 'Account details, credentials & security',
      path: '/profile',
      keywords: ['profile', 'settings', 'account', 'password', 'user', 'security'],
    });

    return pages;
  }, [canVerify, isAdmin]);

  // Debounced/trimmed search query
  const cleanQuery = query.trim().toLowerCase();

  // Search results calculation
  const searchResults = useMemo(() => {
    if (!cleanQuery) {
      return {
        applications: [],
        roles: [],
        pages: [],
        total: 0,
      };
    }

    // Filter Applications (names, application_number, role_applied, hero_category, status)
    const matchingApps = applications
      .filter((app) => {
        const appNum = (app.application_number || '').toLowerCase();
        const name = (app.full_name || '').toLowerCase();
        const role = (app.role_applied || '').toLowerCase();
        const hero = (app.hero_category || '').toLowerCase();
        const status = (app.status || '').toLowerCase();
        return (
          appNum.includes(cleanQuery) ||
          name.includes(cleanQuery) ||
          role.includes(cleanQuery) ||
          hero.includes(cleanQuery) ||
          status.includes(cleanQuery)
        );
      })
      .slice(0, 4);

    // Filter Roles (name, code, description)
    const matchingRoles = roles
      .filter((r) => {
        const name = (r.name || '').toLowerCase();
        const code = (r.code || '').toLowerCase();
        const desc = (r.description || '').toLowerCase();
        return name.includes(cleanQuery) || code.includes(cleanQuery) || desc.includes(cleanQuery);
      })
      .slice(0, 3);

    // Filter Portal Pages (title, subtitle, path, keywords)
    const matchingPages = portalPages
      .filter((p) => {
        const title = p.title.toLowerCase();
        const subtitle = p.subtitle.toLowerCase();
        const path = p.path.toLowerCase();
        const matchesKeyword = p.keywords.some((k) => k.toLowerCase().includes(cleanQuery));
        return (
          title.includes(cleanQuery) ||
          subtitle.includes(cleanQuery) ||
          path.includes(cleanQuery) ||
          matchesKeyword
        );
      })
      .slice(0, 3);

    const total = matchingApps.length + matchingRoles.length + matchingPages.length;

    return {
      applications: matchingApps,
      roles: matchingRoles,
      pages: matchingPages,
      total,
    };
  }, [cleanQuery, applications, roles, portalPages]);

  // Flattened items for keyboard navigation
  const flatResults = useMemo(() => {
    const list: Array<
      | { type: 'app'; item: VerificationApplication }
      | { type: 'role'; item: ApplicationRole }
      | { type: 'page'; item: SearchPageItem }
    > = [];

    for (const app of searchResults.applications) {
      list.push({ type: 'app', item: app });
    }
    for (const role of searchResults.roles) {
      list.push({ type: 'role', item: role });
    }
    for (const page of searchResults.pages) {
      list.push({ type: 'page', item: page });
    }

    return list;
  }, [searchResults]);

  // Navigate to selected search result
  const handleSelectResult = (
    entry:
      | { type: 'app'; item: VerificationApplication }
      | { type: 'role'; item: ApplicationRole }
      | { type: 'page'; item: SearchPageItem }
  ) => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);

    if (entry.type === 'app') {
      if (canVerify) {
        navigate(`/documents/${entry.item.id}`);
      } else {
        navigate('/candidates');
      }
    } else if (entry.type === 'role') {
      if (isAdmin) {
        navigate('/roles');
      } else {
        navigate('/candidates');
      }
    } else if (entry.type === 'page') {
      navigate(entry.item.path);
    }
  };

  // Keyboard navigation within search input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
      } else {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (!isOpen || flatResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
        handleSelectResult(flatResults[selectedIndex]);
      } else if (flatResults.length > 0) {
        handleSelectResult(flatResults[0]);
      }
    }
  };

  const isLoading = isAppsLoading || isRolesLoading;

  return (
    <div className="relative" ref={containerRef}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search portal..."
          className="w-40 sm:w-56 md:w-64 lg:w-72 h-8 sm:h-9 pl-8 pr-12 text-xs bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200/90 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
          aria-label="Search portal"
          aria-expanded={isOpen}
          role="combobox"
          aria-autocomplete="list"
        />

        {/* Right side inside input: Loading spinner, Clear button, or Shortcut hint */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && query ? (
            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd
              className="hidden sm:inline-flex items-center justify-center text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200/90 rounded px-1.5 py-0.5 select-none pointer-events-none"
              title="Press / to focus search"
            >
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Flyout Search Results Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-80 sm:w-96 max-h-[22rem] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-100">
          {/* Error State */}
          {isAppsError && (
            <div className="p-3 text-center text-xs text-rose-600 bg-rose-50 rounded-xl border border-rose-100">
              Unable to search records. Please check connection and try again.
            </div>
          )}

          {/* No Results State */}
          {!isLoading && !isAppsError && searchResults.total === 0 && (
            <div className="p-4 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-800">
                No matching results for &ldquo;{query}&rdquo;
              </p>
              <p className="text-[11px] text-slate-400">
                Try searching by candidate name, application reference (e.g. CEF-APP), role, or portal page.
              </p>
            </div>
          )}

          {/* Group 1: Candidate Applications */}
          {searchResults.applications.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-indigo-600" />
                  <span>Candidate Applications ({searchResults.applications.length})</span>
                </span>
                <span className="text-[9px] text-slate-400 font-normal">Press Enter to view</span>
              </div>
              <div className="space-y-0.5">
                {searchResults.applications.map((app) => {
                  const globalIdx = flatResults.findIndex(
                    (f) => f.type === 'app' && (f.item as VerificationApplication).id === app.id
                  );
                  const isHighlighted = selectedIndex === globalIdx;

                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleSelectResult({ type: 'app', item: app })}
                      className={`w-full text-left p-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 ${
                        isHighlighted
                          ? 'bg-indigo-50/90 text-indigo-900 ring-1 ring-indigo-200'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 truncate">
                            {app.full_name}
                          </span>
                          <span className="font-mono text-[10px] text-indigo-800 bg-indigo-50/80 px-1.5 py-0.2 rounded border border-indigo-200/60 shrink-0">
                            {app.application_number}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {app.hero_category} • {app.role_applied}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-slate-500">
                        {app.status === 'APPROVED' ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                          </span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {app.status?.replace('_', ' ')}
                          </span>
                        )}
                        <ArrowRight className="w-3 h-3 text-slate-300 ml-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Group 2: Designation Roles */}
          {searchResults.roles.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-slate-100">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase className="w-3 h-3 text-indigo-600" />
                <span>Designation Roles ({searchResults.roles.length})</span>
              </div>
              <div className="space-y-0.5">
                {searchResults.roles.map((role) => {
                  const globalIdx = flatResults.findIndex(
                    (f) => f.type === 'role' && (f.item as ApplicationRole).id === role.id
                  );
                  const isHighlighted = selectedIndex === globalIdx;

                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleSelectResult({ type: 'role', item: role })}
                      className={`w-full text-left p-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 ${
                        isHighlighted
                          ? 'bg-indigo-50/90 text-indigo-900 ring-1 ring-indigo-200'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 truncate">
                            {role.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                            {role.code}
                          </span>
                        </div>
                        {role.description && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {role.description}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Group 3: Portal Navigation Pages */}
          {searchResults.pages.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-slate-100">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Compass className="w-3 h-3 text-indigo-600" />
                <span>Portal Navigation ({searchResults.pages.length})</span>
              </div>
              <div className="space-y-0.5">
                {searchResults.pages.map((page) => {
                  const globalIdx = flatResults.findIndex(
                    (f) => f.type === 'page' && (f.item as SearchPageItem).id === page.id
                  );
                  const isHighlighted = selectedIndex === globalIdx;

                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => handleSelectResult({ type: 'page', item: page })}
                      className={`w-full text-left p-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 ${
                        isHighlighted
                          ? 'bg-indigo-50/90 text-indigo-900 ring-1 ring-indigo-200'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 truncate">
                          {page.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {page.subtitle}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                        {page.path}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
