import { ViewConfigUrlResolverComponent } from '@/components/ViewConfigUrlResolverComponent';

export default function ViewConfigUrlPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-10xl mx-auto">
        <ViewConfigUrlResolverComponent />

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Supported URL Rules</h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Current mappings</h3>
              <div className="space-y-2 text-sm text-slate-700">
                <p><span className="font-mono rounded bg-slate-50 px-2 py-1">/uae</span> → code <span className="font-mono">uae</span>, kind <span className="font-mono">1</span> (Nation)</p>
                <p><span className="font-mono rounded bg-slate-50 px-2 py-1">/uae/abudhabi</span> → code <span className="font-mono">abudhabi</span>, kind <span className="font-mono">2</span> (City)</p>
                <p><span className="font-mono rounded bg-slate-50 px-2 py-1">/uae/abudhabi/louvreresidences</span> → code <span className="font-mono">louvreresidences</span>, kind <span className="font-mono">3</span> (Project)</p>
                <p><span className="font-mono rounded bg-slate-50 px-2 py-1">/uae/abudhabi/louvreresidences/r16</span> → code <span className="font-mono">louvreresidences_r16</span>, kind <span className="font-mono">4</span> (Cluster)</p>
                <p><span className="font-mono rounded bg-slate-50 px-2 py-1">/uae/abudhabi/louvreresidences/r16/04</span> → code <span className="font-mono">louvreresidences_r16_04</span>, kind <span className="font-mono">4</span> (Cluster)</p>
                <p><span className="font-mono rounded bg-slate-50 px-2 py-1">/uae/alghadeergardenshero</span> → code <span className="font-mono">alghadeergardenshero</span>, kind <span className="font-mono">2</span> (City)</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Property support right now</h3>
              <div className="space-y-2 text-sm text-slate-700">
                <p><span className="font-mono rounded bg-slate-50 px-2 py-1">.../property/R2-TH-205-01/0?scheme=S1&unitstate=floorplan</span> → kind <span className="font-mono">7</span> (Floor)</p>
                <p><span className="font-mono rounded bg-slate-50 px-2 py-1">.../property/R2-TH-205-01/0?scheme=S1&unitstate=interior</span> → kind <span className="font-mono">8</span> (Interior)</p>
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  The special property URL that resolves to kind <span className="font-mono">6</span> (Property) is still intentionally left unsupported for now, as requested.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
