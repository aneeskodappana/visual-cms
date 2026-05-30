'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FolderSearch,
  FileText,
  Zap,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ProjectInfo {
  folder: string;
  fullPath: string;
  projectCode: string;
  cdnBaseUrl: string;
  csvFolder: string;
  backplateFolder: string;
  subfolders: string[];
}

interface ScanResult {
  csvFiles: string[];
  backplateFiles: string[];
  backplateThumbnails: string[];
  csvPath: string;
  backplatePath: string;
  csvCount: number;
  backplateCount: number;
}

interface MatchedUnit {
  csvFile: string;
  backplateFile: string;
  thumbnailFile: string;
  code: string;
  title: string;
  rooms: number;
  matched: boolean;
  error?: string;
}

type Step = 'config' | 'scan' | 'match' | 'generate';

export default function FloorplanGeneratorPage() {
  const [step, setStep] = useState<Step>('config');
  const [availableProjects, setAvailableProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [projectFolderPath, setProjectFolderPath] = useState('');
  const [csvSubfolder, setCsvSubfolder] = useState('');
  const [backplateSubfolder, setBackplateSubfolder] = useState('');
  const [cdnBaseUrl, setCdnBaseUrl] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [backplateWidth, setBackplateWidth] = useState(4096);
  const [backplateHeight, setBackplateHeight] = useState(4096);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/page-builder/floorplans/projects')
      .then((r) => r.json())
      .then((json) => {
        if (json.status === 'success') setAvailableProjects(json.data);
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  const handleProjectSelect = (folder: string) => {
    const proj = availableProjects.find((p) => p.folder === folder);
    if (!proj) return;
    setSelectedProject(proj);
    setProjectFolderPath(proj.fullPath);
    setCsvSubfolder(proj.csvFolder);
    setBackplateSubfolder(proj.backplateFolder);
    setCdnBaseUrl(proj.cdnBaseUrl);
    setProjectCode(proj.projectCode);
  };

  const [matchedUnits, setMatchedUnits] = useState<MatchedUnit[]>([]);
  const [generating, setGenerating] = useState(false);
  const [sql, setSql] = useState('');
  const [genStats, setGenStats] = useState<{ processedCount: number; totalMarkers: number; errors: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch('/api/page-builder/floorplans/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectFolderPath, csvSubfolder, backplateSubfolder }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setScanResult(json.data);
        autoMatch(json.data);
        setStep('match');
      } else {
        setScanError(json.error);
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [projectFolderPath, csvSubfolder, backplateSubfolder]);

  const autoMatch = (scan: ScanResult) => {
    const units: MatchedUnit[] = [];

    scan.csvFiles.forEach((csvFile) => {
      const baseName = csvFile.replace(/^csv_floorplan_/, '').replace(/\.csv$/, '');
      const backplateFile = scan.backplateFiles.find(
        (f) => f.includes(baseName) && !f.includes('_w640') && !f.includes('_thumb'),
      );
      const thumbnailFile = scan.backplateThumbnails.find(
        (f) => f.includes(baseName),
      );

      let code = `${projectCode}_${baseName}`;
      const dashParts = baseName.split('-');
      if (dashParts.length >= 3) {
        const tower = dashParts[0];
        const floor = dashParts[1];
        const rest = dashParts.slice(2).join('-');
        const unitSchemeMatch = rest.match(/^(\d+)_(.+)$/);
        if (unitSchemeMatch) {
          code = `${projectCode}_${tower}-${parseInt(floor) || floor}${unitSchemeMatch[1]}_${unitSchemeMatch[2]}`;
        }
      }

      units.push({
        csvFile,
        backplateFile: backplateFile || '',
        thumbnailFile: thumbnailFile || '',
        code,
        title: code,
        rooms: 0,
        matched: !!backplateFile,
        error: backplateFile ? undefined : 'No matching backplate found',
      });
    });

    setMatchedUnits(units);
  };

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const validUnits = matchedUnits.filter((u) => u.matched);
      const res = await fetch('/api/page-builder/floorplans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          units: validUnits.map((u) => ({
            csvFile: u.csvFile,
            backplateFile: u.backplateFile,
            thumbnailFile: u.thumbnailFile,
            code: u.code,
            title: u.title,
          })),
          csvFolderPath: scanResult?.csvPath || '',
          backplateSubfolder,
          cdnBaseUrl,
          backplateWidth,
          backplateHeight,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSql(json.data.sql);
        setGenStats(json.data);
        setStep('generate');
      } else {
        alert(json.error || 'Generation failed');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [matchedUnits, scanResult, backplateSubfolder, cdnBaseUrl, backplateWidth, backplateHeight]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const matchedCount = matchedUnits.filter((u) => u.matched).length;
  const unmatchedCount = matchedUnits.filter((u) => !u.matched).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/page-builder" className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Floorplan Generator</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Bulk generate ViewConfig + Layout2D + Marker SQL from CSV marker files
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(['config', 'match', 'generate'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-slate-300" />}
              <div
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : ['config', 'match', 'generate'].indexOf(step) > i
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i + 1}. {s === 'config' ? 'Configure' : s === 'match' ? 'Match & Review' : 'Generate SQL'}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Config */}
        {step === 'config' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FolderSearch size={20} /> Project Configuration
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Project</label>
                {loadingProjects ? (
                  <div className="text-sm text-slate-400 animate-pulse py-2">Loading projects...</div>
                ) : (
                  <select
                    value={selectedProject?.folder || ''}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— Select a project —</option>
                    {availableProjects.map((p) => (
                      <option key={p.folder} value={p.folder}>
                        {p.projectCode} — {p.folder}
                      </option>
                    ))}
                  </select>
                )}
                {selectedProject && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">{selectedProject.fullPath}</span>
                    {selectedProject.csvFolder && <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">CSV: {selectedProject.csvFolder}</span>}
                    {selectedProject.backplateFolder && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">Backplate: {selectedProject.backplateFolder}</span>}
                    <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded">{selectedProject.subfolders.length} subfolders</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CSV Subfolder</label>
                <input
                  type="text"
                  value={csvSubfolder}
                  onChange={(e) => setCsvSubfolder(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Backplate Subfolder</label>
                <input
                  type="text"
                  value={backplateSubfolder}
                  onChange={(e) => setBackplateSubfolder(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CDN Base URL</label>
                <input
                  type="text"
                  value={cdnBaseUrl}
                  onChange={(e) => setCdnBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Project Code Prefix</label>
                <input
                  type="text"
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Backplate Width</label>
                <input
                  type="number"
                  value={backplateWidth}
                  onChange={(e) => setBackplateWidth(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Backplate Height</label>
                <input
                  type="number"
                  value={backplateHeight}
                  onChange={(e) => setBackplateHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {scanError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-center gap-2">
                <AlertCircle size={16} /> {scanError}
              </div>
            )}

            <button
              onClick={handleScan}
              disabled={scanning || !projectFolderPath}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <FolderSearch size={16} /> {scanning ? 'Scanning...' : 'Scan Folder'}
            </button>
          </div>
        )}

        {/* Step 2: Match & Review */}
        {step === 'match' && scanResult && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <FileText size={20} /> Match Results
                </h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-600 font-medium">{matchedCount} matched</span>
                  {unmatchedCount > 0 && (
                    <span className="text-rose-600 font-medium">{unmatchedCount} missing backplate</span>
                  )}
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">{scanResult.csvCount} CSVs, {scanResult.backplateCount} backplates</span>
                </div>
              </div>

              {/* Matching logic info */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
                <p className="font-semibold">How file matching works:</p>
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>Each <code className="bg-blue-100 px-1 rounded">csv_floorplan_*.csv</code> file is listed from the CSV subfolder</li>
                  <li>The <strong>base name</strong> is extracted by stripping the <code className="bg-blue-100 px-1 rounded">csv_floorplan_</code> prefix and <code className="bg-blue-100 px-1 rounded">.csv</code> suffix</li>
                  <li>E.g. <code className="bg-blue-100 px-1 rounded">csv_floorplan_<strong>b2-02-06_s1_0</strong>.csv</code> → base: <code className="bg-blue-100 px-1 rounded">b2-02-06_s1_0</code></li>
                  <li>The base name encodes: <strong>cluster/building</strong>-<strong>floor</strong>-<strong>unit</strong>_<strong>scheme</strong> (e.g. s1=Scheme1, s2=Scheme2, _0=Ground, _1=Upper)</li>
                  <li>A matching backplate is found by searching for <code className="bg-blue-100 px-1 rounded">backplate_image_floorplan_*{'{base}'}*.webp</code> in the backplate subfolder</li>
                  <li>Thumbnail matched by <code className="bg-blue-100 px-1 rounded">_w640_q10</code> suffix</li>
                  <li>The ViewConfig <strong>code</strong> is built as: <code className="bg-blue-100 px-1 rounded">{'{projectCode}'}_{'{base}'}</code></li>
                </ol>
                <p className="mt-1 text-blue-600">In the Automation scripts, <code className="bg-blue-100 px-1 rounded">aldar_unit_number</code> from MuleSoft is parsed to extract cluster/floor/unit, and <code className="bg-blue-100 px-1 rounded">featureSpecification</code> + <code className="bg-blue-100 px-1 rounded">mirror</code> determine the scheme variation (s1/s2, furnished/unfurnished).</p>
              </div>

              <div className="max-h-[500px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-3 py-2 font-medium text-slate-600 w-12">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Code</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Base Name</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">CSV File</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Backplate</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Thumbnail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedUnits.map((unit, i) => {
                      const baseName = unit.csvFile.replace(/^csv_floorplan_/, '').replace(/\.csv$/, '');
                      return (
                        <tr key={i} className={`border-b border-slate-100 ${unit.matched ? 'hover:bg-slate-50' : 'bg-rose-50 hover:bg-rose-100'}`}>
                          <td className="px-3 py-2">
                            {unit.matched ? (
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Matched" />
                            ) : (
                              <span className="inline-block w-2 h-2 rounded-full bg-rose-500" title={unit.error || 'Not matched'} />
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-700" title={unit.code}>
                            <span className="cursor-help">{unit.code}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-indigo-600" title={`Extracted from CSV filename: ${unit.csvFile}`}>
                            <span className="cursor-help">{baseName}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500 max-w-[180px]" title={unit.csvFile}>
                            <span className="block truncate cursor-help">{unit.csvFile}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500 max-w-[180px]" title={unit.backplateFile || 'No matching backplate found'}>
                            {unit.backplateFile ? (
                              <span className="block truncate cursor-help">{unit.backplateFile}</span>
                            ) : (
                              <span className="text-rose-500 cursor-help" title={`Searched for backplate containing "${baseName}" in ${backplateSubfolder}/`}>Not found</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 max-w-[150px]" title={unit.thumbnailFile || 'No thumbnail'}>
                            {unit.thumbnailFile ? (
                              <span className="block truncate cursor-help text-slate-400">{unit.thumbnailFile.split('_').slice(-3).join('_')}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('config')}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || matchedCount === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <Zap size={16} /> {generating ? 'Generating...' : `Generate SQL for ${matchedCount} units`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Generated SQL */}
        {step === 'generate' && genStats && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Zap size={20} /> Generated SQL
                </h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-600 font-medium">{genStats.processedCount} ViewConfigs</span>
                  <span className="text-blue-600 font-medium">{genStats.totalMarkers} markers</span>
                  {genStats.errors.length > 0 && (
                    <button
                      onClick={() => setShowErrors(!showErrors)}
                      className="text-rose-600 font-medium flex items-center gap-1"
                    >
                      {genStats.errors.length} errors
                      {showErrors ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
              </div>

              {showErrors && genStats.errors.length > 0 && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 max-h-[150px] overflow-y-auto">
                  {genStats.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              <div className="relative">
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs font-mono max-h-[500px] overflow-auto whitespace-pre-wrap">
                  {sql}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs rounded hover:bg-slate-600"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy SQL'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('match')}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Back to Review
              </button>
              <button
                onClick={() => setStep('config')}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
