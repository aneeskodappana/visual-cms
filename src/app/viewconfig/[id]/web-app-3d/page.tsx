'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, Info, Pencil, Save, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { NormalizedHotspot, Vector3Like, ViewConfig3DData } from '@/components/web-app-3d/types';
import type { WebApp3DViewerProps } from '@/components/web-app-3d/WebApp3DViewer';
import { getDefaultGroup, normalizeLayout3D } from '@/components/web-app-3d/utils';

const WebApp3DViewer = dynamic<WebApp3DViewerProps>(
  () => import('@/components/web-app-3d/WebApp3DViewer').then((module) => module.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-gray-950 text-white">
        Loading experimental WebApp 3D viewer...
      </div>
    ),
  }
);

const roundVector = (value: Vector3Like) => ({
  x: Number(value.x.toFixed(4)),
  y: Number(value.y.toFixed(4)),
  z: Number(value.z.toFixed(4)),
});

const areVectorsEqual = (left: Vector3Like, right: Vector3Like) => {
  return (
    Number(left.x.toFixed(4)) === Number(right.x.toFixed(4)) &&
    Number(left.y.toFixed(4)) === Number(right.y.toFixed(4)) &&
    Number(left.z.toFixed(4)) === Number(right.z.toFixed(4))
  );
};

export default function WebApp3DPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [viewConfig, setViewConfig] = useState<ViewConfig3DData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, Vector3Like>>({});
  const [modelScale, setModelScale] = useState<Vector3Like>({ x: 10, y: 10, z: 10 });
  const [savedModelScale, setSavedModelScale] = useState<Vector3Like>({ x: 10, y: 10, z: 10 });
  const [requestedGroupId, setRequestedGroupId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchViewConfig = async () => {
      try {
        const response = await fetch(`/api/viewconfig/search?uuid=${params.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch ViewConfig');
        }

        const config = data.data?.[0] as ViewConfig3DData | undefined;
        if (!config) {
          throw new Error('ViewConfig not found');
        }
        if (!config.Layout3D?.HotspotGroup?.length) {
          throw new Error('No Layout3D hotspot data found for this ViewConfig');
        }

        const normalizedLayout = normalizeLayout3D(config.Layout3D);
        const defaultGroup = getDefaultGroup(normalizedLayout);

        setViewConfig(config);
        setModelScale(normalizedLayout.modelScale);
        setSavedModelScale(normalizedLayout.modelScale);
        setRequestedGroupId(defaultGroup?.id ?? null);
        setActiveGroupId(defaultGroup?.id ?? null);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchViewConfig();
  }, [params.id]);

  const normalizedLayout = useMemo(() => {
    if (!viewConfig?.Layout3D) return null;
    return normalizeLayout3D(viewConfig.Layout3D);
  }, [viewConfig]);

  const hotspotGroups = normalizedLayout?.hotspotGroups ?? [];
  const allHotspots = useMemo(
    () => hotspotGroups.flatMap((group) => group.hotspots),
    [hotspotGroups]
  );

  const selectedHotspot = useMemo(
    () => allHotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null,
    [allHotspots, selectedHotspotId]
  );

  const changedHotspotCount = Object.keys(positionOverrides).length;
  const scaleChanged = !areVectorsEqual(modelScale, savedModelScale);
  const hasChanges = changedHotspotCount > 0 || scaleChanged;

  const handleHotspotSelect = useCallback((hotspot: NormalizedHotspot) => {
    setSelectedHotspotId(hotspot.id);
  }, []);

  const handleHotspotDrag = useCallback((hotspotId: string, position: Vector3Like) => {
    setPositionOverrides((current) => ({
      ...current,
      [hotspotId]: roundVector(position),
    }));
  }, []);

  const handleScaleChange = useCallback((axis: keyof Vector3Like, value: string) => {
    const parsed = Number(value);
    setModelScale((current) => ({
      ...current,
      [axis]: Number.isFinite(parsed) ? parsed : 0,
    }));
  }, []);

  const handleCancel = useCallback(() => {
    setPositionOverrides({});
    setModelScale(savedModelScale);
    setSelectedHotspotId(null);
    setIsEditMode(false);
  }, [savedModelScale]);

  const handleSave = useCallback(async () => {
    if (!viewConfig?.Layout3D || !hasChanges) return;

    setIsSaving(true);
    try {
      const hotspotUpdates = Object.entries(positionOverrides).map(([id, position]) => ({
        id,
        positionJson: JSON.stringify(roundVector(position)),
      }));

      if (hotspotUpdates.length > 0) {
        const response = await fetch('/api/viewconfig/hotspots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: hotspotUpdates }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update hotspots');
        }
      }

      if (scaleChanged) {
        const response = await fetch('/api/viewconfig/layout3d', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: viewConfig.Layout3D.Id,
            modelScaleJson: JSON.stringify(roundVector(modelScale)),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update model scale');
        }
      }

      setViewConfig((current) => {
        if (!current?.Layout3D) return current;
        return {
          ...current,
          Layout3D: {
            ...current.Layout3D,
            ModelScaleJson: JSON.stringify(roundVector(modelScale)),
            HotspotGroup: current.Layout3D.HotspotGroup.map((group) => ({
              ...group,
              Hotspots: group.Hotspots.map((hotspot) => {
                const override = positionOverrides[hotspot.Id];
                if (!override) return hotspot;
                return {
                  ...hotspot,
                  PositionJson: JSON.stringify(roundVector(override)),
                };
              }),
            })),
          },
        };
      });

      setSavedModelScale(roundVector(modelScale));
      setPositionOverrides({});
      setSelectedHotspotId(null);
      setIsEditMode(false);
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, modelScale, positionOverrides, scaleChanged, viewConfig]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        Loading experimental 3D viewer...
      </div>
    );
  }

  if (error || !viewConfig?.Layout3D || !normalizedLayout) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <Link href="/viewconfig-search" className="mb-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700">
          <ChevronLeft size={18} /> Back to Search
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error || 'Unable to load experimental 3D view'}
        </div>
      </div>
    );
  }

  const selectedHotspotPosition = selectedHotspot
    ? positionOverrides[selectedHotspot.id] ?? selectedHotspot.position
    : null;

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      <div className={`z-10 flex items-center justify-between border-b px-4 py-2 ${isEditMode ? 'border-orange-700 bg-orange-950/40' : 'border-gray-800 bg-gray-900/95'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-gray-300 transition-colors hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-semibold">
              {viewConfig.Title || 'Untitled'}
              {viewConfig.Subtitle ? <span className="ml-1 font-normal text-gray-400">- {viewConfig.Subtitle}</span> : null}
            </h1>
            <p className="text-xs text-gray-500">Experimental WebApp 3D | Code: {viewConfig.Code}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/viewconfig/${viewConfig.Id}/layout3d`}
            className="inline-flex items-center gap-1 rounded bg-gray-800 px-3 py-1 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-700"
          >
            Existing Layout3D <ExternalLink size={12} />
          </Link>

          {isEditMode ? (
            <>
              <span className="text-xs font-medium text-orange-300">
                Edit Mode {hasChanges ? `(${changedHotspotCount}${scaleChanged ? ` + scale` : ''} changed)` : ''}
              </span>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={12} /> {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="inline-flex items-center gap-1 rounded bg-gray-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-600"
              >
                <X size={12} /> Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              className="inline-flex items-center gap-1 rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-500"
            >
              <Pencil size={12} /> Edit Hotspots & Scale
            </button>
          )}

          <button
            onClick={() => setShowInfo((current) => !current)}
            className="inline-flex items-center gap-1 rounded bg-gray-800 px-3 py-1 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-700"
          >
            <Info size={12} /> {showInfo ? 'Hide' : 'Show'} Info
          </button>
        </div>
      </div>

      {showInfo ? (
        <div className="max-h-60 overflow-auto border-b border-gray-800 bg-gray-900 px-4 py-3 text-xs text-gray-300">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div>
              <span className="text-gray-500">Layout3D ID</span>
              <p className="font-mono break-all">{viewConfig.Layout3D.Id}</p>
            </div>
            <div>
              <span className="text-gray-500">Model URL</span>
              <p className="font-mono break-all">{viewConfig.Layout3D.ModelUrl || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Hotspot Groups</span>
              <p>{hotspotGroups.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Hotspots</span>
              <p>{allHotspots.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Model Scale</span>
              <p className="font-mono">x:{modelScale.x.toFixed(2)} y:{modelScale.y.toFixed(2)} z:{modelScale.z.toFixed(2)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        <WebApp3DViewer
          layout3D={viewConfig.Layout3D}
          cdnBaseUrl={viewConfig.CdnBaseUrl}
          editMode={isEditMode}
          selectedHotspotId={selectedHotspotId}
          positionOverrides={positionOverrides}
          modelScale={modelScale}
          requestedGroupId={requestedGroupId}
          onHotspotSelect={handleHotspotSelect}
          onHotspotDrag={handleHotspotDrag}
          onActiveGroupChange={setActiveGroupId}
        />

        <div className="absolute left-4 top-4 w-80 rounded-xl border border-gray-800 bg-black/65 p-4 text-xs text-gray-200 backdrop-blur">
          <div className="mb-3">
            <p className="text-sm font-semibold text-white">WebApp-style 3D Experiment</p>
            <p className="mt-1 text-gray-400">
              This viewer uses projected GLB rendering and walkable hotspot transitions modeled after the WebApp interior viewer.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-white">Rooms</p>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
              {hotspotGroups.map((group) => {
                const isActive = activeGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => setRequestedGroupId(group.id)}
                    className={`rounded px-2.5 py-1.5 transition-colors ${isActive ? 'bg-white text-gray-950' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>
          </div>

          {isEditMode ? (
            <div className="mt-4 border-t border-gray-800 pt-4">
              <p className="font-medium text-white">Edit Controls</p>
              <p className="mt-1 text-gray-400">Drag hotspots on the model to update their projected walk positions. Adjust model scale below.</p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {(['x', 'y', 'z'] as Array<keyof Vector3Like>).map((axis) => (
                  <label key={axis} className="space-y-1">
                    <span className="text-[11px] uppercase text-gray-500">{axis}</span>
                    <input
                      type="number"
                      step="0.1"
                      value={modelScale[axis]}
                      onChange={(event) => handleScaleChange(axis, event.target.value)}
                      className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-white outline-none focus:border-blue-500"
                    />
                  </label>
                ))}
              </div>

              {selectedHotspot ? (
                <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                  <p className="font-medium text-blue-300">Selected Hotspot</p>
                  <p className="mt-1 text-sm text-white">{selectedHotspot.name}</p>
                  {selectedHotspotPosition ? (
                    <p className="mt-2 font-mono text-[11px] text-gray-400">
                      x: {selectedHotspotPosition.x.toFixed(4)}<br />
                      y: {selectedHotspotPosition.y.toFixed(4)}<br />
                      z: {selectedHotspotPosition.z.toFixed(4)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-gray-500">Click a hotspot to inspect it, then drag it to change position.</p>
              )}
            </div>
          ) : (
            <div className="mt-4 border-t border-gray-800 pt-4 text-gray-400">
              Click a visible hotspot on the surface to walk to that room, or use the room buttons above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
