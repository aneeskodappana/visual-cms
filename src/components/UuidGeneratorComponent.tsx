'use client';

import { useState } from 'react';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { Copy, Check, RefreshCw } from 'lucide-react';

export function UuidGeneratorComponent() {
  const [uuids, setUuids] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [uuidVersion, setUuidVersion] = useState<'v4' | 'v5'>('v4');
  const [v5Namespace, setV5Namespace] = useState('');
  const [v5Name, setV5Name] = useState('');

  const generateUuid = () => {
    let newUuid: string;

    if (uuidVersion === 'v4') {
      newUuid = uuidv4();
    } else {
      // For v5, we need a namespace and name
      if (!v5Namespace || !v5Name) {
        alert('Please provide both namespace and name for UUID v5');
        return;
      }
      try {
        newUuid = uuidv5(v5Name, v5Namespace as any);
      } catch (error) {
        alert('Invalid namespace. Please use a valid UUID or one of the predefined namespaces.');
        return;
      }
    }

    setUuids((prev) => [newUuid, ...prev]);
  };

  const generateMultiple = (count: number) => {
    const newUuids: string[] = [];
    for (let i = 0; i < count; i++) {
      if (uuidVersion === 'v4') {
        newUuids.push(uuidv4());
      } else {
        if (!v5Namespace || !v5Name) {
          alert('Please provide both namespace and name for UUID v5');
          return;
        }
        try {
          newUuids.push(uuidv5(`${v5Name}-${i}`, v5Namespace as any));
        } catch (error) {
          alert('Invalid namespace. Please use a valid UUID or one of the predefined namespaces.');
          return;
        }
      }
    }
    setUuids((prev) => [...newUuids, ...prev]);
  };

  const copyText = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const clearAll = () => {
    setUuids([]);
  };

  const copyAll = async () => {
    const allUuids = uuids.join('\n');
    await navigator.clipboard.writeText(allUuids);
    setCopied('all');
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Generation Form */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-2xl font-semibold text-slate-900">UUID Generator</h2>

        <div className="space-y-4">
          {/* UUID Version Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">UUID Version</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="uuidVersion"
                  value="v4"
                  checked={uuidVersion === 'v4'}
                  onChange={(e) => setUuidVersion(e.target.value as 'v4' | 'v5')}
                  className="rounded"
                />
                <span className="text-sm text-slate-700">Random (v4)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="uuidVersion"
                  value="v5"
                  checked={uuidVersion === 'v5'}
                  onChange={(e) => setUuidVersion(e.target.value as 'v4' | 'v5')}
                  className="rounded"
                />
                <span className="text-sm text-slate-700">Namespace (v5)</span>
              </label>
            </div>
          </div>

          {/* V5 Configuration */}
          {uuidVersion === 'v5' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Namespace UUID</label>
                <input
                  type="text"
                  value={v5Namespace}
                  onChange={(e) => setV5Namespace(e.target.value)}
                  placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={v5Name}
                  onChange={(e) => setV5Name(e.target.value)}
                  placeholder="e.g., my-resource-name"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={generateUuid}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
            >
              <RefreshCw size={16} />
              Generate UUID
            </button>
            <button
              onClick={() => generateMultiple(5)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
            >
              <RefreshCw size={16} />
              Generate 5 UUIDs
            </button>
            <button
              onClick={() => generateMultiple(10)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
            >
              <RefreshCw size={16} />
              Generate 10 UUIDs
            </button>
            {uuids.length > 0 && (
              <>
                <button
                  onClick={copyAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {copied === 'all' ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                  Copy All ({uuids.length})
                </button>
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                >
                  Clear All
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Generated UUIDs List */}
      {uuids.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Generated UUIDs ({uuids.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {uuids.map((uuid, index) => (
              <div
                key={`${uuid}-${index}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 hover:bg-slate-100 transition-colors"
              >
                <div className="flex-1">
                  <p className="break-all font-mono text-sm text-slate-900">{uuid}</p>
                </div>
                <button
                  onClick={() => copyText(uuid, `uuid-${index}`)}
                  className="ml-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  {copied === `uuid-${index}` ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                  {copied === `uuid-${index}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">UUID Information</h3>
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <p className="font-semibold text-slate-900">UUID v4 (Random)</p>
            <p>Generates a random UUID. Each UUID is guaranteed to be unique and is suitable for most use cases.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">UUID v5 (Namespace-based)</p>
            <p>Generates a deterministic UUID based on a namespace and name. The same namespace and name will always produce the same UUID.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
