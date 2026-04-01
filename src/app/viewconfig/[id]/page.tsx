'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { TransformWrapper, TransformComponent, useControls, useTransformEffect } from 'react-zoom-pan-pinch';
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

function MarkerOverlay({ layout2d, onSelectMarker }: { layout2d: Layout2D; onSelectMarker: (marker: Marker) => void }) {
  const [scale, setScale] = useState(1);

  useTransformEffect(({ state }) => {
    setScale(state.scale);
  });

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      {layout2d.Markers.map((marker) => (
        <div
          key={marker.Id}
          className="absolute group cursor-pointer"
          style={{
            top: `${(marker.PositionTop / (layout2d.BackplateHeight || 1080)) * 100}%`,
            left: `${(marker.PositionLeft / (layout2d.BackplateWidth || 1920)) * 100}%`,
            transform: `translate(-50%, -50%) scale(${1 / scale})`,
            transformOrigin: 'center',
            zIndex: 50,
            pointerEvents: 'auto',
          }}
          onClick={() => onSelectMarker(marker)}
          title={marker.Title || marker.Code}
        >
          {marker.IconUrl ? (
            <img
              src={`https://worlddev.aldar.com/assets/${marker.IconUrl}`}
              alt={marker.Title || 'marker'}
              className="hover:saturate-150 transition-all drop-shadow-lg"
              style={{ width: '40px', height: '40px', flexShrink: 0 }}
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          )}

          {/* Hover Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white px-3 py-2 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-normal max-w-xs">
            <div className="font-medium text-center">{marker.Title || marker.Code}</div>
            <div className="text-gray-300 text-[11px] mt-1 w-[300px] text-center">
              <div>UUID: {marker.Id}</div>
              <div>Position: ({marker.PositionTop}, {marker.PositionLeft})</div>
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
          </div>
        </div>
      ))}
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
      <div className="bg-white border-b border-gray-200 shadow-sm p-6">
        <Link href="/viewconfig-search" className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4">
          <ChevronLeft size={20} /> Back to Search
        </Link>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">{viewConfig.Title || 'Untitled'}</h1>
          <p className="text-gray-600 mt-2">
            Code: {viewConfig.Code} | ID: {viewConfig.Id}
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
                        <MarkerOverlay layout2d={layout2d} onSelectMarker={setSelectedMarker} />
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
    </div>
  );
}
