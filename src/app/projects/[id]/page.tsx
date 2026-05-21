import { ProjectDetailComponent } from '@/components/ProjectDetailComponent';

export const metadata = {
  title: 'Project Details - WOACMS',
  description: 'View detailed project information and related data',
};

interface ProjectDetailPageProps {
  params: {
    id: string;
  };
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a href="/projects" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to Projects
          </a>
          <h1 className="text-4xl font-bold text-slate-900">Project Details</h1>
        </div>

        {/* Main Content */}
        <main>
          <ProjectDetailComponent projectId={params.id} />
        </main>
      </div>
    </div>
  );
}
