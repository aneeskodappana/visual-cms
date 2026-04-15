'use client';

import { useState } from 'react';
import { FloorplateMarkerAdder } from '@/components/FloorplateMarkerAdder';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type UtilityType = 'floorplate-marker-adder' | null;

export default function YasParkPlacePage() {
  const [activeUtility, setActiveUtility] = useState<UtilityType>(null);

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
          <h1 className="text-4xl font-bold text-slate-900">YasParkPlace Utilities</h1>
        </div>

        {!activeUtility && (
          <section className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Available Utilities</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActiveUtility('floorplate-marker-adder')}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                Floorplate Marker Adder
              </button>
            </div>
          </section>
        )}

        {activeUtility === 'floorplate-marker-adder' && (
          <div>
            <button
              onClick={() => setActiveUtility(null)}
              className="mb-4 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={16} /> Back to utilities
            </button>
            <FloorplateMarkerAdder />
          </div>
        )}
      </div>
    </div>
  );
}
