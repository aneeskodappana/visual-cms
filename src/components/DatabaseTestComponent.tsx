'use client';

import { useEffect, useState } from 'react';

interface DatabaseInfo {
  connected: boolean;
  database: string;
  host: string;
  port: string;
  user: string;
  schema: string;
}

interface SampleRecord {
  Id: string;
  Kind: number;
  Code: string;
  Title: string;
  Subtitle: string;
  HasGallery: boolean;
}

interface DbTestResponse {
  status: string;
  databaseInfo: DatabaseInfo;
  sampleData?: {
    tableName: string;
    recordCount: number;
    records: SampleRecord[];
  };
  tableCounts?: Record<string, number>;
  error?: string;
  timestamp: string;
}

export function DatabaseTestComponent() {
  const [data, setData] = useState<DbTestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDatabaseInfo = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/db-test');
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch database info');
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchDatabaseInfo();
  }, []);

  if (loading) {
    return (
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800">Loading database connection info...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-900 font-bold mb-2">Connection Error</h3>
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">No data available</p>
      </div>
    );
  }

  const isConnected = data.status === 'success' && data.databaseInfo?.connected;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`p-6 border rounded-lg ${isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}></div>
          <h3 className={`font-bold ${isConnected ? 'text-green-900' : 'text-red-900'}`}>
            Database Connection: {isConnected ? 'Connected' : 'Failed'}
          </h3>
        </div>
        {data.error && (
          <p className="text-red-700 text-sm mt-2">{data.error}</p>
        )}
      </div>

      {/* Database Details */}
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg">
        <h3 className="font-bold text-slate-900 mb-4">Database Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-slate-600">Host</p>
            <p className="font-mono text-slate-900">{data.databaseInfo?.host}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Port</p>
            <p className="font-mono text-slate-900">{data.databaseInfo?.port}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Database</p>
            <p className="font-mono text-slate-900">{data.databaseInfo?.database}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">User</p>
            <p className="font-mono text-slate-900">{data.databaseInfo?.user}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Schema</p>
            <p className="font-mono text-slate-900">{data.databaseInfo?.schema}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Last Updated</p>
            <p className="font-mono text-sm text-slate-900">{new Date(data.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Table Record Counts */}
      {data.tableCounts && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="font-bold text-slate-900 mb-4">Database Tables Record Count</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data.tableCounts).map(([table, count]) => (
              <div key={table} className="bg-white p-3 rounded border border-slate-200">
                <p className="text-sm text-slate-600">{table}</p>
                <p className="text-2xl font-bold text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Data */}
      {data.sampleData && data.sampleData.records.length > 0 && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="font-bold text-slate-900 mb-4">
            Sample Data: {data.sampleData.tableName} (First 10 records)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  <th className="text-left p-2 text-slate-700">ID</th>
                  <th className="text-left p-2 text-slate-700">Code</th>
                  <th className="text-left p-2 text-slate-700">Title</th>
                  <th className="text-left p-2 text-slate-700">Subtitle</th>
                  <th className="text-center p-2 text-slate-700">Gallery</th>
                </tr>
              </thead>
              <tbody>
                {data.sampleData.records.map((record) => (
                  <tr key={record.Id} className="border-b border-slate-200 hover:bg-slate-100">
                    <td className="p-2 font-mono text-xs text-slate-600 truncate max-w-[150px]">{record.Id}</td>
                    <td className="p-2 text-slate-900">{record.Code || '-'}</td>
                    <td className="p-2 text-slate-900">{record.Title || '-'}</td>
                    <td className="p-2 text-slate-900">{record.Subtitle || '-'}</td>
                    <td className="p-2 text-center">
                      <span className={`text-sm ${record.HasGallery ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
                        {record.HasGallery ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            Total records fetched: {data.sampleData.recordCount} (showing first 10)
          </p>
        </div>
      )}
    </div>
  );
}
