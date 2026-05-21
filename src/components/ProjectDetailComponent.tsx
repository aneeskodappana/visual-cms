'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { Loader2, Copy, Check, ExternalLink, ChevronDown, ChevronUp, Edit2, Save, X } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';

interface ProjectDetailData {
  Id: string;
  Code: string;
  MulesoftCode: string;
  CommunityKey: string;
  Title: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  City?: {
    Id: string;
    Code: string;
    Title: string;
    Nation?: {
      Id: string;
      Code: string;
      Title: string;
    };
  };
  ViewConfig?: any;
  Clusters?: Array<any>;
  Amenities?: Array<any>;
  CacheInfo?: any;
  ProjectSalesLeadInfo?: any;
  VariantInfo?: any;
}

interface ProjectDetailComponentProps {
  projectId: string;
}

export function ProjectDetailComponent({ projectId }: ProjectDetailComponentProps) {
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingSalesLead, setEditingSalesLead] = useState(false);
  const [salesLeadData, setSalesLeadData] = useState<any>(null);
  const [savingSalesLead, setSavingSalesLead] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState(false);
  const [expandedVariantJson, setExpandedVariantJson] = useState(false);
  const [groupByUnitNumber, setGroupByUnitNumber] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [updateQuery, setUpdateQuery] = useState<string>('');
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [showMulesoftModal, setShowMulesoftModal] = useState(false);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>([]);
  const [loadingMulesoft, setLoadingMulesoft] = useState(false);
  const [mulesoftData, setMulesoftData] = useState<Record<string, any[]>>({});
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [mulesoftResults, setMulesoftResults] = useState<{
    success: boolean;
    message: string;
    errors?: Record<string, string>;
    data?: Record<string, number>;
  } | null>(null);
  const [showMulesoftDebug, setShowMulesoftDebug] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [generatedQuery, setGeneratedQuery] = useState<string>('');
  const [availableEnvironments, setAvailableEnvironments] = useState<string[]>([]);

  useEffect(() => {
    const fetchAvailableEnvironments = async () => {
      try {
        const response = await fetch('/api/mulesoft/environments');
        const data = await response.json();
        if (data.status === 'success') {
          setAvailableEnvironments(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch available environments:', err);
      }
    };

    fetchAvailableEnvironments();
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch project');
        }

        setProject(data.data);
        if (data.data.ProjectSalesLeadInfo) {
          setSalesLeadData(data.data.ProjectSalesLeadInfo);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch project');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  const handleSalesLeadChange = (key: string, value: string) => {
    setSalesLeadData((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getChangedFields = () => {
    if (!project?.ProjectSalesLeadInfo || !salesLeadData) return {};

    const changed: Record<string, any> = {};
    Object.keys(salesLeadData).forEach((key) => {
      if (key !== 'Id' && key !== 'ProjectId') {
        if (salesLeadData[key] !== project.ProjectSalesLeadInfo[key]) {
          changed[key] = salesLeadData[key];
        }
      }
    });
    return changed;
  };

  const generateUpdateQuery = () => {
    const changed = getChangedFields();
    if (Object.keys(changed).length === 0) {
      alert('No changes made');
      return '';
    }

    const setClause = Object.entries(changed)
      .map(([key, value]) => `${key} = '${value}'`)
      .join(', ');

    const id = project?.ProjectSalesLeadInfo?.Id || 'unknown-id';
    return `UPDATE ProjectSalesLeadInfo SET ${setClause} WHERE Id = '${id}';`;
  };

  const handleSaveClick = () => {
    const query = generateUpdateQuery();
    if (query) {
      setUpdateQuery(query);
      setShowConfirmModal(true);
    }
  };

  const confirmSave = async () => {
    try {
      setSavingSalesLead(true);
      const changed = getChangedFields();

      const response = await fetch(`/api/projects/${project?.Id}/sales-lead`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changed),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update sales lead info');
      }

      setSalesLeadData(result.data);
      setEditingSalesLead(false);
      setShowConfirmModal(false);
      alert('Sales Lead Info updated successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update sales lead info');
    } finally {
      setSavingSalesLead(false);
    }
  };

  const copyQuery = async () => {
    await navigator.clipboard.writeText(updateQuery);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 1500);
  };

  const handleMulesoftFetch = async () => {
    if (selectedEnvironments.length === 0) {
      alert('Please select at least one environment');
      return;
    }

    try {
      setLoadingMulesoft(true);
      const response = await fetch('/api/mulesoft/unit-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          environments: selectedEnvironments,
          communityName: project?.Title || '',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch unit details');
      }

      setMulesoftData(result.data);

      const data: Record<string, number> = {};
      Object.entries(result.data).forEach(([env, units]: [string, any]) => {
        data[env] = units.length;
      });

      setMulesoftResults({
        success: !result.errors || Object.keys(result.errors).length === 0,
        message: `Fetched ${Object.values(data).reduce((a: number, b: number) => a + b, 0)} total units across ${Object.keys(data).length} environment(s)`,
        data,
        errors: result.errors,
      });
      setShowMulesoftModal(false);
      setSelectedEnvironments([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to fetch unit details');
    } finally {
      setLoadingMulesoft(false);
    }
  };

  const getUnitEnvironments = (unitLocationId: string): string[] => {
    if (!unitLocationId || unitLocationId === '-') return [];

    const environments: string[] = [];
    const normalizedLocal = unitLocationId.toString().toLowerCase().trim();

    Object.entries(mulesoftData).forEach(([env, units]) => {
      const found = units.some((u: any, index: number) => {
        const mulesoftLocationId =
          u.location_id?.toString() ||
          u.Location_Id?.toString() ||
          u.LocationId?.toString() ||
          '';

        const normalized = mulesoftLocationId.toLowerCase().trim();
        return normalized === normalizedLocal;
      });

      if (found) {
        environments.push(env.toUpperCase());
      }
    });

    return environments;
  };

  const selectAllInEnvironment = useCallback((environment: string) => {
    setSelectedUnitIds((prev) => {
      const units = getAllUnits();
      const envUnits = new Set(prev);

      units.forEach((unit) => {
        const envs = getUnitEnvironments(unit.LocationId || '-');
        if (envs.includes(environment)) {
          envUnits.add(unit.Id);
        }
      });

      return envUnits;
    });
  }, [mulesoftData, project]);

  const deselectAllInEnvironment = useCallback((environment: string) => {
    setSelectedUnitIds((prev) => {
      const units = getAllUnits();
      const envUnits = new Set(prev);

      units.forEach((unit) => {
        const envs = getUnitEnvironments(unit.LocationId || '-');
        if (envs.includes(environment)) {
          envUnits.delete(unit.Id);
        }
      });

      return envUnits;
    });
  }, [mulesoftData, project]);

  const toggleUnitSelection = useCallback((unitId: string) => {
    setSelectedUnitIds((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(unitId)) {
        newSelection.delete(unitId);
      } else {
        newSelection.add(unitId);
      }
      return newSelection;
    });
  }, []);

  const cancelSalesLeadEdit = () => {
    if (project?.ProjectSalesLeadInfo) {
      setSalesLeadData(project.ProjectSalesLeadInfo);
    }
    setEditingSalesLead(false);
  };

  const getAllUnits = () => {
    const units: any[] = [];
    project?.Clusters?.forEach((cluster) => {
      cluster.Properties?.forEach((property: any) => {
        property.PropertyFloors?.forEach((floor: any) => {
          floor.Units?.forEach((unit: any) => {
            units.push({
              ...unit,
              propertyTitle: property.Title,
              floorTitle: floor.Title,
              clusterTitle: cluster.Title,
            });
          });
        });
      });
    });
    return units;
  };

  const getGroupedUnits = () => {
    const units = getAllUnits();
    const grouped: Record<string, any[]> = {};

    units.forEach((unit) => {
      const key = unit.UnitNumber || '-';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(unit);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([unitNumber, units]) => ({
        unitNumber,
        units,
        count: units.length,
        hasDuplicates: units.length > 1,
      }));
  };

  const copyText = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const generateSelectQuery = () => {
    const selectedIds = Array.from(selectedUnitIds);
    if (selectedIds.length === 0) {
      alert('Please select at least one unit');
      return;
    }

    const idList = selectedIds.map((id) => `'${id}'`).join(', ');
    const query = `SELECT * FROM Units WHERE Id IN (${idList});`;

    setGeneratedQuery(query);
    setShowQueryModal(true);
  };

  const copyGeneratedQuery = async (query: string) => {
    await navigator.clipboard.writeText(query);
    setCopiedQuery(true);
    window.setTimeout(() => setCopiedQuery(false), 1500);
  };

  const getEnvironmentColor = (env: string) => {
    const colorMap: Record<string, { bg: string; text: string; selectedBg: string; selectedText: string }> = {
      UAT: { bg: 'bg-blue-100', text: 'text-blue-700', selectedBg: 'bg-blue-600', selectedText: 'text-white' },
      SIT: { bg: 'bg-orange-100', text: 'text-orange-700', selectedBg: 'bg-orange-600', selectedText: 'text-white' },
      PROD: { bg: 'bg-red-100', text: 'text-red-700', selectedBg: 'bg-red-600', selectedText: 'text-white' },
    };
    return colorMap[env] || { bg: 'bg-slate-100', text: 'text-slate-700', selectedBg: 'bg-slate-600', selectedText: 'text-white' };
  };

  // Memoized unit row component for virtual scrolling
  const UnitRow = memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const unit = getAllUnits()[index];
    if (!unit) return null;

    return (
      <tr
        style={style}
        className={`border-b border-slate-200 text-sm ${
          selectedUnitIds.has(unit.Id) ? 'bg-blue-50' : 'hover:bg-slate-50'
        }`}
      >
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selectedUnitIds.has(unit.Id)}
            onChange={() => toggleUnitSelection(unit.Id)}
          />
        </td>
        <td className="px-4 py-3 font-medium text-slate-900">{unit.UnitNumber || '-'}</td>
        <td className="px-4 py-3 font-mono text-xs text-slate-600">{unit.Id}</td>
        <td className="px-4 py-3 text-slate-700">{unit.LocationId || '-'}</td>
        <td className="px-4 py-3 text-slate-700">{unit.clusterTitle || '-'}</td>
        <td className="px-4 py-3 text-slate-700">{unit.propertyTitle || '-'}</td>
        <td className="px-4 py-3 text-slate-700">{unit.floorTitle || '-'}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            {getUnitEnvironments(unit.LocationId || '-').map((env) => {
              const colors = getEnvironmentColor(env);
              return (
                <span
                  key={env}
                  className={`text-xs font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}
                >
                  {env}
                </span>
              );
            })}
          </div>
        </td>
      </tr>
    );
  });

  UnitRow.displayName = 'UnitRow';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error || 'Project not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Info Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{project.Title}</h2>
            <p className="mt-2 text-slate-600">{project.City?.Title || 'Unknown City'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                project.IsVisible ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {project.IsVisible ? 'Visible' : 'Hidden'}
            </span>
            {project.IsExplorable && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                Explorable
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Project Details Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ID</p>
          <p className="mt-2 break-all font-mono text-sm text-slate-900">{project.Id}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code</p>
          <p className="mt-2 break-all font-mono text-sm text-slate-900">{project.Code || '-'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mulesoft Code</p>
          <p className="mt-2 break-all font-mono text-sm text-slate-900">{project.MulesoftCode || '-'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Community Key</p>
          <p className="mt-2 break-all font-mono text-sm text-slate-900">{project.CommunityKey || '-'}</p>
        </div>
      </div>

      {/* City & Nation Info */}
      {project.City && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Location</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nation</p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {project.City.Nation?.Title || 'Unknown'}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-600">{project.City.Nation?.Code || '-'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">City</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{project.City.Title}</p>
              <p className="mt-1 font-mono text-xs text-slate-600">{project.City.Code}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">City ID</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-900">{project.City.Id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Clusters */}
      {project.Clusters && project.Clusters.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Clusters ({project.Clusters.length})</h3>
          <div className="space-y-3">
            {project.Clusters.map((cluster) => (
              <div key={cluster.Id} className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{cluster.Title || 'Untitled'}</p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600">{cluster.Code || '-'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cluster.Properties?.length > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                        {cluster.Properties.length} Properties
                      </span>
                    )}
                    {cluster.Amenities?.length > 0 && (
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                        {cluster.Amenities.length} Amenities
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amenities */}
      {project.Amenities && project.Amenities.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Amenities ({project.Amenities.length})</h3>
          <div className="space-y-2">
            {project.Amenities.map((amenity) => (
              <div
                key={amenity.Id}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 hover:bg-slate-100"
              >
                <div>
                  <p className="font-medium text-slate-900">{amenity.Title || 'Untitled'}</p>
                  <p className="text-xs text-slate-600">{amenity.Code || '-'}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    amenity.IsVisible ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {amenity.IsVisible ? 'Visible' : 'Hidden'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unit Variants */}
      {project.VariantInfo && project.VariantInfo.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Unit Variants ({project.VariantInfo.length})</h3>
          <div className="space-y-3">
            {project.VariantInfo.map((variant: any) => (
              <div
                key={variant.Id}
                className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{variant.Title || 'Untitled'}</p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600">{variant.Code || '-'}</p>
                    {variant.Description && (
                      <p className="mt-2 text-sm text-slate-700">{variant.Description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {variant.IsVisible !== undefined && (
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          variant.IsVisible
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {variant.IsVisible ? 'Visible' : 'Hidden'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Lead Info */}
      {project.ProjectSalesLeadInfo && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Sales Lead Info</h3>
            {!editingSalesLead && (
              <button
                onClick={() => setEditingSalesLead(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Edit2 size={14} /> Edit
              </button>
            )}
          </div>

          {editingSalesLead ? (
            <div className="space-y-4">
              {Object.entries(salesLeadData || {}).map(([key, value]) => {
                if (key === 'Id' || key === 'ProjectId') return null;
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{key}</label>
                    <input
                      type="text"
                      value={value as string}
                      onChange={(e) => handleSalesLeadChange(key, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                );
              })}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveClick}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Save size={16} /> Save
                </button>
                <button
                  onClick={cancelSalesLeadEdit}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(salesLeadData || {}).map(([key, value]) => {
                if (key === 'Id' || key === 'ProjectId') return null;
                return (
                  <div key={key} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</p>
                    <p className="mt-1 text-sm text-slate-900">{value as string}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Sales Lead Update */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-w-2xl w-full mx-4 rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">Confirm Update</h3>

            <p className="mb-4 text-sm text-slate-600">
              Review the SQL query below before confirming the update:
            </p>

            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-900">
                {updateQuery}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => copyQuery()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                {copiedQuery ? <Check size={16} /> : <Copy size={16} />}
                {copiedQuery ? 'Copied!' : 'Copy Query'}
              </button>
              <button
                onClick={confirmSave}
                disabled={savingSalesLead}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-slate-400"
              >
                {savingSalesLead ? 'Updating...' : 'Confirm Update'}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Units Section */}
      {project.Clusters && project.Clusters.length > 0 && getAllUnits().length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setExpandedUnits(!expandedUnits)}
                className="flex items-center justify-between gap-2 hover:text-blue-600 flex-1"
              >
                <h3 className="text-lg font-semibold text-slate-900">Units ({getAllUnits().length})</h3>
                {expandedUnits ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {expandedUnits && (
                <button
                  onClick={() => setGroupByUnitNumber(!groupByUnitNumber)}
                  className="px-3 py-1 rounded text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  {groupByUnitNumber ? 'Normal View' : 'Group by Unit #'}
                </button>
              )}
            </div>
          </div>

          {expandedUnits && (
            <div className="border-t border-slate-200 p-6">
              {/* Control Bar */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button
                    onClick={() => setShowMulesoftModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    Fetch from Mulesoft
                  </button>
                  {selectedUnitIds.size > 0 && (
                    <button
                      onClick={generateSelectQuery}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Generate SELECT Query ({selectedUnitIds.size})
                    </button>
                  )}
                </div>

                {/* Environment Selection Buttons */}
                {Object.keys(mulesoftData).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold uppercase text-slate-500">Quick Select:</span>
                    {availableEnvironments.map((env) => {
                      const envUnitsCount = getAllUnits().filter((u) =>
                        getUnitEnvironments(u.LocationId || '-').includes(env)
                      ).length;

                      if (envUnitsCount === 0) return null;

                      const allEnvUnitsSelected = getAllUnits()
                        .filter((u) => getUnitEnvironments(u.LocationId || '-').includes(env))
                        .every((u) => selectedUnitIds.has(u.Id));

                      const colors = getEnvironmentColor(env);

                      return (
                        <button
                          key={env}
                          onClick={() => {
                            if (allEnvUnitsSelected) {
                              deselectAllInEnvironment(env);
                            } else {
                              selectAllInEnvironment(env);
                            }
                          }}
                          className={`text-xs font-medium px-3 py-1 rounded ${
                            allEnvUnitsSelected
                              ? `${colors.selectedBg} ${colors.selectedText}`
                              : `${colors.bg} ${colors.text} hover:opacity-80`
                          }`}
                        >
                          {env} ({envUnitsCount})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Grouped View */}
              {groupByUnitNumber ? (
                <div className="space-y-4">
                  {getGroupedUnits().map((group) => {
                    const groupEnvironments = new Set<string>();
                    group.units.forEach((unit) => {
                      getUnitEnvironments(unit.LocationId || '-').forEach((env) => groupEnvironments.add(env));
                    });

                    // Calculate counts for each available environment
                    const envCounts: Record<string, number> = {};
                    availableEnvironments.forEach((env) => {
                      envCounts[env] = group.units.filter((u) =>
                        getUnitEnvironments(u.LocationId || '-').includes(env)
                      ).length;
                    });

                    return (
                      <div key={group.unitNumber} className="rounded-lg border border-slate-200 overflow-hidden">
                        {/* Group Header */}
                        <div className="bg-slate-50 p-4 border-b border-slate-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-slate-900">Unit {group.unitNumber}</h4>
                              {group.hasDuplicates && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  {group.count} units
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {Array.from(groupEnvironments).map((env) => {
                                const colors = getEnvironmentColor(env);
                                return (
                                  <span
                                    key={env}
                                    className={`text-xs font-medium px-2 py-1 rounded ${colors.bg} ${colors.text}`}
                                  >
                                    {env}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Environment Select All Buttons */}
                          {Object.values(envCounts).some((count) => count > 0) && (
                            <div className="mt-3 flex gap-2">
                              {availableEnvironments.map((env) => {
                                const count = envCounts[env];
                                if (count === 0) return null;

                                const allSelected = group.units
                                  .filter((u) => getUnitEnvironments(u.LocationId || '-').includes(env))
                                  .every((u) => selectedUnitIds.has(u.Id));

                                const colors = getEnvironmentColor(env);

                                return (
                                  <button
                                    key={env}
                                    onClick={() => {
                                      if (allSelected) {
                                        deselectAllInEnvironment(env);
                                      } else {
                                        const newSelection = new Set(selectedUnitIds);
                                        group.units.forEach((u) => {
                                          if (getUnitEnvironments(u.LocationId || '-').includes(env)) {
                                            newSelection.add(u.Id);
                                          }
                                        });
                                        setSelectedUnitIds(newSelection);
                                      }
                                    }}
                                    className={`text-xs font-medium px-3 py-1 rounded ${
                                      allSelected
                                        ? `${colors.selectedBg} ${colors.selectedText}`
                                        : `${colors.bg} ${colors.text} hover:opacity-80`
                                    }`}
                                  >
                                    {env} ({count})
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Group Units Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-2 text-left font-semibold text-slate-900 w-10">
                                  <input
                                    type="checkbox"
                                    checked={group.units.every((u) => selectedUnitIds.has(u.Id))}
                                    onChange={(e) => {
                                      const newSelection = new Set(selectedUnitIds);
                                      group.units.forEach((u) => {
                                        if (e.target.checked) {
                                          newSelection.add(u.Id);
                                        } else {
                                          newSelection.delete(u.Id);
                                        }
                                      });
                                      setSelectedUnitIds(newSelection);
                                    }}
                                  />
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-900">Unit ID</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-900">Location ID</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-900">Cluster</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-900">Property</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-900">Floor</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-900">Environments</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.units.map((unit) => (
                                <tr
                                  key={unit.Id}
                                  className={`border-b border-slate-200 ${
                                    selectedUnitIds.has(unit.Id) ? 'bg-blue-50' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedUnitIds.has(unit.Id)}
                                      onChange={() => toggleUnitSelection(unit.Id)}
                                    />
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{unit.Id}</td>
                                  <td className="px-4 py-3 text-slate-700">{unit.LocationId || '-'}</td>
                                  <td className="px-4 py-3 text-slate-700">{unit.clusterTitle || '-'}</td>
                                  <td className="px-4 py-3 text-slate-700">{unit.propertyTitle || '-'}</td>
                                  <td className="px-4 py-3 text-slate-700">{unit.floorTitle || '-'}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                      {getUnitEnvironments(unit.LocationId || '-').map((env) => {
                                        const colors = getEnvironmentColor(env);
                                        return (
                                          <span
                                            key={env}
                                            className={`text-xs font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}
                                          >
                                            {env}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Normal View - Virtualized */
                <div className="space-y-2">
                  {/* Table Header */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-2 text-left font-semibold text-slate-900 w-10">
                            <input
                              type="checkbox"
                              checked={
                                getAllUnits().length > 0 && getAllUnits().every((u) => selectedUnitIds.has(u.Id))
                              }
                              onChange={(e) => {
                                const newSelection = new Set(selectedUnitIds);
                                getAllUnits().forEach((u) => {
                                  if (e.target.checked) {
                                    newSelection.add(u.Id);
                                  } else {
                                    newSelection.delete(u.Id);
                                  }
                                });
                                setSelectedUnitIds(newSelection);
                              }}
                            />
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-900">Unit #</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-900">Unit ID</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-900">Location ID</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-900">Cluster</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-900">Property</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-900">Floor</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-900">Environments</th>
                        </tr>
                      </thead>
                    </table>
                  </div>

                  {/* Virtualized Table Body */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <List
                      height={600}
                      itemCount={getAllUnits().length}
                      itemSize={48}
                      width="100%"
                    >
                      {({ index, style }) => (
                        <table style={{ width: '100%' }}>
                          <tbody>
                            <UnitRow index={index} style={style} />
                          </tbody>
                        </table>
                      )}
                    </List>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mulesoft Modal */}
      {showMulesoftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-w-2xl w-full mx-4 rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">Fetch Units from Mulesoft</h3>

            <div className="mb-4 space-y-2">
              {availableEnvironments.length === 0 ? (
                <p className="text-sm text-slate-600">No environments configured with Mulesoft credentials</p>
              ) : (
                availableEnvironments.map((env) => (
                  <label key={env} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedEnvironments.includes(env)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEnvironments([...selectedEnvironments, env]);
                        } else {
                          setSelectedEnvironments(selectedEnvironments.filter((e) => e !== env));
                        }
                      }}
                    />
                    <span>{env}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMulesoftFetch}
                disabled={loadingMulesoft}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-slate-400"
              >
                {loadingMulesoft ? 'Fetching...' : 'Fetch Units'}
              </button>
              <button
                onClick={() => setShowMulesoftModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Query Modal */}
      {showQueryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Generated SELECT Query</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-900">
                  {generatedQuery}
                </pre>
              </div>
            </div>

            <div className="border-t border-slate-200 p-6 flex gap-3">
              <button
                onClick={() => copyGeneratedQuery(generatedQuery)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {copiedQuery ? <Check size={16} /> : <Copy size={16} />}
                {copiedQuery ? 'Copied!' : 'Copy Query'}
              </button>
              <button
                onClick={() => setShowQueryModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ViewConfig Link */}
      {project.ViewConfig && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">ViewConfig</h3>
          <a
            href={`/viewconfig/${project.ViewConfig.Id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open ViewConfig <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
}
