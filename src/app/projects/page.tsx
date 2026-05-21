import { ProjectListComponent } from '@/components/ProjectListComponent';

export const metadata = {
  title: 'Projects - WOACMS',
  description: 'Browse and manage projects',
};

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to Dashboard
          </a>
          <h1 className="text-4xl font-bold text-slate-900">Projects</h1>
          <p className="mt-2 text-slate-600">Browse and manage all projects</p>
        </div>

        {/* Main Content */}
        <main>
          <ProjectListComponent />
        </main>
      </div>
    </div>
  );
}
