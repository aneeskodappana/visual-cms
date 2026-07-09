import { UnitSqlGeneratorComponent } from '@/components/UnitSqlGeneratorComponent';

export default function UnitSqlGeneratorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="mx-auto max-w-10xl">
        <UnitSqlGeneratorComponent />

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Search Inputs</h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-2 text-sm text-slate-700">
              <h3 className="font-semibold text-slate-900">Project Search</h3>
              <p>Use this when you want all units from one project, then filter and generate SQL from the unit picker.</p>
              <p className="rounded bg-slate-50 p-2 font-mono text-xs">code=wimbledonbridgehouse</p>
            </div>

            <div className="space-y-2 text-sm text-slate-700">
              <h3 className="font-semibold text-slate-900">Unit Search</h3>
              <p>Direct unit lookup supports raw unit numbers, UUIDs, and normalized aliases.</p>
              <p className="rounded bg-slate-50 p-2 font-mono text-xs">twickenhamsquare_rivierahouse_01_02</p>
            </div>

            <div className="space-y-2 text-sm text-slate-700">
              <h3 className="font-semibold text-slate-900">URL Search</h3>
              <p>Paste an Aldar property URL and the page will derive the unit lookup automatically.</p>
              <p className="rounded bg-slate-50 p-2 font-mono text-xs break-all">
                https://world.aldar.com/uk/london/twickenhamsquare/property/RivieraHouse-01-02/0?unitstate=floorplan&scheme=S1&furnished=true
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
