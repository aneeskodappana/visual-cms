export type QueryType = 'CREATE' | 'ALTER' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DROP' | 'OTHER';

export interface ParsedQuery {
  originalFile: string;
  query: string;
  type: QueryType;
  lineNumber: number;
  tableName?: string;
  rawIndex: number;
  rowsAffected?: number;
}

export interface ParsedFileResult {
  fileName: string;
  queries: ParsedQuery[];
  totalQueries: number;
  parseErrors: string[];
}

export interface SqlFile {
  name: string;
  content: string;
  size: number;
  lastModified: string;
  executed?: boolean;
}

export interface DataSnapshot {
  table: string;
  queryType: 'DELETE' | 'INSERT';
  queryIndex: number;
  originalFile: string;
  query: string;
  before: Record<string, unknown>[];
  after: Record<string, unknown>[];
}

export interface ExecutionError {
  message: string;
  failedQuery: string;
  index: number;
  originalFile: string;
  lineNumber: number;
  sqlState?: string;
}

export interface ExecutionResult {
  success: boolean;
  mergedQuery: string;
  executedCount: number;
  totalQueries: number;
  executionTimeMs: number;
  snapshots: DataSnapshot[];
  errors: ExecutionError[];
  error?: ExecutionError;
  executedQueries: ParsedQuery[];
}

