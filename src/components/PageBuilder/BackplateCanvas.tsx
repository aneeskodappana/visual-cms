'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { MapPin, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import {
  TransformWrapper,
  TransformComponent,
  useTransformEffect,
  useControls,
} from 'react-zoom-pan-pinch';
import type OpenSeadragonType from 'openseadragon';
import {
  constructCdnUrl,
  constructMarkerIconUrl,
  isAbsoluteAssetUrl,
} from '@/lib/cdnUtils';
import type { LayoutDraft, MarkerDraft } from '@/lib/pageBuilderTypes';

interface Props {
  layout: LayoutDraft;
  theme: number;
  cdnBaseUrl: string;
  addMode: boolean;
  editMode: boolean;
  selectedMarkerId: string | null;
  onSelectMarker: (id: string) => void;
  onMoveMarker: (id: string, left: number, top: number) => void;
  onAddMarkerAt: (left: number, top: number) => void;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

// Design reference width markers were authored against (matches Layout2DDviewer). Marker visual
// size scales by (viewerWidth / this) × osdZoom so they look right at any viewer size / zoom.
const VIEWPORT_REFERENCE_WIDTH = 2048;

const pxToPct = (pos: number, ref: number) => (ref > 0 ? (pos / ref) * 100 : pos);
const pctToPx = (pct: number, ref: number) => round2(ref > 0 ? (pct / 100) * ref : pct);

/** Deep Zoom (tiled) assets must be served through OpenSeadragon, not a plain <img>. */
function isDziAsset(path?: string | null): boolean {
  if (!path) return false;
  return /\.dzi(\?.*)?$/i.test(path);
}

/** Resolve a backplate path to a displayable URL (absolute passes through; relative gets CDN base). */
function resolveBackplateUrl(url: string, cdnBaseUrl: string): string {
  if (!url) return '';
  return isAbsoluteAssetUrl(url) ? url : constructCdnUrl(url, cdnBaseUrl);
}

/** Resolve a marker icon path to a displayable URL (icons live at the CDN assets root, no cdn base). */
function resolveIconUrl(url: string | null): string {
  if (!url) return '';
  return isAbsoluteAssetUrl(url) ? url : constructMarkerIconUrl(url);
}

// ------------------------------------------------------------------------------------------------
// Shared marker overlay — identical look in both the image and Deep Zoom canvases. Positions are
// stored as pixels relative to the backplate's native size; rendered as % within the overlay.
// ------------------------------------------------------------------------------------------------
interface MarkerItemsProps {
  markers: MarkerDraft[];
  refW: number;
  refH: number;
  editMode: boolean;
  selectedMarkerId: string | null;
  /** CSS scale for icon-style markers (KeepScale handling differs per stage). */
  getVisualScale: (marker: MarkerDraft) => number;
  onMarkerPointerDown: (e: ReactPointerEvent, marker: MarkerDraft) => void;
  /** Override pointerEvents on each marker element (default 'auto'). */
  markerPointerEvents?: CSSProperties['pointerEvents'];
}

function MarkerItems({
  markers,
  refW,
  refH,
  editMode,
  selectedMarkerId,
  getVisualScale,
  onMarkerPointerDown,
  markerPointerEvents = 'auto',
}: MarkerItemsProps) {
  return (
    <>
      {markers.map((marker) => {
        const isSelected = marker.Id === selectedMarkerId;
        // Markers carrying explicit image-pixel dimensions (project-overlay shapes, landmarks) are
        // sized as a % of the backplate footprint so they grow with the image — same as the
        // viewconfig viewer's useImageRelativeSize path. Plain icons use a fixed CSS size × scale.
        const useImageRelativeSize =
          !!marker.IconUrl && marker.IconWidth != null && marker.IconHeight != null && refW > 0 && refH > 0;
        const visualScale = useImageRelativeSize ? 1 : getVisualScale(marker);

        const style: CSSProperties = {
          left: `${pxToPct(marker.PositionLeft, refW)}%`,
          top: `${pxToPct(marker.PositionTop, refH)}%`,
          transform: `translate(-50%, -50%) scale(${visualScale})`,
          transformOrigin: 'center',
          zIndex: isSelected ? 100 : 50,
          pointerEvents: markerPointerEvents,
        };
        if (useImageRelativeSize) {
          style.width = `${(marker.IconWidth! / refW) * 100}%`;
          style.height = `${(marker.IconHeight! / refH) * 100}%`;
        }

        return (
          <div
            key={marker.Id}
            onPointerDown={(e) => onMarkerPointerDown(e, marker)}
            onClick={(e) => e.stopPropagation()} // don't let a marker click also "add" a marker
            className={`absolute flex ${editMode ? 'cursor-move' : 'cursor-pointer'} flex-col items-center`}
            style={style}
            title={marker.Title || marker.Code}
          >
            {marker.IconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveIconUrl(marker.IconUrl)}
                alt={marker.Title}
                draggable={false}
                className={`select-none object-contain ${
                  useImageRelativeSize ? 'h-full w-full' : 'h-10 w-10'
                } ${isSelected ? 'rounded ring-2 ring-blue-500' : ''}`}
              />
            ) : (
              <MapPin
                size={28}
                className={isSelected ? 'text-blue-600 drop-shadow' : 'text-rose-600 drop-shadow'}
                fill={isSelected ? '#2563eb' : '#e11d48'}
                fillOpacity={0.2}
              />
            )}
            {marker.TitleVisible && marker.Title && !useImageRelativeSize && (
              <span className="mt-0.5 max-w-[120px] truncate rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                {marker.Title}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// Image canvas (Image / Video / MapBox backplates) — react-zoom-pan-pinch.
// ------------------------------------------------------------------------------------------------
interface ImageStageProps {
  layout: LayoutDraft;
  theme: number;
  bgUrl: string;
  refW: number;
  refH: number;
  addMode: boolean;
  editMode: boolean;
  selectedMarkerId: string | null;
  onSelectMarker: (id: string) => void;
  onMoveMarker: (id: string, left: number, top: number) => void;
  onAddMarkerAt: (left: number, top: number) => void;
  onImgLoad: (w: number, h: number) => void;
}

/** Zoom controls — rendered outside TransformComponent so they don't pan/zoom with the content. */
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <CanvasControls
      onZoomIn={() => zoomIn()}
      onZoomOut={() => zoomOut()}
      onReset={() => resetTransform()}
    />
  );
}

function CanvasControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-20 flex flex-col gap-1">
      <button type="button" onClick={onZoomIn} className="rounded bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white" title="Zoom in">
        <ZoomIn size={16} />
      </button>
      <button type="button" onClick={onZoomOut} className="rounded bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white" title="Zoom out">
        <ZoomOut size={16} />
      </button>
      <button type="button" onClick={onReset} className="rounded bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white" title="Reset view">
        <Maximize size={16} />
      </button>
    </div>
  );
}

function ImageStage({
  layout,
  theme,
  bgUrl,
  refW,
  refH,
  addMode,
  editMode,
  selectedMarkerId,
  onSelectMarker,
  onMoveMarker,
  onAddMarkerAt,
  onImgLoad,
}: ImageStageProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  useTransformEffect(({ state }) => setScale(state.scale));

  function pointToPercent(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      left: clamp(((clientX - rect.left) / rect.width) * 100),
      top: clamp(((clientY - rect.top) / rect.height) * 100),
    };
  }

  function handleMarkerPointerDown(e: ReactPointerEvent, marker: MarkerDraft) {
    e.stopPropagation();
    onSelectMarker(marker.Id);
    if (!editMode) return;
    setDraggingId(marker.Id);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (!editMode || !draggingId) return;
    const pos = pointToPercent(e.clientX, e.clientY);
    if (pos) onMoveMarker(draggingId, pctToPx(pos.left, refW), pctToPx(pos.top, refH));
  }

  function handlePointerUp(e: ReactPointerEvent) {
    if (draggingId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setDraggingId(null);
    }
  }

  function handleCanvasClick(e: ReactPointerEvent) {
    if (!addMode || draggingId) return;
    const pos = pointToPercent(e.clientX, e.clientY);
    if (pos) onAddMarkerAt(pctToPx(pos.left, refW), pctToPx(pos.top, refH));
  }

  return (
    <div
      ref={canvasRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleCanvasClick}
      className="relative h-full w-full"
    >
      {bgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgUrl}
          alt="backplate"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) onImgLoad(img.naturalWidth, img.naturalHeight);
          }}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-500">
          No backplate image for theme {theme === 1 ? 'Dark (1)' : 'Light (0)'}. Add one in the
          Backplates panel, or set the Layout&apos;s BackplateUrl. Markers can still be placed.
        </div>
      )}

      <MarkerItems
        markers={layout.markers}
        refW={refW}
        refH={refH}
        editMode={editMode}
        selectedMarkerId={selectedMarkerId}
        getVisualScale={(m) => (m.KeepScale === false ? 1 : scale > 0 ? 1 / scale : 1)}
        onMarkerPointerDown={handleMarkerPointerDown}
      />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Deep Zoom canvas (Tiled / .dzi backplates) — OpenSeadragon, mirroring Layout2DDziViewer.
// A separate overlay div is repositioned/resized to the tiled image on every viewport event so the
// marker layer always lines up with the image as it zooms/pans.
// ------------------------------------------------------------------------------------------------
interface DziStageProps {
  dziUrl: string;
  refW: number;
  refH: number;
  markers: MarkerDraft[];
  addMode: boolean;
  editMode: boolean;
  selectedMarkerId: string | null;
  onSelectMarker: (id: string) => void;
  onMoveMarker: (id: string, left: number, top: number) => void;
  onAddMarkerAt: (left: number, top: number) => void;
}

function DziStage({
  dziUrl,
  refW,
  refH,
  markers,
  addMode,
  editMode,
  selectedMarkerId,
  onSelectMarker,
  onMoveMarker,
  onAddMarkerAt,
}: DziStageProps) {
  const rawId = useId();
  const viewerId = useMemo(() => `osd-pagebuilder-${rawId.replace(/[:]/g, '-')}`, [rawId]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragonType.Viewer | null>(null);
  const osdRef = useRef<typeof import('openseadragon')['default'] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [osdZoom, setOsdZoom] = useState(1);
  const [viewerWidth, setViewerWidth] = useState(0);

  // Keep the overlay aligned with the tiled image as the OSD viewport changes, and track the
  // current zoom + viewer width so markers can be scaled like the viewconfig viewer.
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
    overlay.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`;
    overlay.style.width = `${bottomRight.x - topLeft.x}px`;
    overlay.style.height = `${bottomRight.y - topLeft.y}px`;
    setOsdZoom(viewer.viewport.getZoom(true));
    if (containerRef.current) setViewerWidth(containerRef.current.clientWidth);
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
          maxZoomLevel: 8,
          homeFillsViewer: true,
          showZoomControl: false,
          showNavigator: false,
          showHomeControl: false,
          showFullPageControl: false,
          showRotationControl: false,
          showSequenceControl: false,
          gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false },
          gestureSettingsTouch: { scrollToZoom: true, pinchToZoom: true, clickToZoom: false },
          imageSmoothingEnabled: true,
        });
        viewer.addHandler('open', updateOverlayGeometry);
        viewer.addHandler('animation', updateOverlayGeometry);
        viewer.addHandler('animation-finish', updateOverlayGeometry);
        viewer.addHandler('update-viewport', updateOverlayGeometry);
        viewer.addHandler('resize', updateOverlayGeometry);
        viewerRef.current = viewer;
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to initialize Deep Zoom viewer');
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

  function overlayPointToPx(clientX: number, clientY: number) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const left = clamp(((clientX - rect.left) / rect.width) * 100);
    const top = clamp(((clientY - rect.top) / rect.height) * 100);
    return { left: pctToPx(left, refW), top: pctToPx(top, refH) };
  }

  function handleMarkerPointerDown(e: ReactPointerEvent, marker: MarkerDraft) {
    e.stopPropagation();
    onSelectMarker(marker.Id);
    if (!editMode) return;
    setDraggingId(marker.Id);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (!editMode || !draggingId) return;
    const px = overlayPointToPx(e.clientX, e.clientY);
    if (px) onMoveMarker(draggingId, px.left, px.top);
  }

  function handlePointerUp(e: ReactPointerEvent) {
    if (draggingId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setDraggingId(null);
    }
  }

  function handleOverlayClick(e: ReactPointerEvent) {
    if (!addMode || draggingId) return;
    const px = overlayPointToPx(e.clientX, e.clientY);
    if (px) onAddMarkerAt(px.left, px.top);
  }

  // Marker size relative to a 2048-wide design viewport, growing with zoom — matches the
  // viewconfig DZI viewer (effectiveScale = osdZoom × viewerWidth / 2048).
  const windowScale = viewerWidth > 0 ? viewerWidth / VIEWPORT_REFERENCE_WIDTH : 1;
  const effectiveScale = osdZoom * windowScale;

  return (
    <>
      <div id={viewerId} ref={containerRef} className="absolute inset-0" />
      {/* Overlay: 'none' normally so OSD handles pan/zoom; 'auto' in add-mode to capture clicks.
          Markers set their own pointerEvents:auto so they stay draggable even when the overlay is
          non-interactive (pointer capture routes move/up events here regardless). */}
      <div
        ref={overlayRef}
        className="absolute left-0 top-0 origin-top-left"
        style={{ pointerEvents: addMode || editMode ? 'auto' : 'none' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleOverlayClick}
      >
        <MarkerItems
          markers={markers}
          refW={refW}
          refH={refH}
          editMode={editMode}
          selectedMarkerId={selectedMarkerId}
          getVisualScale={(m) => (m.KeepScale === false ? effectiveScale : 1)}
          onMarkerPointerDown={handleMarkerPointerDown}
          markerPointerEvents={editMode ? 'auto' : 'none'}
        />
      </div>
      <CanvasControls
        onZoomIn={() => {
          viewerRef.current?.viewport.zoomBy(1.25);
          viewerRef.current?.viewport.applyConstraints();
        }}
        onZoomOut={() => {
          viewerRef.current?.viewport.zoomBy(0.8);
          viewerRef.current?.viewport.applyConstraints();
        }}
        onReset={() => viewerRef.current?.viewport.goHome()}
      />
      {error && (
        <div className="absolute right-2 top-2 z-30 max-w-xs rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 shadow">
          {error}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// Orchestrator — picks the OpenSeadragon (Deep Zoom) or react-zoom-pan-pinch (image) canvas.
// ------------------------------------------------------------------------------------------------
export function BackplateCanvas({
  layout,
  theme,
  cdnBaseUrl,
  addMode,
  editMode,
  selectedMarkerId,
  onSelectMarker,
  onMoveMarker,
  onAddMarkerAt,
}: Props) {
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);

  // The backplate can live as a per-theme Backplate row OR directly on the Layout2D (BackplateUrl/
  // Width/Height). Prefer the matching theme row, then any row, then the layout's own fields.
  const themeRow = layout.backplates.find((b) => b.Theme === theme);
  const anyRow = themeRow ?? layout.backplates[0];
  const effUrl = anyRow?.Url || layout.BackplateUrl;
  const refW = (anyRow && anyRow.Width > 0 ? anyRow.Width : 0) || layout.BackplateWidth || imgNatural?.w || 0;
  const refH = (anyRow && anyRow.Height > 0 ? anyRow.Height : 0) || layout.BackplateHeight || imgNatural?.h || 0;

  const resolvedUrl = resolveBackplateUrl(effUrl, cdnBaseUrl);
  const dzi = isDziAsset(effUrl);
  const aspect = refW > 0 && refH > 0 ? refW / refH : 16 / 9;

  return (
    <div className="space-y-2">
      <div
        className={`relative w-full overflow-hidden rounded-lg border border-slate-300 bg-slate-200 ${
          addMode ? 'cursor-crosshair' : ''
        }`}
        style={{ aspectRatio: String(aspect) }}
      >
        {dzi ? (
          <DziStage
            dziUrl={resolvedUrl}
            refW={refW}
            refH={refH}
            markers={layout.markers}
            addMode={addMode}
            editMode={editMode}
            selectedMarkerId={selectedMarkerId}
            onSelectMarker={onSelectMarker}
            onMoveMarker={onMoveMarker}
            onAddMarkerAt={onAddMarkerAt}
          />
        ) : (
          <TransformWrapper
            initialScale={1}
            minScale={1}
            maxScale={12}
            limitToBounds={false}
            centerOnInit
            wheel={{ step: 0.12 }}
            doubleClick={{ disabled: true }}
            panning={{ disabled: addMode || editMode, velocityDisabled: true }}
          >
            <ZoomControls />
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%' }}
            >
              <ImageStage
                layout={layout}
                theme={theme}
                bgUrl={resolvedUrl}
                refW={refW}
                refH={refH}
                addMode={addMode}
                editMode={editMode}
                selectedMarkerId={selectedMarkerId}
                onSelectMarker={onSelectMarker}
                onMoveMarker={onMoveMarker}
                onAddMarkerAt={onAddMarkerAt}
                onImgLoad={(w, h) => setImgNatural({ w, h })}
              />
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {addMode
          ? 'Add mode ON — click anywhere on the canvas to drop a marker (panning paused).'
          : editMode
            ? 'Edit mode ON — drag markers to reposition (panning paused). Click "Edit markers" again to exit.'
            : 'Scroll to zoom, drag to pan. Click "Edit markers" to reposition markers, or click a marker to select.'}
      </p>
    </div>
  );
}
