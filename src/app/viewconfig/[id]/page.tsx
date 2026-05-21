'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Save, X, Copy, Trash2, Database, GripVertical, Minimize2, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { TransformWrapper, TransformComponent, useTransformEffect } from 'react-zoom-pan-pinch';
import { constructCdnUrl, getMarkerTypeName, getMarkerSubTypeName } from '@/lib/cdnUtils';
import { v4 as uuidv4 } from 'uuid';
import { Layout2DDziViewer } from '@/components/Layout2DDziViewer';

function isDziAsset(path?: string | null): boolean {
  if (!path) return false;
  return /\.dzi(\?.*)?$/i.test(path);
}

interface Layout2D {
  Id: string;
  DisplayName: string;
  BackplateUrl: string;
  BackplateWidth: number;
  BackplateHeight: number;
  Markers: Marker[];
}

interface Marker {
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
}

// Markers may store a built-in icon reference like "#ui-villas-and-towers" in
// IconUrl instead of a real path. Anything starting with "#" is not a URL and
// should fall back to the generic dot icon. Mirrors how WebApp treats these.
function isImageIconUrl(url?: string | null): boolean {
  if (!url) return false;
  return !url.trim().includes('#');
}

// WebApp scales the OSD zoom by (window.width / 2048) before comparing to a
// marker's MinZoom/MaxZoom. See WebApp's useMarkerScaleRef + useMarkerVisibility.
const VIEWPORT_REFERENCE_WIDTH = 2048;

function getWindowScaleFactor(): number {
  if (typeof window === 'undefined') return 1;
  return window.innerWidth / VIEWPORT_REFERENCE_WIDTH;
}

function isMarkerVisibleAtScale(marker: Marker, effectiveScale: number, isMobile: boolean): boolean {
  const minZoom = isMobile ? marker.MobileMinZoom : marker.MinZoom;
  const maxZoom = isMobile ? marker.MobileMaxZoom : marker.MaxZoom;
  if (minZoom == null || maxZoom == null) return true;
  return effectiveScale >= minZoom && effectiveScale <= maxZoom;
}

interface ViewConfig {
  Id: string;
  Title: string;
  Subtitle: string;
  Code: string;
  CdnBaseUrl: string;
  Layout2Ds: Layout2D[];
}

interface PositionChange {
  markerId: string;
  markerTitle: string;
  markerCode: string;
  oldTop: number;
  oldLeft: number;
  newTop: number;
  newLeft: number;
}

function buildMarkerInsertSql(marker: Marker, layout2dId: string, posTop?: number, posLeft?: number): string {
  const esc = (s?: string) => s ? `'${s.replace(/'/g, "''")}'` : 'NULL';
  const top = posTop ?? marker.PositionTop;
  const left = posLeft ?? marker.PositionLeft;
  return `INSERT INTO "Markers" (
  "Id", "Kind", "SubType", "MarkerIndex", "Code", "IsVisible", "IsExplorable",
  "NavigateTo", "IsShallowLink", "PositionTop", "PositionLeft", "KeepScale",
  "Title", "TitleVisible", "IconUrl", "HoverIconUrl", "Layout2DId"
) VALUES (
  '${marker.Id}'::uuid, ${marker.Kind}, ${marker.SubType ?? 'NULL'}, ${marker.MarkerIndex ?? 'NULL'},
  ${esc(marker.Code)}, true, false,
  '', false, ${top.toFixed(6)}::float8, ${left.toFixed(6)}::float8, false,
  ${esc(marker.Title)}, false, ${esc(marker.IconUrl)}, ${esc(marker.HoverIconUrl)},
  '${layout2dId}'::uuid
);`;
}

function MarkerOverlay({
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
}: {
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
}) {
  const [scale, setScale] = useState(1);
  const [windowScale, setWindowScale] = useState(getWindowScaleFactor);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isDragConfirmed, setIsDragConfirmed] = useState(false);
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const DRAG_THRESHOLD = 5;

  useTransformEffect(({ state }) => {
    setScale(state.scale);
  });

  useEffect(() => {
    const onResize = () => setWindowScale(getWindowScaleFactor());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    const backplateWidth = layout2d.BackplateWidth || 1920;
    const backplateHeight = layout2d.BackplateHeight || 1080;

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
    <div
      ref={overlayRef}
      className="absolute inset-0"
      style={{ pointerEvents: isEditMode ? 'auto' : 'none' }}
      onPointerMove={isEditMode ? handlePointerMove : undefined}
      onPointerUp={isEditMode ? handlePointerUp : undefined}
    >
      {layout2d.Markers.map((marker) => {
        const override = positionOverrides[marker.Id];
        const top = override ? override.top : marker.PositionTop;
        const left = override ? override.left : marker.PositionLeft;
        const hasChanged = override !== undefined;
        const isTemp = tempMarkerIds?.has(marker.Id) ?? false;
        const hasEdits = markerEdits?.[marker.Id] !== undefined;
        const displayTitle = markerEdits?.[marker.Id]?.title ?? marker.Title;
        const displayIconUrl = markerEdits?.[marker.Id]?.iconUrl ?? marker.IconUrl;
        const renderAsImage = isImageIconUrl(displayIconUrl);

        const effectiveScale = scale * windowScale;
        const isInZoomRange = isMarkerVisibleAtScale(marker, effectiveScale, false);
        // In edit mode keep all markers visible/draggable regardless of zoom-range gating.
        const isHiddenByZoom = !isEditMode && !isInZoomRange;
        // KeepScale === true: marker stays at constant visible size (inverse-scaled by zoom).
        // KeepScale === false: marker grows with the image (no inverse scale).
        const visualScale = marker.KeepScale === false ? 1 : 1 / scale;

        return (
          <div
            key={marker.Id}
            className={`absolute group ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            style={{
              top: `${(top / (layout2d.BackplateHeight || 1080)) * 100}%`,
              left: `${(left / (layout2d.BackplateWidth || 1920)) * 100}%`,
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
  );
}

function TitleConfirmationModal({
  oldTitle,
  oldSubtitle,
  newTitle,
  newSubtitle,
  viewConfigId,
  onConfirm,
  onCancel,
  isSaving,
}: {
  oldTitle: string;
  oldSubtitle: string;
  newTitle: string;
  newSubtitle: string;
  viewConfigId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const hasChanges = oldTitle !== newTitle || oldSubtitle !== newSubtitle;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Confirm Title Changes</h2>
          <p className="text-sm text-gray-500 mt-1">ViewConfig title/subtitle modifications</p>
        </div>

        <div className="overflow-auto flex-1 p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Changes</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 text-left font-medium text-gray-700 border-b">Field</th>
                    <th className="p-3 text-left font-medium text-gray-700 border-b">Old Value</th>
                    <th className="p-3 text-left font-medium text-gray-700 border-b">New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {oldTitle !== newTitle && (
                    <tr className="border-b">
                      <td className="py-3 px-3 font-medium text-gray-700">Title</td>
                      <td className="py-3 font-mono text-gray-500 text-xs">{oldTitle || '(empty)'}</td>
                      <td className="py-3 font-mono text-green-600 text-xs">{newTitle || '(empty)'}</td>
                    </tr>
                  )}
                  {oldSubtitle !== newSubtitle && (
                    <tr className="border-b">
                      <td className="py-3 px-3 font-medium text-gray-700">Subtitle</td>
                      <td className="py-3 font-mono text-gray-500 text-xs">{oldSubtitle || '(empty)'}</td>
                      <td className="py-3 font-mono text-green-600 text-xs">{newSubtitle || '(empty)'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">SQL Query</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto">
                UPDATE "ViewConfigs"<br />
                &nbsp;&nbsp;SET "Title" = {newTitle ? `'${newTitle}'` : 'NULL'}<br />
                {oldSubtitle !== newSubtitle && (
                  <>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"Subtitle" = {newSubtitle ? `'${newSubtitle}'` : 'NULL'}<br />
                  </>
                )}
                &nbsp;&nbsp;WHERE "Id" = '{viewConfigId}'::uuid;
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving || !hasChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkerEditModal({
  marker,
  sourceMarker,
  layout2dId,
  onConfirm,
  onCancel,
  isSaving,
  isNew,
  allIconUrls,
  assignedNewId,
}: {
  marker: Marker;
  sourceMarker?: Marker;
  layout2dId?: string;
  onConfirm: (title: string, iconUrl: string) => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew?: boolean;
  allIconUrls?: string[];
  assignedNewId?: string;
}) {
  const [title, setTitle] = useState(marker.Title || '');
  const [iconUrl, setIconUrl] = useState(marker.IconUrl || '');

  const hasChanges = isNew || title !== (marker.Title || '') || iconUrl !== (marker.IconUrl || '');

  let sql = '';
  if (isNew && sourceMarker && layout2dId) {
    const titleExpr = title ? `'${title.replace(/'/g, "''")}'` : `''`;
    const iconExpr = iconUrl ? `'${iconUrl.replace(/'/g, "''")}'` : 'NULL';
    const newId = assignedNewId || uuidv4();
    sql = `INSERT INTO "Markers" (
  "Id", "Kind", "SubType", "MarkerIndex", "Code", "IsVisible", "IsExplorable",
  "NavigateTo", "IsShallowLink", "PositionTop", "PositionLeft", "KeepScale",
  "LngLatJson", "ConnectionLineJson", "Scale", "MinZoom", "MaxZoom",
  "MobileScale", "MobileMinZoom", "MobileMaxZoom", "LinkToMarkerIndex",
  "AnchorPositionTop", "AnchorPositionLeft",
  "HoverTitle", "HoverTitleVisible", "HoverIconUrl", "HoverIconVersion",
  "HoverIconWidth", "HoverIconHeight", "HoverScale",
  "SelectedTitle", "SelectedTitleVisible", "SelectedIconUrl", "SelectedIconVersion",
  "SelectedIconWidth", "SelectedIconHeight", "SelectedScale",
  "Title", "TitleVisible", "IconUrl", "IconVersion", "IconWidth", "IconHeight",
  "Version", "IsPriority", "Logo", "Layout2DId"
) SELECT
  '${newId}'::uuid, "Kind", "SubType",
  (SELECT COALESCE(MAX("MarkerIndex"), -1) + 1
   FROM "Markers" WHERE "Layout2DId" = '${layout2dId}'::uuid),
  "Code", "IsVisible", "IsExplorable", "NavigateTo", "IsShallowLink",
  "PositionTop" + 20, "PositionLeft" + 20, "KeepScale",
  "LngLatJson", "ConnectionLineJson", "Scale", "MinZoom", "MaxZoom",
  "MobileScale", "MobileMinZoom", "MobileMaxZoom", "LinkToMarkerIndex",
  "AnchorPositionTop", "AnchorPositionLeft",
  "HoverTitle", "HoverTitleVisible", "HoverIconUrl", "HoverIconVersion",
  "HoverIconWidth", "HoverIconHeight", "HoverScale",
  "SelectedTitle", "SelectedTitleVisible", "SelectedIconUrl", "SelectedIconVersion",
  "SelectedIconWidth", "SelectedIconHeight", "SelectedScale",
  ${titleExpr}, "TitleVisible", ${iconExpr}, "IconVersion", "IconWidth", "IconHeight",
  "Version", "IsPriority", "Logo", "Layout2DId"
FROM "Markers"
WHERE "Id" = '${sourceMarker.Id}'::uuid;`;
  } else {
    const sqlParts: string[] = [];
    if (title !== (marker.Title || '')) sqlParts.push(`"Title" = '${title.replace(/'/g, "''")}'`);
    if (iconUrl !== (marker.IconUrl || '')) {
      sqlParts.push(iconUrl ? `"IconUrl" = '${iconUrl.replace(/'/g, "''")}'` : `"IconUrl" = NULL`);
    }
    if (sqlParts.length > 0) {
      sql = `UPDATE "Markers"\n  SET ${sqlParts.join(',\n      ')}\n  WHERE "Id" = '${marker.Id}'::uuid;`;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{isNew ? 'Create Replicated Marker' : 'Edit Marker'}</h2>
          <p className="text-sm text-gray-500 mt-1">{marker.Code}{!isNew && <> &middot; {marker.Id}</>}</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Marker title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            {iconUrl && (
              <div className="mb-3 flex items-center gap-3">
                <div className="bg-gray-800 rounded-lg p-3 flex items-center justify-center">
                  <img
                    src={`https://worlddev.aldar.com/assets/${iconUrl}`}
                    alt="current icon"
                    className="w-12 h-12"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">Current</p>
                  <p className="text-[10px] text-gray-400 font-mono break-all">{iconUrl}</p>
                </div>
              </div>
            )}
            {allIconUrls && allIconUrls.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Select from existing icons:</p>
                <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                  {allIconUrls.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setIconUrl(url)}
                      className={`bg-gray-800 rounded-lg p-2 flex items-center justify-center transition-all hover:ring-2 hover:ring-blue-400 ${
                        iconUrl === url ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                      }`}
                      title={url}
                    >
                      <img
                        src={`https://worlddev.aldar.com/assets/${url}`}
                        alt={url}
                        className="w-8 h-8"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2">
              <input
                type="text"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                placeholder="Or type a path, e.g. icons/marker.png"
              />
            </div>
          </div>

          {hasChanges && sql && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-700">SQL Preview</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(sql)}
                  className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Copy SQL
                </button>
              </div>
              <div className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {sql}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(title, iconUrl)}
            disabled={isSaving || !hasChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {isSaving ? (isNew ? 'Creating...' : 'Saving...') : (isNew ? 'Confirm & Create' : 'Confirm & Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({
  positionChanges,
  newMarkers,
  editChanges,
  onConfirm,
  onCancel,
  isSaving,
}: {
  positionChanges: PositionChange[];
  newMarkers: { marker: Marker; sourceId: string; newId: string; position: { top: number; left: number }; edits?: { title?: string; iconUrl?: string } }[];
  editChanges: { markerId: string; marker: Marker; edits: { title?: string; iconUrl?: string } }[];
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const totalChanges = positionChanges.length + newMarkers.length + editChanges.length;

  const buildFullSql = () => {
    const parts: string[] = [];
    newMarkers.forEach((nm) => {
      const title = nm.edits?.title ?? nm.marker.Title;
      const iconUrl = nm.edits?.iconUrl ?? nm.marker.IconUrl;
      const titleExpr = title ? `'${title.replace(/'/g, "''")}'` : `''`;
      const iconExpr = iconUrl ? `'${iconUrl.replace(/'/g, "''")}'` : 'NULL';
      parts.push(`INSERT INTO "Markers" (
  "Id","Kind","SubType","MarkerIndex","Code","IsVisible","IsExplorable",
  "NavigateTo","IsShallowLink","PositionTop","PositionLeft","KeepScale",
  "LngLatJson","ConnectionLineJson","Scale","MinZoom","MaxZoom",
  "MobileScale","MobileMinZoom","MobileMaxZoom","LinkToMarkerIndex",
  "AnchorPositionTop","AnchorPositionLeft",
  "HoverTitle","HoverTitleVisible","HoverIconUrl","HoverIconVersion",
  "HoverIconWidth","HoverIconHeight","HoverScale",
  "SelectedTitle","SelectedTitleVisible","SelectedIconUrl","SelectedIconVersion",
  "SelectedIconWidth","SelectedIconHeight","SelectedScale",
  "Title","TitleVisible","IconUrl","IconVersion","IconWidth","IconHeight",
  "Version","IsPriority","Logo","Layout2DId"
) SELECT
  '${nm.newId}'::uuid, "Kind","SubType",
  (SELECT COALESCE(MAX("MarkerIndex"),-1)+1 FROM "Markers" WHERE "Layout2DId"="Layout2DId"),
  "Code","IsVisible","IsExplorable","NavigateTo","IsShallowLink",
  ${nm.position.top.toFixed(6)}::float8, ${nm.position.left.toFixed(6)}::float8, "KeepScale",
  "LngLatJson","ConnectionLineJson","Scale","MinZoom","MaxZoom",
  "MobileScale","MobileMinZoom","MobileMaxZoom","LinkToMarkerIndex",
  "AnchorPositionTop","AnchorPositionLeft",
  "HoverTitle","HoverTitleVisible","HoverIconUrl","HoverIconVersion",
  "HoverIconWidth","HoverIconHeight","HoverScale",
  "SelectedTitle","SelectedTitleVisible","SelectedIconUrl","SelectedIconVersion",
  "SelectedIconWidth","SelectedIconHeight","SelectedScale",
  ${titleExpr}, "TitleVisible", ${iconExpr}, "IconVersion","IconWidth","IconHeight",
  "Version","IsPriority","Logo","Layout2DId"
FROM "Markers"
WHERE "Id" = '${nm.sourceId}'::uuid;`);
    });
    positionChanges.forEach((c) => {
      parts.push(`UPDATE "Markers"\n  SET "PositionTop" = ${c.newTop.toFixed(6)}::float8,\n      "PositionLeft" = ${c.newLeft.toFixed(6)}::float8\n  WHERE "Id" = '${c.markerId}'::uuid;`);
    });
    editChanges.forEach((ec) => {
      const setParts: string[] = [];
      if (ec.edits.title !== undefined) setParts.push(`"Title" = '${ec.edits.title.replace(/'/g, "''")}'`);
      if (ec.edits.iconUrl !== undefined) setParts.push(ec.edits.iconUrl ? `"IconUrl" = '${ec.edits.iconUrl.replace(/'/g, "''")}'` : `"IconUrl" = NULL`);
      if (setParts.length > 0) parts.push(`UPDATE "Markers"\n  SET ${setParts.join(', ')}\n  WHERE "Id" = '${ec.markerId}'::uuid;`);
    });
    return `BEGIN;\n\n${parts.join('\n\n')}\n\nCOMMIT;`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Confirm Changes</h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalChanges} change(s)
            {newMarkers.length > 0 && <span className="ml-1 text-green-600">· {newMarkers.length} new</span>}
            {positionChanges.length > 0 && <span className="ml-1 text-blue-600">· {positionChanges.length} moved</span>}
            {editChanges.length > 0 && <span className="ml-1 text-orange-600">· {editChanges.length} edited</span>}
          </p>
        </div>

        <div className="overflow-auto flex-1 p-6 space-y-6">
          {newMarkers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-700 mb-2">New Markers (INSERT)</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2 font-medium">Marker</th><th className="pb-2 font-medium">Title</th><th className="pb-2 font-medium">Position</th></tr></thead>
                <tbody>
                  {newMarkers.map((nm) => (
                    <tr key={nm.marker.Id} className="border-b border-gray-100">
                      <td className="py-2"><span className="font-medium text-gray-900">{nm.marker.Code}</span></td>
                      <td className="py-2 text-xs text-green-600 font-mono">{(nm.edits?.title ?? nm.marker.Title) || '(empty)'}</td>
                      <td className="py-2 text-xs font-mono text-gray-600">{nm.position.top.toFixed(1)}, {nm.position.left.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {positionChanges.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-700 mb-2">Position Changes (UPDATE)</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2 font-medium">Marker</th><th className="pb-2 font-medium">Old</th><th className="pb-2 font-medium">New</th><th className="pb-2 font-medium">Delta</th></tr></thead>
                <tbody>
                  {positionChanges.map((c) => (
                    <tr key={c.markerId} className="border-b border-gray-100">
                      <td className="py-2"><div className="font-medium text-gray-900">{c.markerTitle || c.markerCode}</div><div className="text-[10px] text-gray-400 font-mono">{c.markerId}</div></td>
                      <td className="py-2 font-mono text-red-600 text-xs">{c.oldTop.toFixed(1)}, {c.oldLeft.toFixed(1)}</td>
                      <td className="py-2 font-mono text-green-600 text-xs">{c.newTop.toFixed(1)}, {c.newLeft.toFixed(1)}</td>
                      <td className="py-2 font-mono text-gray-500 text-xs">Δ {(c.newTop - c.oldTop).toFixed(1)}, {(c.newLeft - c.oldLeft).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editChanges.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-orange-700 mb-2">Property Edits (UPDATE)</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2 font-medium">Marker</th><th className="pb-2 font-medium">Field</th><th className="pb-2 font-medium">Old</th><th className="pb-2 font-medium">New</th></tr></thead>
                <tbody>
                  {editChanges.map((ec) => (
                    <tr key={ec.markerId} className="border-b border-gray-100">
                      <td className="py-2"><div className="font-medium text-gray-900">{ec.marker.Title || ec.marker.Code}</div><div className="text-[10px] text-gray-400 font-mono">{ec.markerId}</div></td>
                      <td className="py-2 text-xs text-gray-600">{ec.edits.title !== undefined ? 'Title' : ''}{ec.edits.title !== undefined && ec.edits.iconUrl !== undefined ? ', ' : ''}{ec.edits.iconUrl !== undefined ? 'IconUrl' : ''}</td>
                      <td className="py-2 text-xs font-mono text-red-600">{ec.edits.title !== undefined ? (ec.marker.Title || '(empty)') : ''}{ec.edits.iconUrl !== undefined ? <><br />{ec.marker.IconUrl || '(none)'}</> : ''}</td>
                      <td className="py-2 text-xs font-mono text-green-600">{ec.edits.title !== undefined ? (ec.edits.title || '(empty)') : ''}{ec.edits.iconUrl !== undefined ? <><br />{ec.edits.iconUrl || '(none)'}</> : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">SQL Queries</h3>
              <button
                onClick={() => navigator.clipboard.writeText(buildFullSql())}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Copy All
              </button>
            </div>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {buildFullSql()}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ViewConfigPage({ params }: { params: { id: string } }) {
  const [viewConfig, setViewConfig] = useState<ViewConfig | null>(null);
  const [currentLayout2DIndex, setCurrentLayout2DIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { top: number; left: number }>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMarkersList, setShowMarkersList] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingSubtitle, setEditingSubtitle] = useState('');
  const [showTitleConfirmModal, setShowTitleConfirmModal] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [editingMarker, setEditingMarker] = useState<Marker | null>(null);
  const [isSavingMarker, setIsSavingMarker] = useState(false);
  const [tempMarkerIds, setTempMarkerIds] = useState<Set<string>>(new Set());
  const [replicateSources, setReplicateSources] = useState<Record<string, string>>({});
  const [replicateNewIds, setReplicateNewIds] = useState<Record<string, string>>({});
  const [markerEdits, setMarkerEdits] = useState<Record<string, { title?: string; iconUrl?: string }>>({});
  const [deletingMarker, setDeletingMarker] = useState<Marker | null>(null);
  const [isDeletingMarker, setIsDeletingMarker] = useState(false);
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<Set<string>>(new Set());
  const [sqlCopiedType, setSqlCopiedType] = useState<'insert' | 'delete' | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [headerPos, setHeaderPos] = useState({ x: 16, y: 16 });
  const headerDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const handleHeaderDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    headerDragRef.current = { startX: e.clientX, startY: e.clientY, originX: headerPos.x, originY: headerPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleHeaderDragMove = (e: React.PointerEvent) => {
    if (!headerDragRef.current) return;
    const dx = e.clientX - headerDragRef.current.startX;
    const dy = e.clientY - headerDragRef.current.startY;
    setHeaderPos({ x: headerDragRef.current.originX + dx, y: headerDragRef.current.originY + dy });
  };
  const handleHeaderDragEnd = () => { headerDragRef.current = null; };

  useEffect(() => {
    const fetchViewConfig = async () => {
      try {
        const response = await fetch(`/api/viewconfig/search?uuid=${params.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch ViewConfig');
        }

        if (data.data && data.data.length > 0) {
          const config = data.data[0];
          setViewConfig(config);
          
          // Filter to only layouts with markers
          if (!config.Layout2Ds || config.Layout2Ds.length === 0) {
            setError('No Layout2D found for this ViewConfig');
          }
        } else {
          setError('ViewConfig not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchViewConfig();
  }, [params.id]);

  const handleMarkerDrag = useCallback((markerId: string, newTop: number, newLeft: number) => {
    setPositionOverrides((prev) => ({
      ...prev,
      [markerId]: { top: newTop, left: newLeft },
    }));
  }, []);

  const getChanges = useCallback((): PositionChange[] => {
    if (!viewConfig) return [];
    const layout = viewConfig.Layout2Ds?.[currentLayout2DIndex];
    if (!layout) return [];

    return Object.entries(positionOverrides)
      .map(([markerId, pos]) => {
        const marker = layout.Markers.find((m) => m.Id === markerId);
        if (!marker) return null;
        return {
          markerId,
          markerTitle: marker.Title,
          markerCode: marker.Code,
          oldTop: marker.PositionTop,
          oldLeft: marker.PositionLeft,
          newTop: pos.top,
          newLeft: pos.left,
        };
      })
      .filter(Boolean) as PositionChange[];
  }, [viewConfig, currentLayout2DIndex, positionOverrides]);

  const hasPendingChanges = Object.keys(positionOverrides).length > 0
    || tempMarkerIds.size > 0
    || Object.keys(markerEdits).length > 0;

  const handleSaveClick = () => {
    if (!hasPendingChanges) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!viewConfig || !hasPendingChanges) return;
    const layout = viewConfig.Layout2Ds?.[currentLayout2DIndex];
    if (!layout) return;

    setIsSaving(true);
    try {
      // 1. POST new (replicated) markers
      for (const tempId of Array.from(tempMarkerIds)) {
        const sourceId = replicateSources[tempId];
        const marker = layout.Markers.find((m) => m.Id === tempId);
        if (!sourceId || !marker) continue;
        const override = positionOverrides[tempId];
        const edits = markerEdits[tempId];
        const top = override ? override.top : marker.PositionTop;
        const left = override ? override.left : marker.PositionLeft;
        const title = edits?.title ?? marker.Title;
        const iconUrl = edits?.iconUrl ?? marker.IconUrl;

        await fetch('/api/viewconfig/markers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newId: replicateNewIds[tempId],
            sourceMarkerId: sourceId,
            offsetTop: top - (layout.Markers.find((m) => m.Id === sourceId)?.PositionTop ?? 0),
            offsetLeft: left - (layout.Markers.find((m) => m.Id === sourceId)?.PositionLeft ?? 0),
            title,
            iconUrl: iconUrl || undefined,
          }),
        });
      }

      // 2. PUT position changes for existing markers
      const posUpdates = Object.entries(positionOverrides)
        .filter(([id]) => !tempMarkerIds.has(id))
        .map(([id, pos]) => ({ id, positionTop: pos.top, positionLeft: pos.left }));
      if (posUpdates.length > 0) {
        await fetch('/api/viewconfig/markers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: posUpdates }),
        });
      }

      // 3. PATCH title/icon edits for existing markers
      const editEntries = Object.entries(markerEdits).filter(([id]) => !tempMarkerIds.has(id));
      for (const [id, edits] of editEntries) {
        await fetch('/api/viewconfig/markers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, title: edits.title, iconUrl: edits.iconUrl }),
        });
      }

      // Refresh data from server
      const response = await fetch(`/api/viewconfig/search?uuid=${params.id}`);
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        setViewConfig(data.data[0]);
      }

      setPositionOverrides({});
      setTempMarkerIds(new Set());
      setReplicateSources({});
      setReplicateNewIds({});
      setMarkerEdits({});
      setShowConfirmModal(false);
      setIsEditMode(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Remove temp markers from local state
    if (tempMarkerIds.size > 0) {
      setViewConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          Layout2Ds: prev.Layout2Ds.map((layout, idx) => {
            if (idx !== currentLayout2DIndex) return layout;
            return {
              ...layout,
              Markers: layout.Markers.filter((m) => !tempMarkerIds.has(m.Id)),
            };
          }),
        };
      });
    }
    setPositionOverrides({});
    setTempMarkerIds(new Set());
    setReplicateSources({});
    setReplicateNewIds({});
    setMarkerEdits({});
    setIsEditMode(false);
  };

  const handleReplicateMarker = (sourceMarker: Marker) => {
    const newRealId = uuidv4();
    const tempId = `temp-${newRealId}`;
    const tempMarker: Marker = {
      Id: tempId,
      Kind: sourceMarker.Kind,
      SubType: sourceMarker.SubType,
      Code: sourceMarker.Code,
      Title: sourceMarker.Title ? `${sourceMarker.Title} (copy)` : '',
      PositionTop: sourceMarker.PositionTop + 20,
      PositionLeft: sourceMarker.PositionLeft + 20,
      IconUrl: sourceMarker.IconUrl,
      HoverIconUrl: sourceMarker.HoverIconUrl,
    };

    setViewConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        Layout2Ds: prev.Layout2Ds.map((layout, idx) => {
          if (idx !== currentLayout2DIndex) return layout;
          return { ...layout, Markers: [...layout.Markers, tempMarker] };
        }),
      };
    });

    setTempMarkerIds((prev) => new Set(prev).add(tempId));
    setReplicateSources((prev) => ({ ...prev, [tempId]: sourceMarker.Id }));
    setReplicateNewIds((prev) => ({ ...prev, [tempId]: newRealId }));
    setSelectedMarker(tempMarker);
  };

  const isNewMarker = editingMarker?.Id.startsWith('temp-') ?? false;

  const handleEditMarkerConfirm = (title: string, iconUrl: string) => {
    if (!editingMarker) return;
    setMarkerEdits((prev) => ({
      ...prev,
      [editingMarker.Id]: { title, iconUrl: iconUrl || undefined },
    }));
    setEditingMarker(null);
  };

  const handleCancelEditMarker = () => {
    setEditingMarker(null);
  };

  const handleConfirmDeleteMarker = async () => {
    if (!deletingMarker || !viewConfig) return;
    setIsDeletingMarker(true);
    try {
      const response = await fetch(`/api/viewconfig/markers?id=${deletingMarker.Id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete marker');
      }

      setViewConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          Layout2Ds: prev.Layout2Ds.map((layout, idx) => {
            if (idx !== currentLayout2DIndex) return layout;
            return {
              ...layout,
              Markers: layout.Markers.filter((m) => m.Id !== deletingMarker.Id),
            };
          }),
        };
      });

      if (selectedMarker?.Id === deletingMarker.Id) setSelectedMarker(null);
      setDeletingMarker(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete marker');
    } finally {
      setIsDeletingMarker(false);
    }
  };

  const handleEditTitle = () => {
    if (!viewConfig) return;
    setIsEditingTitle(true);
    setEditingTitle(viewConfig.Title || '');
    setEditingSubtitle(viewConfig.Subtitle || '');
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditingTitle('');
    setEditingSubtitle('');
  };

  const handleSaveTitle = () => {
    if (!viewConfig) return;
    const hasChanges = viewConfig.Title !== editingTitle || viewConfig.Subtitle !== editingSubtitle;
    if (!hasChanges) return;
    setShowTitleConfirmModal(true);
  };

  const handleConfirmSaveTitle = async () => {
    if (!viewConfig) return;
    setIsSavingTitle(true);
    try {
      const response = await fetch('/api/viewconfig', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: viewConfig.Id,
          title: editingTitle,
          subtitle: editingSubtitle,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update ViewConfig');
      }

      setViewConfig(prev => prev ? { ...prev, Title: editingTitle, Subtitle: editingSubtitle } : null);
      setShowTitleConfirmModal(false);
      setIsEditingTitle(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save title');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const changedCount = Object.keys(positionOverrides).length + tempMarkerIds.size + Object.keys(markerEdits).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !viewConfig) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Link href="/viewconfig-search" className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4">
          <ChevronLeft size={20} /> Back to Search
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Unable to load ViewConfig'}</p>
        </div>
      </div>
    );
  }

  const layout2d = viewConfig.Layout2Ds?.[currentLayout2DIndex];
  const backplateUrl = constructCdnUrl(layout2d?.BackplateUrl, viewConfig.CdnBaseUrl);

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 relative">
      {/* Floating Draggable Header Panel */}
      <div
        className="fixed z-40 select-none"
        style={{ left: headerPos.x, top: headerPos.y }}
      >
        <div className={`rounded-lg shadow-xl border backdrop-blur-sm ${isEditMode ? 'border-orange-400 bg-orange-50/95' : 'border-gray-300 bg-white/95'}`}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 cursor-grab active:cursor-grabbing"
            onPointerDown={handleHeaderDragStart}
            onPointerMove={handleHeaderDragMove}
            onPointerUp={handleHeaderDragEnd}
          >
            <GripVertical size={14} className="text-gray-400 flex-shrink-0" />
            <Link href="/viewconfig-search" className="text-blue-600 hover:text-blue-700 flex-shrink-0">
              <ChevronLeft size={14} />
            </Link>
            <span className="text-xs font-semibold text-gray-900 truncate max-w-[200px]">
              {viewConfig.Title || 'Untitled'}
            </span>
            {isEditMode && (
              <span className="text-[10px] text-orange-600 font-medium whitespace-nowrap">
                Edit {changedCount > 0 && `(${changedCount})`}
              </span>
            )}
            <button
              onClick={() => setHeaderCollapsed(!headerCollapsed)}
              className="ml-auto text-gray-400 hover:text-gray-700 flex-shrink-0"
            >
              {headerCollapsed ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>
          </div>

          {!headerCollapsed && (
            <div className="px-3 pb-2 pt-1 border-t border-gray-200/60 space-y-1.5">
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="text-xs font-bold text-gray-900 bg-transparent border-b border-blue-500 focus:outline-none w-28"
                    placeholder="Title"
                  />
                  <input
                    type="text"
                    value={editingSubtitle}
                    onChange={(e) => setEditingSubtitle(e.target.value)}
                    className="text-xs text-gray-600 bg-transparent border-b border-blue-500 focus:outline-none w-24"
                    placeholder="Subtitle"
                  />
                  <button onClick={handleSaveTitle} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded hover:bg-green-700">Save</button>
                  <button onClick={handleCancelEditTitle} className="text-[10px] px-1.5 py-0.5 bg-gray-500 text-white rounded hover:bg-gray-600">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 truncate max-w-[180px]">
                    {viewConfig.Subtitle && `${viewConfig.Subtitle} · `}{viewConfig.Code}
                  </span>
                  <button onClick={handleEditTitle} className="text-gray-400 hover:text-gray-700"><Pencil size={10} /></button>
                </div>
              )}

              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => {
                    const query = `SELECT * FROM "ViewConfigs" WHERE "Code" = '${viewConfig.Code}';`;
                    navigator.clipboard.writeText(query);
                  }}
                  className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Code SQL
                </button>
                <button
                  onClick={() => {
                    const query = `SELECT * FROM "ViewConfigs" WHERE "Id" = '${viewConfig.Id}'::uuid;`;
                    navigator.clipboard.writeText(query);
                  }}
                  className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  ID SQL
                </button>
                {layout2d && (
                  <button
                    onClick={() => {
                      const query = `SELECT * FROM "Layout2Ds" WHERE "Id" = '${layout2d.Id}'::uuid;`;
                      navigator.clipboard.writeText(query);
                    }}
                    className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Layout SQL
                  </button>
                )}
                {isEditMode ? (
                  <>
                    <button
                      onClick={handleSaveClick}
                      disabled={!hasPendingChanges}
                      className="px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 text-[10px] font-medium flex items-center gap-0.5 disabled:opacity-50"
                    >
                      <Save size={10} /> Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-0.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-[10px] font-medium flex items-center gap-0.5"
                    >
                      <X size={10} /> Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="px-2 py-0.5 bg-orange-500 text-white rounded hover:bg-orange-600 text-[10px] font-medium flex items-center gap-0.5"
                  >
                    <Pencil size={10} /> Edit
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Layout2D Selector */}
      {viewConfig.Layout2Ds && viewConfig.Layout2Ds.length > 1 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 flex items-center gap-1 px-2 py-1">
          <button
            onClick={() => setCurrentLayout2DIndex(Math.max(0, currentLayout2DIndex - 1))}
            disabled={currentLayout2DIndex === 0}
            className="p-0.5 hover:bg-gray-200 disabled:opacity-30 rounded-full transition-colors"
          >
            <ChevronLeft size={14} className="text-gray-600" />
          </button>
          <span className="text-[11px] font-medium text-gray-700 px-2 whitespace-nowrap">
            {layout2d?.DisplayName || `Layout ${currentLayout2DIndex + 1}`}
            <span className="text-gray-400 ml-1">{currentLayout2DIndex + 1}/{viewConfig.Layout2Ds.length}</span>
          </span>
          <button
            onClick={() => setCurrentLayout2DIndex(Math.min(viewConfig.Layout2Ds.length - 1, currentLayout2DIndex + 1))}
            disabled={currentLayout2DIndex === viewConfig.Layout2Ds.length - 1}
            className="p-0.5 hover:bg-gray-200 disabled:opacity-30 rounded-full transition-colors"
          >
            <ChevronRight size={14} className="text-gray-600" />
          </button>
        </div>
      )}

      {/* Full-screen Layout2D Viewer */}
      {layout2d && backplateUrl && isDziAsset(layout2d.BackplateUrl) && (
        <Layout2DDziViewer
          dziUrl={backplateUrl}
          layout2d={layout2d}
          onSelectMarker={setSelectedMarker}
          isEditMode={isEditMode}
          positionOverrides={positionOverrides}
          onMarkerDrag={handleMarkerDrag}
          onReplicate={handleReplicateMarker}
          onEditMarker={setEditingMarker}
          onDeleteMarker={setDeletingMarker}
          tempMarkerIds={tempMarkerIds}
          markerEdits={markerEdits}
          buildMarkerInsertSql={buildMarkerInsertSql}
        />
      )}

      {layout2d && backplateUrl && !isDziAsset(layout2d.BackplateUrl) && (
        <TransformWrapper
          initialScale={1}
          minScale={1}
          maxScale={10}
          limitToBounds={false}
          centerOnInit={true}
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: false }}
          panning={{ disabled: false, velocityDisabled: true }}
          onPanningStop={(ref) => {
            const { positionX, positionY, scale } = ref.state;
            const wrapperW = window.innerWidth;
            const wrapperH = window.innerHeight;
            const contentW = wrapperW * scale;
            const contentH = (wrapperW * (layout2d.BackplateHeight || 1080) / (layout2d.BackplateWidth || 1920)) * scale;
            const minX = Math.min(0, wrapperW - contentW);
            const minY = Math.min(0, wrapperH - contentH);
            const clampedX = Math.max(minX, Math.min(0, positionX));
            const clampedY = Math.max(minY, Math.min(0, positionY));
            if (clampedX !== positionX || clampedY !== positionY) {
              ref.setTransform(clampedX, clampedY, scale, 200);
            }
          }}
        >
          {(utils) => (
            <>
              <div className="fixed bottom-20 left-6 z-20 flex flex-col gap-2">
                <button
                  onClick={() => utils.zoomIn()}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={() => utils.zoomOut()}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
                  title="Zoom Out"
                >
                  −
                </button>
                <button
                  onClick={() => utils.resetTransform()}
                  className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium transition-colors"
                  title="Reset View"
                >
                  Reset
                </button>
              </div>

              <TransformComponent
                wrapperStyle={{ width: '100vw', height: '100vh' }}
              >
                <div
                  ref={containerRef}
                  className="relative"
                  style={{
                    width: '100vw',
                    aspectRatio: `${layout2d.BackplateWidth || 1920} / ${layout2d.BackplateHeight || 1080}`,
                  }}
                >
                  <img
                    src={backplateUrl}
                    alt={layout2d.DisplayName || 'Layout'}
                    className="w-full h-full"
                    style={{ display: 'block' }}
                  />
                  {layout2d.Markers && layout2d.Markers.length > 0 && (
                    <MarkerOverlay
                      layout2d={layout2d}
                      onSelectMarker={setSelectedMarker}
                      isEditMode={isEditMode}
                      positionOverrides={positionOverrides}
                      onMarkerDrag={handleMarkerDrag}
                      onReplicate={handleReplicateMarker}
                      onEditMarker={setEditingMarker}
                      onDeleteMarker={setDeletingMarker}
                      tempMarkerIds={tempMarkerIds}
                      markerEdits={markerEdits}
                    />
                  )}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      )}

      {/* Floating Markers Widget */}
      {layout2d && layout2d.Markers && layout2d.Markers.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-white rounded-lg shadow-xl border border-gray-200 z-30">
          <button
            onClick={() => setShowMarkersList(!showMarkersList)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-t-lg"
          >
            <span className="text-sm font-medium text-gray-900">Markers ({layout2d.Markers.length})</span>
            <ChevronLeft 
              size={16} 
              className={`text-gray-400 transition-transform ${showMarkersList ? 'rotate-90' : '-rotate-90'}`} 
            />
          </button>
          
          {showMarkersList && (
            <div className="max-h-96 overflow-y-auto border-t border-gray-200">
              {/* Selection toolbar */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between gap-2 z-10">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600 hover:text-gray-900">
                  <input
                    type="checkbox"
                    checked={layout2d.Markers.length > 0 && selectedMarkerIds.size === layout2d.Markers.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMarkerIds(new Set(layout2d.Markers.map(m => m.Id)));
                      } else {
                        setSelectedMarkerIds(new Set());
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {selectedMarkerIds.size > 0 ? `${selectedMarkerIds.size} selected` : 'Select all'}
                </label>
                {selectedMarkerIds.size > 0 && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const markers = layout2d.Markers.filter(m => selectedMarkerIds.has(m.Id));
                        const parts = markers.map(m => buildMarkerInsertSql(m, layout2d.Id));
                        const sql = `BEGIN;\n\n${parts.join('\n\n')}\n\nCOMMIT;`;
                        navigator.clipboard.writeText(sql);
                        setSqlCopiedType('insert');
                        setTimeout(() => setSqlCopiedType(null), 2000);
                      }}
                      className={`px-2 py-1 text-[10px] font-medium rounded transition-colors whitespace-nowrap ${sqlCopiedType === 'insert' ? 'bg-green-100 text-green-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {sqlCopiedType === 'insert' ? 'Copied!' : 'INSERT SQL'}
                    </button>
                    <button
                      onClick={() => {
                        const markers = layout2d.Markers.filter(m => selectedMarkerIds.has(m.Id));
                        const parts = markers.map(m => `DELETE FROM "Markers" WHERE "Id" = '${m.Id}'::uuid;`);
                        const sql = `BEGIN;\n\n${parts.join('\n')}\n\nCOMMIT;`;
                        navigator.clipboard.writeText(sql);
                        setSqlCopiedType('delete');
                        setTimeout(() => setSqlCopiedType(null), 2000);
                      }}
                      className={`px-2 py-1 text-[10px] font-medium rounded transition-colors whitespace-nowrap ${sqlCopiedType === 'delete' ? 'bg-green-100 text-green-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                    >
                      {sqlCopiedType === 'delete' ? 'Copied!' : 'DELETE SQL'}
                    </button>
                  </div>
                )}
              </div>

              {/* Selected Marker Details */}
              {selectedMarker && (
                <div className="border-b border-gray-200 bg-blue-50">
                  <div className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{selectedMarker.Title || 'Marker'}</h3>
                        <p className="text-xs text-gray-600">{selectedMarker.Code}</p>
                      </div>
                      <button
                        onClick={() => setSelectedMarker(null)}
                        className="text-gray-400 hover:text-gray-600 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="font-medium text-gray-700">Kind</span>
                        <p className="text-gray-600">{selectedMarker.Kind}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">SubType</span>
                        <p className="text-gray-600">{selectedMarker.SubType}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Position</span>
                        <p className="text-gray-600">
                          {selectedMarker.PositionTop?.toFixed(1)}, {selectedMarker.PositionLeft?.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-2">
                {layout2d.Markers.map((marker) => (
                  <div
                    key={marker.Id}
                    className={`flex items-center gap-2 p-2 border rounded transition-colors ${
                      selectedMarker?.Id === marker.Id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-blue-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMarkerIds.has(marker.Id)}
                      onChange={(e) => {
                        setSelectedMarkerIds(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(marker.Id) : next.delete(marker.Id);
                          return next;
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                    />
                    <button
                      onClick={() => setSelectedMarker(marker)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-xs font-medium text-gray-900 truncate">{marker.Title || marker.Code}</p>
                      <p className="text-[10px] text-gray-500">{marker.Code}</p>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && layout2d && (
        <ConfirmationModal
          positionChanges={getChanges().filter(c => !tempMarkerIds.has(c.markerId))}
          newMarkers={Array.from(tempMarkerIds).map((tempId) => {
            const marker = layout2d.Markers.find(m => m.Id === tempId)!;
            const override = positionOverrides[tempId];
            return {
              marker,
              sourceId: replicateSources[tempId],
              newId: replicateNewIds[tempId],
              position: { top: override ? override.top : marker.PositionTop, left: override ? override.left : marker.PositionLeft },
              edits: markerEdits[tempId],
            };
          }).filter(nm => nm.marker)}
          editChanges={Object.entries(markerEdits)
            .filter(([id]) => !tempMarkerIds.has(id))
            .map(([id, edits]) => ({ markerId: id, marker: layout2d.Markers.find(m => m.Id === id)!, edits }))
            .filter(ec => ec.marker)}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirmModal(false)}
          isSaving={isSaving}
        />
      )}

      {/* Title Confirmation Modal */}
      {showTitleConfirmModal && viewConfig && (
        <TitleConfirmationModal
          oldTitle={viewConfig.Title || ''}
          oldSubtitle={viewConfig.Subtitle || ''}
          newTitle={editingTitle}
          newSubtitle={editingSubtitle}
          viewConfigId={viewConfig.Id}
          onConfirm={handleConfirmSaveTitle}
          onCancel={() => setShowTitleConfirmModal(false)}
          isSaving={isSavingTitle}
        />
      )}

      {/* Edit Marker Modal */}
      {editingMarker && (
        <MarkerEditModal
          marker={editingMarker}
          sourceMarker={isNewMarker && editingMarker ? layout2d?.Markers.find(m => m.Id === replicateSources[editingMarker.Id]) ?? undefined : undefined}
          layout2dId={layout2d?.Id}
          onConfirm={handleEditMarkerConfirm}
          onCancel={handleCancelEditMarker}
          isSaving={isSavingMarker}
          isNew={isNewMarker}
          allIconUrls={layout2d ? Array.from(new Set(layout2d.Markers.map(m => m.IconUrl).filter((u): u is string => !!u))) : []}
          assignedNewId={isNewMarker && editingMarker ? replicateNewIds[editingMarker.Id] : undefined}
        />
      )}

      {/* Delete Marker Confirmation Modal */}
      {deletingMarker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-red-600">Delete Marker</h2>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete &ldquo;{deletingMarker.Title || deletingMarker.Code}&rdquo;?
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-medium text-gray-700">Title</span>
                  <p className="text-gray-600">{deletingMarker.Title || '(empty)'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Code</span>
                  <p className="text-gray-600 font-mono">{deletingMarker.Code}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Position</span>
                  <p className="text-gray-600">
                    {deletingMarker.PositionTop?.toFixed(1)}, {deletingMarker.PositionLeft?.toFixed(1)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">UUID</span>
                  <p className="text-gray-600 font-mono text-[10px]">{deletingMarker.Id}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-gray-700">SQL Preview</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(`DELETE FROM "Markers" WHERE "Id" = '${deletingMarker.Id}'::uuid;`)}
                    className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Copy SQL
                  </button>
                </div>
                <div className="bg-gray-900 text-red-400 p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {`DELETE FROM "Markers" WHERE "Id" = '${deletingMarker.Id}'::uuid;`}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setDeletingMarker(null)}
                disabled={isDeletingMarker}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteMarker}
                disabled={isDeletingMarker}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50"
              >
                {isDeletingMarker ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
