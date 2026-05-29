'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Maximize2, Minimize2, RefreshCw, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { generateWebAppPath } from '@/lib/previewTransform';

const PreviewRenderer = dynamic(
  () => import('@/components/PageBuilder/PreviewRenderer').then((m) => m.PreviewRenderer),
  { ssr: false },
) as React.ComponentType<{ mapLayout: any; cdnBaseUrl: string }>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface ViewConfigPreview {
  id: string;
  kind: string;
  code: string;
  title: string;
  subtitle?: string;
  mapLayouts: MapLayoutPreview[];
  navigations: NavigationPreview[];
  hasGallery?: boolean;
  defaultMapLayoutIndex: number;
}

interface NavigationPreview {
  displayName: string;
  displaySubName?: string;
  displayOrder: number;
  isPriority: boolean;
  navigationUrl: string;
}

interface MapLayoutPreview {
  id: string;
  displayOrder: number;
  displayName: string;
  isDefault: boolean;
  hasCallbackWindow: boolean;
  backplate: BackplatePreview;
  backplates: BackplatePreview[];
  markers?: Record<string, MarkerPreview[]>;
  focusedMarkerId: number;
  desktopTransformSettings: TransformSettingsPreview;
  mobileTransformSettings: TransformSettingsPreview;
  northBearing?: number;
}

interface BackplatePreview {
  backplateUrl: string;
  version: number;
  width: number;
  height: number;
  videoLoopEnabled: boolean;
  videoAutoplay: boolean;
  showVideoControls: boolean;
  backplateFormat: string;
  theme: string;
  thumbnailUrl: string;
}

interface MarkerPreview {
  id: number;
  kind: string;
  subType?: string;
  code: string;
  position: { left: number; top: number };
  keepScale: boolean;
  isExploreDisabled: boolean;
  isHidden: boolean;
  title?: string;
  titleVisible?: boolean;
  icon?: { url: string; width: number; height: number };
  hover?: { title?: string; icon?: { url: string; width: number; height: number }; scale?: number };
  selected?: { title?: string; icon?: { url: string; width: number; height: number }; scale?: number };
  scale?: number;
  navigateTo?: string;
  minZoom?: number;
  maxZoom?: number;
  mobileScale?: number;
  isPriority?: boolean;
  logo?: string;
  anchorPosition?: { left: number; top: number };
  connectionLine?: unknown;
}

interface TransformSettingsPreview {
  disabled: boolean;
  minScale: number;
  maxScale: number;
  ui: { hideZoomControls: boolean };
}

export default function PreviewPage() {
  const params = useParams();
  const id = params.id as string;

  const [viewConfig, setViewConfig] = useState<ViewConfigPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeLayoutIndex, setActiveLayoutIndex] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/page-builder/preview/${id}`);
      const json = await res.json();
      if (json.status === 'success') {
        setViewConfig(json.data);
        setActiveLayoutIndex(json.data.defaultMapLayoutIndex || 0);
      } else {
        setError(json.error || 'Failed to load preview');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      previewRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const activeLayout = viewConfig?.mapLayouts[activeLayoutIndex];

  const webAppPath = useMemo(() => {
    if (!viewConfig) return '/';
    const kindMap: Record<string, number> = {
      Globe: 0, Nation: 1, City: 2, Project: 3, Cluster: 4,
      Amenity: 5, Property: 6, Floor: 7, Interior: 8, Gallery: 9,
    };
    return generateWebAppPath(kindMap[viewConfig.kind] ?? 3, viewConfig.code);
  }, [viewConfig]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Loading preview…</div>
      </div>
    );
  }

  if (error || !viewConfig) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <p className="text-rose-400 text-lg">{error || 'No data'}</p>
        <Link href="/page-builder" className="text-blue-400 hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Back to builder
        </Link>
      </div>
    );
  }

  return (
    <div ref={previewRef} className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Address bar / Chrome simulation */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-3 shrink-0">
        <Link
          href="/page-builder"
          className="text-slate-400 hover:text-white transition-colors"
          title="Back to builder"
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="flex-1 flex items-center gap-2">
          {/* Fake address bar */}
          <div className="flex-1 bg-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm">
            <Globe size={14} className="text-slate-400 shrink-0" />
            <span className="text-slate-300 truncate">
              <span className="text-slate-500">worlddev.aldar.com</span>
              <span className="text-slate-200">{webAppPath}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPreview}
            className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Reload preview"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-700 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Page info bar */}
      <div className="bg-slate-800/50 border-b border-slate-700/50 px-4 py-1.5 flex items-center gap-4 text-xs shrink-0">
        <span className="text-slate-400">
          <span className="text-slate-500">Kind:</span>{' '}
          <span className="text-cyan-400 font-medium">{viewConfig.kind}</span>
        </span>
        <span className="text-slate-400">
          <span className="text-slate-500">Code:</span>{' '}
          <span className="text-emerald-400 font-mono">{viewConfig.code}</span>
        </span>
        <span className="text-slate-400">
          <span className="text-slate-500">Title:</span>{' '}
          <span className="text-white">{viewConfig.title || '—'}</span>
        </span>
        {viewConfig.mapLayouts.length > 1 && (
          <span className="text-slate-400">
            <span className="text-slate-500">Layout:</span>{' '}
            <span className="text-amber-400">{activeLayout?.displayName || `#${activeLayoutIndex}`}</span>
          </span>
        )}
      </div>

      {/* Layout switcher (if multiple layouts — like WebApp navigations) */}
      {viewConfig.mapLayouts.length > 1 && (
        <div className="bg-slate-800/30 border-b border-slate-700/30 px-4 py-1.5 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveLayoutIndex((i) => Math.max(0, i - 1))}
            disabled={activeLayoutIndex === 0}
            className="text-slate-400 hover:text-white disabled:opacity-30 p-1 rounded"
          >
            <ChevronLeft size={16} />
          </button>
          {viewConfig.mapLayouts.map((ml, i) => (
            <button
              key={ml.id}
              onClick={() => setActiveLayoutIndex(i)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                i === activeLayoutIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {ml.displayName || `Layout ${i + 1}`}
            </button>
          ))}
          <button
            onClick={() => setActiveLayoutIndex((i) => Math.min(viewConfig.mapLayouts.length - 1, i + 1))}
            disabled={activeLayoutIndex === viewConfig.mapLayouts.length - 1}
            className="text-slate-400 hover:text-white disabled:opacity-30 p-1 rounded"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Navigation tabs (like WebApp sidebar navigations) */}
      {viewConfig.navigations.length > 0 && (
        <div className="bg-slate-800/20 border-b border-slate-700/20 px-4 py-1 flex items-center gap-3 shrink-0 overflow-x-auto">
          {viewConfig.navigations.map((nav, i) => (
            <div
              key={i}
              className="text-xs text-slate-400 bg-slate-700/50 px-2.5 py-1 rounded whitespace-nowrap"
              title={nav.navigationUrl}
            >
              {nav.displayName}
            </div>
          ))}
        </div>
      )}

      {/* Preview viewport */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {activeLayout && (
          <PreviewRenderer
            key={`${id}-${activeLayoutIndex}`}
            mapLayout={activeLayout}
            cdnBaseUrl=""
          />
        )}
      </div>
    </div>
  );
}
