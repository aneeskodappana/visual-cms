'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Search,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Layers,
  MapPin,
  Image as ImageIcon,
  Navigation,
} from 'lucide-react';

const KIND_NAMES: Record<number, string> = {
  0: 'Globe', 1: 'Nation', 2: 'City', 3: 'Project', 4: 'Cluster',
  5: 'Amenity', 6: 'Property', 7: 'Floor', 8: 'Interior', 9: 'Gallery',
};

const KIND_COLORS: Record<number, string> = {
  0: 'bg-violet-100 text-violet-700',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-cyan-100 text-cyan-700',
  3: 'bg-emerald-100 text-emerald-700',
  4: 'bg-amber-100 text-amber-700',
  5: 'bg-rose-100 text-rose-700',
  6: 'bg-indigo-100 text-indigo-700',
  7: 'bg-slate-100 text-slate-700',
  8: 'bg-pink-100 text-pink-700',
  9: 'bg-teal-100 text-teal-700',
};

interface PageSummary {
  id: string;
  kind: number;
  code: string;
  title: string;
  subtitle: string;
  layoutCount: number;
  markerCount: number;
  backplateCount: number;
  navigationCount: number;
  parentLink: { field: string; id: string } | null;
}

export default function PageBuilderPage() {
  const router = useRouter();
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (kindFilter !== null) params.set('kind', String(kindFilter));
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(currentPage));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`/api/page-builder/pages?${params}`);
      const json = await res.json();
      if (json.status === 'success') {
        setPages(json.data);
        setTotalPages(json.totalPages || 1);
        setTotal(json.total || 0);
      } else {
        setError(json.error || 'Failed to load');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [kindFilter, search, currentPage]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete page "${code}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/page-builder/pages?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.status === 'success') {
        setPages((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(json.error || 'Delete failed');
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleClone = async (page: PageSummary) => {
    router.push(`/page-builder/new?cloneFrom=${page.id}`);
  };

  const kindCounts = pages.reduce<Record<number, number>>((acc, p) => {
    acc[p.kind] = (acc[p.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Page Builder</h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage ViewConfigs — create, edit, preview, and deploy pages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/page-builder/floorplans"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-300 text-amber-800 text-sm font-medium rounded-lg hover:bg-amber-100"
            >
              <Layers size={16} /> Floorplans
            </Link>
            <Link
              href="/page-builder/interiors"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-300 text-purple-800 text-sm font-medium rounded-lg hover:bg-purple-100"
            >
              <Layers size={16} /> Interiors
            </Link>
            <Link
              href="/page-builder/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
            >
              <Plus size={18} /> New Page
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[250px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                onKeyDown={(e) => e.key === 'Enter' && fetchPages()}
                placeholder="Search by code or title..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setKindFilter(null)}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                  kindFilter === null ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({pages.length})
              </button>
              {Object.entries(KIND_NAMES).map(([k, name]) => {
                const kind = Number(k);
                const count = kindCounts[kind] || 0;
                if (count === 0 && kindFilter !== kind) return null;
                return (
                  <button
                    key={kind}
                    onClick={() => { setKindFilter(kindFilter === kind ? null : kind); setCurrentPage(1); }}
                    className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                      kindFilter === kind
                        ? 'bg-slate-800 text-white'
                        : `${KIND_COLORS[kind] || 'bg-slate-100 text-slate-600'} hover:opacity-80`
                    }`}
                  >
                    {name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 animate-pulse">Loading pages...</div>
        ) : error ? (
          <div className="text-center py-12 text-rose-500">{error}</div>
        ) : pages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 mb-4">No pages found</p>
            <Link
              href="/page-builder/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} /> Create your first page
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Kind</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                  <th className="text-center px-3 py-3 font-medium text-slate-600">
                    <Layers size={14} className="inline" />
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-slate-600">
                    <MapPin size={14} className="inline" />
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-slate-600">
                    <ImageIcon size={14} className="inline" />
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-slate-600">
                    <Navigation size={14} className="inline" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr
                    key={page.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${KIND_COLORS[page.kind] || 'bg-slate-100 text-slate-600'}`}>
                        {KIND_NAMES[page.kind] || page.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{page.code || '—'}</td>
                    <td className="px-4 py-3 text-slate-800 max-w-[250px] truncate">{page.title || '—'}</td>
                    <td className="text-center px-3 py-3 text-slate-500">{page.layoutCount}</td>
                    <td className="text-center px-3 py-3 text-slate-500">{page.markerCount}</td>
                    <td className="text-center px-3 py-3 text-slate-500">{page.backplateCount}</td>
                    <td className="text-center px-3 py-3 text-slate-500">{page.navigationCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/page-builder/${page.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </Link>
                        <Link
                          href={`/page-builder/preview/${page.id}`}
                          target="_blank"
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          title="Preview"
                        >
                          <Eye size={15} />
                        </Link>
                        <button
                          onClick={() => handleClone(page)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Clone as new"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(page.id, page.code)}
                          disabled={deleting === page.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-30"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-sm text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-30"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'border border-slate-300 hover:bg-slate-100'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
