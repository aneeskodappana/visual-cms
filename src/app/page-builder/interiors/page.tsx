'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, FolderSearch, FileText, Zap, Copy, Check, AlertCircle, ChevronDown, ChevronUp, Box,
} from 'lucide-react';

interface ProjectInfo {
  folder: string; fullPath: string; projectCode: string; cdnBaseUrl: string;
  csvFolder: string; backplateFolder: string; subfolders: string[];
}

interface ScanResult {
  hotspotFolders: string[]; hotspotDetails: Record<string, string[]>;
  collisionFiles: string[]; csvCameraFiles: string[];
  hotspotPath: string; collisionPath: string; csvCameraPath: string;
}

interface MatchedUnit {
  code: string; hotspotFolder: string; collisionFile: string; csvCameraFile: string;
  hotspotImages: string[]; roomCount: number; imageCount: number;
  mirror: string; unitId: string; tower: string; floor: string;
  unitNumber: string; floorPart: string; schemeFilter: string;
  matched: boolean; error?: string;
}

type Step = 'config' | 'match' | 'generate';

export default function InteriorGeneratorPage() {
  const [step, setStep] = useState<Step>('config');
  const [availableProjects, setAvailableProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [projectFolderPath, setProjectFolderPath] = useState('');
  const [hotspotSubfolder, setHotspotSubfolder] = useState('image_360_property_unit');
  const [collisionSubfolder, setCollisionSubfolder] = useState('model_360-collision_property_variation');
  const [csvCameraSubfolder, setCsvCameraSubfolder] = useState('csv_camera_property_variation');
  const [cdnBaseUrl, setCdnBaseUrl] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [mediaVersion, setMediaVersion] = useState(17);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [matchedUnits, setMatchedUnits] = useState<MatchedUnit[]>([]);

  const [generating, setGenerating] = useState(false);
  const [sql, setSql] = useState('');
  const [genStats, setGenStats] = useState<{ processedCount: number; totalGroups: number; totalHotspots: number; errors: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    fetch('/api/page-builder/floorplans/projects')
      .then((r) => r.json())
      .then((json) => { if (json.status === 'success') setAvailableProjects(json.data); })
      .finally(() => setLoadingProjects(false));
  }, []);

  const handleProjectSelect = (folder: string) => {
    const proj = availableProjects.find((p) => p.folder === folder);
    if (!proj) return;
    setSelectedProject(proj);
    setProjectFolderPath(proj.fullPath);
    setCdnBaseUrl(proj.cdnBaseUrl);
    setProjectCode(proj.projectCode);
    const subs = proj.subfolders;
    setHotspotSubfolder(subs.find((s) => s.startsWith('image_360')) || 'image_360_property_unit');
    setCollisionSubfolder(subs.find((s) => s.startsWith('model_360')) || 'model_360-collision_property_variation');
    setCsvCameraSubfolder(subs.find((s) => s.startsWith('csv_camera')) || 'csv_camera_property_variation');
  };

  const handleScan = useCallback(async () => {
    setScanning(true); setScanError(null);
    try {
      const res = await fetch('/api/page-builder/interiors/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectFolderPath, hotspotSubfolder, collisionSubfolder, csvCameraSubfolder }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setScanResult(json.data);
        autoMatch(json.data);
        setStep('match');
      } else { setScanError(json.error); }
    } catch (e) { setScanError(e instanceof Error ? e.message : 'Scan failed'); }
    finally { setScanning(false); }
  }, [projectFolderPath, hotspotSubfolder, collisionSubfolder, csvCameraSubfolder]);

  const autoMatch = (scan: ScanResult) => {
    const units: MatchedUnit[] = [];
    const defaultScheme = 's1_0';

    scan.hotspotFolders.forEach((folder) => {
      const images = scan.hotspotDetails[folder] || [];
      if (images.length === 0) return;

      const parts = folder.split('-');
      const tower = parts[0] || '';
      const floor = parts[1] || '';
      const unitNum = parts[2] || '';

      const schemeImages = images.filter((img) => img.includes(defaultScheme));
      const roomKeys = new Set(schemeImages.map((img) => img.split('_').at(-2)?.toLowerCase()).filter(Boolean));

      const code = `${projectCode}_${tower}-${parseInt(floor) || floor}${unitNum}_${defaultScheme}`;

      // Match collision GLB and CSV camera by unit type prefix
      // Folder: AlGhadeerGardens-NA1_R2-TH-001 → type = "th"
      // Collision: model_360-collision_th_s_3b_3tm.glb → contains "th_"
      // CSV: csv_camera_th_s_3b_3tm_s1.csv → contains "th_"
      const folderParts = folder.split('-');
      const unitTypeRaw = folderParts.find((p) => /^(TH|V|A|PH|SV|TX|H)$/i.test(p)) || '';
      const unitType = unitTypeRaw.toLowerCase();

      // Find collision files matching this unit type
      const matchingCollisions = scan.collisionFiles.filter((f) =>
        f.toLowerCase().includes(`_${unitType}_`),
      );
      const collisionFile = matchingCollisions[0] || '';

      // Find CSV camera files matching this unit type
      const matchingCsvs = scan.csvCameraFiles.filter((f) =>
        f.toLowerCase().includes(`_${unitType}_`),
      );
      const csvCameraFile = matchingCsvs[0] || '';

      const errors: string[] = [];
      if (!collisionFile) errors.push('No collision GLB');
      if (!csvCameraFile) errors.push('No CSV camera');

      units.push({
        code,
        hotspotFolder: folder,
        collisionFile,
        csvCameraFile,
        hotspotImages: images,
        roomCount: roomKeys.size,
        imageCount: schemeImages.length,
        mirror: 'NORMAL',
        unitId: '',
        tower, floor, unitNumber: unitNum,
        floorPart: '0',
        schemeFilter: defaultScheme,
        matched: schemeImages.length > 0,
        error: errors.length > 0 ? errors.join(', ') : undefined,
      });
    });

    setMatchedUnits(units);
  };

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const valid = matchedUnits.filter((u) => u.matched);
      const res = await fetch('/api/page-builder/interiors/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          units: valid, hotspotBasePath: scanResult?.hotspotPath, csvCameraBasePath: scanResult?.csvCameraPath,
          cdnBaseUrl, hotspotSubfolder, collisionSubfolder, mediaVersion,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') { setSql(json.data.sql); setGenStats(json.data); setStep('generate'); }
      else alert(json.error);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setGenerating(false); }
  }, [matchedUnits, scanResult, cdnBaseUrl, hotspotSubfolder, collisionSubfolder, mediaVersion]);

  const handleCopy = () => { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const matchedCount = matchedUnits.filter((u) => u.matched).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/page-builder" className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><ArrowLeft size={24} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Interior Generator</h1>
            <p className="text-sm text-slate-500 mt-0.5">Bulk generate ViewConfig + Layout3D + HotspotGroup + Hotspot SQL from 360 images</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8">
          {(['config', 'match', 'generate'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-slate-300" />}
              <div className={`px-3 py-1 text-xs font-medium rounded-full ${step === s ? 'bg-blue-600 text-white' : ['config','match','generate'].indexOf(step) > i ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {i + 1}. {s === 'config' ? 'Configure' : s === 'match' ? 'Match & Review' : 'Generate SQL'}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Config */}
        {step === 'config' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><Box size={20} /> Project Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Project</label>
                {loadingProjects ? <div className="text-sm text-slate-400 animate-pulse py-2">Loading...</div> : (
                  <select value={selectedProject?.folder || ''} onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Select a project —</option>
                    {availableProjects.map((p) => <option key={p.folder} value={p.folder}>{p.projectCode} — {p.folder}</option>)}
                  </select>
                )}
                {selectedProject && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">{selectedProject.fullPath}</span>
                    <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded">{selectedProject.subfolders.length} subfolders</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">360 Images Subfolder</label>
                <select value={hotspotSubfolder} onChange={(e) => setHotspotSubfolder(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono">
                  <option value="">— select —</option>
                  {(selectedProject?.subfolders || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Collision Model Subfolder</label>
                <select value={collisionSubfolder} onChange={(e) => setCollisionSubfolder(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono">
                  <option value="">— select —</option>
                  {(selectedProject?.subfolders || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CSV Camera Subfolder</label>
                <select value={csvCameraSubfolder} onChange={(e) => setCsvCameraSubfolder(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono">
                  <option value="">— select —</option>
                  {(selectedProject?.subfolders || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CDN Base URL</label>
                <input type="text" value={cdnBaseUrl} onChange={(e) => setCdnBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Project Code</label>
                <input type="text" value={projectCode} onChange={(e) => setProjectCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Media Version</label>
                <input type="number" value={mediaVersion} onChange={(e) => setMediaVersion(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {scanError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-center gap-2"><AlertCircle size={16} /> {scanError}</div>}
            <button onClick={handleScan} disabled={scanning || !projectFolderPath}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <FolderSearch size={16} /> {scanning ? 'Scanning...' : 'Scan Folder'}
            </button>
          </div>
        )}

        {/* Step 2: Match */}
        {step === 'match' && scanResult && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><FileText size={20} /> Match Results</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-600 font-medium">{matchedCount} matched</span>
                  <span className="text-slate-500">{scanResult.hotspotFolders.length} folders, {scanResult.collisionFiles.length} GLBs, {scanResult.csvCameraFiles.length} CSVs</span>
                </div>
              </div>

              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
                <p className="font-semibold">How interior matching works:</p>
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>Each subfolder in <code className="bg-blue-100 px-1 rounded">image_360_property_unit/</code> represents one unit (e.g. <code className="bg-blue-100 px-1 rounded">b5-08-09</code>)</li>
                  <li>360 images inside are grouped by <strong>room name</strong> (extracted from filename, e.g. <code className="bg-blue-100 px-1 rounded">..._Bathroom_1.jpg</code>)</li>
                  <li>Only images matching the <strong>scheme filter</strong> (e.g. <code className="bg-blue-100 px-1 rounded">s1_0</code>) are included</li>
                  <li>GLB collision model matched via <code className="bg-blue-100 px-1 rounded">featureSpecification</code> from MuleSoft data</li>
                  <li>CSV camera file provides 3D position (X,Y,Z) and rotation for each hotspot</li>
                  <li><code className="bg-blue-100 px-1 rounded">mirror</code> field determines model scale (NORMAL → positive X, MIRROR → negative X)</li>
                </ol>
              </div>

              <div className="max-h-[500px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-3 py-2 font-medium text-slate-600 w-8">St</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Code</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Folder</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-600">Rooms</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-600">Images</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Collision</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">CSV Camera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedUnits.map((unit, i) => (
                      <tr key={i} className={`border-b border-slate-100 ${unit.matched ? 'hover:bg-slate-50' : 'bg-rose-50'}`}>
                        <td className="px-3 py-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${unit.matched ? 'bg-emerald-500' : 'bg-rose-500'}`} title={unit.error || 'OK'} />
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700" title={unit.code}><span className="cursor-help">{unit.code}</span></td>
                        <td className="px-3 py-2 font-mono text-indigo-600" title={`${unit.hotspotImages.length} total images`}><span className="cursor-help">{unit.hotspotFolder}</span></td>
                        <td className="text-center px-3 py-2 text-slate-500">{unit.roomCount}</td>
                        <td className="text-center px-3 py-2 text-slate-500">{unit.imageCount}</td>
                        <td className="px-3 py-2 text-slate-500 max-w-[150px]" title={unit.collisionFile || 'Not set'}>
                          <span className="block truncate cursor-help">{unit.collisionFile || <span className="text-slate-300">—</span>}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 max-w-[150px]" title={unit.csvCameraFile || 'Not set'}>
                          <span className="block truncate cursor-help">{unit.csvCameraFile || <span className="text-slate-300">—</span>}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setStep('config')} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100">Back</button>
              <button onClick={handleGenerate} disabled={generating || matchedCount === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                <Zap size={16} /> {generating ? 'Generating...' : `Generate SQL for ${matchedCount} units`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: SQL */}
        {step === 'generate' && genStats && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><Zap size={20} /> Generated SQL</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-600 font-medium">{genStats.processedCount} ViewConfigs</span>
                  <span className="text-blue-600 font-medium">{genStats.totalGroups} groups</span>
                  <span className="text-purple-600 font-medium">{genStats.totalHotspots} hotspots</span>
                  {genStats.errors.length > 0 && (
                    <button onClick={() => setShowErrors(!showErrors)} className="text-rose-600 font-medium flex items-center gap-1">
                      {genStats.errors.length} errors {showErrors ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
              </div>
              {showErrors && genStats.errors.length > 0 && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 max-h-[150px] overflow-y-auto">
                  {genStats.errors.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              )}
              <div className="relative">
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs font-mono max-h-[500px] overflow-auto whitespace-pre-wrap">{sql}</pre>
                <button onClick={handleCopy}
                  className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs rounded hover:bg-slate-600">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy SQL'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('match')} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100">Back</button>
              <button onClick={() => setStep('config')} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100">Start Over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
