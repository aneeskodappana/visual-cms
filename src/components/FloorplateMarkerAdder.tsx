'use client';

import { useState } from 'react';
import { Copy, Check, Play, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TowerMarkerEntry {
  title: string;
  iconPath: string;
  positionTop: number;
  positionLeft: number;
}

type TowerMarkersConfig = Record<string, TowerMarkerEntry[]>;

const MARKER_TEMPLATES: { title: string; iconPath: string }[] = [
  { title: 'Ferrari World', iconPath: 'project_marker/project_ferrari_world_north-east.svg' },
  { title: 'Yas Mall', iconPath: 'project_marker/project_yas_mall_north-east.svg' },
  { title: 'Yas Marina', iconPath: 'project_marker/project_yas_marina_north-east.svg' },
  { title: 'Warner Bros', iconPath: 'project_marker/project_warner_bros_north-east.svg' },
  { title: 'Yas Beach', iconPath: 'project_marker/project_yas_beach_north-east.svg' },
];

interface FetchedFloorplate {
  viewConfigId: string;
  layout2dId: string;
  code: string;
  tower: string;
}

function buildMarkersForTowers(towers: string[]): TowerMarkersConfig {
  const config: TowerMarkersConfig = {};
  for (const tower of towers) {
    config[tower] = MARKER_TEMPLATES.map(m => ({
      ...m,
      positionTop: 0,
      positionLeft: 0,
    }));
  }
  return config;
}

const DEFAULT_ICON_BASE_PATH = '/container_projects/project_1-0-0_uae_abudhabi_a93e1b7f-5b89-4d1c-b2d8-ea7c5d1f3b42/backplate_image_project';

const DEFAULT_WHERE_CONDITION = `"Code" ilike 'yasparkplace_%' and "Kind" = 4 and "Code" not in ('yasparkplace_b1', 'yasparkplace_b2', 'yasparkplace_b3', 'yasparkplace_b4', 'yasparkplace_b5', 'yasparkplace_b6')`;

export function FloorplateMarkerAdder() {
  const [whereCondition, setWhereCondition] = useState(DEFAULT_WHERE_CONDITION);
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iconBasePath, setIconBasePath] = useState(DEFAULT_ICON_BASE_PATH);
  const [towerMarkers, setTowerMarkers] = useState<TowerMarkersConfig>({});
  const [expandedTowers, setExpandedTowers] = useState<Set<string>>(new Set());
  const [syncTitleAndIcon, setSyncTitleAndIcon] = useState(true);
  const [fetchedFloorplates, setFetchedFloorplates] = useState<FetchedFloorplate[]>([]);
  const [detectedTowers, setDetectedTowers] = useState<string[]>([]);

  const primaryTower = detectedTowers[0] || '';

  const extractTowerFromCode = (code: string): string | null => {
    const match = code.match(/yasparkplace_(b\d+)_/i);
    return match ? match[1].toLowerCase() : null;
  };

  const generateUUID = () => uuidv4();

  const buildFullIconUrl = (iconPath: string) => {
    const base = iconBasePath.replace(/\/$/, '');
    const path = iconPath.replace(/^\//, '');
    return `${base}/${path}`;
  };

  const generateMarkerInsert = (
    layout2dId: string,
    markerIndex: number,
    title: string,
    iconUrl: string,
    positionTop: number,
    positionLeft: number
  ): string => {
    const markerId = generateUUID();
    const columns = [
      '"Id"', '"Kind"', '"MarkerIndex"', '"Code"', '"IsVisible"', '"IsExplorable"',
      '"NavigateTo"', '"IsShallowLink"', '"PositionTop"', '"PositionLeft"', '"KeepScale"',
      '"LinkToMarkerIndex"', '"AnchorPositionTop"', '"AnchorPositionLeft"', '"HoverTitle"',
      '"HoverTitleVisible"', '"HoverIconUrl"', '"HoverIconVersion"', '"HoverIconWidth"',
      '"HoverIconHeight"', '"HoverScale"', '"SelectedTitle"', '"SelectedTitleVisible"',
      '"SelectedIconUrl"', '"SelectedIconVersion"', '"SelectedIconWidth"', '"SelectedIconHeight"',
      '"SelectedScale"', '"Title"', '"TitleVisible"', '"IconUrl"', '"IconVersion"',
      '"IconWidth"', '"IconHeight"', '"Layout2DId"', '"SubType"', '"MaxZoom"', '"MinZoom"',
      '"Scale"', '"MobileMaxZoom"', '"MobileMinZoom"', '"MobileScale"', '"IsPriority"',
      '"Logo"', '"Version"', '"LngLatJson"', '"ConnectionLineJson"'
    ].join(', ');

    const values = [
      `'${markerId}'::uuid`, '6', String(markerIndex), "''", 'true', 'false',
      "''", 'false', positionTop.toFixed(1), positionLeft.toFixed(1), 'false',
      'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL',
      'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL',
      `'${title}'`, 'false', `'${iconUrl}'`, 'NULL', '100.0', '100.0',
      `'${layout2dId}'::uuid`, 'NULL', '2.5', '0.0', '100.0', '2.5', '0.0', '100.0',
      'NULL', 'NULL', 'NULL', "''", "''"
    ].join(', ');

    return `INSERT INTO public."Markers" (${columns}) VALUES(${values});`;
  };

  const handleFetch = async () => {
    if (!whereCondition.trim()) {
      setError('Please enter a WHERE condition');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedSql('');
    setFetchedFloorplates([]);
    setDetectedTowers([]);

    try {
      const response = await fetch(
        `/api/yasparkplace/floorplates?where=${encodeURIComponent(whereCondition)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch floorplates');
      }

      const data = await response.json();
      const floorplates = data.data;

      if (!floorplates || floorplates.length === 0) {
        setError('No floorplates found with the given WHERE condition');
        setLoading(false);
        return;
      }

      const parsed: FetchedFloorplate[] = [];
      const towerSet = new Set<string>();

      for (const fp of floorplates) {
        const tower = extractTowerFromCode(fp.Code);
        if (!tower) continue;
        towerSet.add(tower);
        if (fp.Layout2Ds && fp.Layout2Ds.length > 0) {
          parsed.push({
            viewConfigId: fp.Id,
            layout2dId: fp.Layout2Ds[0].Id,
            code: fp.Code,
            tower,
          });
        }
      }

      const towers = Array.from(towerSet).sort();
      setFetchedFloorplates(parsed);
      setDetectedTowers(towers);
      setExpandedTowers(new Set([towers[0]]));

      setTowerMarkers(prev => {
        const updated: TowerMarkersConfig = {};
        for (const tower of towers) {
          updated[tower] = prev[tower] || MARKER_TEMPLATES.map(m => ({
            ...m,
            positionTop: 0,
            positionLeft: 0,
          }));
        }
        return updated;
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (fetchedFloorplates.length === 0) {
      setError('Please fetch floorplates first');
      return;
    }

    const towerFloorplates: Record<string, FetchedFloorplate[]> = {};
    for (const fp of fetchedFloorplates) {
      if (!towerFloorplates[fp.tower]) towerFloorplates[fp.tower] = [];
      towerFloorplates[fp.tower].push(fp);
    }

    const sqlStatements: string[] = [];
    let globalMarkerIndex = 12525;

    for (const [tower, floorplateList] of Object.entries(towerFloorplates)) {
      const markers = towerMarkers[tower];
      if (!markers || markers.length === 0) continue;

      sqlStatements.push(
        `-- Tower ${tower.toUpperCase()} markers (${floorplateList.length} floorplates, ${markers.length} markers each)`
      );

      for (const fp of floorplateList) {
        sqlStatements.push(`-- ${fp.code}`);
        for (const marker of markers) {
          const sql = generateMarkerInsert(
            fp.layout2dId,
            globalMarkerIndex++,
            marker.title,
            buildFullIconUrl(marker.iconPath),
            marker.positionTop,
            marker.positionLeft
          );
          sqlStatements.push(sql);
        }
        sqlStatements.push('');
      }
    }

    setGeneratedSql(sqlStatements.join('\n'));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleTower = (tower: string) => {
    setExpandedTowers(prev => {
      const next = new Set(prev);
      next.has(tower) ? next.delete(tower) : next.add(tower);
      return next;
    });
  };

  const updateTowerMarker = (
    tower: string,
    idx: number,
    field: keyof TowerMarkerEntry,
    value: string | number
  ) => {
    const shouldSync = syncTitleAndIcon && (field === 'title' || field === 'iconPath');
    setTowerMarkers(prev => {
      const updated = { ...prev };
      if (shouldSync) {
        for (const t of Object.keys(updated)) {
          if (updated[t][idx]) {
            updated[t] = [...updated[t]];
            updated[t][idx] = { ...updated[t][idx], [field]: value };
          }
        }
      } else {
        updated[tower] = [...updated[tower]];
        updated[tower][idx] = { ...updated[tower][idx], [field]: value };
      }
      return updated;
    });
  };

  const addMarkerToTower = (tower: string) => {
    setTowerMarkers(prev => ({
      ...prev,
      [tower]: [...prev[tower], { title: '', iconPath: '', positionTop: 0, positionLeft: 0 }],
    }));
  };

  const removeMarkerFromTower = (tower: string, idx: number) => {
    setTowerMarkers(prev => ({
      ...prev,
      [tower]: prev[tower].filter((_, i) => i !== idx),
    }));
  };

  const addMarkerToAllTowers = () => {
    setTowerMarkers(prev => {
      const updated = { ...prev };
      for (const tower of Object.keys(updated)) {
        updated[tower] = [
          ...updated[tower],
          { title: '', iconPath: '', positionTop: 0, positionLeft: 0 },
        ];
      }
      return updated;
    });
  };

  const removeMarkerFromAllTowers = (idx: number) => {
    setTowerMarkers(prev => {
      const updated = { ...prev };
      for (const tower of Object.keys(updated)) {
        updated[tower] = updated[tower].filter((_, i) => i !== idx);
      }
      return updated;
    });
  };

  const copyTowerMarkersFrom = (sourceTower: string, targetTower: string) => {
    setTowerMarkers(prev => ({
      ...prev,
      [targetTower]: prev[sourceTower].map(m => ({
        ...m,
        positionTop: 0,
        positionLeft: 0,
      })),
    }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-800">Floorplate Marker Adder</h2>
        <p className="text-sm text-slate-500 mt-1">
          Generate SQL INSERT statements for markers on floorplate ViewConfigs grouped by tower
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            WHERE Condition (for ViewConfigs query)
          </label>
          <textarea
            value={whereCondition}
            onChange={(e) => setWhereCondition(e.target.value)}
            className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder={'e.g., "Code" ilike \'yasparkplace_%\' and "Kind" = 4'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Icon Base Path
          </label>
          <input
            type="text"
            value={iconBasePath}
            onChange={(e) => setIconBasePath(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-slate-400 mt-1">Common base path prepended to each marker icon path</p>
        </div>

        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search size={16} />
          {loading ? 'Fetching...' : 'Fetch Floorplates'}
        </button>

        {detectedTowers.length > 0 && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            Found <strong>{fetchedFloorplates.length}</strong> floorplates across <strong>{detectedTowers.length}</strong> towers: {detectedTowers.map(t => t.toUpperCase()).join(', ')}
          </div>
        )}

        {detectedTowers.length > 0 && (
          <div className="border border-slate-200 rounded-lg">
          <div className="px-4 py-3 bg-slate-50 rounded-t-lg border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Tower &times; Marker Configuration</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncTitleAndIcon}
                  onChange={(e) => setSyncTitleAndIcon(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-600">Sync Title & Icon across towers</span>
              </label>
              <button
                onClick={addMarkerToAllTowers}
                className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
              >
                + Add Marker to All Towers
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {Object.entries(towerMarkers).map(([tower, markers]) => (
              <div key={tower}>
                <button
                  onClick={() => toggleTower(tower)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedTowers.has(tower) ? (
                      <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-400" />
                    )}
                    <span className="text-sm font-semibold text-slate-700 uppercase">{tower}</span>
                    <span className="text-xs text-slate-400">{markers.length} markers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {markers.map((m, idx) => (
                      <img
                        key={idx}
                        src={buildFullIconUrl(m.iconPath)}
                        alt={m.title}
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ))}
                  </div>
                </button>

                {expandedTowers.has(tower) && (
                  <div className="px-4 pb-4 space-y-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                          <th className="pb-1.5 pr-2 font-medium w-8">Icon</th>
                          <th className="pb-1.5 pr-2 font-medium">Title</th>
                          <th className="pb-1.5 pr-2 font-medium">Icon Path</th>
                          <th className="pb-1.5 pr-2 font-medium w-24">Top</th>
                          <th className="pb-1.5 pr-2 font-medium w-24">Left</th>
                          <th className="pb-1.5 font-medium w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {markers.map((marker, idx) => (
                          <tr key={idx} className="border-b border-slate-50 last:border-0">
                            <td className="py-1.5 pr-2">
                              <img
                                src={buildFullIconUrl(marker.iconPath)}
                                alt={marker.title}
                                className="w-7 h-7 object-contain rounded border border-slate-200 bg-white p-0.5"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="text"
                                value={marker.title}
                                onChange={(e) => updateTowerMarker(tower, idx, 'title', e.target.value)}
                                placeholder="Title"
                                disabled={syncTitleAndIcon && tower !== primaryTower}
                                className={`w-full px-2 py-1 border border-slate-300 rounded text-sm ${syncTitleAndIcon && tower !== primaryTower ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="text"
                                value={marker.iconPath}
                                onChange={(e) => updateTowerMarker(tower, idx, 'iconPath', e.target.value)}
                                placeholder="Relative icon path"
                                disabled={syncTitleAndIcon && tower !== primaryTower}
                                className={`w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono ${syncTitleAndIcon && tower !== primaryTower ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                value={marker.positionTop}
                                onChange={(e) =>
                                  updateTowerMarker(tower, idx, 'positionTop', parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                value={marker.positionLeft}
                                onChange={(e) =>
                                  updateTowerMarker(tower, idx, 'positionLeft', parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                              />
                            </td>
                            {(!syncTitleAndIcon || tower === primaryTower) && (
                              <td className="py-1.5 text-right">
                                <button
                                  onClick={() => syncTitleAndIcon ? removeMarkerFromAllTowers(idx) : removeMarkerFromTower(tower, idx)}
                                  className="px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 rounded"
                                >
                                  Remove
                                </button>
                              </td>
                            )}
                            {syncTitleAndIcon && tower !== primaryTower && <td />}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(!syncTitleAndIcon || tower === primaryTower) && (
                      <button
                        onClick={() => syncTitleAndIcon ? addMarkerToAllTowers() : addMarkerToTower(tower)}
                        className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        + Add Marker{syncTitleAndIcon ? ' (all towers)' : ''}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {detectedTowers.length > 0 && (
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Play size={16} />
            Generate SQL
          </button>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {generatedSql && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Generated SQL</label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="w-full h-96 p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-auto whitespace-pre-wrap">
              {generatedSql}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
