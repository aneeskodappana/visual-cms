'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageBuilderComponent } from '@/components/PageBuilder/PageBuilderComponent';
import {
  PageDraft,
  newPageDraft,
  newLayout,
  newMarker,
  newBackplate,
  pageFromRow,
  clonePageDraft,
} from '@/lib/pageBuilderTypes';

const PAGE_TEMPLATES: { kind: number; label: string; description: string; color: string }[] = [
  { kind: 2, label: 'City', description: 'City-level page with project markers', color: 'bg-cyan-500' },
  { kind: 3, label: 'Project / Hero', description: 'Project or Hero page with amenity markers and explore card', color: 'bg-emerald-500' },
  { kind: 4, label: 'Cluster', description: 'Cluster-level page with unit/building markers', color: 'bg-amber-500' },
  { kind: 5, label: 'Amenity', description: 'Amenity detail page', color: 'bg-rose-500' },
  { kind: 1, label: 'Nation', description: 'Nation-level page with city markers', color: 'bg-blue-500' },
];

function createTemplate(kind: number): PageDraft {
  const draft = newPageDraft();
  draft.Kind = kind;

  const parentFieldMap: Record<number, PageDraft['ParentLinkField']> = {
    1: 'NationId',
    2: 'CityId',
    3: 'ProjectId',
    4: 'ClusterId',
    5: 'AmenityId',
  };
  draft.ParentLinkField = parentFieldMap[kind] || 'ProjectId';

  const layout = draft.layouts[0];
  layout.IsDefault = true;
  layout.DisplayName = 'Main';
  layout.backplates = [newBackplate(0)];

  return draft;
}

export default function NewPage() {
  const searchParams = useSearchParams();
  const cloneFromId = searchParams.get('cloneFrom');
  const kindParam = searchParams.get('kind');

  const [draft, setDraft] = useState<PageDraft | null>(null);
  const [loading, setLoading] = useState(!!cloneFromId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloneFromId) {
      if (kindParam) {
        setDraft(createTemplate(Number(kindParam)));
      }
      return;
    }
    async function loadAndClone() {
      try {
        const res = await fetch(`/api/page-builder?id=${cloneFromId}`);
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          const original = pageFromRow(json);
          const cloned = clonePageDraft(original);
          cloned.Code = `${original.Code}-copy`;
          cloned.Title = `${original.Title} (Copy)`;
          setDraft(cloned);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to clone');
      } finally {
        setLoading(false);
      }
    }
    loadAndClone();
  }, [cloneFromId, kindParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-4">
        <p className="text-rose-500">{error}</p>
        <Link href="/page-builder" className="text-blue-500 hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/page-builder" className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Choose Page Type</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PAGE_TEMPLATES.map((t) => (
              <button
                key={t.kind}
                onClick={() => setDraft(createTemplate(t.kind))}
                className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${t.color}`} />
                  <span className="font-semibold text-slate-800 group-hover:text-blue-600">{t.label}</span>
                </div>
                <p className="text-sm text-slate-500">{t.description}</p>
              </button>
            ))}
            <button
              onClick={() => setDraft(newPageDraft())}
              className="bg-white border border-dashed border-slate-300 rounded-xl p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="font-semibold text-slate-600 group-hover:text-blue-600">Blank Page</span>
              </div>
              <p className="text-sm text-slate-500">Start from scratch with empty defaults</p>
            </button>
          </div>
        </div>
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
              New Page {cloneFromId && <span className="text-amber-600 text-base font-normal ml-2">(cloned)</span>}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {['Globe','Nation','City','Project','Cluster','Amenity'][draft.Kind] || `Kind ${draft.Kind}`} page
            </p>
          </div>
        </div>
        <PageBuilderComponent initialDraft={draft} />
      </div>
    </div>
  );
}
