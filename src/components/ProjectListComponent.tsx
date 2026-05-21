'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProjectData {
  Id: string;
  Code: string;
  MulesoftCode: string;
  CommunityKey: string;
  Title: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  City?: {
    Id: string;
    Code: string;
    Title: string;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ApiResponse {
  status: string;
  data: ProjectData[];
  pagination: PaginationInfo;
  error?: string;
}

export function ProjectListComponent() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async (page: number = 1, searchQuery: string = '') => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/projects?${params}`);
      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch projects');
      }

      setProjects(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects(1, search);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects(1, search);
  };

  const handlePageChange = (newPage: number) => {
    fetchProjects(newPage, search);
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-2xl font-semibold text-slate-900">Projects</h2>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Code, Title, or Mulesoft Code..."
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-400"
            >
              <Search size={16} />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Results Summary */}
      {!loading && projects.length > 0 && (
        <div className="text-sm text-slate-600">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} projects
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Projects Table */}
      {!loading && projects.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-700">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-700">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-700">
                    Mulesoft Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-700">
                    City
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.Id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                      <a
                        href={`/projects/${project.Id}`}
                        className="text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {project.Title || 'Untitled'}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">
                      {project.Code || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">
                      {project.MulesoftCode || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {project.City?.Title || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            project.IsVisible
                              ? 'bg-green-100 text-green-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {project.IsVisible ? 'Visible' : 'Hidden'}
                        </span>
                        {project.IsExplorable && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                            Explorable
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && projects.length === 0 && !error && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-700">No projects found</p>
            <p className="mt-1 text-sm">Try adjusting your search criteria</p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.pages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">
            Page {pagination.page} of {pagination.pages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
