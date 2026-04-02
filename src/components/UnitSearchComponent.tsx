'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Search, Copy, Check, Download } from 'lucide-react';
import { generateUnitInsertSql, downloadSqlFile } from '@/lib/sqlExportUtils';

interface UnitResult {
  Id: string;
  Code: string;
  Title: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  UnitType: string;
  UnitStatus: string;
  UnitCategory: string;
  FeatureSpecification: string;
  IsPremium: boolean;
  SaleableArea: string;
  BalconyArea: string;
  PlotArea: string;
  PaymentPlan: string;
  Price: string;
  OnlineStatus: boolean;
  LocationId: string;
  DownPaymentPercentage: number;
  DisableUnit: boolean;
  ClusterName: string;
  BedroomCount: number;
  BathroomCount: number;
  UnitNumber: string;
  Plex: string;
  Mirror: string;
  DefaultFloor: string;
  FloorsOccupied: string;
  NorthBearing: string;
  IsFurnished: boolean;
  SalesAgentId: string;
  HasInterior: boolean;
  HasFloorplan: boolean;
  DisplayName: string;
  IsShowHome: boolean;
  HasUniqueView: boolean;
  EnableForKiosk: boolean;
  UnitVariantId: string;
  PropertyFloorId: string;
  ViewConfigs: any[];
  UnitVariant: any;
  PropertyFloor: any;
}

export function UnitSearchComponent() {
  const searchParams = useSearchParams();

  const [unitNumberInput, setUnitNumberInput] = useState('');
  const [uuidInput, setUuidInput] = useState('');
  const [codeMatchType, setCodeMatchType] = useState<'ilike' | 'exact'>('exact');
  const [rowsPerPage, setRowsPerPage] = useState<number>(1000);
  const [results, setResults] = useState<UnitResult[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  useEffect(() => {
    const unitNumber = searchParams.get('unitNumber') || '';
    const uuid = searchParams.get('uuid') || '';
    const matchType = (searchParams.get('matchType') as 'ilike' | 'exact') || 'exact';

    setUnitNumberInput(unitNumber);
    setUuidInput(uuid);
    setCodeMatchType(matchType);

    if (unitNumber || uuid) {
      performSearch(unitNumber, uuid, matchType, rowsPerPage);
    }
  }, [searchParams]);

  const updateURL = (unitNumber: string, uuid: string, matchType: string) => {
    const params = new URLSearchParams();
    if (unitNumber) params.append('unitNumber', unitNumber);
    if (uuid) params.append('uuid', uuid);
    if (matchType) params.append('matchType', matchType);
    const queryString = params.toString();
    window.history.replaceState(null, '', queryString ? `?${queryString}` : '/unit-search');
  };

  const performSearch = async (unitNumber: string, uuid: string, matchType: string, rowsPerPage: number) => {
    if (!unitNumber && !uuid) {
      setError('Please enter a unit number or UUID to search');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedUnits(new Set());

    try {
      const params = new URLSearchParams();
      if (unitNumber) {
        params.append('code', unitNumber);
        params.append('codeMatchType', matchType);
      }
      if (uuid) params.append('uuid', uuid);
      params.append('limit', String(rowsPerPage));

      const response = await fetch(`/api/unit/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.data || []);
      if (data.data?.length === 0) {
        setError('No results found');
      }

      updateURL(unitNumber, uuid, matchType);
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

  const handleSelectUnit = (unitId: string, checked: boolean) => {
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (checked) next.add(unitId);
      else next.delete(unitId);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUnits(new Set(results.map((r) => r.Id)));
    } else {
      setSelectedUnits(new Set());
    }
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
    performSearch(unitNumberInput, uuidInput, codeMatchType, rowsPerPage);
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

  const getHierarchyPath = (result: UnitResult) => {
    const parts: string[] = [];
    const prop = result.PropertyFloor?.Property;
    const cluster = prop?.Cluster;
    const project = cluster?.Project;
    const city = project?.City;
    const nation = city?.Nation;
    if (nation) parts.push(nation.Title || nation.Code);
    if (city) parts.push(city.Title || city.Code);
    if (project) parts.push(project.Title || project.Code);
    if (cluster) parts.push(cluster.Title || cluster.Code);
    if (prop) parts.push(prop.Title || prop.Code);
    if (result.PropertyFloor) parts.push(result.PropertyFloor.Title || result.PropertyFloor.Code);
    return parts.join(' > ');
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Units</h2>

        <div className="flex flex-col lg:flex-row gap-4 items-end mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search by Unit Number</label>
            <input
              type="text"
              value={unitNumberInput}
              onChange={(e) => setUnitNumberInput(e.target.value)}
              placeholder="e.g., 'A-101'"
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
            {selectedUnits.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">{selectedUnits.size} selected</span>
                <button
                  onClick={() => {
                    const selected = results.filter((r) => selectedUnits.has(r.Id));
                    const sql = generateUnitInsertSql(selected);
                    downloadSqlFile(sql, 'unit');
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
                  checked={selectedUnits.size === results.length && results.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                />
                Select All
              </label>
            </div>
          )}

          <div className="space-y-3">
            {results.map((result) => (
              <div key={result.Id} className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedUnits.has(result.Id)}
                    onChange={(e) => handleSelectUnit(result.Id, e.target.checked)}
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
                      <h4 className="font-semibold text-gray-900">{result.Title || result.DisplayName || 'Untitled'}</h4>
                      <p className="text-sm text-gray-600">
                        Code: {result.Code} | ID: {result.Id.substring(0, 8)}... | Unit#: {result.UnitNumber || '-'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{getHierarchyPath(result)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${result.IsVisible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {result.IsVisible ? 'Visible' : 'Hidden'}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${result.OnlineStatus ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {result.OnlineStatus ? 'Online' : 'Offline'}
                      </span>
                      {result.IsPremium && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">Premium</span>
                      )}
                    </div>
                  </button>
                </div>

                {expandedIds.has(result.Id) && (
                  <div className="p-4 bg-white space-y-4 border-t border-gray-300">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700">ID:</span>
                        <p className="font-mono text-gray-600 break-all">
                          <CellWithCopy text={result.Id} cellId={`unit-id-${result.Id}`} />
                        </p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Code:</span>
                        <p className="text-gray-600"><CellWithCopy text={result.Code} cellId={`unit-code-${result.Id}`} /></p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Title:</span>
                        <p className="text-gray-600">{result.Title || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">DisplayName:</span>
                        <p className="text-gray-600">{result.DisplayName || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">UnitNumber:</span>
                        <p className="text-gray-600">{result.UnitNumber || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">UnitType:</span>
                        <p className="text-gray-600">{result.UnitType || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">UnitStatus:</span>
                        <p className="text-gray-600">{result.UnitStatus || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">UnitCategory:</span>
                        <p className="text-gray-600">{result.UnitCategory || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Bedrooms:</span>
                        <p className="text-gray-600">{result.BedroomCount}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Bathrooms:</span>
                        <p className="text-gray-600">{result.BathroomCount}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Price:</span>
                        <p className="text-gray-600">{result.Price || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">SaleableArea:</span>
                        <p className="text-gray-600">{result.SaleableArea || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">BalconyArea:</span>
                        <p className="text-gray-600">{result.BalconyArea || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">PlotArea:</span>
                        <p className="text-gray-600">{result.PlotArea || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">DownPayment%:</span>
                        <p className="text-gray-600">{result.DownPaymentPercentage}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">PaymentPlan:</span>
                        <p className="text-gray-600">{result.PaymentPlan || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Plex:</span>
                        <p className="text-gray-600">{result.Plex || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Mirror:</span>
                        <p className="text-gray-600">{result.Mirror || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">DefaultFloor:</span>
                        <p className="text-gray-600">{result.DefaultFloor || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">FloorsOccupied:</span>
                        <p className="text-gray-600">{result.FloorsOccupied || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">IsPremium:</span>
                        <p className="text-gray-600">{result.IsPremium ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">IsFurnished:</span>
                        <p className="text-gray-600">{result.IsFurnished ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">HasInterior:</span>
                        <p className="text-gray-600">{result.HasInterior ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">HasFloorplan:</span>
                        <p className="text-gray-600">{result.HasFloorplan ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">IsShowHome:</span>
                        <p className="text-gray-600">{result.IsShowHome ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">EnableForKiosk:</span>
                        <p className="text-gray-600">{result.EnableForKiosk ? 'Yes' : 'No'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">ClusterName:</span>
                        <p className="text-gray-600">{result.ClusterName || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">DisableUnit:</span>
                        <p className="text-gray-600">{result.DisableUnit ? 'Yes' : 'No'}</p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h5 className="font-semibold text-gray-900 mb-3">Relations</h5>
                      <div className="space-y-3">
                        {renderRelation('ViewConfigs', result.ViewConfigs, result.Id)}
                        {renderRelation('UnitVariant', result.UnitVariant, result.Id)}
                        {renderRelation('PropertyFloor', result.PropertyFloor, result.Id)}
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
          <p className="text-blue-800">Use the search form above to find Unit records</p>
        </div>
      )}
    </div>
  );
}
