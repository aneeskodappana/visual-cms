'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Copy, Check, ExternalLink } from 'lucide-react';
import { constructCdnUrl, getViewTypeName } from '@/lib/cdnUtils';
import { OpenSeadragonPreview } from '@/components/OpenSeadragonPreview';

interface ResolvedLookup {
  input: string;
  pathname: string;
  pathSegments: string[];
  code: string | null;
  kind: number | null;
  kindName: string | null;
  supported: boolean;
  reason: string | null;
}

interface Layout2DResult {
  Id: string;
  DisplayName: string;
  BackplateUrl: string;
  BackplateVersion: number;
  BackplateWidth: number;
  BackplateHeight: number;
  BackplateThumbnailUrl?: string | null;
  BackplateThumbnailVersion?: number | null;
  BackplateThumbnailWidth?: number | null;
  BackplateThumbnailHeight?: number | null;
  Backplates: Array<{
    Id: string;
    Url: string;
    Version: number;
    Width: number;
    Height: number;
    VideoLoopEnabled?: boolean;
    VideoAutoplay?: boolean;
    ShowVideoControls?: boolean;
    ThumbnailUrl?: string | null;
    ThumbnailVersion?: number | null;
    ThumbnailWidth?: number | null;
    ThumbnailHeight?: number | null;
  }>;
}

interface ViewConfigResult {
  Id: string;
  Kind: number;
  Code: string;
  Title: string;
  Subtitle: string;
  HasGallery: boolean;
  CdnBaseUrl: string;
  Layout3D: any;
  Layout2Ds: Layout2DResult[];
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

interface QueryPreview {
  endpoint: string;
  params: {
    code: string;
    kind: number;
    codeMatchType: string;
  };
  rawSql: string;
}

interface ApiResponse {
  status: string;
  resolved?: ResolvedLookup;
  query?: QueryPreview | null;
  count?: number;
  data?: ViewConfigResult[];
  error?: string;
}

const EXAMPLES = [
  'http://localhost:3000/uae',
  'http://localhost:3000/uae/abudhabi?v=0',
  'http://localhost:3000/uae/abudhabi/louvreresidences',
  'http://localhost:3000/uae/abudhabi/louvreresidences/r16',
  'http://localhost:3000/uae/abudhabi/louvreresidences/r16/04',
  'http://localhost:3000/uae/abudhabi/louvreresidences/property/R16-08-04/0?unitstate=floorplan&scheme=S1&furnished=true',
  'http://localhost:3000/uae/alghadeergardenshero',
  'http://localhost:3000/uae/abudhabi/alghadeergardens/property/R2-TH-205-01/0?scheme=S1&unitstate=floorplan&furnished=true',
  'http://localhost:3000/uae/abudhabi/alghadeergardens/property/R2-TH-205-01/0?scheme=S1&unitstate=interior&furnished=true&room=Foyer',
];

function RelationBadge({ label, value }: { label: string; value: unknown }) {
  if (!value) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
      {label}
    </span>
  );
}

function isVideoAsset(path?: string): boolean {
  if (!path) {
    return false;
  }

  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(path);
}

function isDziAsset(path?: string): boolean {
  if (!path) {
    return false;
  }

  return /\.dzi(\?.*)?$/i.test(path);
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function buildSelectByIdQuery(tableName: string, id: string): string {
  return `SELECT * FROM "${tableName}" WHERE "Id" = '${escapeSqlString(id)}';`;
}

function buildUpdateVersionQuery(tableName: string, columnName: string, nextVersion: number | null | undefined, id: string): string {
  return `UPDATE "${tableName}" SET "${columnName}" = ${nextVersion ?? 1} WHERE "Id" = '${escapeSqlString(id)}';`;
}

export function ViewConfigUrlResolverComponent() {
  const [urlInput, setUrlInput] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<ResolvedLookup | null>(null);
  const [queryPreview, setQueryPreview] = useState<QueryPreview | null>(null);
  const [results, setResults] = useState<ViewConfigResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const handleResolve = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!urlInput.trim()) {
      setError('Please enter a URL or path');
      setResolved(null);
      setQueryPreview(null);
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/viewconfig/resolve-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data: ApiResponse = await response.json();

      setResolved(data.resolved ?? null);
      setQueryPreview(data.query ?? null);
      setResults(data.data ?? []);

      if (!response.ok) {
        throw new Error(data.error || data.resolved?.reason || 'Failed to resolve URL');
      }

      if ((data.data?.length ?? 0) === 0) {
        setError('No ViewConfig matched the resolved code and kind');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleResolve} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-2xl font-semibold text-slate-900">Resolve ViewConfig from URL</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">URL or path</label>
            <textarea
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="Paste a localhost URL, production URL, or just a path like /uae/abudhabi"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example, index) => (
              <button
                key={example}
                type="button"
                onClick={() => setUrlInput(example)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
              >
                Example {index + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
            >
              <Search size={16} />
              {loading ? 'Resolving...' : 'Resolve'}
            </button>
          </div>
        </div>
      </form>

      {resolved && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Resolved Lookup</h3>
              <p className="text-sm text-slate-600">Derived from the URL before querying the database.</p>
            </div>
            {resolved.code && (
              <button
                type="button"
                onClick={() => copyText(resolved.code || '', 'code')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {copied === 'code' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                Copy Code
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pathname</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-900">{resolved.pathname}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-900">{resolved.code || '-'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kind</p>
              <p className="mt-2 text-sm text-slate-900">
                {resolved.kind === null ? '-' : `${resolved.kind} · ${resolved.kindName || getViewTypeName(resolved.kind)}`}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className={`mt-2 text-sm font-medium ${resolved.supported ? 'text-green-700' : 'text-amber-700'}`}>
                {resolved.supported ? 'Supported pattern' : 'Unsupported pattern'}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Path Segments</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {resolved.pathSegments.length > 0 ? (
                resolved.pathSegments.map((segment, index) => (
                  <span key={`${segment}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-mono text-slate-700 ring-1 ring-slate-200">
                    {segment}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No segments</span>
              )}
            </div>
          </div>

          {resolved.reason && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {resolved.reason}
            </div>
          )}
        </div>
      )}

      {queryPreview && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Query Preview</h3>
              <p className="text-sm text-slate-600">This is the exact ViewConfig lookup being attempted from the frontend.</p>
            </div>
            <button
              type="button"
              onClick={() => copyText(JSON.stringify(queryPreview, null, 2), 'query-preview')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {copied === 'query-preview' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              Copy Query
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search Endpoint</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-900">{queryPreview.endpoint}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact Match</p>
              <p className="mt-2 text-sm text-slate-900">{queryPreview.params.code} · {queryPreview.params.kind} · {getViewTypeName(queryPreview.params.kind)}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Raw SQL Query</p>
            <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
              {queryPreview.rawSql}
            </pre>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-6">
          {results.map((result) => {
            const relationSummary = [
              result.Nation ? 'Nation' : null,
              result.City ? 'City' : null,
              result.Project ? 'Project' : null,
              result.Cluster ? 'Cluster' : null,
              result.Amenity ? 'Amenity' : null,
              result.Unit ? 'Unit' : null,
              result.UnitVariantExterior ? 'UnitVariantExterior' : null,
              result.UnitVariantFloor ? 'UnitVariantFloor' : null,
              result.UnitVariantInterior ? 'UnitVariantInterior' : null,
              result.ParkingFloorplan ? 'ParkingFloorplan' : null,
              result.ParkingUpgrade ? 'ParkingUpgrade' : null,
              result.ParkingUpgradeGallery ? 'ParkingUpgradeGallery' : null,
            ].filter(Boolean) as string[];

            const layout2dCount = result.Layout2Ds?.length || 0;

            return (
              <details key={result.Id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer list-none p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{result.Title || 'Untitled ViewConfig'}</h3>
                      <p className="mt-1 text-sm text-slate-600">{result.Subtitle || 'No subtitle'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-700">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{result.Kind} · {getViewTypeName(result.Kind)}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Layout2Ds {layout2dCount}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Gallery {result.GalleryItems?.length || 0}</span>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-slate-200 px-6 py-6">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/viewconfig/${result.Id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Open ViewConfig <ExternalLink size={14} />
                    </Link>
                    {result.Layout3D && (
                      <Link
                        href={`/viewconfig/${result.Id}/layout3d`}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                      >
                        Open Layout3D <ExternalLink size={14} />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => copyText(result.Id, `viewconfig-id-${result.Id}`)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {copied === `viewconfig-id-${result.Id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                      Copy ViewConfig UUID
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(result.Code, `viewconfig-code-${result.Id}`)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {copied === `viewconfig-code-${result.Id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                      Copy Code
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ViewConfig UUID</p>
                      <p className="mt-2 break-all font-mono text-sm text-slate-900">{result.Id}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code</p>
                      <p className="mt-2 break-all font-mono text-sm text-slate-900">{result.Code}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kind</p>
                      <p className="mt-2 text-sm text-slate-900">{result.Kind} · {getViewTypeName(result.Kind)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layout2Ds</p>
                      <p className="mt-2 text-sm text-slate-900">{layout2dCount}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gallery / Nav</p>
                      <p className="mt-2 text-sm text-slate-900">{result.GalleryItems?.length || 0} / {result.Navigations?.length || 0}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <RelationBadge label="Layout3D" value={result.Layout3D} />
                    {relationSummary.map((relation) => (
                      <RelationBadge key={relation} label={relation} value={true} />
                    ))}
                    {result.HasGallery && <RelationBadge label="HasGallery" value={true} />}
                  </div>

                  {layout2dCount > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-slate-900">Layout2Ds</h4>
                      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {result.Layout2Ds.map((layout, index) => {
                          const primaryBackplate = layout.Backplates?.[0] ?? null;
                          const hasBackplateRows = (layout.Backplates?.length || 0) > 0;
                          const previewPath = primaryBackplate?.Url || layout.BackplateUrl;
                          const previewWidth = primaryBackplate?.Width || layout.BackplateWidth;
                          const previewHeight = primaryBackplate?.Height || layout.BackplateHeight;
                          const backplateUrl = constructCdnUrl(previewPath, result.CdnBaseUrl);
                          const isVideoBackplate = isVideoAsset(previewPath);
                          const isDziBackplate = isDziAsset(previewPath);
                          const layoutThumbnailUrl = constructCdnUrl(layout.BackplateThumbnailUrl || '', result.CdnBaseUrl);

                          return (
                            <div key={layout.Id || index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{layout.DisplayName || `Layout ${index + 1}`}</p>
                                  <p className="mt-1 break-all font-mono text-xs text-slate-600">{layout.Id}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => copyText(layout.Id, `layout2d-id-${layout.Id}`)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    {copied === `layout2d-id-${layout.Id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                    Copy Layout2D UUID
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyText(buildSelectByIdQuery('Layout2Ds', layout.Id), `layout2d-select-${layout.Id}`)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    {copied === `layout2d-select-${layout.Id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                    Copy Layout2D SQL Select
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => copyText(buildUpdateVersionQuery('Layout2Ds', 'BackplateVersion', (layout.BackplateVersion ?? 0) + 1, layout.Id), `layout2d-version-${layout.Id}`)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  {copied === `layout2d-version-${layout.Id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                  Copy Layout2D Version Update SQL
                                </button>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Size</p>
                                  <p className="mt-2 text-sm text-slate-900">{previewWidth || 0} × {previewHeight || 0}</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview Source</p>
                                  <p className="mt-2 text-sm text-slate-900">{hasBackplateRows ? 'Backplates table' : 'Layout2Ds table'}</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layout2D BackplateVersion</p>
                                  <p className="mt-2 text-sm text-slate-900">{layout.BackplateVersion ?? '-'}</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Backplates</p>
                                  <p className="mt-2 text-sm text-slate-900">{layout.Backplates?.length || 0}</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolved Backplate Path</p>
                                  <p className="mt-2 break-all font-mono text-xs text-slate-900">{previewPath || '-'}</p>
                                </div>
                                <div className="rounded-lg bg-white p-3 xl:col-span-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layout2D Backplate Path</p>
                                  <p className="mt-2 break-all font-mono text-xs text-slate-900">{layout.BackplateUrl || '-'}</p>
                                </div>
                              </div>

                              <div className="mt-4 space-y-3">
                                {layoutThumbnailUrl && (
                                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layout2D Thumbnail</p>
                                      <span className="text-xs font-medium text-slate-700">v{layout.BackplateThumbnailVersion ?? '-'}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => window.open(layoutThumbnailUrl, '_blank', 'noopener,noreferrer')}
                                      className="block overflow-hidden rounded-lg border border-slate-200"
                                    >
                                      <img
                                        src={layoutThumbnailUrl}
                                        alt={`${layout.DisplayName || `Layout ${index + 1}`} thumbnail`}
                                        className="h-16 w-32 object-contain bg-slate-100"
                                      />
                                    </button>
                                  </div>
                                )}

                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolved Preview</p>
                                    <span className="text-xs font-medium text-slate-700">{hasBackplateRows ? `v${primaryBackplate?.Version ?? '-'}` : `v${layout.BackplateVersion ?? '-'}`}</span>
                                  </div>
                                  {backplateUrl ? (
                                    isDziBackplate ? (
                                      <OpenSeadragonPreview
                                        assetUrl={backplateUrl}
                                        title={layout.DisplayName || `Layout ${index + 1}`}
                                        className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => window.open(backplateUrl, '_blank', 'noopener,noreferrer')}
                                        className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                                      >
                                        {isVideoBackplate ? (
                                        <video
                                          src={backplateUrl}
                                          controls
                                          muted
                                          playsInline
                                          className="max-h-[28rem] w-full bg-slate-100 object-contain"
                                        />
                                        ) : (
                                        <img
                                          src={backplateUrl}
                                          alt={layout.DisplayName || `Layout ${index + 1}`}
                                          className="max-h-[28rem] w-full object-contain bg-slate-100"
                                        />
                                        )}
                                      </button>
                                    )
                                  ) : (
                                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
                                      No preview
                                    </div>
                                  )}
                                </div>
                              </div>

                              {hasBackplateRows && (
                                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <h5 className="text-sm font-semibold text-slate-900">Backplates</h5>
                                    <span className="text-xs text-slate-600">{layout.Backplates.length} items</span>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3">
                                    {layout.Backplates.map((backplate, backplateIndex) => {
                                      const backplateAssetUrl = constructCdnUrl(backplate.Url, result.CdnBaseUrl);
                                      const backplateThumbnailUrl = constructCdnUrl(backplate.ThumbnailUrl || '', result.CdnBaseUrl);
                                      const isBackplateVideo = isVideoAsset(backplate.Url);
                                      const isBackplateDzi = isDziAsset(backplate.Url);

                                      return (
                                        <div key={backplate.Id || backplateIndex} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                              <p className="text-sm font-semibold text-slate-900">Backplate {backplateIndex + 1}</p>
                                              <p className="mt-1 break-all font-mono text-xs text-slate-600">{backplate.Id}</p>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => copyText(buildUpdateVersionQuery('Backplates', 'Version', (backplate.Version ?? 0) + 1, backplate.Id), `backplate-version-${backplate.Id}`)}
                                              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                            >
                                              {copied === `backplate-version-${backplate.Id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                              Copy Backplate Version Update SQL
                                            </button>
                                          </div>

                                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-lg bg-white p-3">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version</p>
                                              <p className="mt-2 text-sm text-slate-900">{backplate.Version ?? '-'}</p>
                                            </div>
                                            <div className="rounded-lg bg-white p-3">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Size</p>
                                              <p className="mt-2 text-sm text-slate-900">{backplate.Width || 0} × {backplate.Height || 0}</p>
                                            </div>
                                            <div className="rounded-lg bg-white p-3">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thumbnail Version</p>
                                              <p className="mt-2 text-sm text-slate-900">{backplate.ThumbnailVersion ?? '-'}</p>
                                            </div>
                                            <div className="rounded-lg bg-white p-3 xl:col-span-1">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Backplate Path</p>
                                              <p className="mt-2 break-all font-mono text-xs text-slate-900">{backplate.Url || '-'}</p>
                                            </div>
                                          </div>

                                          <div className="mt-4 space-y-3">
                                            {backplateThumbnailUrl && (
                                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thumbnail</p>
                                                  <span className="text-xs font-medium text-slate-700">v{backplate.ThumbnailVersion ?? '-'}</span>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => window.open(backplateThumbnailUrl, '_blank', 'noopener,noreferrer')}
                                                  className="block overflow-hidden rounded-lg border border-slate-200"
                                                >
                                                  <img
                                                    src={backplateThumbnailUrl}
                                                    alt={`Backplate ${backplateIndex + 1} thumbnail`}
                                                    className="h-16 w-32 object-contain bg-slate-100"
                                                  />
                                                </button>
                                              </div>
                                            )}

                                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                              <div className="mb-3 flex items-center justify-between gap-3">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
                                                <span className="text-xs font-medium text-slate-700">v{backplate.Version ?? '-'}</span>
                                              </div>
                                              {backplateAssetUrl ? (
                                                isBackplateDzi ? (
                                                  <OpenSeadragonPreview
                                                    assetUrl={backplateAssetUrl}
                                                    title={`Backplate ${backplateIndex + 1}`}
                                                    className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                                                  />
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => window.open(backplateAssetUrl, '_blank', 'noopener,noreferrer')}
                                                    className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                                                  >
                                                    {isBackplateVideo ? (
                                                    <video
                                                      src={backplateAssetUrl}
                                                      controls
                                                      muted
                                                      playsInline
                                                      className="max-h-[28rem] w-full bg-slate-100 object-contain"
                                                    />
                                                    ) : (
                                                    <img
                                                      src={backplateAssetUrl}
                                                      alt={`Backplate ${backplateIndex + 1}`}
                                                      className="max-h-[28rem] w-full object-contain bg-slate-100"
                                                    />
                                                    )}
                                                  </button>
                                                )
                                              ) : (
                                                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
                                                  No preview
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Raw JSON</summary>
                    <div className="border-t border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-slate-900">Raw JSON</h4>
                        <button
                          type="button"
                          onClick={() => copyText(JSON.stringify(result, null, 2), result.Id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {copied === result.Id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                          Copy JSON
                        </button>
                      </div>
                      <pre className="max-h-[32rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
