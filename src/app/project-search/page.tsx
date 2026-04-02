import { ProjectSearchComponent } from '@/components/ProjectSearchComponent';

export default function ProjectSearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-10xl mx-auto">

        <ProjectSearchComponent />

        <div className="mt-8 p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">How to Use</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Search by Code</h3>
              <p className="text-slate-700 text-sm mb-3">
                Enter a code value and select your match type using the radio buttons:
              </p>
              <div className="space-y-2">
                <div className="text-slate-600 text-sm">
                  <p className="font-semibold text-slate-700">Exact (default)</p>
                  <p className="font-mono bg-slate-50 p-2 rounded">Matches the exact code (case-insensitive)</p>
                </div>
                <div className="text-slate-600 text-sm">
                  <p className="font-semibold text-slate-700">Contains</p>
                  <p className="font-mono bg-slate-50 p-2 rounded">Matches any code containing your text</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Search by UUID</h3>
              <p className="text-slate-700 text-sm mb-3">
                Enter one or more UUID values separated by commas. Use this for exact lookups.
              </p>
              <p className="text-slate-600 text-sm font-mono bg-slate-50 p-2 rounded">
                Single: "550e8400-e29b-41d4-a716-446655440000"
              </p>
              <p className="text-slate-600 text-sm font-mono bg-slate-50 p-2 rounded mt-2">
                Multiple: "uuid1, uuid2, uuid3"
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Included Relations</h4>
            <p className="text-blue-800 text-sm">
              Each Project record includes related data such as ViewConfig, City (with Nation), Clusters (with Properties,
              PropertyFloors, Units), Amenities, CacheInfo, ProjectSalesLeadInfo, and VariantInfo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
