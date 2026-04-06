'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Database, Plus, RefreshCw, Check, Upload, FileText, Trash2, Pencil } from 'lucide-react';

interface DatabaseSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: () => void;
}

export function DatabaseSelectorModal({ isOpen, onClose, onSwitch }: DatabaseSelectorModalProps) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [activeDatabase, setActiveDatabase] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sqlFile, setSqlFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingDb, setRenamingDb] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const fetchDatabases = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/database');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDatabases(data.databases || []);
      setActiveDatabase(data.activeDatabase || '');
      setHost(data.host || '');
      setPort(data.port || '');
      setUser(data.user || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch databases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDatabases();
      setShowCreateForm(false);
      setNewDbName('');
      setSqlFile(null);
      setSuccessMsg(null);
      setError(null);
      setDeleteConfirm(null);
      setRenamingDb(null);
      setRenameValue('');
    }
  }, [isOpen]);

  const handleSwitch = async (dbName: string) => {
    if (dbName === activeDatabase) return;
    setSwitching(dbName);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await fetch('/api/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database: dbName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setActiveDatabase(dbName);
      setSuccessMsg(`Switched to "${dbName}"`);
      onSwitch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch database');
    } finally {
      setSwitching(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim()) return;
    setCreating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const formData = new FormData();
      formData.append('database', newDbName.trim());
      if (sqlFile) formData.append('sqlFile', sqlFile);

      const response = await fetch('/api/database', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const msg = sqlFile
        ? `Database "${newDbName.trim()}" created and SQL file applied`
        : `Database "${newDbName.trim()}" created successfully`;
      setSuccessMsg(msg);
      setNewDbName('');
      setSqlFile(null);
      setShowCreateForm(false);
      await fetchDatabases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create database');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (dbName: string) => {
    setDeleting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await fetch('/api/database', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database: dbName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccessMsg(`Database "${dbName}" deleted`);
      setDeleteConfirm(null);
      await fetchDatabases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete database');
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async (dbName: string) => {
    if (!renameValue.trim() || renameValue.trim() === dbName) {
      setRenamingDb(null);
      return;
    }
    setRenaming(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await fetch('/api/database', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database: dbName, newName: renameValue.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccessMsg(`Renamed "${dbName}" to "${renameValue.trim()}"`);
      setRenamingDb(null);
      setRenameValue('');
      await fetchDatabases();
      onSwitch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename database');
    } finally {
      setRenaming(false);
    }
  };

  const protectedDbs = ['postgres', 'template0', 'template1'];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validExts = ['.sql', '.backup', '.dump', '.bak'];
      if (validExts.some((ext) => file.name.toLowerCase().endsWith(ext))) {
        setSqlFile(file);
      } else {
        setError('Supported formats: .sql, .backup, .dump, .bak');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExts = ['.sql', '.backup', '.dump', '.bak'];
      if (validExts.some((ext) => file.name.toLowerCase().endsWith(ext))) {
        setSqlFile(file);
      } else {
        setError('Supported formats: .sql, .backup, .dump, .bak');
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Database size={22} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Database Manager</h2>
              <p className="text-xs text-gray-500">{user}@{host}:{port}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{successMsg}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Available Databases</h3>
            <button
              onClick={fetchDatabases}
              disabled={loading}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-gray-500 text-sm">Loading databases...</div>
          ) : (
            <div className="space-y-1.5">
              {databases.map((db) => {
                const isActive = db === activeDatabase;
                const isSwitching = switching === db;
                const isProtected = protectedDbs.includes(db);
                const isBeingRenamed = renamingDb === db;
                const isDeleteTarget = deleteConfirm === db;

                if (isDeleteTarget) {
                  return (
                    <div key={db} className="px-4 py-3 rounded-lg border border-red-300 bg-red-50">
                      <p className="text-sm text-red-900 mb-2">
                        Delete <span className="font-semibold">{db}</span>? This cannot be undone.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(db)}
                          disabled={deleting}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors font-medium"
                        >
                          {deleting ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          disabled={deleting}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                if (isBeingRenamed) {
                  return (
                    <div key={db} className="px-4 py-3 rounded-lg border border-amber-300 bg-amber-50">
                      <p className="text-xs text-amber-800 mb-2">Rename <span className="font-semibold">{db}</span></p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder="new-name"
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(db); if (e.key === 'Escape') setRenamingDb(null); }}
                        />
                        <button
                          onClick={() => handleRename(db)}
                          disabled={renaming || !renameValue.trim()}
                          className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:bg-gray-400 transition-colors font-medium"
                        >
                          {renaming ? 'Renaming...' : 'Rename'}
                        </button>
                        <button
                          onClick={() => { setRenamingDb(null); setRenameValue(''); }}
                          disabled={renaming}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={db}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 border border-blue-200 text-blue-900'
                        : 'hover:bg-gray-50 border border-gray-100 text-gray-800'
                    } ${switching !== null && !isSwitching ? 'opacity-50' : ''}`}
                  >
                    <button
                      onClick={() => handleSwitch(db)}
                      disabled={isActive || switching !== null}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <Database size={16} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                      <span className={`text-sm font-medium ${isActive ? 'text-blue-900' : ''}`}>{db}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      {isActive && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 font-medium mr-1">
                          <Check size={14} /> Active
                        </span>
                      )}
                      {isSwitching && (
                        <RefreshCw size={14} className="text-blue-500 animate-spin mr-1" />
                      )}
                      {!isProtected && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setRenamingDb(db); setRenameValue(db); setDeleteConfirm(null); }}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Rename"
                          >
                            <Pencil size={14} className="text-gray-400 hover:text-amber-600" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(db); setRenamingDb(null); }}
                            disabled={isActive}
                            className="p-1 hover:bg-red-100 rounded transition-colors disabled:opacity-30"
                            title={isActive ? 'Switch to another database first' : 'Delete'}
                          >
                            <Trash2 size={14} className="text-gray-400 hover:text-red-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200">
          {showCreateForm ? (
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="new-database-name"
                  pattern="^[a-zA-Z0-9_-]+$"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.backup,.dump,.bak"
                onChange={handleFileSelect}
                className="hidden"
              />

              {sqlFile ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">{sqlFile.name}</p>
                      <p className="text-xs text-blue-600">{formatFileSize(sqlFile.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSqlFile(null)}
                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                  >
                    <X size={16} className="text-blue-600" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    dragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <Upload size={20} className={dragging ? 'text-blue-500' : 'text-gray-400'} />
                  <p className="text-xs text-gray-500 text-center">
                    Drag & drop a <span className="font-medium">.sql</span> or <span className="font-medium">.backup</span> file here, or click to browse
                  </p>
                  <p className="text-xs text-gray-400">(optional - pgAdmin plain SQL or custom-format dump)</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={creating || !newDbName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                  {creating ? 'Creating...' : sqlFile ? 'Create & Import SQL' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setNewDbName(''); setSqlFile(null); }}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              <Plus size={16} /> Create New Database
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
