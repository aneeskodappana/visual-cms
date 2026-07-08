import { Client, QueryResult } from 'pg';
import { getActiveDbUrl } from '@/lib/prisma';
import {
  DataSnapshot,
  ExecutionError,
  ExecutionResult,
  ParsedFileResult,
  ParsedQuery,
  QueryType,
} from '@/lib/sqlOrchestratorTypes';

const queryTypePatterns: Record<QueryType, RegExp> = {
  CREATE: /^\s*CREATE\s+(TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER)/i,
  ALTER: /^\s*ALTER\s+(TABLE|DATABASE|INDEX)/i,
  INSERT: /^\s*INSERT\s+(INTO|IGNORE\s+INTO)/i,
  UPDATE: /^\s*UPDATE\s+/i,
  DELETE: /^\s*DELETE\s+FROM/i,
  DROP: /^\s*DROP\s+/i,
  OTHER: /.*/,
};

export function parseSqlFile(fileName: string, content: string): ParsedFileResult {
  const parseErrors: string[] = [];
  const cleanedContent = removeComments(content);
  const rawQueries = splitQueries(cleanedContent);
  const queries: ParsedQuery[] = [];

  for (let i = 0; i < rawQueries.length; i++) {
    const query = rawQueries[i].trim();
    if (!query) continue;

    try {
      const type = detectQueryType(query);
      queries.push({
        originalFile: fileName,
        query,
        type,
        lineNumber: calculateLineNumber(content, query, i + 1),
        tableName: extractTableName(query, type),
        rawIndex: i,
      });
    } catch (error) {
      parseErrors.push(`Error parsing query at index ${i}: ${String(error)}`);
    }
  }

  if (queries.length > 0 && /^\s*SELECT\b/i.test(queries[queries.length - 1].query)) {
    parseErrors.push(`File "${fileName}" ends with a SELECT statement, which is not allowed.`);
  }

  return {
    fileName,
    queries,
    totalQueries: queries.length,
    parseErrors,
  };
}

export async function testActiveConnection() {
  const client = new Client({ connectionString: getActiveDbUrl() });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return { connected: true };
  } finally {
    await client.end();
  }
}

export async function executeSqlQueries(queries: ParsedQuery[], dryRun: boolean): Promise<ExecutionResult> {
  const startTime = Date.now();
  const mergedQuery = queries.map((query) => query.query).join(';\n') + (queries.length ? ';' : '');
  const client = new Client({ connectionString: getActiveDbUrl() });
  const snapshots: DataSnapshot[] = [];
  const errors: ExecutionError[] = [];
  const executedQueries: ParsedQuery[] = [];

  try {
    await client.connect();

    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      if (isTransactionControl(query.query)) {
        executedQueries.push({ ...query, rowsAffected: 0 });
        continue;
      }

      try {
        const snapshot = await captureBeforeSnapshot(client, query, index);
        if (snapshot) snapshots.push(snapshot);
      } catch (error) {
        console.warn(`[SQL Orchestrator] Snapshot capture failed for query ${index}:`, error);
      }

      try {
        const result = dryRun
          ? await validateQuery(client, query.query)
          : await client.query(addConflictHandling(query.query));
        const rowsAffected = typeof result?.rowCount === 'number' ? result.rowCount : 0;
        executedQueries.push({ ...query, rowsAffected });
      } catch (error: any) {
        errors.push({
          message: error.message || 'Unknown error',
          failedQuery: query.query,
          index,
          originalFile: query.originalFile,
          lineNumber: query.lineNumber,
          sqlState: error.code,
        });
      }
    }

    if (!dryRun) {
      for (const snapshot of snapshots) {
        try {
          snapshot.after = await captureAfterSnapshot(client, queries[snapshot.queryIndex], snapshot.queryType);
        } catch (error) {
          console.warn(`[SQL Orchestrator] Snapshot after-capture failed for query ${snapshot.queryIndex}:`, error);
        }
      }
    }

    return {
      success: errors.length === 0,
      mergedQuery,
      executedCount: executedQueries.length,
      totalQueries: queries.length,
      executionTimeMs: Date.now() - startTime,
      snapshots,
      errors,
      error: errors[0],
      executedQueries,
    };
  } catch (error: any) {
    const setupError = {
      message: error.message || 'Execution setup failed',
      failedQuery: 'Execution setup',
      index: -1,
      originalFile: 'N/A',
      lineNumber: 0,
      sqlState: error.code,
    };
    return {
      success: false,
      mergedQuery,
      executedCount: 0,
      totalQueries: queries.length,
      executionTimeMs: Date.now() - startTime,
      snapshots,
      errors: [setupError],
      error: setupError,
      executedQueries: [],
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

function removeComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '').replace(/#.*$/gm, '');
}

function splitQueries(content: string): string[] {
  const queries: string[] = [];
  let currentQuery = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      currentQuery += char;
    } else if (inString && char === stringChar) {
      if (nextChar === stringChar) {
        currentQuery += char + nextChar;
        i++;
      } else {
        inString = false;
        stringChar = '';
        currentQuery += char;
      }
    } else if (!inString && char === ';') {
      const trimmedQuery = currentQuery.trim();
      if (trimmedQuery) queries.push(trimmedQuery);
      currentQuery = '';
    } else {
      currentQuery += char;
    }
  }

  const finalQuery = currentQuery.trim();
  if (finalQuery) queries.push(finalQuery);
  return queries;
}

function detectQueryType(query: string): QueryType {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  for (const [type, pattern] of Object.entries(queryTypePatterns)) {
    if (type !== 'OTHER' && pattern.test(normalizedQuery)) return type as QueryType;
  }
  return 'OTHER';
}

function extractTableName(query: string, type: QueryType): string | undefined {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  const namePattern = '[`"\']?([\\w.]+)[`"\']?';

  const patterns: Partial<Record<QueryType, RegExp>> = {
    CREATE: new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${namePattern}`, 'i'),
    ALTER: new RegExp(`ALTER\\s+TABLE\\s+${namePattern}`, 'i'),
    INSERT: new RegExp(`INSERT\\s+(?:IGNORE\\s+)?INTO\\s+${namePattern}`, 'i'),
    UPDATE: new RegExp(`UPDATE\\s+${namePattern}`, 'i'),
    DELETE: new RegExp(`DELETE\\s+FROM\\s+${namePattern}`, 'i'),
    DROP: new RegExp(`DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${namePattern}`, 'i'),
  };

  const match = patterns[type]?.exec(normalizedQuery);
  return match ? stripIdentifier(match[1]) : undefined;
}

function calculateLineNumber(originalContent: string, query: string, fallbackLine: number): number {
  const queryStart = query.substring(0, 50);
  const index = originalContent.indexOf(queryStart);
  if (index === -1) return fallbackLine;
  return originalContent.substring(0, index).split('\n').length;
}

function isTransactionControl(sql: string): boolean {
  return /^(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)(;|$)/i.test(sql.trim());
}

async function validateQuery(client: Client, sql: string): Promise<QueryResult> {
  await client.query('BEGIN');
  try {
    const result = await client.query(sql);
    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

function addConflictHandling(sql: string): string {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();
  if (upper.startsWith('INSERT') && !upper.includes('ON CONFLICT')) {
    return `${trimmed.replace(/;\s*$/, '')} ON CONFLICT DO NOTHING`;
  }
  return trimmed;
}

async function captureBeforeSnapshot(client: Client, query: ParsedQuery, index: number): Promise<DataSnapshot | null> {
  if (query.type === 'DELETE') {
    const parsed = extractTableAndWhere(query.query);
    if (!parsed) return null;
    return {
      table: stripIdentifier(parsed.table),
      queryType: 'DELETE',
      queryIndex: index,
      originalFile: query.originalFile,
      query: query.query,
      before: await selectSnapshotRows(client, parsed.table, parsed.where),
      after: [],
    };
  }

  if (query.type === 'INSERT') {
    const insertData = extractInsertWhereCondition(query.query);
    if (!insertData) return null;
    return {
      table: stripIdentifier(insertData.table),
      queryType: 'INSERT',
      queryIndex: index,
      originalFile: query.originalFile,
      query: query.query,
      before: await selectInsertedRows(client, insertData),
      after: [],
    };
  }

  return null;
}

async function captureAfterSnapshot(
  client: Client,
  query: ParsedQuery,
  queryType: 'DELETE' | 'INSERT',
): Promise<Record<string, unknown>[]> {
  if (queryType === 'DELETE') {
    const parsed = extractTableAndWhere(query.query);
    if (!parsed) return [];
    return selectSnapshotRows(client, parsed.table, parsed.where);
  }

  const insertData = extractInsertWhereCondition(query.query);
  if (!insertData) return [];
  return selectInsertedRows(client, insertData);
}

function extractTableAndWhere(sql: string): { table: string; where: string } | null {
  const cleaned = sql.replace(/--[^\n]*/g, '').trim();
  const deleteMatch = cleaned.match(/DELETE\s+FROM\s+([^\s]+)\s+WHERE\s+([\s\S]+)$/i);
  if (deleteMatch) {
    return { table: deleteMatch[1], where: deleteMatch[2].replace(/;\s*$/, '').trim() };
  }

  const deleteNoWhere = cleaned.match(/DELETE\s+FROM\s+([^\s;]+)/i);
  if (deleteNoWhere) return { table: deleteNoWhere[1], where: '' };
  return null;
}

function extractInsertWhereCondition(sql: string): { table: string; columns: string[]; values: string[][] } | null {
  const cleaned = sql.replace(/--[^\n]*/g, '').trim();
  const tableMatch = cleaned.match(/INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+)$/i);
  if (!tableMatch) return null;

  return {
    table: tableMatch[1],
    columns: tableMatch[2].split(',').map((column) => column.trim()),
    values: splitValueTuples(tableMatch[3].trim().replace(/;\s*$/, '')),
  };
}

function splitValueTuples(valuesSql: string): string[][] {
  const values: string[][] = [];
  let depth = 0;
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < valuesSql.length; i++) {
    const char = valuesSql[i];

    if (inString) {
      current += char;
      if (char === stringChar && valuesSql[i + 1] === stringChar) {
        current += valuesSql[++i];
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      inString = true;
      stringChar = char;
      current += char;
    } else if (char === '(') {
      depth++;
      if (depth === 1) {
        current = '';
      } else {
        current += char;
      }
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        values.push(splitCommaAware(current));
        current = '';
      } else {
        current += char;
      }
    } else if (depth > 0) {
      current += char;
    }
  }

  return values;
}

function splitCommaAware(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let depth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inString) {
      current += char;
      if (char === stringChar && input[i + 1] === stringChar) {
        current += input[++i];
      } else if (char === stringChar) {
        inString = false;
      }
    } else if (char === "'" || char === '"') {
      inString = true;
      stringChar = char;
      current += char;
    } else if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

async function selectSnapshotRows(client: Client, table: string, where: string): Promise<Record<string, unknown>[]> {
  const sql = where ? `SELECT * FROM ${table} WHERE ${where} LIMIT 100` : `SELECT * FROM ${table} LIMIT 100`;
  const result = await client.query(sql);
  return result.rows;
}

async function selectInsertedRows(
  client: Client,
  insertData: { table: string; columns: string[]; values: string[][] },
): Promise<Record<string, unknown>[]> {
  const idColIndex = insertData.columns.findIndex((column) => stripIdentifier(column).toLowerCase() === 'id');
  if (idColIndex < 0) return [];

  const idValues = insertData.values.map((value) => value[idColIndex]?.trim()).filter(Boolean);
  if (idValues.length === 0) return [];

  const sql = `SELECT * FROM ${insertData.table} WHERE ${insertData.columns[idColIndex]} IN (${idValues.join(',')}) LIMIT 100`;
  const result = await client.query(sql);
  return result.rows;
}

function stripIdentifier(identifier: string): string {
  return identifier.replace(/"/g, '').replace(/`/g, '').replace(/^public\./i, '');
}

