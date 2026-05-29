'use client';

import { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';

interface Props {
  sql: string;
  fileName: string;
}

export function SqlOutput({ sql, fileName }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Generated SQL</h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              copied
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            <Download size={14} /> Download .sql
          </button>
        </div>
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 whitespace-pre-wrap break-all">
        {sql}
      </pre>
    </div>
  );
}
