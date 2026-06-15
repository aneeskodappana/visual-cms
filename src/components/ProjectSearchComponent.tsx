'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Search, Copy, Check, Download } from 'lucide-react';
import { generateProjectInsertSql, downloadSqlFile } from '@/lib/sqlExportUtils';

interface ProjectResult {
  Id: string;
  Code: string;
  MulesoftCode: string;
  CommunityKey: string;
  Title: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  CityId: string;
  ViewConfig: any;
  Clusters: any[];
  Amenities: any[];
  CacheInfo: any;
  ProjectSalesLeadInfo: any;
  VariantInfo: any;
  City: any;
}

type SqlOperation = 'update' | 'delete' | 'select';

interface FlatProjectUnit {
  Id: string;
  Code: string;
  DisplayName?: string;
  UnitNumber: string;
  UnitStatus: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  projectTitle: string;
  clusterTitle: string;
  propertyTitle: string;
  floorTitle: string;
}

const UNIT_STATUS_OPTIONS = ['Available', 'Reserved', 'Sold', 'Unavailable'] as const;

const escapeSqlString = (value: string) => value.replace(/'/g, "''");

const sqlLiteral = (value: string) => `'${escapeSqlString(value)}'`;

const buildUnitWhereClause = (units: FlatProjectUnit[]) => {
  const unitsWithNumbers = units.filter((unit) => Boolean(unit.UnitNumber));
  const unitNumbers = Array.from(new Set(unitsWithNumbers.map((unit) => unit.UnitNumber))).sort();
  if (unitsWithNumbers.length !== units.length) {
    const ids = Array.from(new Set(units.map((unit) => unit.Id))).sort();
    if (ids.length === 1) {
      return `"Id"=${sqlLiteral(ids[0])}::uuid`;
    }
    return `"Id" IN (${ids.map((id) => `${sqlLiteral(id)}::uuid`).join(', ')})`;
  }
  if (unitNumbers.length === 1) {
    return `"UnitNumber"=${sqlLiteral(unitNumbers[0])}`;
  }
  return `"UnitNumber" IN (${unitNumbers.map(sqlLiteral).join(', ')})`;
};

const flattenProjectUnits = (project: ProjectResult): FlatProjectUnit[] => {
  const units: FlatProjectUnit[] = [];

  for (const cluster of project.Clusters || []) {
    for (const property of cluster.Properties || []) {
      for (const floor of property.PropertyFloors || []) {
        for (const unit of floor.Units || []) {
          units.push({
            Id: unit.Id,
            Code: unit.Code,
            DisplayName: unit.DisplayName,
            UnitNumber: unit.UnitNumber,
            UnitStatus: unit.UnitStatus,
            IsVisible: unit.IsVisible,
            IsExplorable: unit.IsExplorable,
            projectTitle: project.Title || project.Code,
            clusterTitle: cluster.Title || cluster.Code || '-',
            propertyTitle: property.Title || property.Code || '-',
            floorTitle: floor.Title || floor.Code || '-',
          });
        }
      }
    }
  }

  return units;
};

export function ProjectSearchComponent() {
  const searchParams = useSearchParams();

  const [codeInput, setCodeInput] = useState('');
  const [uuidInput, setUuidInput] = useState('');
  const [codeMatchType, setCodeMatchType] = useState<'ilike' | 'exact'>('exact');
  const [rowsPerPage, setRowsPerPage] = useState<number>(1000);
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [sqlOperation, setSqlOperation] = useState<SqlOperation>('update');
  const [unitStatus, setUnitStatus] = useState('Available');
  const [targetIsVisible, setTargetIsVisible] = useState(true);
  const [targetIsExplorable, setTargetIsExplorable] = useState(true);
  const [unitSearchInput, setUnitSearchInput] = useState('');
  const [unitRowsPerPage, setUnitRowsPerPage] = useState(25);
  const [unitPage, setUnitPage] = useState(1);
  const [currentSql, setCurrentSql] = useState('');
  const [previousSqls, setPreviousSqls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const selectedUnitsRef = useRef<Set<string>>(new Set());

  const updateSelectedUnits = (getNext: (current: Set<string>) => Set<string>) => {
    const next = getNext(selectedUnitsRef.current);
    selectedUnitsRef.current = next;
    setSelectedUnits(next);
  };

  useEffect(() => {
    const code = searchParams.get('code') || '';
    const uuid = searchParams.get('uuid') || '';
    const matchType = (searchParams.get('matchType') as 'ilike' | 'exact') || 'exact';

    setCodeInput(code);
    setUuidInput(uuid);
    setCodeMatchType(matchType);

    if (code || uuid) {
      performSearch(code, uuid, matchType, rowsPerPage);
    }
  }, [searchParams]);

  const updateURL = (code: string, uuid: string, matchType: string) => {
    const params = new URLSearchParams();
    if (code) params.append('code', code);
    if (uuid) params.append('uuid', uuid);
    if (matchType) params.append('matchType', matchType);
    const queryString = params.toString();
    window.history.replaceState(null, '', queryString ? `?${queryString}` : '/project-search');
  };

  const performSearch = async (code: string, uuid: string, matchType: string, rowsPerPage: number) => {
    if (!code && !uuid) {
      setError('Please enter a code or UUID to search');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedProjects(new Set());

    try {
      const params = new URLSearchParams();
      if (code) {
        params.append('code', code);
        params.append('codeMatchType', matchType);
      }
      if (uuid) params.append('uuid', uuid);
      params.append('limit', String(rowsPerPage));

      const response = await fetch(`/api/project/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.data || []);
      updateSelectedUnits(() => new Set());
      if (data.data?.length === 0) {
        setError('No results found');
      }

      updateURL(code, uuid, matchType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, cellId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(cellId);
    setTimeout(() => setCopiedCell(null), 2000);
  };

  const handleSelectProject = (projectId: string, checked: boolean) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (checked) next.add(projectId);
      else next.delete(projectId);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProjects(new Set(results.map((r) => r.Id)));
    } else {
      setSelectedProjects(new Set());
    }
  };

  const projectUnits = useMemo(() => results.flatMap(flattenProjectUnits), [results]);

  const filteredProjectUnits = useMemo(() => {
    const query = unitSearchInput.trim().toLowerCase();
    if (!query) return projectUnits;

    return projectUnits.filter((unit) => {
      const searchableText = [
        unit.UnitNumber,
        unit.Code,
        unit.DisplayName,
        unit.UnitStatus,
        unit.projectTitle,
        unit.clusterTitle,
        unit.propertyTitle,
        unit.floorTitle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [projectUnits, unitSearchInput]);

  const unitTotalPages = Math.max(1, Math.ceil(filteredProjectUnits.length / unitRowsPerPage));
  const paginatedProjectUnits = useMemo(() => {
    const start = (unitPage - 1) * unitRowsPerPage;
    return filteredProjectUnits.slice(start, start + unitRowsPerPage);
  }, [filteredProjectUnits, unitPage, unitRowsPerPage]);

  useEffect(() => {
    setUnitPage(1);
  }, [unitSearchInput, unitRowsPerPage, projectUnits.length]);

  useEffect(() => {
    if (unitPage > unitTotalPages) {
      setUnitPage(unitTotalPages);
    }
  }, [unitPage, unitTotalPages]);

  const selectedUnitRecords = useMemo(
    () => projectUnits.filter((unit) => selectedUnits.has(unit.Id)),
    [projectUnits, selectedUnits]
  );

  const handleSelectUnit = (unitId: string, checked: boolean) => {
    updateSelectedUnits((prev) => {
      const next = new Set(prev);
      if (checked) next.add(unitId);
      else next.delete(unitId);
      return next;
    });
  };

  const handleSelectProjectUnits = (project: ProjectResult, checked: boolean) => {
    const units = flattenProjectUnits(project);
    updateSelectedUnits((prev) => {
      const next = new Set(prev);
      for (const unit of units) {
        if (checked) next.add(unit.Id);
        else next.delete(unit.Id);
      }
      return next;
    });
  };

  const handleSelectUnits = (units: FlatProjectUnit[], checked: boolean) => {
    updateSelectedUnits((prev) => {
      const next = new Set(prev);
      for (const unit of units) {
        if (checked) next.add(unit.Id);
        else next.delete(unit.Id);
      }
      return next;
    });
  };

  const handleUnitStatusChange = (status: string) => {
    setUnitStatus(status);
    if (status === 'Available') {
      setTargetIsVisible(true);
      setTargetIsExplorable(true);
    }
    if (status === 'Reserved') {
      setTargetIsVisible(false);
      setTargetIsExplorable(false);
    }
  };

  const generateUnitSql = () => {
    const latestSelectedUnits = selectedUnitsRef.current;
    const latestSelectedUnitRecords = projectUnits.filter((unit) => latestSelectedUnits.has(unit.Id));

    if (latestSelectedUnitRecords.length === 0) {
      setError('Select at least one unit before generating SQL');
      return;
    }

    const whereClause = buildUnitWhereClause(latestSelectedUnitRecords);
    const unitNumbers = latestSelectedUnitRecords.map((unit) => unit.UnitNumber).sort().join(', ');
    const header = [
      `-- ${sqlOperation.toUpperCase()} SQL for ${latestSelectedUnitRecords.length} Unit(s): ${unitNumbers}`,
      `-- Generated at: ${new Date().toISOString()}`,
    ].join('\n');

    let sql = '';
    if (sqlOperation === 'update') {
      sql = `${header}\nUPDATE public."Units"\nSET "IsVisible"=${targetIsVisible}, "IsExplorable"=${targetIsExplorable}, "UnitStatus"=${sqlLiteral(unitStatus)}\nWHERE ${whereClause};`;
    } else if (sqlOperation === 'delete') {
      sql = `${header}\nDELETE FROM public."Units"\nWHERE ${whereClause};`;
    } else {
      sql = `${header}\nSELECT *\nFROM public."Units"\nWHERE ${whereClause}\nORDER BY "UnitNumber";`;
    }

    if (currentSql) {
      setPreviousSqls((prev) => [currentSql, ...prev].slice(0, 5));
    }
    setCurrentSql(sql);
    setError(null);
  };

  const CopyButton = ({ text, cellId }: { text: string; cellId: string }) => (
    <button
      onClick={() => copyToClipboard(text, cellId)}
      className="ml-1 p-0.5 hover:bg-gray-200 rounded inline-flex items-center flex-shrink-0"
      title="Copy to clipboard"
    >
      {copiedCell === cellId ? (
        <Check size={12} className="text-green-600" />
      ) : (
        <Copy size={12} className="text-gray-500" />
      )}
    </button>
  );

  const CellWithCopy = ({ text, cellId }: { text: string; cellId: string }) => (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {text}
      <CopyButton text={text} cellId={cellId} />
    </span>
  );

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const toggleSection = (key: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedSections(newSet);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    performSearch(codeInput, uuidInput, codeMatchType, rowsPerPage);
  };

  const renderRelation = (label: string, value: any, resultId: string) => {
    if (!value) return null;

    const sectionKey = `${resultId}-${label}`;

    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return (
        <div className="mb-3">
          <button
            onClick={() => toggleSection(sectionKey)}
            className="flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            {expandedSections.has(sectionKey) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {label} ({value.length})
          </button>
          {expandedSections.has(sectionKey) && (
            <div className="mt-2 space-y-2 pl-4 border-l-2 border-blue-300">
              {value.map((item: any, idx: number) => (
                <div key={idx} className="p-2 bg-gray-100 rounded text-xs">
                  <pre>{JSON.stringify(item, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="mb-2">
        <span className="font-semibold text-gray-700">{label}:</span>
        <div className="mt-1 p-2 bg-gray-100 rounded text-xs">
          <pre>{JSON.stringify(value, null, 2)}</pre>
        </div>
      </div>
    );
  };

  const getHierarchyPath = (result: ProjectResult) => {
    const parts: string[] = [];
    const city = result.City;
    const nation = city?.Nation;
    if (nation) parts.push(nation.Title || nation.Code);
    if (city) parts.push(city.Title || city.Code);
    return parts.join(' > ');
  };

  const getClusterCount = (result: ProjectResult) => result.Clusters?.length || 0;
  const getUnitCount = (result: ProjectResult) => {
    let count = 0;
    for (const c of result.Clusters || []) {
      for (const p of c.Properties || []) {
        for (const pf of p.PropertyFloors || []) {
          count += pf.Units?.length || 0;
        }
      }
    }
    return count;
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Projects</h2>

        <div className="flex flex-col lg:flex-row gap-4 items-end mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search by Code</label>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="e.g., 'project-code'"
              minLength={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-6 pb-[2px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Match:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="exact"
                  checked={codeMatchType === 'exact'}
                  onChange={(e) => setCodeMatchType(e.target.value as 'exact' | 'ilike')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Exact</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="ilike"
                  checked={codeMatchType === 'ilike'}
                  onChange={(e) => setCodeMatchType(e.target.value as 'exact' | 'ilike')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Contains</span>
              </label>
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search by UUID</label>
            <input
              type="text"
              value={uuidInput}
              onChange={(e) => setUuidInput(e.target.value)}
              placeholder="e.g., 'uuid-1' or 'uuid-1, uuid-2'"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rows Per Page</label>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={2000}>2000</option>
              <option value={5000}>5000</option>
              <option value={10000}>10000</option>
              <option value={50000}>50000</option>
              <option value={100000}>100000</option>
            </select>
          </div>

          <div className="flex-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              <Search size={18} />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </form>

      {results.length > 0 && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Results ({results.length})</h3>
            {selectedProjects.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">{selectedProjects.size} selected</span>
                <button
                  onClick={() => {
                    const selected = results.filter((r) => selectedProjects.has(r.Id));
                    const sql = generateProjectInsertSql(selected);
                    downloadSqlFile(sql, 'project');
                  }}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                >
                  <Download size={12} /> Export SQL
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={selectedProjects.size === results.length && results.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                />
                Select All
              </label>
            </div>
          )}

          {projectUnits.length > 0 && (
            <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-col xl:flex-row xl:items-end gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">Unit SQL Generator</h4>
                    <p className="text-sm text-slate-600">
                      {selectedUnitRecords.length} of {projectUnits.length} units selected
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 flex-[3]">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">SQL Type</label>
                      <select
                        value={sqlOperation}
                        onChange={(e) => setSqlOperation(e.target.value as SqlOperation)}
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="select">Select</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">UnitStatus</label>
                      <select
                        value={unitStatus}
                        onChange={(e) => handleUnitStatusChange(e.target.value)}
                        disabled={sqlOperation !== 'update'}
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-700 disabled:opacity-100"
                      >
                        {UNIT_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700 pt-6">
                      <input
                        type="checkbox"
                        checked={targetIsVisible}
                        onChange={(e) => setTargetIsVisible(e.target.checked)}
                        disabled={sqlOperation !== 'update'}
                        className="w-4 h-4"
                      />
                      IsVisible
                    </label>

                    <label className="flex items-center gap-2 text-sm text-slate-700 pt-6">
                      <input
                        type="checkbox"
                        checked={targetIsExplorable}
                        onChange={(e) => setTargetIsExplorable(e.target.checked)}
                        disabled={sqlOperation !== 'update'}
                        className="w-4 h-4"
                      />
                      IsExplorable
                    </label>

                    <button
                      type="button"
                      onClick={generateUnitSql}
                      disabled={selectedUnitRecords.length === 0}
                      className="mt-5 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                    >
                      Generate SQL
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Search Units</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={unitSearchInput}
                        onChange={(e) => setUnitSearchInput(e.target.value)}
                        placeholder="Unit number, status, property, floor..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="w-full lg:w-40">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Units Per Page</label>
                    <select
                      value={unitRowsPerPage}
                      onChange={(e) => setUnitRowsPerPage(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectUnits(paginatedProjectUnits, paginatedProjectUnits.some((unit) => !selectedUnits.has(unit.Id)))}
                      disabled={paginatedProjectUnits.length === 0}
                      className="px-3 py-2 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                    >
                      {paginatedProjectUnits.length > 0 && paginatedProjectUnits.every((unit) => selectedUnits.has(unit.Id)) ? 'Clear Page' : 'Select Page'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectUnits(filteredProjectUnits, filteredProjectUnits.some((unit) => !selectedUnits.has(unit.Id)))}
                      disabled={filteredProjectUnits.length === 0}
                      className="px-3 py-2 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                    >
                      {filteredProjectUnits.length > 0 && filteredProjectUnits.every((unit) => selectedUnits.has(unit.Id)) ? 'Clear Filtered' : 'Select Filtered'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <p className="text-xs text-slate-600">
                    Showing {filteredProjectUnits.length === 0 ? 0 : ((unitPage - 1) * unitRowsPerPage) + 1}
                    -{Math.min(unitPage * unitRowsPerPage, filteredProjectUnits.length)} of {filteredProjectUnits.length} units
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUnitPage((page) => Math.max(1, page - 1))}
                      disabled={unitPage === 1}
                      className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-medium text-slate-600">
                      Page {unitPage} of {unitTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUnitPage((page) => Math.min(unitTotalPages, page + 1))}
                      disabled={unitPage === unitTotalPages}
                      className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="overflow-auto border border-slate-200 rounded">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="w-10 px-3 py-2 text-left"></th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">UnitNumber</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Visible</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Explorable</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Project</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paginatedProjectUnits.map((unit) => (
                        <tr key={unit.Id} className={selectedUnits.has(unit.Id) ? 'bg-blue-50' : ''}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedUnits.has(unit.Id)}
                              onChange={(e) => handleSelectUnit(unit.Id, e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-700">
                            <CellWithCopy text={unit.UnitNumber || '-'} cellId={`unit-picker-number-${unit.Id}`} />
                          </td>
                          <td className="px-3 py-2 text-slate-700">{unit.UnitStatus || '-'}</td>
                          <td className="px-3 py-2 text-slate-700">{unit.IsVisible ? 'Yes' : 'No'}</td>
                          <td className="px-3 py-2 text-slate-700">{unit.IsExplorable ? 'Yes' : 'No'}</td>
                          <td className="px-3 py-2 text-slate-700">{unit.projectTitle}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {[unit.clusterTitle, unit.propertyTitle, unit.floorTitle].filter(Boolean).join(' / ')}
                          </td>
                        </tr>
                      ))}

                      {paginatedProjectUnits.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                            No units match the current search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {(currentSql || previousSqls.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-white">
                  {currentSql && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-slate-900">Current SQL</h5>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(currentSql, 'current-unit-sql')}
                            className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors flex items-center gap-1"
                          >
                            {copiedCell === 'current-unit-sql' ? <Check size={12} /> : <Copy size={12} />}
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadSqlFile(currentSql, `unit_${sqlOperation}`)}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                          >
                            <Download size={12} />
                            Download
                          </button>
                        </div>
                      </div>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-3 text-xs text-slate-100">{currentSql}</pre>
                    </div>
                  )}

                  {previousSqls.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-slate-900 mb-2">Previous SQL</h5>
                      <div className="space-y-3 max-h-72 overflow-auto">
                        {previousSqls.map((sql, index) => (
                          <div key={`${index}-${sql.length}`} className="rounded border border-slate-200">
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                              <span className="text-xs font-medium text-slate-600">Previous #{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(sql, `previous-unit-sql-${index}`)}
                                className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors flex items-center gap-1"
                              >
                                {copiedCell === `previous-unit-sql-${index}` ? <Check size={12} /> : <Copy size={12} />}
                                Copy
                              </button>
                            </div>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-3 text-xs text-slate-100">{sql}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {results.map((result) => (
              <div key={result.Id} className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedProjects.has(result.Id)}
                    onChange={(e) => handleSelectProject(result.Id, e.target.checked)}
                    className="w-4 h-4"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={() => toggleExpanded(result.Id)}
                    className="flex-1 flex items-center gap-3 transition-colors"
                  >
                    {expandedIds.has(result.Id) ? (
                      <ChevronDown size={20} className="text-gray-600" />
                    ) : (
                      <ChevronRight size={20} className="text-gray-600" />
                    )}

                    <div className="flex-1 text-left">
                      <h4 className="font-semibold text-gray-900">{result.Title || 'Untitled'}</h4>
                      <p className="text-sm text-gray-600">
                        Code: {result.Code} | ID: {result.Id.substring(0, 8)}...
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{getHierarchyPath(result)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${result.IsVisible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {result.IsVisible ? 'Visible' : 'Hidden'}
                      </span>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
                        {getClusterCount(result)} Clusters
                      </span>
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                        {getUnitCount(result)} Units
                      </span>
                    </div>
                  </button>
                </div>

                {expandedIds.has(result.Id) && (
                  <div className="p-4 bg-white space-y-4 border-t border-gray-300">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700">ID:</span>
                        <p className="font-mono text-gray-600 break-all">
                          <CellWithCopy text={result.Id} cellId={`proj-id-${result.Id}`} />
                        </p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Code:</span>
                        <p className="text-gray-600"><CellWithCopy text={result.Code} cellId={`proj-code-${result.Id}`} /></p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Title:</span>
                        <p className="text-gray-600">{result.Title || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">MulesoftCode:</span>
                        <p className="text-gray-600"><CellWithCopy text={result.MulesoftCode || '-'} cellId={`proj-mule-${result.Id}`} /></p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">CommunityKey:</span>
                        <p className="text-gray-600"><CellWithCopy text={result.CommunityKey || '-'} cellId={`proj-ck-${result.Id}`} /></p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">IsVisible:</span>
                        <p className="text-gray-600">{result.IsVisible ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">IsExplorable:</span>
                        <p className="text-gray-600">{result.IsExplorable ? 'Yes' : 'No'}</p>
                      </div>
                    </div>

                    {flattenProjectUnits(result).length > 0 && (
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <h5 className="font-semibold text-gray-900">Units</h5>
                          <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={flattenProjectUnits(result).every((unit) => selectedUnits.has(unit.Id))}
                              onChange={(e) => handleSelectProjectUnits(result, e.target.checked)}
                              className="w-4 h-4"
                            />
                            Select project units
                          </label>
                        </div>
                        <div className="overflow-auto border border-slate-200 rounded">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="w-10 px-3 py-2 text-left"></th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-700">UnitNumber</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-700">Visible</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-700">Explorable</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-700">Location</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {flattenProjectUnits(result).map((unit) => (
                                <tr key={unit.Id} className={selectedUnits.has(unit.Id) ? 'bg-blue-50' : ''}>
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedUnits.has(unit.Id)}
                                      onChange={(e) => handleSelectUnit(unit.Id, e.target.checked)}
                                      className="w-4 h-4"
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs text-slate-700">
                                    <CellWithCopy text={unit.UnitNumber || '-'} cellId={`unit-number-${unit.Id}`} />
                                  </td>
                                  <td className="px-3 py-2 text-slate-700">{unit.UnitStatus || '-'}</td>
                                  <td className="px-3 py-2 text-slate-700">{unit.IsVisible ? 'Yes' : 'No'}</td>
                                  <td className="px-3 py-2 text-slate-700">{unit.IsExplorable ? 'Yes' : 'No'}</td>
                                  <td className="px-3 py-2 text-xs text-slate-600">
                                    {[unit.clusterTitle, unit.propertyTitle, unit.floorTitle].filter(Boolean).join(' / ')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <h5 className="font-semibold text-gray-900 mb-3">Relations</h5>
                      <div className="space-y-3">
                        {renderRelation('ViewConfig', result.ViewConfig, result.Id)}
                        {renderRelation('City', result.City, result.Id)}
                        {renderRelation('Clusters', result.Clusters, result.Id)}
                        {renderRelation('Amenities', result.Amenities, result.Id)}
                        {renderRelation('CacheInfo', result.CacheInfo, result.Id)}
                        {renderRelation('ProjectSalesLeadInfo', result.ProjectSalesLeadInfo, result.Id)}
                        {renderRelation('VariantInfo', result.VariantInfo, result.Id)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !error && !loading && (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-blue-800">Use the search form above to find Project records</p>
        </div>
      )}
    </div>
  );
}
