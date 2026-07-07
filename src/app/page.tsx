'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Database,
  FileCode2,
  FolderSearch,
  Layers,
  Link2,
  PencilRuler,
  Search,
  Server,
  Settings2,
  SquareCode,
} from 'lucide-react';
import { DatabaseTestComponent } from '@/components/DatabaseTestComponent';
import { MarkerTypes, MarkerSubTypes } from '@/lib/cdnUtils';

function enumToList(e: object) {
  return Object.entries(e)
    .filter(([k]) => !isNaN(Number(k)))
    .map(([k, v]) => ({ value: Number(k), name: String(v) }))
    .sort((a, b) => a.value - b.value);
}

const markerKinds = enumToList(MarkerTypes);
const markerSubTypes = enumToList(MarkerSubTypes);

const navGroups = [
  {
    title: 'Content',
    items: [
      { label: 'Visual Page Builder', href: '/page-builder', icon: PencilRuler },
      { label: 'Projects', href: '/projects', icon: Database },
      { label: 'Project Search', href: '/project-search', icon: FolderSearch },
      { label: 'Unit Search', href: '/unit-search', icon: Search },
    ],
  },
  {
    title: 'View Config',
    items: [
      { label: 'ViewConfig Search', href: '/viewconfig-search', icon: Layers },
      { label: 'URL Resolver', href: '/viewconfig-url', icon: Link2 },
      { label: 'YasParkPlace', href: '/yasparkplace', icon: SquareCode },
    ],
  },
  {
    title: 'Utilities',
    items: [
      { label: 'SQL Orchestrator', href: '/sql-orchestrator', icon: SquareCode },
      { label: 'SQL Value Editor', href: '/sql-editor', icon: FileCode2 },
      { label: 'UUID Generator', href: '/uuid-generator', icon: Settings2 },
      { label: 'Raw API Response', href: '/api/db-test', icon: Server },
    ],
  },
];

const primaryActions = [
  {
    title: 'Project Search',
    description: 'Find projects and generate SQL for project or unit status changes.',
    href: '/project-search',
    icon: FolderSearch,
  },
  {
    title: 'Unit Search',
    description: 'Look up units directly by number or UUID with related data.',
    href: '/unit-search',
    icon: Search,
  },
  {
    title: 'Visual Page Builder',
    description: 'Build and preview page configuration content.',
    href: '/page-builder',
    icon: PencilRuler,
  },
  {
    title: 'ViewConfig Search',
    description: 'Inspect view configs, markers, layouts, and related records.',
    href: '/viewconfig-search',
    icon: Layers,
  },
  {
    title: 'SQL Orchestrator',
    description: 'Run SQL files and review execution reports against the active database.',
    href: '/sql-orchestrator',
    icon: SquareCode,
  },
];

export default function Home() {
  const [dbRefreshKey, setDbRefreshKey] = useState(0);
  const [showKinds, setShowKinds] = useState(false);
  const [showSubTypes, setShowSubTypes] = useState(false);

  useEffect(() => {
    const handleDbSwitch = () => setDbRefreshKey((key) => key + 1);
    window.addEventListener('visual-cms:database-switched', handleDbSwitch);
    return () => window.removeEventListener('visual-cms:database-switched', handleDbSwitch);
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {primaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.href}
                href={action.href}
                className="group rounded border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-slate-900 text-white">
                  <Icon size={18} />
                </div>
                <h2 className="text-base font-semibold text-slate-950">{action.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
              </a>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <section className="rounded border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">All Menus</h2>
              </div>
              <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
                {navGroups.map((group) => (
                  <div key={group.title} className="p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.title}
                    </p>
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            className="flex items-start rounded border border-slate-200 px-3 py-2 text-sm font-medium leading-5 text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                          >
                            <span className="flex min-w-0 items-start gap-2">
                              <Icon size={16} className="mt-0.5 flex-shrink-0 text-slate-500" />
                              <span>{item.label}</span>
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setShowKinds(!showKinds)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-slate-950">Marker Kinds</h2>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {markerKinds.length}
                  </span>
                </div>
                <ChevronDown size={18} className={`text-slate-500 transition-transform ${showKinds ? 'rotate-180' : ''}`} />
              </button>
              {showKinds && (
                <div className="border-t border-slate-200 p-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {markerKinds.map(({ value, name }) => (
                      <div key={value} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2">
                        <span className="w-5 flex-shrink-0 text-right font-mono text-xs text-slate-400">{value}</span>
                        <span className="truncate text-sm font-medium text-slate-800">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setShowSubTypes(!showSubTypes)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-slate-950">Marker SubTypes</h2>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {markerSubTypes.length}
                  </span>
                </div>
                <ChevronDown size={18} className={`text-slate-500 transition-transform ${showSubTypes ? 'rotate-180' : ''}`} />
              </button>
              {showSubTypes && (
                <div className="border-t border-slate-200 p-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {markerSubTypes.map(({ value, name }) => (
                      <div key={value} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2">
                        <span className="w-5 flex-shrink-0 text-right font-mono text-xs text-slate-400">{value}</span>
                        <span className="truncate text-sm font-medium text-slate-800">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950">Database Status</h2>
                <p className="mt-1 text-sm text-slate-500">Active connection check</p>
              </div>
              <DatabaseTestComponent key={dbRefreshKey} />
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
