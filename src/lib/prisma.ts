import { PrismaClient } from '../client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  currentDbUrl: string;
};

function getDbUrl(): string {
  return globalForPrisma.currentDbUrl || process.env.CAPTIVATE_DATABASE_URL || '';
}

function createPrismaClient(url?: string): PrismaClient {
  const datasourceUrl = url || getDbUrl();
  return new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasourceUrl,
  });
}

if (!globalForPrisma.prisma) {
  globalForPrisma.currentDbUrl = process.env.CAPTIVATE_DATABASE_URL || '';
  globalForPrisma.prisma = createPrismaClient();
}

export let prisma = globalForPrisma.prisma;

export function getActiveDbUrl(): string {
  return globalForPrisma.currentDbUrl || process.env.CAPTIVATE_DATABASE_URL || '';
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
