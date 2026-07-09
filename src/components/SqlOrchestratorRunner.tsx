'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileCode2,
  FileText,
  FolderOpen,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  DataSnapshot,
  ExecutionError,
  ExecutionResult,
  ParsedFileResult,
  ParsedQuery,
  QueryType,
  SqlFile,
} from '@/lib/sqlOrchestratorTypes';

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

type ActiveTab = 'queries' | 'report';

const queryTypeClasses: Record<QueryType, string> = {
  CREATE: 'bg-blue-50 text-blue-700 border-blue-200',
  ALTER: 'bg-amber-50 text-amber-700 border-amber-200',
  INSERT: 'bg-green-50 text-green-700 border-green-200',
  UPDATE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  DROP: 'bg-rose-50 text-rose-700 border-rose-200',
  OTHER: 'bg-slate-50 text-slate-700 border-slate-200',
};

async function postSqlOrchestrator<T>(body: Record<string, unknown>): Promise<ApiResponse<T>> {
  const response = await fetch('/api/sql-orchestrator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(data.error || 'SQL orchestrator request failed');
  return data;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildParseErrors(parsedFiles: ParsedFileResult[]): ExecutionError[] {
  return parsedFiles.flatMap((file) =>
    file.parseErrors.map((message) => ({
      message,
      failedQuery: 'Parse validation',
      index: -1,
      originalFile: file.fileName,
      lineNumber: 0,
    })),
  );
}

function getAllQueries(parsedFiles: ParsedFileResult[]) {
  return parsedFiles.flatMap((file) => file.queries);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
      title="Copy SQL"
      aria-label="Copy SQL"
    >
      {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
    </button>
  );
}

function QueryList({ queries }: { queries: ParsedQuery[] }) {
  const typeCounts = useMemo(() => {
    return queries.reduce<Record<string, number>>((counts, query) => {
      counts[query.type] = (counts[query.type] || 0) + 1;
      return counts;
    }, {});
  }, [queries]);

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Original Queries</h2>
          <p className="mt-1 text-sm text-slate-500">{queries.length} parsed queries</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(typeCounts) as QueryType[]).map((type) => (
            <span key={type} className={`rounded border px-2 py-1 text-xs font-medium ${queryTypeClasses[type]}`}>
              {type} {typeCounts[type]}
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-[640px] overflow-y-auto p-4">
        {queries.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
            Select SQL files to preview parsed queries.
          </div>
        ) : (
          <div className="space-y-3">
            {queries.map((query, index) => (
              <article key={`${query.originalFile}-${query.rawIndex}-${index}`} className="rounded border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${queryTypeClasses[query.type]}`}>
                        {query.type}
                      </span>
                      {query.tableName && (
                        <span className="rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-600">
                          {query.tableName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {query.originalFile}:{query.lineNumber}
                    </p>
                  </div>
                  <CopyButton text={query.query} />
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-xs leading-5 text-slate-800">
                  {query.query}
                </pre>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SnapshotTable({ rows, emptyMessage }: { rows: Record<string, unknown>[]; emptyMessage: string }) {
  if (!rows.length) {
    return <div className="px-4 py-3 text-xs italic text-slate-500">{emptyMessage}</div>;
  }

  const columns = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-500">#</th>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-500">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-100">
              <td className="sticky left-0 bg-white px-3 py-2 font-mono text-slate-400">{rowIndex + 1}</td>
              {columns.map((column) => {
                const rawValue = row[column];
                const value = rawValue == null ? 'NULL' : String(rawValue);
                return (
                  <td key={column} className="max-w-[320px] truncate px-3 py-2 font-mono text-slate-700" title={value}>
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotCard({ snapshot }: { snapshot: DataSnapshot }) {
  const [expanded, setExpanded] = useState(true);
  const isDelete = snapshot.queryType === 'DELETE';

  return (
    <div className={`overflow-hidden rounded border ${isDelete ? 'border-red-200' : 'border-green-200'}`}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
          isDelete ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="rounded bg-white/80 px-2 py-0.5 font-mono text-xs">{snapshot.queryType}</span>
          <span className="truncate font-mono">{snapshot.table}</span>
        </span>
        <span className="shrink-0 text-xs">
          {snapshot.before.length} before / {snapshot.after.length} after
        </span>
      </button>
      {expanded && (
        <div className="divide-y divide-slate-200 bg-white">
          <div>
            <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">Before Execution</div>
            <SnapshotTable rows={snapshot.before} emptyMessage={isDelete ? 'No matching rows were found.' : 'No matching rows existed before insert.'} />
          </div>
          <div>
            <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">After Execution</div>
            <SnapshotTable rows={snapshot.after} emptyMessage={isDelete ? 'Rows are no longer present.' : 'No rows captured after execution.'} />
          </div>
        </div>
      )}
    </div>
  );
}

function buildReport(result: ExecutionResult, files: SqlFile[]) {
  const fileRows = files.map((file) => {
    const fileErrors = result.errors.filter((error) => error.originalFile === file.name);
    const fileQueries = result.executedQueries.filter((query) => query.originalFile === file.name);
    const rowsAffected = fileQueries.reduce((sum, query) => sum + (query.rowsAffected || 0), 0);
    return {
      file: file.name,
      status: fileErrors.length ? `Failed (${fileErrors.length})` : 'Processed',
      queries: fileQueries.length,
      rowsAffected,
    };
  });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SQL Execution Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    pre { white-space: pre-wrap; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; }
  </style>
</head>
<body>
  <h1>${result.success ? 'SQL Execution Report' : 'SQL Execution Error Report'}</h1>
  <p>Generated ${new Date().toLocaleString()}</p>
  <p>Executed ${result.executedCount} of ${result.totalQueries} queries in ${result.executionTimeMs}ms.</p>
  <h2>File Summary</h2>
  <table>
    <thead><tr><th>File</th><th>Status</th><th>Queries</th><th>Rows Affected</th></tr></thead>
    <tbody>
      ${fileRows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.file)}</td><td>${escapeHtml(row.status)}</td><td>${row.queries}</td><td>${row.rowsAffected}</td></tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <h2>Errors</h2>
  ${
    result.errors.length
      ? result.errors
          .map(
            (error) =>
              `<h3>${escapeHtml(error.originalFile)}:${error.lineNumber}</h3><p>${escapeHtml(error.message)}</p><pre>${escapeHtml(
                error.failedQuery,
              )}</pre>`,
          )
          .join('')
      : '<p>No errors were reported.</p>'
  }
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ReportPanel({ result, files }: { result: ExecutionResult | null; files: SqlFile[] }) {
  const downloadReport = useCallback(() => {
    if (!result) return;
    const blob = new Blob([buildReport(result, files)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sql-execution-report-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [files, result]);

  if (!result) {
    return (
      <section className="rounded border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        Run a dry run or execute SQL to generate a report.
      </section>
    );
  }

  const totalRowsAffected = result.executedQueries.reduce((sum, query) => sum + (query.rowsAffected || 0), 0);

  return (
    <div className="space-y-4">
      <section className={`rounded border bg-white shadow-sm ${result.success ? 'border-green-200' : 'border-red-200'}`}>
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {result.success ? (
              <div className="mt-0.5 rounded bg-green-100 p-1 text-green-700">
                <Check size={18} />
              </div>
            ) : (
              <div className="mt-0.5 rounded bg-red-100 p-1 text-red-700">
                <XCircle size={18} />
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {result.success ? 'Execution Successful' : 'Execution Completed With Errors'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {result.executedCount} of {result.totalQueries} queries processed in {result.executionTimeMs}ms.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadReport}
            className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <Download size={16} />
            Download Report
          </button>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-200 text-sm sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Files</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{files.length}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Queries</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{result.totalQueries}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rows Affected</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{totalRowsAffected}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Errors</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{result.errors.length}</p>
          </div>
        </div>
      </section>

      {result.errors.length > 0 && (
        <section className="rounded border border-red-200 bg-white shadow-sm">
          <div className="border-b border-red-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-red-800">
              <AlertCircle size={18} />
              Errors
            </h2>
          </div>
          <div className="space-y-3 p-4">
            {result.errors.map((error, index) => (
              <div key={`${error.originalFile}-${index}`} className="rounded border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-900">{error.message}</p>
                <p className="mt-1 text-xs text-red-700">
                  {error.originalFile}:{error.lineNumber} {error.sqlState ? `SQL state ${error.sqlState}` : ''}
                </p>
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-3 font-mono text-xs text-slate-800">
                  {error.failedQuery}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}

      {result.snapshots.length > 0 && (
        <section className="rounded border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Data Snapshots</h2>
            <p className="mt-1 text-sm text-slate-500">Before and after records captured for INSERT and DELETE statements.</p>
          </div>
          <div className="space-y-3 p-4">
            {result.snapshots.map((snapshot, index) => (
              <SnapshotCard key={`${snapshot.originalFile}-${snapshot.queryIndex}-${index}`} snapshot={snapshot} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function SqlOrchestratorRunner() {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SqlFile[]>([]);
  const [parsedFiles, setParsedFiles] = useState<ParsedFileResult[]>([]);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('queries');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  const queries = useMemo(() => getAllQueries(parsedFiles), [parsedFiles]);

  const runConnectionTest = useCallback(async () => {
    try {
      const response = await postSqlOrchestrator<{ connected: boolean }>({ action: 'test-connection' });
      setConnectionStatus(response.data?.connected ? 'connected' : 'failed');
    } catch {
      setConnectionStatus('failed');
    }
  }, []);

  useEffect(() => {
    runConnectionTest();
  }, [runConnectionTest]);

  const parseFiles = useCallback(async (targetFiles: SqlFile[]) => {
    const response = await postSqlOrchestrator<{ parsedFiles: ParsedFileResult[]; totalQueries: number }>({
      action: 'parse',
      contents: targetFiles.map((file) => ({ fileName: file.name, content: file.content })),
    });
    const parsed = response.data?.parsedFiles || [];
    setParsedFiles(parsed);
    return parsed;
  }, []);

  const readFiles = useCallback(async (fileList: FileList | null, append: boolean) => {
    if (!fileList) return;
    setMessage('');

    const sqlFiles: SqlFile[] = [];
    const existing = new Set(append ? files.map((file) => file.name) : []);

    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.sql') || existing.has(file.name)) continue;
      sqlFiles.push({
        name: file.name,
        content: await file.text(),
        size: file.size,
        lastModified: new Date(file.lastModified).toISOString(),
      });
    }

    sqlFiles.sort((a, b) => a.name.localeCompare(b.name));
    const nextFiles = append ? [...files, ...sqlFiles] : sqlFiles;
    setFiles(nextFiles);
    setResult(null);
    setActiveTab('queries');

    if (nextFiles.length > 0) {
      try {
        setIsLoading(true);
        setLoadingAction('Parsing SQL files...');
        await parseFiles(nextFiles);
      } catch (error: any) {
        setMessage(error.message || 'Failed to parse SQL files');
      } finally {
        setIsLoading(false);
        setLoadingAction('');
      }
    } else {
      setParsedFiles([]);
    }
  }, [files, parseFiles]);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setParsedFiles([]);
    setResult(null);
    setMessage('');
    setActiveTab('queries');
  }, []);

  const runQueries = useCallback(async (dryRun: boolean, onlyFile?: SqlFile) => {
    const targetFiles = onlyFile ? [onlyFile] : files;
    if (!targetFiles.length) return;
    if (!dryRun && !window.confirm('This will execute SQL against the active Visual CMS database. Continue?')) return;

    setIsLoading(true);
    setLoadingAction(dryRun ? 'Testing queries...' : 'Executing queries...');
    setMessage('');

    try {
      const parsed = await parseFiles(targetFiles);
      const parsedQueries = getAllQueries(parsed);
      const parseErrors = buildParseErrors(parsed);

      if (parsedQueries.length === 0) {
        throw new Error('No SQL queries were found in the selected files.');
      }

      const response = await postSqlOrchestrator<ExecutionResult>({
        action: dryRun ? 'test' : 'execute',
        queries: parsedQueries,
      });

      const executionResult = response.data;
      if (!executionResult) throw new Error(response.error || 'No execution result returned');

      if (parseErrors.length) {
        executionResult.success = false;
        executionResult.errors = [...executionResult.errors, ...parseErrors];
        executionResult.error = executionResult.errors[0];
      }

      setResult(executionResult);
      setActiveTab('report');

      if (!dryRun && executionResult.success) {
        setFiles((current) =>
          current.map((file) => (onlyFile ? (file.name === onlyFile.name ? { ...file, executed: true } : file) : { ...file, executed: true })),
        );
      }
    } catch (error: any) {
      setMessage(error.message || 'SQL run failed');
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  }, [files, parseFiles]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded bg-slate-900 p-2 text-white">
                <FileCode2 size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-950">SQL Orchestrator</h1>
                <p className="mt-1 text-sm text-slate-500">Run SQL files against the active Visual CMS database and export execution reports.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isLoading && (
                <span className="inline-flex items-center gap-2 rounded bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  <Loader2 size={16} className="animate-spin" />
                  {loadingAction}
                </span>
              )}
              <button
                type="button"
                onClick={runConnectionTest}
                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                <RefreshCw size={16} />
                Test Connection
              </button>
              <span
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
                  connectionStatus === 'connected'
                    ? 'bg-green-50 text-green-700'
                    : connectionStatus === 'failed'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Database size={16} />
                {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'failed' ? 'Connection Failed' : 'Not Tested'}
              </span>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {message}
          </div>
        )}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                  <FolderOpen size={18} />
                  SQL Files
                </h2>
                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={clearFiles}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Clear files"
                    aria-label="Clear files"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div className="space-y-4 p-4">
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  accept=".sql"
                  className="hidden"
                  // @ts-expect-error webkitdirectory is browser-specific.
                  webkitdirectory=""
                  onChange={(event) => readFiles(event.target.files, false)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".sql"
                  className="hidden"
                  onChange={(event) => readFiles(event.target.files, true)}
                />

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded border-2 border-dashed border-slate-300 px-4 py-8 text-center hover:border-slate-400 hover:bg-slate-50"
                >
                  <Upload size={28} className="text-slate-400" />
                  <span className="mt-3 text-sm font-semibold text-slate-800">Select SQL Folder</span>
                  <span className="mt-1 text-xs text-slate-500">All .sql files will be loaded in name order.</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <FileText size={16} />
                  Add SQL Files
                </button>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.name} className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatBytes(file.size)}
                              {file.executed ? ' | executed' : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => runQueries(false, file)}
                            disabled={isLoading}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Execute this file"
                            aria-label={`Execute ${file.name}`}
                          >
                            <Play size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">Run</h2>
              </div>
              <div className="space-y-2 p-4">
                <button
                  type="button"
                  onClick={() => runQueries(true)}
                  disabled={!files.length || isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={16} />
                  Dry Run
                </button>
                <button
                  type="button"
                  onClick={() => runQueries(false)}
                  disabled={!files.length || isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play size={16} />
                  Execute All
                </button>
              </div>
            </section>
          </aside>

          <div className="min-w-0 space-y-4">
            <div className="flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('queries')}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === 'queries' ? 'border-slate-900 text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Queries
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === 'report' ? 'border-slate-900 text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Report
              </button>
            </div>

            {activeTab === 'queries' ? <QueryList queries={queries} /> : <ReportPanel result={result} files={files} />}
          </div>
        </section>
      </div>
    </div>
  );
}

