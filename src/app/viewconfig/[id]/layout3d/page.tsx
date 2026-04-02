'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ThreeSixtyViewer = dynamic(
  () => import('@/components/ThreeSixty/ThreeSixtyViewer'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full bg-gray-900 text-white">Loading 3D viewer...</div> }
);

interface ViewConfigData {
  Id: string;
  Title: string;
  Subtitle: string;
  Code: string;
  CdnBaseUrl: string;
  Layout3D: any;
}

export default function Layout3DPage({ params }: { params: { id: string } }) {
  const [viewConfig, setViewConfig] = useState<ViewConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const fetchViewConfig = async () => {
      try {
        const response = await fetch(`/api/viewconfig/search?uuid=${params.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch ViewConfig');
        }

        if (data.data && data.data.length > 0) {
          const config = data.data[0];
          if (!config.Layout3D) {
            setError('No Layout3D found for this ViewConfig');
          } else {
            setViewConfig(config);
          }
        } else {
          setError('ViewConfig not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchViewConfig();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error || !viewConfig) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Link href="/viewconfig-search" className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4">
          <ChevronLeft size={20} /> Back to Search
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Unable to load ViewConfig'}</p>
        </div>
      </div>
    );
  }

  const layout3D = viewConfig.Layout3D;
  const hotspotGroups = layout3D.HotspotGroup || [];
  const totalHotspots = hotspotGroups.reduce(
    (sum: number, g: any) => sum + (g.Hotspots?.length || 0),
    0
  );

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/viewconfig-search"
            className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-white truncate">
              {viewConfig.Title || 'Untitled'}
              {viewConfig.Subtitle && (
                <span className="text-gray-400 ml-1 font-normal">- {viewConfig.Subtitle}</span>
              )}
            </h1>
            <p className="text-xs text-gray-500">
              Layout 3D | Code: {viewConfig.Code}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewConfig.Layout3D && (
            <Link
              href={`/viewconfig/${viewConfig.Id}`}
              className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-xs font-medium hover:bg-blue-600/30 transition-colors"
            >
              View Layout 2D
            </Link>
          )}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium hover:bg-gray-600 transition-colors"
          >
            {showInfo ? 'Hide' : 'Show'} Info
          </button>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 text-xs text-gray-300 space-y-2 overflow-auto max-h-60">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="text-gray-500">Layout3D ID:</span>
              <p className="font-mono text-gray-300 break-all">{layout3D.Id}</p>
            </div>
            <div>
              <span className="text-gray-500">Model URL:</span>
              <p className="font-mono text-gray-300 break-all">{layout3D.ModelUrl || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Default Group Index:</span>
              <p className="text-gray-300">{layout3D.DefaultHotspotGroupIndex}</p>
            </div>
            <div>
              <span className="text-gray-500">Hotspot Groups / Hotspots:</span>
              <p className="text-gray-300">{hotspotGroups.length} / {totalHotspots}</p>
            </div>
          </div>

          {hotspotGroups.length > 0 && (
            <div className="mt-2">
              <h3 className="text-gray-400 font-semibold mb-1">Hotspot Groups</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left py-1 pr-3">Name</th>
                      <th className="text-left py-1 pr-3">Index</th>
                      <th className="text-left py-1 pr-3">Default Hotspot</th>
                      <th className="text-left py-1 pr-3">Hotspots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotspotGroups.map((group: any) => (
                      <tr key={group.Id} className="border-b border-gray-700/50">
                        <td className="py-1 pr-3 text-gray-300">{group.Name || '-'}</td>
                        <td className="py-1 pr-3 text-gray-400">{group.HotspotGroupIndex}</td>
                        <td className="py-1 pr-3 text-gray-400">{group.DefaultHotspotIndex}</td>
                        <td className="py-1 pr-3 text-gray-400">{group.Hotspots?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3D Viewer */}
      <div className="flex-1 relative">
        <ThreeSixtyViewer layout3D={layout3D} cdnBaseUrl={viewConfig.CdnBaseUrl} />
      </div>
    </div>
  );
}
