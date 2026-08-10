import { PrismaClient } from '../client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  currentDbUrl: string;
};

function cleanEnvValue(value: string): string {
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^['"]|['"]$/g, '');
  return unquoted.includes('#{') ? '' : unquoted;
}

function readEnvValue(filePath: string, key: string): string {
  if (!existsSync(filePath)) return '';

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match?.[1] === key) {
      return cleanEnvValue(match[2]);
    }
  }

  return '';
}

function getPropertyServiceDbUrl(): string {
  const propertyServiceRoot = resolve(process.cwd(), '..', 'Captivate.PropertyService');
  return (
    readEnvValue(resolve(propertyServiceRoot, '.env.local'), 'DATABASE_URL') ||
    readEnvValue(resolve(propertyServiceRoot, '.env'), 'DATABASE_URL')
  );
}

function getDbUrl(): string {
  return (
    globalForPrisma.currentDbUrl ||
    process.env.CAPTIVATE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    getPropertyServiceDbUrl() ||
    ''
  );
}

function createPrismaClient(url?: string): PrismaClient {
  const datasourceUrl = url || getDbUrl();
  if (datasourceUrl && !process.env.CAPTIVATE_DATABASE_URL) {
    process.env.CAPTIVATE_DATABASE_URL = datasourceUrl;
  }

  return new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  });
}

if (!globalForPrisma.prisma) {
  globalForPrisma.currentDbUrl = getDbUrl();
  globalForPrisma.prisma = createPrismaClient();
}

export let prisma = globalForPrisma.prisma;

export function getActiveDbUrl(): string {
  return getDbUrl();
}

export function parseDbUrl(url: string) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) return null;
  return { user: match[1], password: match[2], host: match[3], port: match[4], database: match[5] };
}

export async function switchDatabase(dbName: string): Promise<void> {
  const currentUrl = getDbUrl();
  const parsed = parseDbUrl(currentUrl);
  if (!parsed) throw new Error('Cannot parse current database URL');

  const newUrl = `postgresql://${parsed.user}:${parsed.password}@${parsed.host}:${parsed.port}/${dbName}?schema=public`;

  await globalForPrisma.prisma.$disconnect();

  globalForPrisma.currentDbUrl = newUrl;
  globalForPrisma.prisma = createPrismaClient(newUrl);
  prisma = globalForPrisma.prisma;
}

export function getBaseConnectionUrl(): string {
  const url = getDbUrl();
  const parsed = parseDbUrl(url);
  if (!parsed) return '';
  return `postgresql://${parsed.user}:${parsed.password}@${parsed.host}:${parsed.port}`;
}
