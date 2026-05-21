import { UuidGeneratorComponent } from '@/components/UuidGeneratorComponent';

export const metadata = {
  title: 'UUID Generator - WOACMS',
  description: 'Generate UUIDs using v4 (random) or v5 (namespace-based) algorithms',
};

export default function UuidGeneratorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to Dashboard
          </a>
          <h1 className="text-4xl font-bold text-slate-900">UUID Generator</h1>
          <p className="mt-2 text-slate-600">Generate and manage UUIDs with ease</p>
        </div>

        {/* Main Content */}
        <main>
          <UuidGeneratorComponent />
        </main>
      </div>
    </div>
  );
}
