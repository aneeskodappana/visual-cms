'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FileCode2,
  FolderSearch,
  Home as HomeIcon,
  Layers,
  Link2,
  Menu,
  PencilRuler,
  Search,
  Server,
  Settings2,
  SquareCode,
} from 'lucide-react';
import { DatabaseSelectorModal } from '@/components/DatabaseSelectorModal';

const navGroups = [
  {
    title: 'Content',
    items: [
      { label: 'Dashboard', href: '/', icon: HomeIcon },
      { label: 'Visual Page Builder', href: '/page-builder', icon: PencilRuler },
      { label: 'Projects', href: '/projects', icon: Database },
      { label: 'Project Search', href: '/project-search', icon: FolderSearch },
      { label: 'Unit Search', href: '/unit-search', icon: Search },
    ],
  },
  {
    title: 'View Config',
    items: [
      { label: 'ViewConfig Search', href: '/viewconfig-search', icon: Layers, activePaths: ['/viewconfig-search', '/viewconfig'] },
      { label: 'URL Resolver', href: '/viewconfig-url', icon: Link2 },
      { label: 'YasParkPlace', href: '/yasparkplace', icon: SquareCode },
    ],
  },
  {
    title: 'Utilities',
    items: [
      { label: 'SQL Value Editor', href: '/sql-editor', icon: FileCode2 },
      { label: 'UUID Generator', href: '/uuid-generator', icon: Settings2 },
      { label: 'Raw API Response', href: '/api/db-test', icon: Server },
    ],
  },
];

function isActivePath(pathname: string, href: string, activePaths?: string[]) {
  const paths = activePaths || [href];
  return paths.some((path) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

function getActiveItem(pathname: string) {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (isActivePath(pathname, item.href, item.activePaths)) {
        return { ...item, group: group.title };
      }
    }
  }

  return { label: 'CMS Navigation', group: 'Dashboard', href: '/', icon: HomeIcon };
}

function Sidebar({
  pathname,
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  return (
    <aside
      className={`flex h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div className={`flex h-16 items-center border-b border-slate-200 ${collapsed ? 'justify-center px-2' : 'gap-3 px-5'}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-900 text-white">
          <HomeIcon size={18} />
        </div>
        {!collapsed && (
          <a href="/" className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-950">WOACMS</p>
            <p className="text-xs text-slate-500">Visual CMS Console</p>
          </a>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      <nav className="scrollbar-hidden flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href, item.activePaths);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon size={17} className={active ? 'text-white' : 'text-slate-500'} />
                    {!collapsed && <span>{item.label}</span>}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeItem = useMemo(() => getActiveItem(pathname), [pathname]);

  const handleDbSwitch = useCallback(() => {
    window.dispatchEvent(new CustomEvent('visual-cms:database-switched'));
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem('visual-cms:sidebar-collapsed');
    if (stored != null) {
      setSidebarCollapsed(stored === 'true');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('visual-cms:sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-xl">
            <Sidebar
              pathname={pathname}
              collapsed={false}
              onNavigate={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-h-screen">
        <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
          <Sidebar
            pathname={pathname}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          />
        </div>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  className="hidden h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 lg:inline-flex"
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{activeItem.group}</p>
                  <h1 className="truncate text-lg font-semibold text-slate-950 sm:text-xl">{activeItem.label}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/project-search"
                  className="hidden items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 sm:inline-flex"
                >
                  <FolderSearch size={16} />
                  Project Search
                </a>
                <button
                  type="button"
                  onClick={() => setDbModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
                >
                  <Database size={16} />
                  <span className="hidden sm:inline">Switch Database</span>
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <DatabaseSelectorModal
        isOpen={dbModalOpen}
        onClose={() => setDbModalOpen(false)}
        onSwitch={handleDbSwitch}
      />
    </div>
  );
}
