'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Search, Copy, Check } from 'lucide-react';
import { constructCdnUrl, constructMarkerIconUrl, getViewTypeName, getMarkerTypeName, getMarkerSubTypeName, ViewTypes } from '@/lib/cdnUtils';

interface ViewConfigResult {
  Id: string;
  Kind: number;
  Code: string;
  Title: string;
  Subtitle: string;
  HasGallery: boolean;
  CdnBaseUrl: string;
  Layout3D: any;
  Layout2Ds: any[];
  Navigations: any[];
  GalleryItems: any[];
  Nation: any;
  City: any;
  Project: any;
  Cluster: any;
  Amenity: any;
  Unit: any;
  UnitVariantExterior: any;
  UnitVariantFloor: any;
  UnitVariantInterior: any;
  ParkingFloorplan: any;
  ParkingUpgrade: any;
  ParkingUpgradeGallery: any;
}

export function ViewConfigSearchComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [codeInput, setCodeInput] = useState('');
  const [uuidInput, setUuidInput] = useState('');
  const [codeMatchType, setCodeMatchType] = useState<'ilike' | 'exact'>('exact');
  const [selectedKind, setSelectedKind] = useState<number | ''>('');
  const [results, setResults] = useState<ViewConfigResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  // Initialize from URL params on mount
  useEffect(() => {
    const code = searchParams.get('code') || '';
    const uuid = searchParams.get('uuid') || '';
    const matchType = (searchParams.get('matchType') as 'ilike' | 'exact') || 'exact';
    const kind = searchParams.get('kind');

    setCodeInput(code);
    setUuidInput(uuid);
    setCodeMatchType(matchType);
    setSelectedKind(kind ? Number(kind) : '');

    // If we have search params, perform the search
    if (code || uuid || kind) {
      performSearch(code, uuid, matchType, kind ? Number(kind) : '');
    }
  }, [searchParams]);

  const updateURL = (code: string, uuid: string, matchType: string, kind: number | string) => {
    const params = new URLSearchParams();
    if (code) params.append('code', code);
    if (uuid) params.append('uuid', uuid);
    if (matchType) params.append('matchType', matchType);
    if (kind) params.append('kind', String(kind));

    // Update URL without navigation
    const queryString = params.toString();
    window.history.replaceState(null, '', queryString ? `?${queryString}` : '/viewconfig-search');
  };

  const performSearch = async (code: string, uuid: string, matchType: string, kind: number | string) => {
    if (!code && !uuid && !kind) {
      setError('Please enter a code, UUID, or select a kind to search');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (code) {
        params.append('code', code);
        params.append('codeMatchType', matchType);
      }
      if (uuid) params.append('uuid', uuid);
      if (kind) params.append('kind', String(kind));

      const response = await fetch(`/api/viewconfig/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.data || []);
      if (data.data?.length === 0) {
        setError('No results found');
      }

      // Update URL after successful search
      updateURL(code, uuid, matchType, kind);
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

  const Tooltip = ({ children, label }: { children: React.ReactNode; label: string }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

    const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPos({
        top: rect.top - 35,
        left: rect.left + rect.width / 2 - 50,
      });
      setShowTooltip(true);
    };

    return (
      <span
        className="relative inline-block cursor-help underline decoration-dotted"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
        {showTooltip && (
          <div
            className="fixed z-50 px-3 py-2 text-xs text-white bg-gray-900 rounded whitespace-nowrap"
            style={{
              top: `${tooltipPos.top}px`,
              left: `${tooltipPos.left}px`,
            }}
          >
            {label}
            <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 bottom-[-4px] left-1/2 -translate-x-1/2"></div>
          </div>
        )}
      </span>
    );
  };

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const toggleSection = (key: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedSections(newSet);
  };

  const handleSearch = async () => {
    performSearch(codeInput, uuidInput, codeMatchType, selectedKind);
  };

  const renderLayout2DTable = (layout2ds: any[], resultId: string, cdnBaseUrl?: string) => {
    if (!layout2ds || layout2ds.length === 0) return null;

    return (
      <div className="mb-6">
        <h6 className="font-semibold text-gray-900 mb-3">Layout 2D</h6>
        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">Id</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">DisplayName</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">BackplateVersion</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">BackplateWidth</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">BackplateHeight</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">BackplateUrl</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold">Backplates</th>
              </tr>
            </thead>
            <tbody>
              {layout2ds.map((layout, idx) => (
                <tr key={idx} className="border-b border-gray-300 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 truncate max-w-[120px]">
                    <CellWithCopy text={layout.Id?.substring(0, 8) + '...' || '-'} cellId={`l2d-id-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300">{layout.DisplayName || '-'}</td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(layout.BackplateVersion)} cellId={`l2d-bpv-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(layout.BackplateWidth)} cellId={`l2d-bpw-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(layout.BackplateHeight)} cellId={`l2d-bph-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 border-r border-gray-300">
                    {layout.BackplateUrl ? (
                      <img
                        src={constructCdnUrl(layout.BackplateUrl, cdnBaseUrl)}
                        alt="Backplate"
                        className="h-12 w-auto cursor-pointer hover:opacity-80"
                        onClick={() => window.open(constructCdnUrl(layout.BackplateUrl, cdnBaseUrl), '_blank')}
                        title="Click to view full size"
                      />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1 text-blue-600">
                      {layout.Backplates?.length || 0}
                      <span className="inline-flex items-center gap-1">
                        <CopyButton text={String(layout.Backplates?.length || 0)} cellId={`l2d-bp-${resultId}-${idx}`} />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMarkersTable = (layout2ds: any[], resultId: string) => {
    const allMarkers = layout2ds.flatMap((layout) => layout.Markers || []);
    if (!allMarkers || allMarkers.length === 0) return null;

    return (
      <div className="mb-6">
        <h6 className="font-semibold text-gray-900 mb-3">Markers</h6>
        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">Id</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">Kind</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">SubType</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">MarkerIndex</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">Code</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">NavigateTo</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">PositionTop</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">PositionLeft</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">KeepScale</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">Title</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">HoverIconUrl</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">IconUrl</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold">Layout2DId</th>
              </tr>
            </thead>
            <tbody>
              {allMarkers.map((marker, idx) => (
                <tr key={idx} className="border-b border-gray-300 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 truncate max-w-[100px]">
                    <CellWithCopy text={marker.Id?.substring(0, 8) + '...' || '-'} cellId={`m-id-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <Tooltip label={marker.Kind ? getMarkerTypeName(marker.Kind) : '-'}>
                      <CellWithCopy text={String(marker.Kind || '-')} cellId={`m-kind-${resultId}-${idx}`} />
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <Tooltip label={getMarkerSubTypeName(marker.SubType)}>
                      <CellWithCopy text={String(marker.SubType || '-')} cellId={`m-st-${resultId}-${idx}`} />
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(marker.MarkerIndex || '-')} cellId={`m-mi-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300">{marker.Code || '-'}</td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300">{marker.NavigateTo || '-'}</td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={marker.PositionTop?.toFixed(2) || '-'} cellId={`m-pt-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={marker.PositionLeft?.toFixed(2) || '-'} cellId={`m-pl-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">{marker.KeepScale ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300">{marker.Title || '-'}</td>
                  <td className="px-3 py-2 border-r border-gray-300">
                    {marker.HoverIconUrl ? (
                      <img
                        src={constructMarkerIconUrl(marker.HoverIconUrl)}
                        alt="Hover Icon"
                        className="h-8 w-auto cursor-pointer hover:opacity-80"
                        onClick={() => window.open(constructMarkerIconUrl(marker.HoverIconUrl), '_blank')}
                        title="Click to view full size"
                      />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 border-r border-gray-300">
                    {marker.IconUrl ? (
                      <img
                        src={constructMarkerIconUrl(marker.IconUrl)}
                        alt="Icon"
                        className="h-8 w-auto cursor-pointer hover:opacity-80"
                        onClick={() => window.open(constructMarkerIconUrl(marker.IconUrl), '_blank')}
                        title="Click to view full size"
                      />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[100px]">
                    <CellWithCopy text={marker.Layout2DId?.substring(0, 8) + '...' || '-'} cellId={`m-l2did-${resultId}-${idx}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBackplatesTable = (layout2ds: any[], resultId: string) => {
    const allBackplates = layout2ds.flatMap((layout) => 
      (layout.Backplates || []).map((bp: any) => ({ ...bp, layout2dId: layout.Id }))
    );
    if (!allBackplates || allBackplates.length === 0) return null;

    return (
      <div className="mb-6">
        <h6 className="font-semibold text-gray-900 mb-3">Backplates</h6>
        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">Id</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">Url</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">Version</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">Width</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">Height</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">Type</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">MinZoomLevel</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">MaxZoomLevel</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">VideoLoopEnabled</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">Layout2DId</th>
              </tr>
            </thead>
            <tbody>
              {allBackplates.map((backplate, idx) => (
                <tr key={idx} className="border-b border-gray-300 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 truncate max-w-[100px]">
                    <CellWithCopy text={backplate.Id?.substring(0, 8) + '...' || '-'} cellId={`bp-id-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-blue-600 border-r border-gray-300 truncate max-w-[150px]">
                    {backplate.Url ? (
                      <a href={backplate.Url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        Link
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(backplate.Version)} cellId={`bp-ver-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(backplate.Width)} cellId={`bp-w-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(backplate.Height)} cellId={`bp-h-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(backplate.Type)} cellId={`bp-t-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(backplate.MinZoomLevel)} cellId={`bp-min-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(backplate.MaxZoomLevel)} cellId={`bp-max-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    {backplate.VideoLoopEnabled ? 'Yes' : 'No'}
                  </td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[100px]">
                    <CellWithCopy text={backplate.layout2dId?.substring(0, 8) + '...' || '-'} cellId={`bp-l2did-${resultId}-${idx}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderNavigationsTable = (navigations: any[], resultId: string) => {
    if (!navigations || navigations.length === 0) return null;

    return (
      <div className="mb-6">
        <h6 className="font-semibold text-gray-900 mb-3">Navigations</h6>
        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">Id</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">DisplayName</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">DisplaySubName</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold border-r border-gray-300">CardImageUrl</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">DisplayOrder</th>
                <th className="px-3 py-2 text-center text-gray-700 font-semibold border-r border-gray-300">IsPriority</th>
                <th className="px-3 py-2 text-left text-gray-700 font-semibold">NavigationUrl</th>
              </tr>
            </thead>
            <tbody>
              {navigations.map((nav, idx) => (
                <tr key={idx} className="border-b border-gray-300 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 truncate max-w-[100px]">
                    <CellWithCopy text={nav.Id?.substring(0, 8) + '...' || '-'} cellId={`nav-id-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300">
                    {nav.DisplayName || '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300">
                    {nav.DisplaySubName || '-'}
                  </td>
                  <td className="px-3 py-2 text-blue-600 border-r border-gray-300 truncate max-w-[150px]">
                    {nav.CardImageUrl ? (
                      <a href={nav.CardImageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        Link
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    <CellWithCopy text={String(nav.DisplayOrder)} cellId={`nav-do-${resultId}-${idx}`} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 border-r border-gray-300 text-center">
                    {nav.IsPriority ? 'Yes' : 'No'}
                  </td>
                  <td className="px-3 py-2 text-blue-600 truncate max-w-[150px]">
                    {nav.NavigationUrl ? (
                      <a href={nav.NavigationUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        Link
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
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
            {expandedSections.has(sectionKey) ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
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

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Search ViewConfig</h2>

        <div className="flex flex-col lg:flex-row gap-4 items-end mb-4">
          {/* Code Input */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Code
            </label>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="e.g., 'view' or 'config'"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Match Type Radio Buttons */}
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

          {/* Kind Selector */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by View Type
            </label>
            <select
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              {Object.entries(ViewTypes).map(([name, value]) => {
                // Filter out numeric keys from enum to avoid duplicates
                if (typeof value === 'number') {
                  return (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  );
                }
                return null;
              })}
            </select>
          </div>

          {/* UUID Input */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by UUID
            </label>
            <input
              type="text"
              value={uuidInput}
              onChange={(e) => setUuidInput(e.target.value)}
              placeholder="e.g., 'uuid-1' or 'uuid-1, uuid-2'"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          <Search size={18} />
          {loading ? 'Searching...' : 'Search'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Results ({results.length})
          </h3>

          <div className="space-y-3">
            {results.map((result) => (
              <div key={result.Id} className="border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpanded(result.Id)}
                  className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
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
                  </div>

                  <div className="flex items-center gap-2">
                    {result.Layout2Ds && result.Layout2Ds.length > 0 && (
                      <Link
                        href={`/viewconfig/${result.Id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200 transition-colors"
                      >
                        View Layout 2D
                      </Link>
                    )}
                    {result.Layout3D && (
                      <Link
                        href={`/viewconfig/${result.Id}/layout3d`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium hover:bg-purple-200 transition-colors"
                      >
                        View Layout 3D
                      </Link>
                    )}
                    {result.HasGallery && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                        Has Gallery
                      </span>
                    )}
                  </div>
                </button>

                {expandedIds.has(result.Id) && (
                  <div className="p-4 bg-white space-y-4 border-t border-gray-300">
                    {/* Main Fields */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700">ID:</span>
                        <p className="font-mono text-gray-600 break-all">{result.Id}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Kind:</span>
                        <p className="text-gray-600">{result.Kind} ({getViewTypeName(result.Kind)})</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Code:</span>
                        <p className="text-gray-600">{result.Code}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Titles:</span>
                        <p className="text-gray-600">{result.Title || '-'} | {result.Subtitle || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">CDN Base URL:</span>
                        <p className="text-gray-600">{result.CdnBaseUrl || '-'}</p>
                      </div>
                    </div>

                    {/* Relations */}
                    <div className="border-t pt-4">
                      <h5 className="font-semibold text-gray-900 mb-3">Relations</h5>

                      <div className="space-y-3">
                        {renderRelation('Layout 3D', result.Layout3D, result.Id)}
                        {renderLayout2DTable(result.Layout2Ds, result.Id, result.CdnBaseUrl)}
                        {renderMarkersTable(result.Layout2Ds, result.Id)}
                        {renderBackplatesTable(result.Layout2Ds, result.Id)}
                        {renderNavigationsTable(result.Navigations, result.Id)}
                        {renderRelation('Gallery Items', result.GalleryItems, result.Id)}
                        {renderRelation('Nation', result.Nation, result.Id)}
                        {renderRelation('City', result.City, result.Id)}
                        {renderRelation('Project', result.Project, result.Id)}
                        {renderRelation('Cluster', result.Cluster, result.Id)}
                        {renderRelation('Amenity', result.Amenity, result.Id)}
                        {renderRelation('Unit', result.Unit, result.Id)}
                        {renderRelation('Unit Variant Exterior', result.UnitVariantExterior, result.Id)}
                        {renderRelation('Unit Variant Floor', result.UnitVariantFloor, result.Id)}
                        {renderRelation('Unit Variant Interior', result.UnitVariantInterior, result.Id)}
                        {renderRelation('Parking Floorplan', result.ParkingFloorplan, result.Id)}
                        {renderRelation('Parking Upgrade', result.ParkingUpgrade, result.Id)}
                        {renderRelation('Parking Upgrade Gallery', result.ParkingUpgradeGallery, result.Id)}
                      </div>

                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        <p className="font-semibold mb-1">Note:</p>
                        <p>Marker data is excluded from results due to NaN values in position fields in the database. This is a data integrity issue that should be addressed in the database cleanup.</p>
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
          <p className="text-blue-800">Use the search form above to find ViewConfig records</p>
        </div>
      )}
    </div>
  );
}
