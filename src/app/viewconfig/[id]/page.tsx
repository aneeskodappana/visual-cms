'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';
import Link from 'next/link';
import { TransformWrapper, TransformComponent, useTransformEffect } from 'react-zoom-pan-pinch';
import { constructCdnUrl, getMarkerTypeName, getMarkerSubTypeName } from '@/lib/cdnUtils';

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
  Code: string;
  Title: string;
  PositionTop: number;
  PositionLeft: number;
  IconUrl?: string;
  HoverIconUrl?: string;
}

interface ViewConfig {
  Id: string;
  Title: string;
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

function MarkerOverlay({
  layout2d,
  onSelectMarker,
  isEditMode,
  positionOverrides,
  onMarkerDrag,
}: {
  layout2d: Layout2D;
  onSelectMarker: (marker: Marker) => void;
  isEditMode: boolean;
  positionOverrides: Record<string, { top: number; left: number }>;
  onMarkerDrag: (markerId: string, newTop: number, newLeft: number) => void;
}) {
  const [scale, setScale] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useTransformEffect(({ state }) => {
    setScale(state.scale);
  });

  const handlePointerDown = (e: React.PointerEvent, markerId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(markerId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !overlayRef.current) return;
    e.preventDefault();
    e.stopPropagation();

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

        return (
          <div
            key={marker.Id}
            className={`absolute group ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            style={{
              top: `${(top / (layout2d.BackplateHeight || 1080)) * 100}%`,
              left: `${(left / (layout2d.BackplateWidth || 1920)) * 100}%`,
              transform: `translate(-50%, -50%) scale(${1 / scale})`,
              transformOrigin: 'center',
              zIndex: draggingId === marker.Id ? 100 : 50,
              pointerEvents: 'auto',
            }}
            onPointerDown={(e) => isEditMode ? handlePointerDown(e, marker.Id) : undefined}
            onClick={() => {
              if (!isEditMode) {
                const query = `SELECT * FROM "Markers" WHERE "Id" = '${marker.Id}'::uuid;`;
                navigator.clipboard.writeText(query);
              } else {
                onSelectMarker(marker);
              }
            }}
            title={marker.Title || marker.Code}
          >
            {isEditMode && hasChanged && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white z-10" />
            )}
            {marker.IconUrl ? (
              <img
                src={`https://worlddev.aldar.com/assets/${marker.IconUrl}`}
                alt={marker.Title || 'marker'}
                className={`drop-shadow-lg ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-1 rounded' : 'hover:saturate-150'} transition-all`}
                style={{ width: '40px', height: '40px', flexShrink: 0 }}
                draggable={false}
              />
            ) : (
              <div className={`w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center flex-shrink-0 ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
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

            {isEditMode && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-blue-900 text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                {marker.Title || marker.Code} ({top.toFixed(1)}, {left.toFixed(1)})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConfirmationModal({
  changes,
  onConfirm,
  onCancel,
  isSaving,
}: {
  changes: PositionChange[];
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Confirm Position Changes</h2>
          <p className="text-sm text-gray-500 mt-1">{changes.length} marker(s) modified</p>
        </div>

        <div className="overflow-auto flex-1 p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Marker</th>
                <th className="pb-2 font-medium">Old Position</th>
                <th className="pb-2 font-medium">New Position</th>
                <th className="pb-2 font-medium">Delta</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.markerId} className="border-b border-gray-100">
                  <td className="py-3">
                    <div className="font-medium text-gray-900">{change.markerTitle || change.markerCode}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{change.markerId}</div>
                  </td>
                  <td className="py-3 font-mono text-red-600 text-xs">
                    Top: {change.oldTop.toFixed(2)}<br />
                    Left: {change.oldLeft.toFixed(2)}
                  </td>
                  <td className="py-3 font-mono text-green-600 text-xs">
                    Top: {change.newTop.toFixed(2)}<br />
                    Left: {change.newLeft.toFixed(2)}
                  </td>
                  <td className="py-3 font-mono text-gray-500 text-xs">
                    Δ Top: {(change.newTop - change.oldTop).toFixed(2)}<br />
                    Δ Left: {(change.newLeft - change.oldLeft).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">SQL Queries</h3>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto">
              {changes.map((change) => (
                <div key={change.markerId} className="mb-2">
                  UPDATE &quot;Markers&quot;<br />
                  &nbsp;&nbsp;SET &quot;PositionTop&quot; = {change.newTop.toFixed(6)}::float8,<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;PositionLeft&quot; = {change.newLeft.toFixed(6)}::float8<br />
                  &nbsp;&nbsp;WHERE &quot;Id&quot; = &apos;{change.markerId}&apos;::uuid;
                </div>
              ))}
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

  const handleSaveClick = () => {
    const changes = getChanges();
    if (changes.length === 0) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    const changes = getChanges();
    if (changes.length === 0) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/viewconfig/markers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: changes.map((c) => ({
            id: c.markerId,
            positionTop: c.newTop,
            positionLeft: c.newLeft,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update markers');
      }

      // Update local state with new positions
      setViewConfig((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        updated.Layout2Ds = updated.Layout2Ds.map((layout, idx) => {
          if (idx !== currentLayout2DIndex) return layout;
          return {
            ...layout,
            Markers: layout.Markers.map((marker) => {
              const override = positionOverrides[marker.Id];
              if (!override) return marker;
              return { ...marker, PositionTop: override.top, PositionLeft: override.left };
            }),
          };
        });
        return updated;
      });

      setPositionOverrides({});
      setShowConfirmModal(false);
      setIsEditMode(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setPositionOverrides({});
    setIsEditMode(false);
  };

  const changedCount = Object.keys(positionOverrides).length;

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`bg-white border-b shadow-sm p-6 ${isEditMode ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <Link href="/viewconfig-search" className="text-blue-600 hover:text-blue-700 flex items-center gap-2">
            <ChevronLeft size={20} /> Back to Search
          </Link>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <span className="text-sm text-orange-700 font-medium mr-2">
                  Edit Mode {changedCount > 0 && `(${changedCount} changed)`}
                </span>
                <button
                  onClick={handleSaveClick}
                  disabled={changedCount === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} /> Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm flex items-center gap-2"
                >
                  <X size={16} /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditMode(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm flex items-center gap-2"
              >
                <Pencil size={16} /> Edit Markers
              </button>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">{viewConfig.Title || 'Untitled'}</h1>
          <p className="text-gray-600 mt-2 flex items-center gap-2">
            Code: {viewConfig.Code} | ID: {viewConfig.Id}
            <button
              onClick={() => {
                const query = `SELECT * FROM "ViewConfigs" WHERE "Code" = '${viewConfig.Code}';`;
                navigator.clipboard.writeText(query);
              }}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Copy SELECT * query for Code"
            >
              Copy Code Query
            </button>
            <button
              onClick={() => {
                const query = `SELECT * FROM "ViewConfigs" WHERE "Id" = '${viewConfig.Id}'::uuid;`;
                navigator.clipboard.writeText(query);
              }}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Copy SELECT * query for ID"
            >
              Copy ID Query
            </button>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col">
        {/* Layout2D Selector */}
        {viewConfig.Layout2Ds && viewConfig.Layout2Ds.length > 1 && (
          <div className="max-w-10xl mx-auto w-full px-6 pt-6 mb-6 flex items-center gap-4">
            <button
              onClick={() => setCurrentLayout2DIndex(Math.max(0, currentLayout2DIndex - 1))}
              disabled={currentLayout2DIndex === 0}
              className="p-2 hover:bg-gray-200 disabled:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm font-medium text-gray-700">
                {layout2d?.DisplayName || `Layout ${currentLayout2DIndex + 1}`}
              </p>
              <p className="text-xs text-gray-500">
                {currentLayout2DIndex + 1} of {viewConfig.Layout2Ds.length}
              </p>
            </div>
            <button
              onClick={() => setCurrentLayout2DIndex(Math.min(viewConfig.Layout2Ds.length - 1, currentLayout2DIndex + 1))}
              disabled={currentLayout2DIndex === viewConfig.Layout2Ds.length - 1}
              className="p-2 hover:bg-gray-200 disabled:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        )}

        {/* Layout2D Viewer - Full Width */}
        {layout2d && backplateUrl && (
          <div className="flex-1 bg-white shadow-md overflow-hidden flex flex-col">
            <TransformWrapper
              initialScale={1}
              initialPositionX={0}
              initialPositionY={0}
              wheel={{ step: 0.1 }}
              doubleClick={{ disabled: false }}
              panning={{ disabled: isEditMode }}
            >
              {(utils) => (
                <div className="w-full h-full flex flex-col">
                  <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                      onClick={() => utils.zoomIn()}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
                    >
                      +
                    </button>
                    <button
                      onClick={() => utils.zoomOut()}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
                    >
                      −
                    </button>
                    <button
                      onClick={() => utils.resetTransform()}
                      className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                  <TransformComponent
                    wrapperClass="w-full h-full"
                    contentClass="w-full h-full"
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
                      <div
                        ref={containerRef}
                        className="relative bg-gray-100"
                        style={{
                          width: `${layout2d.BackplateWidth || 1920}px`,
                          height: `${layout2d.BackplateHeight || 1080}px`,
                        }}
                      >
                      {/* Backplate Image */}
                      <img
                        src={backplateUrl}
                        alt={layout2d.DisplayName || 'Layout'}
                        className="w-full h-full object-contain"
                      />

                      {/* Markers Overlay */}
                      {layout2d.Markers && layout2d.Markers.length > 0 && (
                        <MarkerOverlay
                          layout2d={layout2d}
                          onSelectMarker={setSelectedMarker}
                          isEditMode={isEditMode}
                          positionOverrides={positionOverrides}
                          onMarkerDrag={handleMarkerDrag}
                        />
                      )}
                      </div>
                    </div>
                  </TransformComponent>
                </div>
              )}
            </TransformWrapper>
          </div>
        )}
      </div>

      {/* Bottom Panels */}
      <div className="p-6">
        {/* Selected Marker Details */}
        {selectedMarker && (
          <div className="max-w-10xl mx-auto bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedMarker.Title || 'Marker'}</h2>
                <p className="text-sm text-gray-600 mt-1">Code: {selectedMarker.Code}</p>
              </div>
              <button
                onClick={() => setSelectedMarker(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Kind</span>
                <p className="text-gray-600 mt-1">{selectedMarker.Kind} ({getMarkerTypeName(selectedMarker.Kind)})</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">SubType</span>
                <p className="text-gray-600 mt-1">{selectedMarker.SubType} ({getMarkerSubTypeName(selectedMarker.SubType)})</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Position</span>
                <p className="text-gray-600 mt-1">
                  {selectedMarker.PositionTop?.toFixed(2)}%, {selectedMarker.PositionLeft?.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Markers List */}
        {layout2d && layout2d.Markers && layout2d.Markers.length > 0 && (
          <div className="max-w-10xl mx-auto bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Markers ({layout2d.Markers.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {layout2d.Markers.map((marker) => (
                <button
                  key={marker.Id}
                  onClick={() => setSelectedMarker(marker)}
                  className="p-4 border border-gray-300 rounded-lg hover:bg-blue-50 transition-colors text-left"
                >
                  <p className="font-medium text-gray-900">{marker.Title || 'Untitled'}</p>
                  <p className="text-sm text-gray-600">{marker.Code}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {getMarkerTypeName(marker.Kind)} • {getMarkerSubTypeName(marker.SubType)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          changes={getChanges()}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirmModal(false)}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
