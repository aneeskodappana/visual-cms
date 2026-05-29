'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sun, Moon, MapPin, MousePointerClick, Download as DownloadIcon, Pencil, Copy, Save, Eye } from 'lucide-react';
import { ViewTypes, getMarkerTypeName } from '@/lib/cdnUtils';
import {
  LayoutDraft,
  MarkerDraft,
  BackplateDraft,
  PageDraft,
  newBackplate,
  newLayout,
  newMarker,
  newPageDraft,
  pageFromRow,
  clonePageDraft,
} from '@/lib/pageBuilderTypes';
import { buildPageSql } from '@/lib/sqlBuilder';
import { PageMetaPanel } from './PageMetaPanel';
import { LayoutManager } from './LayoutManager';
import { BackplatePanel } from './BackplatePanel';
import { BackplateCanvas } from './BackplateCanvas';
import { MarkerEditorPanel } from './MarkerEditorPanel';
import { SqlOutput } from './SqlOutput';
import { enumToList } from './fields';

const viewTypeOptions = enumToList(ViewTypes);

interface PageBuilderProps {
  initialDraft?: PageDraft;
}

export function PageBuilderComponent({ initialDraft }: PageBuilderProps = {}) {
  const [page, setPage] = useState<PageDraft>(() => initialDraft ?? newPageDraft());
  const [activeLayoutId, setActiveLayoutId] = useState<string>(() => page.layouts[0].Id);
  const [theme, setTheme] = useState<number>(0);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The draft is seeded with random UUIDs, which would differ between the SSR pass and the client
  // pass and trip React's hydration check. Render only after mount so both passes agree (null).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Load-existing form state
  const [loadCode, setLoadCode] = useState('');
  const [loadKind, setLoadKind] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeLayout =
    page.layouts.find((l) => l.Id === activeLayoutId) ?? page.layouts[0];
  const selectedMarker: MarkerDraft | null =
    activeLayout?.markers.find((m) => m.Id === selectedMarkerId) ?? null;

  const sql = useMemo(() => buildPageSql(page), [page]);

  // --- Page / layout mutations ---------------------------------------------------------------
  const updatePage = (patch: Partial<PageDraft>) => setPage((p) => ({ ...p, ...patch }));

  const updateLayoutById = (id: string, updater: (l: LayoutDraft) => LayoutDraft) =>
    setPage((p) => ({ ...p, layouts: p.layouts.map((l) => (l.Id === id ? updater(l) : l)) }));

  const updateActiveLayout = (updater: (l: LayoutDraft) => LayoutDraft) =>
    updateLayoutById(activeLayout.Id, updater);

  const changeLayout = (id: string, patch: Partial<LayoutDraft>) =>
    updateLayoutById(id, (l) => ({ ...l, ...patch }));

  const addLayout = () =>
    setPage((p) => {
      const layout = newLayout(p.layouts.length);
      setActiveLayoutId(layout.Id);
      return { ...p, layouts: [...p.layouts, layout] };
    });

  const removeLayout = (id: string) =>
    setPage((p) => {
      if (p.layouts.length <= 1) return p;
      const layouts = p.layouts.filter((l) => l.Id !== id);
      if (id === activeLayoutId) setActiveLayoutId(layouts[0].Id);
      return { ...p, layouts };
    });

  // --- Backplate mutations -------------------------------------------------------------------
  const addBackplate = (t: number) =>
    updateActiveLayout((l) => ({ ...l, backplates: [...l.backplates, newBackplate(t)] }));

  const changeBackplate = (id: string, patch: Partial<BackplateDraft>) =>
    updateActiveLayout((l) => ({
      ...l,
      backplates: l.backplates.map((b) => (b.Id === id ? { ...b, ...patch } : b)),
    }));

  const removeBackplate = (id: string) =>
    updateActiveLayout((l) => ({ ...l, backplates: l.backplates.filter((b) => b.Id !== id) }));

  // --- Marker mutations ----------------------------------------------------------------------
  const addMarkerAt = (left: number, top: number) =>
    updateActiveLayout((l) => {
      const nextIndex = l.markers.reduce((max, m) => Math.max(max, m.MarkerIndex + 1), 0);
      const marker = newMarker(nextIndex, left, top);
      setSelectedMarkerId(marker.Id);
      return { ...l, markers: [...l.markers, marker] };
    });

  const moveMarker = (id: string, left: number, top: number) =>
    updateActiveLayout((l) => ({
      ...l,
      markers: l.markers.map((m) => (m.Id === id ? { ...m, PositionLeft: left, PositionTop: top } : m)),
    }));

  const changeMarker = (id: string, patch: Partial<MarkerDraft>) =>
    updateActiveLayout((l) => ({
      ...l,
      markers: l.markers.map((m) => (m.Id === id ? { ...m, ...patch } : m)),
    }));

  const removeMarker = (id: string) => {
    updateActiveLayout((l) => ({ ...l, markers: l.markers.filter((m) => m.Id !== id) }));
    if (selectedMarkerId === id) setSelectedMarkerId(null);
  };

  // --- Load existing -------------------------------------------------------------------------
  const loadExisting = async () => {
    if (!loadCode.trim()) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/page-builder?kind=${loadKind}&code=${encodeURIComponent(loadCode.trim())}`,
      );
      const json = await res.json();
      if (json.error) {
        setLoadError(json.error || 'Failed to load');
        return;
      }
      const loaded = pageFromRow(json);
      setPage(loaded);
      setActiveLayoutId(loaded.layouts[0].Id);
      setSelectedMarkerId(null);
      setAddMode(false);
      setEditMode(false);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const resetDraft = () => {
    const fresh = newPageDraft();
    setPage(fresh);
    setActiveLayoutId(fresh.layouts[0].Id);
    setSelectedMarkerId(null);
    setAddMode(false);
    setEditMode(false);
  };

  const cloneDraft = () => {
    const cloned = clonePageDraft(page);
    setPage(cloned);
    setActiveLayoutId(cloned.layouts[0].Id);
    setSelectedMarkerId(null);
    setAddMode(false);
    setEditMode(false);
  };

  const saveDraft = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/page-builder/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page),
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.error || 'Save failed');
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAndPreview = async () => {
    const ok = await saveDraft();
    if (ok) {
      window.open(`/page-builder/preview/${page.Id}`, '_blank');
    }
  };

  if (!mounted) {
    return <div className="text-sm text-slate-500">Loading builder…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Load existing */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kind</label>
            <select
              value={loadKind}
              onChange={(e) => setLoadKind(Number(e.target.value))}
              className="px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {viewTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.name} ({o.value})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
            <input
              type="text"
              value={loadCode}
              onChange={(e) => setLoadCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadExisting()}
              placeholder="Load an existing page by code"
              className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={loadExisting}
            disabled={loading || !loadCode.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <DownloadIcon size={15} /> {loading ? 'Loading…' : 'Load existing'}
          </button>
          <button
            onClick={cloneDraft}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 border border-amber-300 text-amber-800 text-sm font-medium rounded hover:bg-amber-100"
          >
            <Copy size={15} /> Clone as new
          </button>
          <button
            onClick={resetDraft}
            className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-700 text-sm font-medium rounded hover:bg-slate-200"
          >
            New page
          </button>
          <div className="border-l border-slate-300 h-8" />
          <button
            onClick={saveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save size={15} /> {saving ? 'Saving…' : 'Save to DB'}
          </button>
          <button
            onClick={saveAndPreview}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50"
          >
            <Eye size={15} /> {saving ? 'Saving…' : 'Save & Preview'}
          </button>
        </div>
        {loadError && <p className="mt-2 text-sm text-rose-600">{loadError}</p>}
        {saveError && <p className="mt-2 text-sm text-rose-600">{saveError}</p>}
      </div>

      <PageMetaPanel page={page} onChange={updatePage} />

      <LayoutManager
        layouts={page.layouts}
        activeLayoutId={activeLayout.Id}
        onSelectLayout={setActiveLayoutId}
        onAddLayout={addLayout}
        onRemoveLayout={removeLayout}
        onChangeLayout={changeLayout}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: canvas + controls + marker list */}
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setTheme(0)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                    theme === 0 ? 'bg-amber-500 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  <Sun size={15} /> Light (0)
                </button>
                <button
                  onClick={() => setTheme(1)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                    theme === 1 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  <Moon size={15} /> Dark (1)
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditMode((v) => {
                      if (!v) setAddMode(false);
                      return !v;
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded ${
                    editMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Pencil size={15} />
                  {editMode ? 'Editing markers' : 'Edit markers'}
                </button>
                <button
                  onClick={() => {
                    setAddMode((v) => {
                      if (!v) setEditMode(false);
                      return !v;
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded ${
                    addMode
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {addMode ? <MousePointerClick size={15} /> : <MapPin size={15} />}
                  {addMode ? 'Click canvas to add' : 'Add marker'}
                </button>
              </div>
            </div>

            <BackplateCanvas
              layout={activeLayout}
              theme={theme}
              cdnBaseUrl={page.CdnBaseUrl}
              addMode={addMode}
              editMode={editMode}
              selectedMarkerId={selectedMarkerId}
              onSelectMarker={setSelectedMarkerId}
              onMoveMarker={moveMarker}
              onAddMarkerAt={addMarkerAt}
            />

            {/* Marker list */}
            {activeLayout.markers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeLayout.markers.map((m) => (
                  <button
                    key={m.Id}
                    onClick={() => setSelectedMarkerId(m.Id)}
                    className={`px-2 py-1 text-xs rounded border ${
                      m.Id === selectedMarkerId
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    #{m.MarkerIndex} {m.Title || getMarkerTypeName(m.Kind)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <BackplatePanel
            layout={activeLayout}
            activeTheme={theme}
            cdnBaseUrl={page.CdnBaseUrl}
            onAddBackplate={addBackplate}
            onChangeBackplate={changeBackplate}
            onRemoveBackplate={removeBackplate}
          />
        </div>

        {/* Right: marker editor */}
        <div>
          <MarkerEditorPanel marker={selectedMarker} onChange={changeMarker} onRemove={removeMarker} />
        </div>
      </div>

      <SqlOutput sql={sql} fileName={`page_${page.Code || 'draft'}.sql`} />
    </div>
  );
}
