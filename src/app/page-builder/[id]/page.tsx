'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageBuilderComponent } from '@/components/PageBuilder/PageBuilderComponent';
import { pageFromRow, PageDraft } from '@/lib/pageBuilderTypes';

export default function EditPage() {
  const params = useParams();
  const id = params.id as string;
  const [initialDraft, setInitialDraft] = useState<PageDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/page-builder?id=${id}`);
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          setInitialDraft(pageFromRow(json));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading page...</div>
      </div>
    );
  }

  if (error || !initialDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-4">
        <p className="text-rose-500">{error || 'Page not found'}</p>
        <Link href="/page-builder" className="text-blue-500 hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Back to pages
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/page-builder" className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Edit: <span className="text-blue-600 font-mono">{initialDraft.Code || initialDraft.Id.slice(0, 8)}</span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {initialDraft.Title || 'Untitled'} — {['Globe','Nation','City','Project','Cluster','Amenity','Property','Floor','Interior','Gallery'][initialDraft.Kind] || `Kind ${initialDraft.Kind}`}
            </p>
          </div>
        </div>
        <PageBuilderComponent initialDraft={initialDraft} />
      </div>
    </div>
  );
}
