import { DatabaseTestComponent } from "@/components/DatabaseTestComponent";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">WOACMS</h1>
        </div>

        {/* Main Content */}
        <main className="space-y-8">
          {/* Database Test Section */}
          {/* Quick Links */}
          <section className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex flex-wrap gap-3">
              <a
                href="/viewconfig-search"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
              >
                ViewConfig Search
              </a>
              <a
                href="/unit-search"
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Unit Search
              </a>
              <a
                href="/project-search"
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                Project Search
              </a>
              <a
                href="/api/db-test"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View Raw API Response
              </a>
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Database Status</h2>
            <DatabaseTestComponent />
          </section>
        </main>
      </div>
    </div>
  );
}
