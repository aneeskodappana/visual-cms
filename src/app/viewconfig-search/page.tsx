import { ViewConfigSearchComponent } from '@/components/ViewConfigSearchComponent';

export default function ViewConfigSearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-10xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">ViewConfig Search</h1>
          <p className="text-lg text-slate-600">
            Search and explore ViewConfig records with their complete relations
          </p>
        </div>

        {/* Search Component */}
        <ViewConfigSearchComponent />

        {/* Info Section */}
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
                  <p className="text-xs mt-1">Example: "dashboard", "project-view"</p>
                </div>
                <div className="text-slate-600 text-sm">
                  <p className="font-semibold text-slate-700">Contains</p>
                  <p className="font-mono bg-slate-50 p-2 rounded">Matches any code containing your text</p>
                  <p className="text-xs mt-1">Examples: "view", "config", "dash"</p>
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
              Each ViewConfig record includes all related data such as Layout3D, Layout2Ds, Navigations,
              GalleryItems, and references to Nation, City, Project, Cluster, Amenity, Unit variants, and Parking information.
            </p>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Data Integrity Issue: Markers Excluded</h4>
            <p className="text-yellow-800 text-sm mb-3">
              Marker data is excluded from search results due to NaN values in position fields (PositionTop, PositionLeft, etc.) 
              in the database. This is a data quality issue that should be addressed.
            </p>
            <p className="text-yellow-800 text-sm">
              To fetch markers separately with automatic NaN handling, use:
            </p>
            <p className="font-mono text-yellow-900 text-xs bg-yellow-100 p-2 rounded mt-2">
              GET /api/viewconfig/markers?layout2dId=YOUR_LAYOUT_2D_UUID
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
