import { NextRequest, NextResponse } from 'next/server';
import { executeSqlQueries, parseSqlFile, testActiveConnection } from '@/lib/sqlOrchestrator';
import { ParsedQuery } from '@/lib/sqlOrchestratorTypes';

function response<T>(success: boolean, data?: T, error?: string, status = 200) {
  return NextResponse.json(
    {
      success,
      data,
      error,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === 'test-connection') {
      const data = await testActiveConnection();
      return response(true, data);
    }

    if (action === 'parse') {
      const contents = body.contents as Array<{ fileName: string; content: string }> | undefined;
      if (!contents?.length) return response(false, undefined, 'No SQL content provided', 400);

      const parsedFiles = contents.map((file) => parseSqlFile(file.fileName, file.content));
      const totalQueries = parsedFiles.reduce((sum, file) => sum + file.totalQueries, 0);
      return response(true, { parsedFiles, totalQueries });
    }

    if (action === 'test' || action === 'execute') {
      const queries = body.queries as ParsedQuery[] | undefined;
      if (!queries?.length) return response(false, undefined, 'No queries provided', 400);

      const data = await executeSqlQueries(queries, action === 'test');
      return response(data.success, data, data.success ? undefined : data.error?.message);
    }

    return response(false, undefined, `Unknown action "${action}"`, 400);
  } catch (error: any) {
    return response(false, undefined, error.message || 'SQL orchestrator request failed', 500);
  }
}

