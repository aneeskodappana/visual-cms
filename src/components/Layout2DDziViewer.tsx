'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Database, Pencil, Trash2 } from 'lucide-react';
import type OpenSeadragonType from 'openseadragon';

type Marker = {
  Id: string;
  Kind: number;
  SubType: number;
  MarkerIndex?: number;
  Code: string;
  Title: string;
  PositionTop: number;
  PositionLeft: number;
  IconUrl?: string;
  HoverIconUrl?: string;
  KeepScale?: boolean;
  MinZoom?: number | null;
  MaxZoom?: number | null;
  MobileMinZoom?: number | null;
  MobileMaxZoom?: number | null;
};

const VIEWPORT_REFERENCE_WIDTH = 2048;

function isImageIconUrl(url?: string | null): boolean {
  if (!url) return false;
  return !url.trim().startsWith('#');
}

function isMarkerVisibleAtScale(marker: Marker, effectiveScale: number, isMobile: boolean): boolean {
  const minZoom = isMobile ? marker.MobileMinZoom : marker.MinZoom;
  const maxZoom = isMobile ? marker.MobileMaxZoom : marker.MaxZoom;
  if (minZoom == null || maxZoom == null) return true;
  return effectiveScale >= minZoom && effectiveScale <= maxZoom;
}

type Layout2D = {
  Id: string;
  DisplayName: string;
  BackplateUrl: string;
  BackplateWidth: number;
  BackplateHeight: number;
  Markers: Marker[];
};

type Props = {
  dziUrl: string;
  layout2d: Layout2D;
  onSelectMarker: (marker: Marker) => void;
  isEditMode: boolean;
  positionOverrides: Record<string, { top: number; left: number }>;
  onMarkerDrag: (markerId: string, newTop: number, newLeft: number) => void;
  onReplicate?: (marker: Marker) => void;
  onEditMarker?: (marker: Marker) => void;
  onDeleteMarker?: (marker: Marker) => void;
  tempMarkerIds?: Set<string>;
  markerEdits?: Record<string, { title?: string; iconUrl?: string }>;
  buildMarkerInsertSql: (marker: Marker, layout2dId: string, posTop?: number, posLeft?: number) => string;
};

const DRAG_THRESHOLD = 5;

export function Layout2DDziViewer({
  dziUrl,
  layout2d,
  onSelectMarker,
  isEditMode,
  positionOverrides,
  onMarkerDrag,
  onReplicate,
  onEditMarker,
  onDeleteMarker,
  tempMarkerIds,
  markerEdits,
  buildMarkerInsertSql,
}: Props) {
  const rawId = useId();
  const viewerId = useMemo(() => `osd-viewconfig-${rawId.replace(/[:]/g, '-')}`, [rawId]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragonType.Viewer | null>(null);
  const osdRef = useRef<typeof import('openseadragon')['default'] | null>(null);

  const [osdZoom, setOsdZoom] = useState(1);
  const [windowScale, setWindowScale] = useState(() =>
    typeof window === 'undefined' ? 1 : window.innerWidth / VIEWPORT_REFERENCE_WIDTH,
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isDragConfirmed, setIsDragConfirmed] = useState(false);
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onResize = () => setWindowScale(window.innerWidth / VIEWPORT_REFERENCE_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const backplateWidth = layout2d.BackplateWidth || 1920;
  const backplateHeight = layout2d.BackplateHeight || 1080;

  const updateOverlayGeometry = useCallback(() => {
    const viewer = viewerRef.current;
    const OSD = osdRef.current;
    const overlay = overlayRef.current;
    if (!viewer || !OSD || !overlay) return;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    const contentSize = tiledImage.getContentSize();
    if (!contentSize || contentSize.x === 0 || contentSize.y === 0) return;

    const topLeft = tiledImage.imageToViewerElementCoordinates(new OSD.Point(0, 0));
    const bottomRight = tiledImage.imageToViewerElementCoordinates(
      new OSD.Point(contentSize.x, contentSize.y),
    );
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;

    overlay.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;

    setOsdZoom(viewer.viewport.getZoom(true));
  }, []);

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      if (!containerRef.current) return;
      try {
        const module = await import('openseadragon');
        if (disposed || !containerRef.current) return;

        const OSD = module.default;
        osdRef.current = OSD;
        containerRef.current.innerHTML = '';

        const viewer = OSD({
          id: viewerId,
          tileSources: dziUrl,
          useCanvas: true,
          visibilityRatio: 1,
          minZoomImageRatio: 1,
          constrainDuringPan: true,
          defaultZoomLevel: 1,
          minZoomLevel: 1,
          maxZoomLevel: 7,
          homeFillsViewer: true,
          showZoomControl: false,
          showNavigator: false,
          showHomeControl: false,
          showFullPageControl: false,
          showRotationControl: false,
          showFlipControl: false,
          showSequenceControl: false,
          gestureSettingsMouse: { scrollToZoom: true, pinchToZoom: true, clickToZoom: false },
          gestureSettingsTouch: { scrollToZoom: true, pinchToZoom: true, clickToZoom: false },
          immediateRender: false,
          imageSmoothingEnabled: true,
          preload: false,
        });

        viewer.addHandler('open', updateOverlayGeometry);
        viewer.addHandler('animation', updateOverlayGeometry);
        viewer.addHandler('animation-finish', updateOverlayGeometry);
        viewer.addHandler('update-viewport', updateOverlayGeometry);
        viewer.addHandler('resize', updateOverlayGeometry);

        viewerRef.current = viewer;
        setError(null);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to initialize Deep Zoom viewer');
      }
    };

    initialize();

    return () => {
      disposed = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [dziUrl, viewerId, updateOverlayGeometry]);

  const handleZoomIn = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.viewport.zoomBy(1.25);
    viewer.viewport.applyConstraints();
  };

  const handleZoomOut = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.viewport.zoomBy(0.8);
    viewer.viewport.applyConstraints();
  };

  const handleReset = () => {
    viewerRef.current?.viewport.goHome();
  };

  const handlePointerDown = (e: React.PointerEvent, markerId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(markerId);
    setIsDragConfirmed(false);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !overlayRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    if (!isDragConfirmed && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      setIsDragConfirmed(true);
    }

    const rect = overlayRef.current.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;

    const newLeft = relativeX * backplateWidth;
    const newTop = relativeY * backplateHeight;

    const clampedTop = Math.max(0, Math.min(backplateHeight, newTop));
    const clampedLeft = Math.max(0, Math.min(backplateWidth, newLeft));

    onMarkerDrag(draggingId, clampedTop, clampedLeft);
  };

  const handlePointerUp = () => {
    setDraggingId(null);
    setIsDragConfirmed(false);
    dragStartRef.current = null;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      <div id={viewerId} ref={containerRef} className="w-full h-full" />

      <div
        ref={overlayRef}
        className="absolute top-0 left-0 origin-top-left"
        style={{ pointerEvents: isEditMode ? 'auto' : 'none' }}
        onPointerMove={isEditMode ? handlePointerMove : undefined}
        onPointerUp={isEditMode ? handlePointerUp : undefined}
      >
        {layout2d.Markers?.map((marker) => {
          const override = positionOverrides[marker.Id];
          const top = override ? override.top : marker.PositionTop;
          const left = override ? override.left : marker.PositionLeft;
          const hasChanged = override !== undefined;
          const isTemp = tempMarkerIds?.has(marker.Id) ?? false;
          const hasEdits = markerEdits?.[marker.Id] !== undefined;
          const displayTitle = markerEdits?.[marker.Id]?.title ?? marker.Title;
          const displayIconUrl = markerEdits?.[marker.Id]?.iconUrl ?? marker.IconUrl;
          const renderAsImage = isImageIconUrl(displayIconUrl);

          const effectiveScale = osdZoom * windowScale;
          const isInZoomRange = isMarkerVisibleAtScale(marker, effectiveScale, false);
          const isHiddenByZoom = !isEditMode && !isInZoomRange;
          // KeepScale === true: marker stays at its natural CSS size (no parent
          // transform here, so the icon's pixel dimensions stay constant as the
          // user zooms — only the marker's anchor position moves with the image).
          // KeepScale === false: marker grows with the image, matching WebApp's
          // `transform: scale(zoom * windowScale)` behavior.
          const visualScale = marker.KeepScale === false ? effectiveScale : 1;

          return (
            <div
              key={marker.Id}
              className={`absolute group ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
              style={{
                top: `${(top / backplateHeight) * 100}%`,
                left: `${(left / backplateWidth) * 100}%`,
                transform: `translate(-50%, -50%) scale(${visualScale})`,
                transformOrigin: 'center',
                zIndex: draggingId === marker.Id ? 100 : 50,
                pointerEvents: isHiddenByZoom ? 'none' : 'auto',
                opacity: isHiddenByZoom ? 0 : 1,
                visibility: isHiddenByZoom ? 'hidden' : 'visible',
              }}
              onPointerDown={(e) => isEditMode ? handlePointerDown(e, marker.Id) : undefined}
              onClick={(e) => {
                if (!isEditMode) {
                  const query = `SELECT * FROM "Markers" WHERE "Id" = '${marker.Id}'::uuid;`;
                  navigator.clipboard.writeText(query);
                } else {
                  e.stopPropagation();
                  setActivePopupId(activePopupId === marker.Id ? null : marker.Id);
                  onSelectMarker(marker);
                }
              }}
              title={displayTitle || marker.Code}
            >
              {isEditMode && isTemp && (
                <div className="absolute -top-1 -right-1 flex gap-0.5 z-10">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full border border-white" />
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full border border-white" />
                </div>
              )}
              {isEditMode && !isTemp && (hasChanged || hasEdits) && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white z-10" />
              )}
              {renderAsImage ? (
                <img
                  src={`https://worlddev.aldar.com/assets/${displayIconUrl}`}
                  alt={displayTitle || 'marker'}
                  className={`drop-shadow-lg ${isTemp ? 'ring-2 ring-green-400 ring-offset-1 rounded' : isEditMode ? 'ring-2 ring-blue-400 ring-offset-1 rounded' : 'hover:saturate-150'} transition-all`}
                  style={{ width: '40px', height: '40px', flexShrink: 0 }}
                  draggable={false}
                />
              ) : (
                <div className={`w-6 h-6 rounded-full ${isTemp ? 'bg-green-500' : 'bg-blue-500'} border-2 border-white shadow-lg flex items-center justify-center flex-shrink-0 ${isTemp ? 'ring-2 ring-green-400 ring-offset-1' : isEditMode ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}

              {!isEditMode && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white px-3 py-2 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-normal max-w-xs">
                  <div className="font-medium text-center">{marker.Title || marker.Code}</div>
                  <div className="text-gray-300 text-[11px] mt-1 w-[300px] text-center">
                    <div>UUID: {marker.Id}</div>
                    <div>Position: ({marker.PositionTop}, {marker.PositionLeft})</div>
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                </div>
              )}

              {isEditMode && activePopupId !== marker.Id && (
                <div className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 ${isTemp ? 'bg-green-700' : 'bg-blue-900'} text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap`}>
                  {displayTitle || marker.Code} ({top.toFixed(1)}, {left.toFixed(1)}){isTemp ? ' (new)' : ''}
                </div>
              )}

              {isEditMode && activePopupId === marker.Id && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-[200] flex flex-col items-center">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-800"></div>
                  <div className="bg-gray-800 rounded-lg shadow-xl p-1.5 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onReplicate?.(marker); setActivePopupId(null); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 text-white rounded text-[11px] font-medium hover:bg-purple-700 transition-colors whitespace-nowrap"
                    >
                      <Copy size={10} /> Replicate
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditMarker?.(marker); setActivePopupId(null); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      <Pencil size={10} /> Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteMarker?.(marker); setActivePopupId(null); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded text-[11px] font-medium hover:bg-red-700 transition-colors whitespace-nowrap"
                    >
                      <Trash2 size={10} /> Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const sql = buildMarkerInsertSql(marker, layout2d.Id, top, left);
                        navigator.clipboard.writeText(sql);
                        setActivePopupId(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded text-[11px] font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap"
                    >
                      <Database size={10} /> SQL
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-20 left-6 z-20 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium transition-colors"
          title="Reset View"
        >
          Reset
        </button>
      </div>

      {error && (
        <div className="absolute top-4 right-4 z-30 max-w-md rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 shadow">
          {error}
        </div>
      )}
    </div>
  );
}
