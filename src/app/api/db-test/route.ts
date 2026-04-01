import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test connection by querying the database
    const connectionTest = await prisma.$queryRaw`SELECT 1 as connected`;
    
    // Get database info from environment
    const dbUrl = process.env.CAPTIVATE_DATABASE_URL || '';
    const dbUrlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    
    const databaseInfo = {
      connected: true,
      database: dbUrlParts ? dbUrlParts[5] : 'unknown',
      host: dbUrlParts ? dbUrlParts[3] : 'unknown',
      port: dbUrlParts ? dbUrlParts[4] : 'unknown',
      user: dbUrlParts ? dbUrlParts[1] : 'unknown',
      schema: 'public',
    };

    // Fetch sample data from ViewConfigs (first 10 entries)
    const viewConfigs = await prisma.viewConfig.findMany({
      take: 10,
      select: {
        Id: true,
        Kind: true,
        Code: true,
        Title: true,
        Subtitle: true,
        HasGallery: true,
      },
    });

    // Get count of records in key tables
    const tableCounts = {
      ViewConfigs: await prisma.viewConfig.count(),
      Nations: await prisma.nation.count(),
      Cities: await prisma.city.count(),
      Projects: await prisma.project.count(),
      Clusters: await prisma.cluster.count(),
      Properties: await prisma.property.count(),
      Units: await prisma.unit.count(),
      Amenities: await prisma.amenity.count(),
    };

    return NextResponse.json({
      status: 'success',
      databaseInfo,
      sampleData: {
        tableName: 'ViewConfigs',
        recordCount: viewConfigs.length,
        records: viewConfigs,
      },
      tableCounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Database connection error:', error);
    
    const dbUrl = process.env.CAPTIVATE_DATABASE_URL || '';
    const dbUrlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    
    return NextResponse.json({
      status: 'error',
      connected: false,
      error: error.message,
      databaseInfo: {
        database: dbUrlParts ? dbUrlParts[5] : 'unknown',
        host: dbUrlParts ? dbUrlParts[3] : 'unknown',
        port: dbUrlParts ? dbUrlParts[4] : 'unknown',
        user: dbUrlParts ? dbUrlParts[1] : 'unknown',
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
