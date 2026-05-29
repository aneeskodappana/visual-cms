'use client';

import { useState, useCallback } from 'react';
import { DatabaseTestComponent } from "@/components/DatabaseTestComponent";
import { DatabaseSelectorModal } from "@/components/DatabaseSelectorModal";
import { Database, ChevronDown } from 'lucide-react';
import { MarkerTypes, MarkerSubTypes } from '@/lib/cdnUtils';

// Build a sorted list of { value, name } from a numeric TypeScript enum.
// Numeric enums have both forward (name→number) and reverse (number→name) entries;
// filtering on isNaN keeps only the number keys.
function enumToList(e: object) {
  return Object.entries(e)
    .filter(([k]) => !isNaN(Number(k)))
    .map(([k, v]) => ({ value: Number(k), name: String(v) }))
    .sort((a, b) => a.value - b.value);
}

const markerKinds = enumToList(MarkerTypes);
const markerSubTypes = enumToList(MarkerSubTypes);

export default function Home() {
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [dbRefreshKey, setDbRefreshKey] = useState(0);
  const [showKinds, setShowKinds] = useState(false);
  const [showSubTypes, setShowSubTypes] = useState(false);

  const handleDbSwitch = useCallback(() => {
    setDbRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-slate-900">WOACMS</h1>
          <button
            onClick={() => setDbModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium"
          >
            <Database size={16} /> Switch Database
          </button>
        </div>

        {/* Main Content */}
        <main className="space-y-8">
          {/* Quick Links */}
          <section className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex flex-wrap gap-3">
              <a
                href="/page-builder"
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-sm font-medium"
              >
                Visual Page Builder
              </a>
              <a
                href="/projects"
                className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors text-sm font-medium"
              >
                Projects
              </a>
              <a
                href="/viewconfig-search"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
              >
                ViewConfig Search
              </a>
              <a
                href="/viewconfig-url"
                className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors text-sm font-medium"
              >
                ViewConfig URL Resolver
              </a>
              <a
                href="/unit-search"
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Unit Search
              </a>
              <a
                href="/project-search"
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                Project Search
              </a>
              <a
                href="/yasparkplace"
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                YasParkPlace
              </a>
              <a
                href="/sql-editor"
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                SQL Query Value Editor
              </a>
              <a
                href="/uuid-generator"
                className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors text-sm font-medium"
              >
                UUID Generator
              </a>
              <a
                href="/api/db-test"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View Raw API Response
              </a>
            </div>
          </section>
          {/* Marker Kinds Reference */}
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => setShowKinds(!showKinds)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Marker Kinds</h2>
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{markerKinds.length} kinds</span>
              </div>
              <ChevronDown size={18} className={`text-slate-400 transition-transform ${showKinds ? 'rotate-180' : ''}`} />
            </button>
            {showKinds && (
              <div className="border-t border-slate-200 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {markerKinds.map(({ value, name }) => (
                    <div key={value} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <span className="text-xs font-mono text-slate-400 w-5 flex-shrink-0 text-right">{value}</span>
                      <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Marker SubTypes Reference */}
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => setShowSubTypes(!showSubTypes)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Marker SubTypes</h2>
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{markerSubTypes.length} subtypes</span>
              </div>
              <ChevronDown size={18} className={`text-slate-400 transition-transform ${showSubTypes ? 'rotate-180' : ''}`} />
            </button>
            {showSubTypes && (
              <div className="border-t border-slate-200 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {markerSubTypes.map(({ value, name }) => (
                    <div key={value} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <span className="text-xs font-mono text-slate-400 w-5 flex-shrink-0 text-right">{value}</span>
                      <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Database Status</h2>
            <DatabaseTestComponent key={dbRefreshKey} />
          </section>
        </main>
      </div>

      <DatabaseSelectorModal
        isOpen={dbModalOpen}
        onClose={() => setDbModalOpen(false)}
        onSwitch={handleDbSwitch}
      />
    </div>
  );
}
