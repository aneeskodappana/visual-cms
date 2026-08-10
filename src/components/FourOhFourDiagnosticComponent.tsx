'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  ExternalLink,
  Search,
  ShieldAlert,
} from 'lucide-react';

type IssueSeverity = 'error' | 'warning' | 'info';

interface DiagnosticIssue {
  code: string;
  severity: IssueSeverity;
  title: string;
  details: string;
  inspectSql?: string;
  fixSql?: string;
}

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

interface ViewConfigSummary {
  Id: string;
  Code: string;
  Kind: number;
  KindName: string;
  Title: string;
  Subtitle: string;
  Layout2DCount: number;
  HasLayout3D: boolean;
  Relation: string;
  CandidateFixSql?: string;
}

interface UnitSummary {
  Id: string;
  Code: string;
  Title: string;
  UnitNumber: string;
  DisplayName: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  DisableUnit: boolean;
  HasFloorplan: boolean;
  HasInterior: boolean;
  UnitVariant: {
    Code: string;
    Title: string;
  } | null;
  ProjectCode: string | null;
  ClusterCode: string | null;
}

interface PropertyUnitLookup {
  rawUnitCode: string;
  normalizedUnitCode: string;
  requestedState: string;
  candidates: UnitSummary[];
  inspectSql: string;
}

interface DiagnosticResponse {
  status: 'failed' | 'passed';
  resolved: ResolvedLookup;
  lookupSql: string | null;
  issues: DiagnosticIssue[];
  exactMatches: ViewConfigSummary[];
  nearbyMatches: ViewConfigSummary[];
  propertyUnitLookup: PropertyUnitLookup | null;
  error?: string;
}

const EXAMPLES = [
  'http://localhost:3000/uae',
  'http://localhost:3000/uae/abudhabi',
  'http://localhost:3000/uae/abudhabi/louvreresidences',
  'http://localhost:3000/uae/abudhabi/louvreresidences/r16',
  'http://localhost:3000/uae/abudhabi/louvreresidences/property/R16-08-04/0?unitstate=floorplan&scheme=S1&furnished=true',
];

function severityClasses(severity: IssueSeverity) {
  if (severity === 'error') {
    return {
      shell: 'border-red-200 bg-red-50',
      icon: 'bg-red-100 text-red-700',
      title: 'text-red-950',
      body: 'text-red-800',
      badge: 'bg-red-100 text-red-700',
    };
  }

  if (severity === 'warning') {
    return {
      shell: 'border-amber-200 bg-amber-50',
      icon: 'bg-amber-100 text-amber-700',
      title: 'text-amber-950',
      body: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-700',
    };
  }

  return {
    shell: 'border-slate-200 bg-slate-50',
    icon: 'bg-slate-100 text-slate-700',
    title: 'text-slate-950',
    body: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
  };
}

function SqlBlock({
  title,
  sql,
  copyKey,
  copied,
  onCopy,
}: {
  title: string;
  sql?: string;
  copyKey: string;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  if (!sql) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <button
          type="button"
          onClick={() => onCopy(sql, copyKey)}
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied === copyKey ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          Copy
        </button>
      </div>
      <pre className="max-h-72 overflow-auto rounded bg-slate-950 p-4 text-xs leading-5 text-slate-100">
        {sql}
      </pre>
    </div>
  );
}

function FieldCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-all font-mono text-sm text-slate-900">{value ?? '-'}</p>
    </div>
  );
}

function BooleanPill({ label, value }: { label: string; value: boolean }) {
  return (
    <span
      className={`rounded px-2.5 py-1 text-xs font-medium ${
        value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {label}: {String(value)}
    </span>
  );
}

export function FourOhFourDiagnosticComponent() {
  const [urlInput, setUrlInput] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const handleDiagnose = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!urlInput.trim()) {
      setError('Please enter a local web app URL or path');
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/diagnostics/404', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data: DiagnosticResponse = await response.json();
      setResult(data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to diagnose URL');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to diagnose URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <form onSubmit={handleDiagnose} className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-900 text-white">
                <ShieldAlert size={18} />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-slate-950">404 Database Diagnostic</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Enter the same URL that shows the web app 404. The diagnostic resolves the expected ViewConfig lookup,
                checks obvious blocking database flags, and generates reviewable SQL for the fix.
              </p>
            </div>
            <Link
              href="/viewconfig-url"
              className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              URL Resolver <ExternalLink size={14} />
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Local URL or path</label>
              <textarea
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                rows={3}
                placeholder="http://localhost:3000/uae/abudhabi/project"
                className="w-full rounded border border-slate-300 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example, index) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setUrlInput(example)}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Example {index + 1}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
            >
              <Search size={16} />
              {loading ? 'Diagnosing...' : 'Diagnose 404'}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}

        {result && (
          <>
            <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnostic Result</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">
                    {result.status === 'failed' ? 'Database issue detected' : 'No blocking issue detected'}
                  </h3>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded px-3 py-1.5 text-sm font-medium ${
                    result.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  <Database size={15} />
                  {result.status}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FieldCard label="Pathname" value={result.resolved.pathname} />
                <FieldCard label="Expected Code" value={result.resolved.code} />
                <FieldCard
                  label="Expected Kind"
                  value={result.resolved.kind === null ? null : `${result.resolved.kind} - ${result.resolved.kindName}`}
                />
                <FieldCard label="Exact Matches" value={result.exactMatches.length} />
              </div>

              <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Path Segments</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.resolved.pathSegments.length > 0 ? (
                    result.resolved.pathSegments.map((segment, index) => (
                      <span
                        key={`${segment}-${index}`}
                        className="rounded bg-white px-2.5 py-1 font-mono text-xs text-slate-700 ring-1 ring-slate-200"
                      >
                        {segment}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No path segments</span>
                  )}
                </div>
              </div>

              <SqlBlock
                title="Exact ViewConfig Lookup SQL"
                sql={result.lookupSql || undefined}
                copyKey="lookup-sql"
                copied={copied}
                onCopy={copyText}
              />
            </section>

            <section className="space-y-4">
              {result.issues.map((issue) => {
                const classes = severityClasses(issue.severity);
                return (
                  <article key={issue.code} className={`rounded border p-5 shadow-sm ${classes.shell}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-3">
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded ${classes.icon}`}>
                          {issue.severity === 'error' ? <AlertTriangle size={17} /> : <Database size={17} />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={`text-base font-semibold ${classes.title}`}>{issue.title}</h4>
                            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${classes.badge}`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className={`mt-2 text-sm leading-6 ${classes.body}`}>{issue.details}</p>
                        </div>
                      </div>
                    </div>

                    <SqlBlock
                      title="Inspect SQL"
                      sql={issue.inspectSql}
                      copyKey={`inspect-${issue.code}`}
                      copied={copied}
                      onCopy={copyText}
                    />
                    <SqlBlock
                      title="Fix SQL"
                      sql={issue.fixSql}
                      copyKey={`fix-${issue.code}`}
                      copied={copied}
                      onCopy={copyText}
                    />
                  </article>
                );
              })}
            </section>

            {result.exactMatches.length > 0 && (
              <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-950">Exact ViewConfig Matches</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {result.exactMatches.map((match) => (
                    <div key={match.Id} className="rounded border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{match.Title || 'Untitled ViewConfig'}</p>
                          <p className="mt-1 break-all font-mono text-xs text-slate-600">{match.Id}</p>
                        </div>
                        <Link
                          href={`/viewconfig/${match.Id}`}
                          className="inline-flex w-fit items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Open <ExternalLink size={14} />
                        </Link>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FieldCard label="Code" value={match.Code} />
                        <FieldCard label="Kind" value={`${match.Kind} - ${match.KindName}`} />
                        <FieldCard label="Layout2Ds" value={match.Layout2DCount} />
                        <FieldCard label="Relation" value={match.Relation} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.nearbyMatches.length > 0 && (
              <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-950">Nearby ViewConfig Candidates</h3>
                <p className="mt-1 text-sm text-slate-600">
                  These rows do not match exactly, but they are close enough to review as likely repair candidates.
                </p>
                <div className="mt-4 space-y-4">
                  {result.nearbyMatches.map((match) => (
                    <div key={match.Id} className="rounded border border-slate-200 bg-slate-50 p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <FieldCard label="Code" value={match.Code} />
                        <FieldCard label="Kind" value={`${match.Kind} - ${match.KindName}`} />
                        <FieldCard label="Title" value={match.Title || '-'} />
                        <FieldCard label="Layouts" value={`${match.Layout2DCount} / 3D ${match.HasLayout3D}`} />
                      </div>
                      <SqlBlock
                        title="Candidate Fix SQL"
                        sql={match.CandidateFixSql}
                        copyKey={`candidate-${match.Id}`}
                        copied={copied}
                        onCopy={copyText}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.propertyUnitLookup && (
              <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-950">Property Unit Check</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FieldCard label="URL Unit Code" value={result.propertyUnitLookup.rawUnitCode} />
                  <FieldCard label="Normalized Unit Code" value={result.propertyUnitLookup.normalizedUnitCode} />
                  <FieldCard label="Requested Unit State" value={result.propertyUnitLookup.requestedState || '-'} />
                </div>

                <SqlBlock
                  title="Unit Lookup SQL"
                  sql={result.propertyUnitLookup.inspectSql}
                  copyKey="unit-lookup"
                  copied={copied}
                  onCopy={copyText}
                />

                {result.propertyUnitLookup.candidates.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {result.propertyUnitLookup.candidates.map((unit) => (
                      <div key={unit.Id} className="rounded border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-semibold text-slate-950">
                            {unit.DisplayName || unit.UnitNumber || unit.Code}
                          </p>
                          <p className="break-all font-mono text-xs text-slate-600">{unit.Id}</p>
                          <div className="flex flex-wrap gap-2">
                            <BooleanPill label="IsVisible" value={unit.IsVisible} />
                            <BooleanPill label="IsExplorable" value={unit.IsExplorable} />
                            <BooleanPill label="DisableUnit" value={unit.DisableUnit} />
                            <BooleanPill label="HasFloorplan" value={unit.HasFloorplan} />
                            <BooleanPill label="HasInterior" value={unit.HasInterior} />
                          </div>
                          <p className="text-xs text-slate-600">
                            Project {unit.ProjectCode || '-'} · Cluster {unit.ClusterCode || '-'} · Variant{' '}
                            {unit.UnitVariant?.Code || '-'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
