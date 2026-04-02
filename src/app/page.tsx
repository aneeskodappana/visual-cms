import { DatabaseTestComponent } from "@/components/DatabaseTestComponent";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Visual CMS</h1>
          <p className="text-lg text-slate-600">Database Connection & Schema Inspector</p>
        </div>

        {/* Main Content */}
        <main className="space-y-8">
          {/* Database Test Section */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Database Status</h2>
            <DatabaseTestComponent />
          </section>

          {/* Schema Information */}
          <section className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Schema Overview</h2>
            <p className="text-slate-600 mb-4">
              This application uses Prisma ORM to manage the visual CMS database with PostgreSQL. 
              The schema includes models for managing views, layouts, markers, galleries, and more.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">Core Models</h3>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>• ViewConfig - Configuration for different view types</li>
                  <li>• Layout2D - 2D layout with markers and backplates</li>
                  <li>• Layout3D - 3D layout with hotspots</li>
                  <li>• Navigation - Navigation items for view configs</li>
                </ul>
              </div>
              <div className="p-4 bg-slate-50 rounded border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">Hierarchy Models</h3>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>• Nation - Top-level geographic entity</li>
                  <li>• City - City within a nation</li>
                  <li>• Project - Project within a city</li>
                  <li>• Cluster - Property cluster within a project</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Quick Links */}
          <section className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Quick Links</h2>
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
              <a
                href="https://github.com/prisma/prisma"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-slate-300 text-slate-900 rounded hover:bg-slate-400 transition-colors text-sm font-medium"
              >
                Prisma Documentation
              </a>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-slate-600 text-sm">
          <p>Visual CMS - Built with Next.js, Prisma, and PostgreSQL</p>
        </footer>
      </div>
    </div>
  );
}
