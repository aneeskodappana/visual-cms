'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Pencil, Save, X, Copy, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const ThreeSixtyViewer = dynamic(
  () => import('@/components/ThreeSixty/ThreeSixtyViewer'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full bg-gray-900 text-white">Loading 3D viewer...</div> }
);

interface NavigationData {
  Id: string;
  DisplayName: string;
  DisplaySubName: string;
  DisplayOrder: number;
  IsPriority: boolean;
  NavigationUrl: string;
  ViewConfigId: string;
}

interface ViewConfigData {
  Id: string;
  Title: string;
  Subtitle: string;
  Code: string;
  CdnBaseUrl: string;
  Layout3D: any;
  Navigations: NavigationData[];
}

interface DuplicatedHotspot {
  id: string;
  sourceHotspot: any;
  hotspotGroupId: string;
  hotspotIndex: number;
  name: string;
  position: { x: number; y: number; z: number };
}

interface HotspotChange {
  hotspotId: string;
  hotspotName: string;
  oldPositionRaw?: { x: number; y: number; z: number };
  oldPositionSphere?: { x: number; y: number; z: number };
  newPosition?: { x: number; y: number; z: number };
  oldName?: string;
  newName?: string;
  isDuplicate?: boolean;
  duplicateData?: DuplicatedHotspot;
  isDelete?: boolean;
}

const SPHERE_RADIUS = 4;

function convertToSpherePosition(x: number, y: number, z: number, radius = SPHERE_RADIUS): { x: number; y: number; z: number } {
  const imageWidth = 6000;
  const imageHeight = 3000;
  const isPixelCoordinate = x > imageWidth * 0.01 || y > imageHeight * 0.01;

  if (!isPixelCoordinate && x !== 0 && y !== 0 && z !== 0) {
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length === 0) return { x: 0, y: 0, z: -radius };
    const scale = radius / length;
    return { x: x * scale, y: y * scale, z: z * scale };
  }

  const theta = (x / imageWidth) * 2 * Math.PI - Math.PI;
  const phi = (y / imageHeight) * Math.PI;
  return {
    x: radius * Math.sin(phi) * Math.sin(theta),
    y: radius * Math.cos(phi),
    z: -radius * Math.sin(phi) * Math.cos(theta),
  };
}

function parsePosition(positionJson: string): { x: number; y: number; z: number } {
  try {
    const parsed = JSON.parse(positionJson);
    return {
      x: parsed.x ?? parsed.X ?? 0,
      y: parsed.y ?? parsed.Y ?? 0,
      z: parsed.z ?? parsed.Z ?? 0,
    };
  } catch {
    return { x: 0, y: 0, z: 0 };
  }
}

function buildSqlForChange(change: HotspotChange): string {
  if (change.isDelete) {
    return `-- DELETE: ${change.hotspotName}\nDELETE FROM "Hotspots"\n  WHERE "Id" = '${change.hotspotId}'::uuid;`;
  }
  if (change.isDuplicate && change.duplicateData) {
    const d = change.duplicateData;
    const pos = change.newPosition
      ? { x: +change.newPosition.x.toFixed(4), y: +change.newPosition.y.toFixed(4), z: +change.newPosition.z.toFixed(4) }
      : d.position;
    const name = change.newName ?? d.name;
    return `-- NEW: ${name} (duplicated from ${d.sourceHotspot.Name})\nINSERT INTO "Hotspots" (\n  "Id", "HotspotIndex", "IsVisible", "IsExplorable", "Name",\n  "MediaUrl", "MediaVersion", "MediaThumbnailUrl", "MediaThumbnailVersion",\n  "PositionJson", "OffsetRotationJson", "DefaultCameraRotationJson",\n  "CameraSettingsJson", "HotspotGroupId"\n) VALUES (\n  gen_random_uuid(), ${d.hotspotIndex}, true, true, '${name}',\n  '${d.sourceHotspot.MediaUrl || ''}', ${d.sourceHotspot.MediaVersion || 1}, '${d.sourceHotspot.MediaThumbnailUrl || ''}', ${d.sourceHotspot.MediaThumbnailVersion || 1},\n  '${JSON.stringify(pos)}', '${d.sourceHotspot.OffsetRotationJson || ''}', '${d.sourceHotspot.DefaultCameraRotationJson || ''}',\n  '${JSON.stringify(d.sourceHotspot.CameraSettingsJson || { version: 1, default: { fov: 90 } })}'::jsonb, '${d.hotspotGroupId}'::uuid\n);`;
  }
  const setClauses: string[] = [];
  if (change.newPosition) {
    const pos = { x: +change.newPosition.x.toFixed(4), y: +change.newPosition.y.toFixed(4), z: +change.newPosition.z.toFixed(4) };
    setClauses.push(`"PositionJson" = '${JSON.stringify(pos)}'`);
  }
  if (change.newName !== undefined) {
    setClauses.push(`"Name" = '${change.newName}'`);
  }
  return `-- ${change.hotspotName}\nUPDATE "Hotspots"\n  SET ${setClauses.join(', ')}\n  WHERE "Id" = '${change.hotspotId}'::uuid;`;
}

function HotspotConfirmationModal({
  changes,
  onConfirm,
  onCancel,
  isSaving,
}: {
  changes: HotspotChange[];
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Confirm Hotspot Changes</h2>
          <p className="text-sm text-gray-500 mt-1">{changes.length} hotspot(s) modified</p>
        </div>

        <div className="overflow-auto flex-1 p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Hotspot</th>
                <th className="pb-2 font-medium">Changes</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.hotspotId} className="border-b border-gray-100">
                  <td className="py-3 align-top">
                    <div className="font-medium text-gray-900">{change.hotspotName}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{change.hotspotId}</div>
                  </td>
                  <td className="py-3 text-xs space-y-2">
                    {change.isDelete && (
                      <div>
                        <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium text-[11px]">DELETE</span>
                      </div>
                    )}
                    {change.isDuplicate && (
                      <div>
                        <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium text-[11px] mb-1">NEW (Duplicate)</span>
                        <div className="text-gray-500">Source: {change.duplicateData?.sourceHotspot.Name}</div>
                      </div>
                    )}
                    {change.newName !== undefined && (
                      <div>
                        <span className="text-gray-500 font-medium">Name:</span>
                        {change.oldName && <span className="ml-2 text-red-600 line-through">{change.oldName}</span>}
                        <span className="ml-2 text-green-600 font-medium">{change.newName ?? change.hotspotName}</span>
                      </div>
                    )}
                    {change.newPosition && change.oldPositionSphere && (
                      <div className="font-mono">
                        <span className="text-gray-500 font-medium font-sans">Position:</span><br />
                        <span className="text-red-600">
                          x: {change.oldPositionSphere.x.toFixed(4)}, y: {change.oldPositionSphere.y.toFixed(4)}, z: {change.oldPositionSphere.z.toFixed(4)}
                        </span><br />
                        <span className="text-green-600">
                          x: {change.newPosition.x.toFixed(4)}, y: {change.newPosition.y.toFixed(4)}, z: {change.newPosition.z.toFixed(4)}
                        </span>
                      </div>
                    )}
                    {change.isDuplicate && change.newPosition && !change.oldPositionSphere && (
                      <div className="font-mono">
                        <span className="text-gray-500 font-medium font-sans">Position:</span><br />
                        <span className="text-green-600">
                          x: {change.newPosition.x.toFixed(4)}, y: {change.newPosition.y.toFixed(4)}, z: {change.newPosition.z.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">SQL Queries</h3>
              <button
                onClick={() => {
                  const transactionSql = `BEGIN;\n\n${changes.map((c) => buildSqlForChange(c)).join('\n\n')}\n\nCOMMIT;`;
                  navigator.clipboard.writeText(transactionSql);
                }}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Copy All
              </button>
            </div>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              <div className="text-gray-500 mb-2">-- BEGIN TRANSACTION</div>
              {changes.map((change) => (
                <div key={change.hotspotId} className="mb-2" style={{ whiteSpace: 'pre-wrap' }}>
                  {buildSqlForChange(change)}
                </div>
              ))}
              <div className="text-gray-500 mt-2">-- COMMIT;</div>
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

export default function Layout3DPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [viewConfig, setViewConfig] = useState<ViewConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number; z: number }>>({});
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [duplicatedHotspots, setDuplicatedHotspots] = useState<DuplicatedHotspot[]>([]);
  const [deletedHotspotIds, setDeletedHotspotIds] = useState<Set<string>>(new Set());
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
          if (!config.Layout3D) {
            setError('No Layout3D found for this ViewConfig');
          } else {
            setViewConfig(config);
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

  const handleHotspotClick = useCallback((hotspot: any) => {
    setSelectedHotspotId(hotspot.Id);
  }, []);

  const handleHotspotNavigate = useCallback(async (hotspot: any) => {
    const name = hotspot.Name;
    if (!name) return;

    const parentCode = viewConfig?.Code || '';
    const lastUnderscoreIdx = parentCode.lastIndexOf('_');
    const prefix = lastUnderscoreIdx >= 0 ? parentCode.substring(0, lastUnderscoreIdx + 1) : '';
    const targetCode = `${prefix}${name}`;

    try {
      const response = await fetch(`/api/viewconfig/search?code=${encodeURIComponent(targetCode)}&codeMatchType=exact`);
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const targetConfig = data.data[0];
        router.push(targetConfig.Layout3D
          ? `/viewconfig/${targetConfig.Id}/layout3d`
          : `/viewconfig/${targetConfig.Id}`
        );
      }
    } catch (err) {
      console.error('Navigation error:', err);
    }
  }, [router, viewConfig]);

  const handleHotspotDrag = useCallback((hotspotId: string, position: { x: number; y: number; z: number }) => {
    setPositionOverrides((prev) => ({
      ...prev,
      [hotspotId]: position,
    }));
  }, []);

  const getChanges = useCallback((): HotspotChange[] => {
    if (!viewConfig) return [];
    const layout3D = viewConfig.Layout3D;
    const hotspotGroups = layout3D.HotspotGroup || [];

    const allHotspots: any[] = [];
    hotspotGroups.forEach((group: any) => {
      (group.Hotspots || []).forEach((h: any) => allHotspots.push(h));
    });

    const deleteChanges: HotspotChange[] = Array.from(deletedHotspotIds)
      .map((hotspotId) => {
        const hotspot = allHotspots.find((h) => h.Id === hotspotId);
        if (!hotspot) return null;
        return {
          hotspotId,
          hotspotName: hotspot.Name || `Hotspot ${hotspot.HotspotIndex}`,
          isDelete: true,
        };
      })
      .filter(Boolean) as HotspotChange[];

    const changedIds = new Set([...Object.keys(positionOverrides), ...Object.keys(nameOverrides)]);
    const updateChanges = Array.from(changedIds)
      .filter((id) => !deletedHotspotIds.has(id))
      .map((hotspotId) => {
        const hotspot = allHotspots.find((h) => h.Id === hotspotId);
        if (!hotspot) return null;
        if (duplicatedHotspots.some((d) => d.id === hotspotId)) return null;

        const change: HotspotChange = {
          hotspotId,
          hotspotName: nameOverrides[hotspotId] ?? hotspot.Name ?? `Hotspot ${hotspot.HotspotIndex}`,
        };

        if (positionOverrides[hotspotId]) {
          const oldPosRaw = parsePosition(hotspot.PositionJson);
          change.oldPositionRaw = oldPosRaw;
          change.oldPositionSphere = convertToSpherePosition(oldPosRaw.x, oldPosRaw.y, oldPosRaw.z);
          change.newPosition = positionOverrides[hotspotId];
        }

        if (nameOverrides[hotspotId] !== undefined && nameOverrides[hotspotId] !== hotspot.Name) {
          change.oldName = hotspot.Name;
          change.newName = nameOverrides[hotspotId];
        }

        if (!change.newPosition && change.newName === undefined) return null;
        return change;
      })
      .filter(Boolean) as HotspotChange[];

    const insertChanges: HotspotChange[] = duplicatedHotspots.map((dup) => {
      const pos = positionOverrides[dup.id] ?? dup.position;
      const name = nameOverrides[dup.id] ?? dup.name;
      return {
        hotspotId: dup.id,
        hotspotName: name,
        newPosition: pos,
        newName: name,
        isDuplicate: true,
        duplicateData: dup,
      };
    });

    return [...deleteChanges, ...updateChanges, ...insertChanges];
  }, [viewConfig, positionOverrides, nameOverrides, duplicatedHotspots, deletedHotspotIds]);

  const handleNameChange = useCallback((hotspotId: string, newName: string) => {
    setNameOverrides((prev) => ({
      ...prev,
      [hotspotId]: newName,
    }));
  }, []);

  const handleDelete = useCallback((hotspotId: string) => {
    const isDup = duplicatedHotspots.some((d) => d.id === hotspotId);
    if (isDup) {
      setDuplicatedHotspots((prev) => prev.filter((d) => d.id !== hotspotId));
      setViewConfig((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        updated.Layout3D = {
          ...updated.Layout3D,
          HotspotGroup: updated.Layout3D.HotspotGroup.map((group: any) => ({
            ...group,
            Hotspots: group.Hotspots.filter((h: any) => h.Id !== hotspotId),
          })),
        };
        return updated;
      });
    } else {
      setDeletedHotspotIds((prev) => new Set([...Array.from(prev), hotspotId]));
    }
    setSelectedHotspotId(null);
    setPositionOverrides((prev) => { const next = { ...prev }; delete next[hotspotId]; return next; });
    setNameOverrides((prev) => { const next = { ...prev }; delete next[hotspotId]; return next; });
  }, [duplicatedHotspots]);

  const handleDuplicate = useCallback((hotspot: any) => {
    const allHotspots: any[] = [];
    const layout3D = viewConfig?.Layout3D;
    if (!layout3D) return;
    (layout3D.HotspotGroup || []).forEach((g: any) =>
      (g.Hotspots || []).forEach((h: any) => allHotspots.push(h))
    );

    const maxIndex = Math.max(...allHotspots.map((h: any) => h.HotspotIndex), ...duplicatedHotspots.map((d) => d.hotspotIndex), 0);
    const newIndex = maxIndex + 1;

    const oldPos = parsePosition(hotspot.PositionJson);
    const spherePos = convertToSpherePosition(oldPos.x, oldPos.y, oldPos.z);
    const offset = 0.3;
    const offsetPos = {
      x: spherePos.x + offset,
      y: spherePos.y + offset,
      z: spherePos.z,
    };
    const len = Math.sqrt(offsetPos.x ** 2 + offsetPos.y ** 2 + offsetPos.z ** 2);
    const normalizedPos = {
      x: (offsetPos.x / len) * SPHERE_RADIUS,
      y: (offsetPos.y / len) * SPHERE_RADIUS,
      z: (offsetPos.z / len) * SPHERE_RADIUS,
    };

    const tempId = `temp-${Date.now()}-${newIndex}`;
    const dup: DuplicatedHotspot = {
      id: tempId,
      sourceHotspot: hotspot,
      hotspotGroupId: hotspot.HotspotGroupId,
      hotspotIndex: newIndex,
      name: hotspot.Name,
      position: normalizedPos,
    };

    setDuplicatedHotspots((prev) => [...prev, dup]);

    setViewConfig((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.Layout3D = {
        ...updated.Layout3D,
        HotspotGroup: updated.Layout3D.HotspotGroup.map((group: any) => {
          if (group.Id !== hotspot.HotspotGroupId) return group;
          return {
            ...group,
            Hotspots: [
              ...group.Hotspots,
              {
                Id: tempId,
                HotspotIndex: newIndex,
                IsVisible: true,
                IsExplorable: true,
                Name: hotspot.Name,
                MediaUrl: hotspot.MediaUrl || '',
                MediaVersion: hotspot.MediaVersion || 1,
                MediaThumbnailUrl: hotspot.MediaThumbnailUrl || '',
                MediaThumbnailVersion: hotspot.MediaThumbnailVersion || 1,
                PositionJson: JSON.stringify(normalizedPos),
                OffsetRotationJson: hotspot.OffsetRotationJson || '',
                DefaultCameraRotationJson: hotspot.DefaultCameraRotationJson || '',
                CameraSettingsJson: hotspot.CameraSettingsJson || { version: 1, default: { fov: 90 } },
                HotspotGroupId: hotspot.HotspotGroupId,
              },
            ],
          };
        }),
      };
      return updated;
    });

    setSelectedHotspotId(tempId);
  }, [viewConfig, duplicatedHotspots]);

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
      const updateChanges = changes.filter((c) => !c.isDuplicate && !c.isDelete);
      const insertChanges = changes.filter((c) => c.isDuplicate && c.duplicateData);

      if (updateChanges.length > 0) {
        const response = await fetch('/api/viewconfig/hotspots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: updateChanges.map((c) => ({
              id: c.hotspotId,
              ...(c.newPosition && {
                positionJson: JSON.stringify({ x: +c.newPosition.x.toFixed(4), y: +c.newPosition.y.toFixed(4), z: +c.newPosition.z.toFixed(4) }),
              }),
              ...(c.newName !== undefined && { name: c.newName }),
            })),
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update hotspots');
        }
      }

      const deleteChanges = changes.filter((c) => c.isDelete);
      if (deleteChanges.length > 0) {
        const realDeletes = deleteChanges.filter((c) => !c.hotspotId.startsWith('temp-'));
        if (realDeletes.length > 0) {
          const response = await fetch('/api/viewconfig/hotspots', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: realDeletes.map((c) => c.hotspotId) }),
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete hotspots');
          }
        }
      }

      if (insertChanges.length > 0) {
        const response = await fetch('/api/viewconfig/hotspots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotspots: insertChanges.map((c) => {
              const d = c.duplicateData!;
              const pos = c.newPosition
                ? { x: +c.newPosition.x.toFixed(4), y: +c.newPosition.y.toFixed(4), z: +c.newPosition.z.toFixed(4) }
                : d.position;
              return {
                hotspotIndex: d.hotspotIndex,
                isVisible: true,
                isExplorable: true,
                name: c.newName ?? d.name,
                mediaUrl: d.sourceHotspot.MediaUrl || '',
                mediaVersion: d.sourceHotspot.MediaVersion || 1,
                mediaThumbnailUrl: d.sourceHotspot.MediaThumbnailUrl || '',
                mediaThumbnailVersion: d.sourceHotspot.MediaThumbnailVersion || 1,
                positionJson: JSON.stringify(pos),
                offsetRotationJson: d.sourceHotspot.OffsetRotationJson || '',
                defaultCameraRotationJson: d.sourceHotspot.DefaultCameraRotationJson || '',
                cameraSettingsJson: d.sourceHotspot.CameraSettingsJson || { version: 1, default: { fov: 90 } },
                hotspotGroupId: d.hotspotGroupId,
              };
            }),
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create hotspots');
        }
      }

      setViewConfig((prev) => {
        if (!prev) return prev;
        const delIds = new Set(deletedHotspotIds);
        const updated = { ...prev };
        updated.Layout3D = {
          ...updated.Layout3D,
          HotspotGroup: updated.Layout3D.HotspotGroup.map((group: any) => ({
            ...group,
            Hotspots: group.Hotspots
              .filter((hotspot: any) => !delIds.has(hotspot.Id))
              .map((hotspot: any) => {
                const posOverride = positionOverrides[hotspot.Id];
                const nameOverride = nameOverrides[hotspot.Id];
                if (!posOverride && nameOverride === undefined) return hotspot;
                return {
                  ...hotspot,
                  ...(posOverride && { PositionJson: JSON.stringify({ x: posOverride.x, y: posOverride.y, z: posOverride.z }) }),
                  ...(nameOverride !== undefined && { Name: nameOverride }),
                };
              }),
          })),
        };
        return updated;
      });

      setPositionOverrides({});
      setNameOverrides({});
      setDuplicatedHotspots([]);
      setDeletedHotspotIds(new Set());
      setShowConfirmModal(false);
      setIsEditMode(false);
      setSelectedHotspotId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (duplicatedHotspots.length > 0) {
      setViewConfig((prev) => {
        if (!prev) return prev;
        const dupIds = new Set(duplicatedHotspots.map((d) => d.id));
        const updated = { ...prev };
        updated.Layout3D = {
          ...updated.Layout3D,
          HotspotGroup: updated.Layout3D.HotspotGroup.map((group: any) => ({
            ...group,
            Hotspots: group.Hotspots.filter((h: any) => !dupIds.has(h.Id)),
          })),
        };
        return updated;
      });
    }
    setPositionOverrides({});
    setNameOverrides({});
    setDuplicatedHotspots([]);
    setDeletedHotspotIds(new Set());
    setIsEditMode(false);
    setSelectedHotspotId(null);
  };

  const changedCount = new Set([...Object.keys(positionOverrides), ...Object.keys(nameOverrides), ...duplicatedHotspots.map((d) => d.id), ...Array.from(deletedHotspotIds)]).size;

  const navigations: NavigationData[] = viewConfig?.Navigations || [];
  const navigationOptions = navigations
    .sort((a, b) => a.DisplayOrder - b.DisplayOrder)
    .map((nav) => ({
      value: nav.DisplayName.replace(/\s+/g, '-'),
      label: nav.DisplayName,
    }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
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

  const layout3D = viewConfig.Layout3D;
  const hotspotGroups = layout3D.HotspotGroup || [];
  const totalHotspots = hotspotGroups.reduce(
    (sum: number, g: any) => sum + (g.Hotspots?.length || 0),
    0
  );

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b z-10 ${isEditMode ? 'bg-orange-900/30 border-orange-700' : 'bg-gray-800 border-gray-700'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white truncate">
              {viewConfig.Title || 'Untitled'}
              {viewConfig.Subtitle && (
                <span className="text-gray-400 ml-1 font-normal">- {viewConfig.Subtitle}</span>
              )}
            </h1>
            <p className="text-xs text-gray-500">
              Layout 3D | Code: {viewConfig.Code}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          {isEditMode ? (
            <>
              <span className="text-xs text-orange-400 font-medium">
                Edit Mode {changedCount > 0 && `(${changedCount} changed)`}
              </span>
              <button
                onClick={handleSaveClick}
                disabled={getChanges().length === 0}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={12} /> Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1 bg-gray-600 text-white rounded text-xs font-medium hover:bg-gray-500 transition-colors flex items-center gap-1"
              >
                <X size={12} /> Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              className="px-3 py-1 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-500 transition-colors flex items-center gap-1"
            >
              <Pencil size={12} /> Edit Hotspots
            </button>
          )}

          <button
            onClick={() => setShowInfo(!showInfo)}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium hover:bg-gray-600 transition-colors"
          >
            {showInfo ? 'Hide' : 'Show'} Info
          </button>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 text-xs text-gray-300 space-y-2 overflow-auto max-h-60">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="text-gray-500">Layout3D ID:</span>
              <p className="font-mono text-gray-300 break-all">{layout3D.Id}</p>
            </div>
            <div>
              <span className="text-gray-500">Model URL:</span>
              <p className="font-mono text-gray-300 break-all">{layout3D.ModelUrl || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Default Group Index:</span>
              <p className="text-gray-300">{layout3D.DefaultHotspotGroupIndex}</p>
            </div>
            <div>
              <span className="text-gray-500">Hotspot Groups / Hotspots:</span>
              <p className="text-gray-300">{hotspotGroups.length} / {totalHotspots}</p>
            </div>
          </div>

          {hotspotGroups.length > 0 && (
            <div className="mt-2">
              <h3 className="text-gray-400 font-semibold mb-1">Hotspot Groups</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left py-1 pr-3">Name</th>
                      <th className="text-left py-1 pr-3">Index</th>
                      <th className="text-left py-1 pr-3">Default Hotspot</th>
                      <th className="text-left py-1 pr-3">Hotspots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotspotGroups.map((group: any) => (
                      <tr key={group.Id} className="border-b border-gray-700/50">
                        <td className="py-1 pr-3 text-gray-300">{group.Name || '-'}</td>
                        <td className="py-1 pr-3 text-gray-400">{group.HotspotGroupIndex}</td>
                        <td className="py-1 pr-3 text-gray-400">{group.DefaultHotspotIndex}</td>
                        <td className="py-1 pr-3 text-gray-400">{group.Hotspots?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3D Viewer */}
      <div className="flex-1 relative">
        <ThreeSixtyViewer
          layout3D={layout3D}
          cdnBaseUrl={viewConfig.CdnBaseUrl}
          isEditMode={isEditMode}
          selectedHotspotId={selectedHotspotId}
          positionOverrides={positionOverrides}
          onHotspotClick={handleHotspotClick}
          onHotspotDrag={handleHotspotDrag}
          onHotspotNavigate={handleHotspotNavigate}
          hiddenHotspotIds={deletedHotspotIds}
        />

        {isEditMode && (
          <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-3 text-xs text-gray-300 max-w-sm">
            <p className="font-medium text-white mb-1">Edit Mode</p>
            <p>Drag hotspots to reposition them. Click a hotspot to select it.</p>
            {selectedHotspotId && (() => {
              const allHotspots: any[] = [];
              hotspotGroups.forEach((g: any) => (g.Hotspots || []).forEach((h: any) => allHotspots.push(h)));
              const h = allHotspots.find((hs: any) => hs.Id === selectedHotspotId);
              if (!h) return null;
              const currentName = nameOverrides[selectedHotspotId] ?? h.Name ?? '';
              return (
                <div className="mt-2 border-t border-gray-600 pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-blue-400 font-medium">Selected: {h.Name || 'Unknown'}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDuplicate(h)}
                        className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded text-[11px] font-medium hover:bg-purple-600/50 transition-colors flex items-center gap-1"
                      >
                        <Copy size={10} /> Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(selectedHotspotId)}
                        className="px-2 py-1 bg-red-600/30 text-red-300 rounded text-[11px] font-medium hover:bg-red-600/50 transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </div>
                  </div>
                  <label className="text-gray-400 block mb-1">Navigation Target (Name)</label>
                  <select
                    value={currentName}
                    onChange={(e) => handleNameChange(selectedHotspotId, e.target.value)}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value={h.Name}>{h.Name} (current)</option>
                    {navigationOptions
                      .filter((opt) => opt.value !== h.Name)
                      .map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value}
                        </option>
                      ))}
                  </select>
                  {nameOverrides[selectedHotspotId] !== undefined && nameOverrides[selectedHotspotId] !== h.Name && (
                    <p className="mt-1 text-orange-400 text-[11px]">Changed: {h.Name} → {nameOverrides[selectedHotspotId]}</p>
                  )}
                </div>
              );
            })()}
            {changedCount > 0 && (
              <p className="mt-2 text-orange-400">{changedCount} hotspot(s) modified</p>
            )}
          </div>
        )}
      </div>

      {showConfirmModal && (
        <HotspotConfirmationModal
          changes={getChanges()}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirmModal(false)}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
