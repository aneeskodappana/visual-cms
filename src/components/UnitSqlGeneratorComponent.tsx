'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Copy, Download, FolderSearch, Link2, Search } from 'lucide-react';
import { downloadSqlFile } from '@/lib/sqlExportUtils';
import {
  SqlOperation,
  UNIT_STATUS_OPTIONS,
  FlatUnitRecord,
  buildUnitLookupAliases,
  buildUnitSql,
  dedupeFlatUnits,
  flattenProjectUnits,
  mapUnitSearchResultToFlatUnit,
  resolveUnitLookupFromUrl,
} from '@/lib/unitSqlGeneratorUtils';

interface ProjectSearchResult {
  Id: string;
  Code: string;
  Title?: string;
  Clusters?: any[];
}

type SearchMode = 'project' | 'unit' | 'url';

const SQL_HISTORY_LIMIT = 5;

function buildUnitSearchParams(options: {
  code?: string;
  uuid?: string;
  matchType?: 'exact' | 'ilike';
  projectCode?: string;
  furnished?: boolean | null;
  limit: number;
}) {
  const params = new URLSearchParams();
  if (options.code) params.set('code', options.code);
  if (options.uuid) params.set('uuid', options.uuid);
  if (options.matchType) params.set('codeMatchType', options.matchType);
  if (options.projectCode) params.set('projectCode', options.projectCode);
  if (options.furnished != null) params.set('furnished', String(options.furnished));
  params.set('limit', String(options.limit));
  return params;
}

export function UnitSqlGeneratorComponent() {
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);
  const selectedUnitIdsRef = useRef<Set<string>>(new Set());

  const [searchMode, setSearchMode] = useState<SearchMode>('project');
  const [projectCodeInput, setProjectCodeInput] = useState('');
  const [projectUuidInput, setProjectUuidInput] = useState('');
  const [unitQueryInput, setUnitQueryInput] = useState('');
  const [unitUuidInput, setUnitUuidInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [matchType, setMatchType] = useState<'exact' | 'ilike'>('exact');
  const [rowsPerPage, setRowsPerPage] = useState<number>(1000);

  const [units, setUnits] = useState<FlatUnitRecord[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [currentSql, setCurrentSql] = useState('');
  const [previousSqls, setPreviousSqls] = useState<string[]>([]);
  const [sqlOperation, setSqlOperation] = useState<SqlOperation>('update');
  const [unitStatus, setUnitStatus] = useState('Available');
  const [targetIsVisible, setTargetIsVisible] = useState(true);
  const [targetIsExplorable, setTargetIsExplorable] = useState(true);
  const [unitFilterInput, setUnitFilterInput] = useState('');
  const [unitRowsPerPage, setUnitRowsPerPage] = useState(25);
  const [unitPage, setUnitPage] = useState(1);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchSummary, setSearchSummary] = useState('');
  const [resolvedUrlLookup, setResolvedUrlLookup] = useState<ReturnType<typeof resolveUnitLookupFromUrl> | null>(null);

  const modeConfig = {
    project: {
      title: 'Project Search',
      subtitle: 'Load all units under one project, then filter and generate SQL from the picker.',
      primaryLabel: 'Project Code',
      primaryPlaceholder: 'e.g. wimbledonbridgehouse',
      primaryHint: 'Best when you need bulk status changes across one project.',
      actionLabel: 'Search Project',
    },
    unit: {
      title: 'Unit Search',
      subtitle: 'Search by raw unit number, normalized alias, or UUID.',
      primaryLabel: 'Unit Number or Alias',
      primaryPlaceholder: 'e.g. RivieraHouse-01-02 or twickenhamsquare_rivierahouse_01_02',
      primaryHint: 'Alias search works with project_property_floor_unit patterns.',
      actionLabel: 'Search Unit',
    },
    url: {
      title: 'URL Search',
      subtitle: 'Paste an Aldar property URL and extract the target unit automatically.',
      primaryLabel: 'Property URL',
      primaryPlaceholder:
        'https://world.aldar.com/uk/london/twickenhamsquare/property/RivieraHouse-01-02/0?unitstate=floorplan&scheme=S1&furnished=true',
      primaryHint: 'Project code, unit number, and furnished flag are derived from the URL.',
      actionLabel: 'Resolve URL',
    },
  } as const;

  const updateSelectedUnitIds = (getNext: (current: Set<string>) => Set<string>) => {
    const next = getNext(selectedUnitIdsRef.current);
    selectedUnitIdsRef.current = next;
    setSelectedUnitIds(next);
  };

  const resetSelections = () => {
    selectedUnitIdsRef.current = new Set();
    setSelectedUnitIds(new Set());
  };

  const copyToClipboard = (text: string, cellId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(cellId);
    window.setTimeout(() => setCopiedCell(null), 1500);
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

  const updateBrowserUrl = (mode: SearchMode, values: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set('mode', mode);

    for (const [key, value] of Object.entries(values)) {
      if (value) {
        params.set(key, value);
      }
    }

    params.set('matchType', matchType);
    params.set('limit', String(rowsPerPage));

    const queryString = params.toString();
    window.history.replaceState(null, '', queryString ? `/unit-sql-generator?${queryString}` : '/unit-sql-generator');
  };

  const fetchUnitResults = async (params: URLSearchParams) => {
    const response = await fetch(`/api/unit/search?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unit search failed');
    }

    return (data.data || []).map(mapUnitSearchResultToFlatUnit) as FlatUnitRecord[];
  };

  const runProjectSearch = async (code: string, uuid: string, match: 'exact' | 'ilike', limit: number) => {
    if (!code && !uuid) {
      setError('Enter a project code or UUID before searching');
      return;
    }

    setLoading(true);
    setError(null);
    setResolvedUrlLookup(null);

    try {
      const params = new URLSearchParams();
      if (code) {
        params.set('code', code);
        params.set('codeMatchType', match);
      }
      if (uuid) {
        params.set('uuid', uuid);
      }
      params.set('limit', String(limit));

      const response = await fetch(`/api/project/search?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Project search failed');
      }

      const projectResults = (data.data || []) as ProjectSearchResult[];
      const flatUnits = dedupeFlatUnits(projectResults.flatMap(flattenProjectUnits));

      setUnits(flatUnits);
      resetSelections();
      setSearchSummary(
        flatUnits.length > 0
          ? `${flatUnits.length} units from ${projectResults.length} matching project${projectResults.length === 1 ? '' : 's'}`
          : 'No matching units found'
      );
      updateBrowserUrl('project', {
        projectCode: code,
        projectUuid: uuid,
      });
    } catch (err) {
      setUnits([]);
      resetSelections();
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const runUnitSearch = async (
    query: string,
    uuid: string,
    match: 'exact' | 'ilike',
    limit: number,
    extra?: { projectCode?: string; furnished?: boolean | null; updateUrl?: boolean }
  ) => {
    if (!query && !uuid) {
      setError('Enter a unit number, alias, or UUID before searching');
      return;
    }

    setLoading(true);
    setError(null);
    setResolvedUrlLookup(null);

    try {
      const params = buildUnitSearchParams({
        code: query,
        uuid,
        matchType: match,
        projectCode: extra?.projectCode,
        furnished: extra?.furnished ?? null,
        limit,
      });
      const unitResults = dedupeFlatUnits(await fetchUnitResults(params));

      setUnits(unitResults);
      resetSelections();
      setSearchSummary(
        unitResults.length > 0
          ? `${unitResults.length} matching unit${unitResults.length === 1 ? '' : 's'}`
          : 'No matching units found'
      );

      if (extra?.updateUrl !== false) {
        updateBrowserUrl('unit', {
          unitQuery: query,
          unitUuid: uuid,
        });
      }
    } catch (err) {
      setUnits([]);
      resetSelections();
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const runUrlSearch = async (input: string, limit: number) => {
    const lookup = resolveUnitLookupFromUrl(input);
    setResolvedUrlLookup(lookup);

    if (!lookup.supported) {
      setUnits([]);
      resetSelections();
      setError(lookup.reason || 'Unsupported URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [aliasResults, fallbackResults] = await Promise.all([
        fetchUnitResults(
          buildUnitSearchParams({
            code: lookup.normalizedLookup,
            matchType: 'exact',
            projectCode: lookup.projectCode,
            furnished: lookup.furnished,
            limit,
          })
        ),
        fetchUnitResults(
          buildUnitSearchParams({
            code: lookup.unitNumber,
            matchType: 'ilike',
            projectCode: lookup.projectCode,
            furnished: lookup.furnished,
            limit,
          })
        ),
      ]);

      const mergedResults = dedupeFlatUnits([...aliasResults, ...fallbackResults]);
      setUnits(mergedResults);
      resetSelections();
      setSearchSummary(
        mergedResults.length > 0
          ? `${mergedResults.length} matching unit${mergedResults.length === 1 ? '' : 's'} from URL lookup`
          : 'No matching units found for the provided URL'
      );

      updateBrowserUrl('url', {
        lookupUrl: input,
      });
    } catch (err) {
      setUnits([]);
      resetSelections();
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const mode = (searchParams.get('mode') as SearchMode) || 'project';
    const nextMatchType = (searchParams.get('matchType') as 'exact' | 'ilike') || 'exact';
    const nextLimit = Number(searchParams.get('limit') || 1000);
    const nextProjectCode = searchParams.get('projectCode') || '';
    const nextProjectUuid = searchParams.get('projectUuid') || '';
    const nextUnitQuery = searchParams.get('unitQuery') || '';
    const nextUnitUuid = searchParams.get('unitUuid') || '';
    const nextLookupUrl = searchParams.get('lookupUrl') || '';

    setSearchMode(mode);
    setMatchType(nextMatchType);
    setRowsPerPage(Number.isFinite(nextLimit) && nextLimit > 0 ? nextLimit : 1000);
    setProjectCodeInput(nextProjectCode);
    setProjectUuidInput(nextProjectUuid);
    setUnitQueryInput(nextUnitQuery);
    setUnitUuidInput(nextUnitUuid);
    setUrlInput(nextLookupUrl);

    if (mode === 'project' && (nextProjectCode || nextProjectUuid)) {
      void runProjectSearch(nextProjectCode, nextProjectUuid, nextMatchType, nextLimit);
    } else if (mode === 'unit' && (nextUnitQuery || nextUnitUuid)) {
      void runUnitSearch(nextUnitQuery, nextUnitUuid, nextMatchType, nextLimit);
    } else if (mode === 'url' && nextLookupUrl) {
      void runUrlSearch(nextLookupUrl, nextLimit);
    }
  }, [searchParams]);

  const filteredUnits = useMemo(() => {
    const query = unitFilterInput.trim().toLowerCase();
    if (!query) return units;

    return units.filter((unit) => {
      const searchableText = [
        unit.UnitNumber,
        unit.Code,
        unit.DisplayName,
        unit.Title,
        unit.UnitStatus,
        unit.projectCode,
        unit.projectTitle,
        unit.clusterTitle,
        unit.propertyCode,
        unit.propertyTitle,
        unit.floorCode,
        unit.floorTitle,
        ...buildUnitLookupAliases(unit),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [unitFilterInput, units]);

  const unitTotalPages = Math.max(1, Math.ceil(filteredUnits.length / unitRowsPerPage));

  useEffect(() => {
    setUnitPage(1);
  }, [unitFilterInput, unitRowsPerPage, units.length]);

  useEffect(() => {
    if (unitPage > unitTotalPages) {
      setUnitPage(unitTotalPages);
    }
  }, [unitPage, unitTotalPages]);

  const paginatedUnits = useMemo(() => {
    const start = (unitPage - 1) * unitRowsPerPage;
    return filteredUnits.slice(start, start + unitRowsPerPage);
  }, [filteredUnits, unitPage, unitRowsPerPage]);

  const selectedUnitRecords = useMemo(
    () => units.filter((unit) => selectedUnitIds.has(unit.Id)),
    [selectedUnitIds, units]
  );

  const activeModeConfig = modeConfig[searchMode];

  const handleSelectUnit = (unitId: string, checked: boolean) => {
    updateSelectedUnitIds((current) => {
      const next = new Set(current);
      if (checked) next.add(unitId);
      else next.delete(unitId);
      return next;
    });
  };

  const handleSelectUnits = (targetUnits: FlatUnitRecord[], checked: boolean) => {
    updateSelectedUnitIds((current) => {
      const next = new Set(current);
      for (const unit of targetUnits) {
        if (checked) next.add(unit.Id);
        else next.delete(unit.Id);
      }
      return next;
    });
  };

  const generateSql = () => {
    const latestSelectedUnits = units.filter((unit) => selectedUnitIdsRef.current.has(unit.Id));

    if (latestSelectedUnits.length === 0) {
      setError('Select at least one unit before generating SQL');
      return;
    }

    const nextSql = buildUnitSql(latestSelectedUnits, {
      sqlOperation,
      unitStatus,
      isVisible: targetIsVisible,
      isExplorable: targetIsExplorable,
    });

    if (currentSql) {
      setPreviousSqls((previous) => [currentSql, ...previous].slice(0, SQL_HISTORY_LIMIT));
    }

    setCurrentSql(nextSql);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Utilities</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Unit SQL Generator</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Search units from projects, direct unit identifiers, or Aldar property URLs. Then generate update, delete, or select SQL with selection history.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Source</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{activeModeConfig.title}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Matches</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{units.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Selected</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{selectedUnitRecords.length}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Search Source</p>
              <div className="inline-flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 sm:w-auto sm:flex-row">
                {[
                  { key: 'project', label: 'Project', icon: FolderSearch },
                  { key: 'unit', label: 'Unit', icon: Search },
                  { key: 'url', label: 'URL', icon: Link2 },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSearchMode(key as SearchMode);
                      setError(null);
                    }}
                    className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      searchMode === key
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-950'
                    }`}
                  >
                    <Icon size={16} className={searchMode === key ? 'text-white' : 'text-slate-400'} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{activeModeConfig.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{activeModeConfig.subtitle}</p>
              </div>
              <div className="max-w-xl rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {activeModeConfig.primaryHint}
              </div>
            </div>

            <div className="space-y-4">
              {(searchMode === 'project' || searchMode === 'unit') && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                  <div className="md:col-span-2 xl:col-span-4">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {activeModeConfig.primaryLabel}
                    </label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchMode === 'project' ? projectCodeInput : unitQueryInput}
                        onChange={(event) =>
                          searchMode === 'project'
                            ? setProjectCodeInput(event.target.value)
                            : setUnitQueryInput(event.target.value)
                        }
                        placeholder={activeModeConfig.primaryPlaceholder}
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="xl:col-span-3">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">UUID</label>
                    <input
                      type="text"
                      value={searchMode === 'project' ? projectUuidInput : unitUuidInput}
                      onChange={(event) =>
                        searchMode === 'project'
                          ? setProjectUuidInput(event.target.value)
                          : setUnitUuidInput(event.target.value)
                      }
                      placeholder="uuid-1, uuid-2"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Match</label>
                    <select
                      value={matchType}
                      onChange={(event) => setMatchType(event.target.value as 'exact' | 'ilike')}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="exact">Exact</option>
                      <option value="ilike">Contains</option>
                    </select>
                  </div>

                  <div className="xl:col-span-1">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Rows</label>
                    <select
                      value={rowsPerPage}
                      onChange={(event) => setRowsPerPage(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                      <option value={2000}>2000</option>
                      <option value={5000}>5000</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 xl:col-span-2 xl:flex xl:items-end">
                    <button
                      type="button"
                      onClick={() =>
                        searchMode === 'project'
                          ? void runProjectSearch(projectCodeInput.trim(), projectUuidInput.trim(), matchType, rowsPerPage)
                          : void runUnitSearch(unitQueryInput.trim(), unitUuidInput.trim(), matchType, rowsPerPage)
                      }
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
                    >
                      <Search size={16} />
                      {loading ? 'Searching...' : activeModeConfig.actionLabel}
                    </button>
                  </div>
                </div>
              )}

              {searchMode === 'url' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                  <div className="md:col-span-2 xl:col-span-8">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {activeModeConfig.primaryLabel}
                    </label>
                    <div className="relative">
                      <Link2 size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <textarea
                        value={urlInput}
                        onChange={(event) => setUrlInput(event.target.value)}
                        placeholder={activeModeConfig.primaryPlaceholder}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Rows</label>
                    <select
                      value={rowsPerPage}
                      onChange={(event) => setRowsPerPage(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={25}>25</option>
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 xl:col-span-2 xl:flex xl:items-end">
                    <button
                      type="button"
                      onClick={() => void runUrlSearch(urlInput.trim(), rowsPerPage)}
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
                    >
                      <Search size={16} />
                      {loading ? 'Searching...' : activeModeConfig.actionLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {resolvedUrlLookup?.supported && (
            <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 md:grid-cols-2 xl:grid-cols-4">
              <p><span className="font-semibold">Project:</span> {resolvedUrlLookup.projectCode}</p>
              <p><span className="font-semibold">Unit:</span> {resolvedUrlLookup.unitNumber}</p>
              <p><span className="font-semibold">Lookup ID:</span> <span className="font-mono text-xs">{resolvedUrlLookup.normalizedLookup}</span></p>
              <p><span className="font-semibold">URL flags:</span> {[resolvedUrlLookup.unitState || 'state n/a', resolvedUrlLookup.scheme || 'scheme n/a', resolvedUrlLookup.furnished == null ? 'furnished n/a' : `furnished=${resolvedUrlLookup.furnished}`].join(' | ')}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>

      {units.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Selected Units</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedUnitRecords.length} of {units.length} units selected
                  {searchSummary ? ` • ${searchSummary}` : ''}
                </p>
              </div>

              <div className="grid flex-[3] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">SQL Type</label>
                  <select
                    value={sqlOperation}
                    onChange={(event) => setSqlOperation(event.target.value as SqlOperation)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                    <option value="select">Select</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">UnitStatus</label>
                  <select
                    value={unitStatus}
                    onChange={(event) => handleUnitStatusChange(event.target.value)}
                    disabled={sqlOperation !== 'update'}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-700 disabled:opacity-100"
                  >
                    {UNIT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={targetIsVisible}
                    onChange={(event) => setTargetIsVisible(event.target.checked)}
                    disabled={sqlOperation !== 'update'}
                    className="h-4 w-4"
                  />
                  IsVisible
                </label>

                <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={targetIsExplorable}
                    onChange={(event) => setTargetIsExplorable(event.target.checked)}
                    disabled={sqlOperation !== 'update'}
                    className="h-4 w-4"
                  />
                  IsExplorable
                </label>

                <button
                  type="button"
                  onClick={generateSql}
                  disabled={selectedUnitRecords.length === 0}
                  className="mt-5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
                >
                  Generate SQL
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">Filter Units</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={unitFilterInput}
                    onChange={(event) => setUnitFilterInput(event.target.value)}
                    placeholder="Unit number, alias, project, property, floor, status..."
                    className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="w-full lg:w-40">
                <label className="mb-1 block text-xs font-medium text-slate-600">Units Per Page</label>
                <select
                  value={unitRowsPerPage}
                  onChange={(event) => setUnitRowsPerPage(Number(event.target.value))}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
                  onClick={() =>
                    handleSelectUnits(
                      paginatedUnits,
                      paginatedUnits.some((unit) => !selectedUnitIds.has(unit.Id))
                    )
                  }
                  disabled={paginatedUnits.length === 0}
                  className="rounded bg-slate-100 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {paginatedUnits.length > 0 && paginatedUnits.every((unit) => selectedUnitIds.has(unit.Id))
                    ? 'Clear Page'
                    : 'Select Page'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectUnits(
                      filteredUnits,
                      filteredUnits.some((unit) => !selectedUnitIds.has(unit.Id))
                    )
                  }
                  disabled={filteredUnits.length === 0}
                  className="rounded bg-slate-100 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {filteredUnits.length > 0 && filteredUnits.every((unit) => selectedUnitIds.has(unit.Id))
                    ? 'Clear Filtered'
                    : 'Select Filtered'}
                </button>
              </div>
            </div>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-600">
                Showing {filteredUnits.length === 0 ? 0 : (unitPage - 1) * unitRowsPerPage + 1}
                -{Math.min(unitPage * unitRowsPerPage, filteredUnits.length)} of {filteredUnits.length} units
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnitPage((page) => Math.max(1, page - 1))}
                  disabled={unitPage === 1}
                  className="rounded bg-slate-100 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
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
                  className="rounded bg-slate-100 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="overflow-auto rounded border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-10 px-3 py-2 text-left" />
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">UnitNumber</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Visible</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Explorable</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Furnished</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Project</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedUnits.map((unit) => (
                    <tr key={unit.Id} className={selectedUnitIds.has(unit.Id) ? 'bg-blue-50' : ''}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedUnitIds.has(unit.Id)}
                          onChange={(event) => handleSelectUnit(unit.Id, event.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          {unit.UnitNumber || '-'}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(unit.UnitNumber || '-', `unit-${unit.Id}`)}
                            className="rounded p-0.5 hover:bg-slate-200"
                            title="Copy unit number"
                          >
                            {copiedCell === `unit-${unit.Id}` ? (
                              <Check size={12} className="text-green-600" />
                            ) : (
                              <Copy size={12} className="text-slate-500" />
                            )}
                          </button>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{unit.UnitStatus || '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{unit.IsVisible ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 text-slate-700">{unit.IsExplorable ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 text-slate-700">{unit.IsFurnished ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 text-slate-700">{unit.projectTitle}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {[unit.clusterTitle, unit.propertyTitle, unit.floorTitle].filter(Boolean).join(' / ')}
                      </td>
                    </tr>
                  ))}

                  {paginatedUnits.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                        No units match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(currentSql || previousSqls.length > 0) && (
            <div className="grid grid-cols-1 gap-4 bg-white p-4 lg:grid-cols-2">
              {currentSql && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900">Current SQL</h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(currentSql, 'current-unit-sql')}
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        {copiedCell === 'current-unit-sql' ? <Check size={12} /> : <Copy size={12} />}
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadSqlFile(currentSql, `unit_${sqlOperation}`)}
                        className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white transition-colors hover:bg-green-700"
                      >
                        <Download size={12} />
                        Download
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-3 text-xs text-slate-100">
                    {currentSql}
                  </pre>
                </div>
              )}

              {previousSqls.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-slate-900">Previous SQL</h4>
                  <div className="max-h-72 space-y-3 overflow-auto">
                    {previousSqls.map((sql, index) => (
                      <div key={`${index}-${sql.length}`} className="rounded border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-xs font-medium text-slate-600">Previous #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(sql, `previous-unit-sql-${index}`)}
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200"
                          >
                            {copiedCell === `previous-unit-sql-${index}` ? <Check size={12} /> : <Copy size={12} />}
                            Copy
                          </button>
                        </div>
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-3 text-xs text-slate-100">
                          {sql}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
