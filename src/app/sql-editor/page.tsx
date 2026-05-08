'use client';

import { SqlQueryValueEditor } from '@/components/SqlQueryValueEditor';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SqlEditorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-4xl font-bold text-slate-900">SQL Query Value Editor</h1>
        </div>
        <SqlQueryValueEditor />
      </div>
    </div>
  );
}
