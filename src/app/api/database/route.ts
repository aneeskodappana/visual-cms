import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { execFile } from 'child_process';
import { writeFile, unlink, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { getActiveDbUrl, parseDbUrl, switchDatabase, getBaseConnectionUrl } from '@/lib/prisma';

const PG_BIN_DIRS = [
  'C:\\Program Files\\PostgreSQL\\16\\bin',
  'C:\\Program Files\\PostgreSQL\\17\\bin',
  'C:\\Program Files\\PostgreSQL\\15\\bin',
  'C:\\Program Files\\PostgreSQL\\14\\bin',
];

async function findPgBinDir(): Promise<string> {
  for (const dir of PG_BIN_DIRS) {
    try {
      await access(join(dir, 'psql.exe'));
      return dir;
    } catch {}
  }
  throw new Error(
    'PostgreSQL bin directory not found. Searched: ' + PG_BIN_DIRS.join(', ')
  );
}

function runPgTool(toolPath: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(toolPath, args, { env, maxBuffer: 200 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const details = [stderr?.trim(), stdout?.trim()].filter(Boolean).join('\n');
        reject(new Error(details || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function getAdminClient(): Promise<Client> {
  const baseUrl = getBaseConnectionUrl();
  const client = new Client({ connectionString: `${baseUrl}/postgres` });
  await client.connect();
  return client;
}

export async function GET() {
  let client: Client | null = null;
  try {
    client = await getAdminClient();

    const result = await client.query(
      `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
    );

    const databases = result.rows.map((r: { datname: string }) => r.datname);
    const activeUrl = getActiveDbUrl();
    const parsed = parseDbUrl(activeUrl);

    return NextResponse.json({
      databases,
      activeDatabase: parsed?.database || 'unknown',
      host: parsed?.host || 'unknown',
      port: parsed?.port || 'unknown',
      user: parsed?.user || 'unknown',
    });
  } catch (error: any) {
    console.error('Failed to list databases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) await client.end();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { database } = body;

    if (!database) {
      return NextResponse.json({ error: 'Database name is required' }, { status: 400 });
    }

    await switchDatabase(database);

    return NextResponse.json({
      status: 'success',
      message: `Switched to database: ${database}`,
      activeDatabase: database,
    });
  } catch (error: any) {
    console.error('Failed to switch database:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let client: Client | null = null;
  try {
    const body = await request.json();
    const { database } = body;

    if (!database) {
      return NextResponse.json({ error: 'Database name is required' }, { status: 400 });
    }

    const protectedDbs = ['postgres', 'template0', 'template1'];
    if (protectedDbs.includes(database)) {
      return NextResponse.json({ error: `Cannot delete system database "${database}"` }, { status: 403 });
    }

    const activeUrl = getActiveDbUrl();
    const parsed = parseDbUrl(activeUrl);
    if (parsed?.database === database) {
      return NextResponse.json(
        { error: `Cannot delete the currently active database. Switch to another database first.` },
        { status: 400 }
      );
    }

    client = await getAdminClient();

    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [database]
    );

    await client.query(`DROP DATABASE "${database}"`);

    return NextResponse.json({
      status: 'success',
      message: `Database "${database}" deleted successfully`,
    });
  } catch (error: any) {
    console.error('Failed to delete database:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) await client.end();
  }
}

export async function PATCH(request: NextRequest) {
  let client: Client | null = null;
  try {
    const body = await request.json();
    const { database, newName } = body;

    if (!database || !newName) {
      return NextResponse.json({ error: 'Both database and newName are required' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
      return NextResponse.json(
        { error: 'New name can only contain letters, numbers, hyphens, and underscores' },
        { status: 400 }
      );
    }

    const protectedDbs = ['postgres', 'template0', 'template1'];
    if (protectedDbs.includes(database)) {
      return NextResponse.json({ error: `Cannot rename system database "${database}"` }, { status: 403 });
    }

    const activeUrl = getActiveDbUrl();
    const parsed = parseDbUrl(activeUrl);
    const wasActive = parsed?.database === database;

    client = await getAdminClient();

    if (wasActive) {
      await switchDatabase('postgres');
    }

    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [database]
    );

    await client.query(`ALTER DATABASE "${database}" RENAME TO "${newName}"`);

    if (wasActive) {
      await client.end();
      client = null;
      await switchDatabase(newName);
    }

    return NextResponse.json({
      status: 'success',
      message: `Database renamed from "${database}" to "${newName}"`,
      newName,
    });
  } catch (error: any) {
    console.error('Failed to rename database:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) await client.end();
  }
}

export async function POST(request: NextRequest) {
  let adminClient: Client | null = null;
  try {
    const formData = await request.formData();
    const database = formData.get('database') as string | null;
    const sqlFile = formData.get('sqlFile') as File | null;

    if (!database) {
      return NextResponse.json({ error: 'Database name is required' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(database)) {
      return NextResponse.json(
        { error: 'Database name can only contain letters, numbers, hyphens, and underscores' },
        { status: 400 }
      );
    }

    adminClient = await getAdminClient();

    const existing = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [database]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: `Database "${database}" already exists` }, { status: 409 });
    }

    await adminClient.query(`CREATE DATABASE "${database}"`);
    await adminClient.end();
    adminClient = null;

    if (sqlFile && sqlFile.size > 0) {
      const fileBuffer = Buffer.from(await sqlFile.arrayBuffer());
      const activeUrl = getActiveDbUrl();
      const parsed = parseDbUrl(activeUrl);
      if (!parsed) throw new Error('Cannot parse database URL');

      const pgBinDir = await findPgBinDir();
      const tmpFile = join(tmpdir(), `db-import-${Date.now()}`);
      await writeFile(tmpFile, fileBuffer);

      const env = { ...process.env, PGPASSWORD: parsed.password };
      const connArgs = ['-h', parsed.host, '-p', parsed.port, '-U', parsed.user];

      const isCustomFormat = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x47 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x4D && fileBuffer[4] === 0x50;

      try {
        if (isCustomFormat) {
          const pgRestore = join(pgBinDir, 'pg_restore.exe');
          await runPgTool(pgRestore, [
            ...connArgs, '-d', database, '--no-owner', '--no-privileges', tmpFile,
          ], env);
        } else {
          const psql = join(pgBinDir, 'psql.exe');
          await runPgTool(psql, [
            ...connArgs, '-d', database, '-v', 'ON_ERROR_STOP=1', '-f', tmpFile,
          ], env);
        }
      } finally {
        await unlink(tmpFile).catch(() => {});
      }

      return NextResponse.json({
        status: 'success',
        message: `Database "${database}" created and ${isCustomFormat ? 'dump restored' : 'SQL file executed'} successfully`,
        database,
        sqlFileApplied: true,
        sqlFileName: sqlFile.name,
        sqlFileSize: sqlFile.size,
        format: isCustomFormat ? 'custom' : 'plain',
      });
    }

    return NextResponse.json({
      status: 'success',
      message: `Database "${database}" created successfully`,
      database,
      sqlFileApplied: false,
    });
  } catch (error: any) {
    console.error('Failed to create database:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (adminClient) await adminClient.end();
  }
}
