import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * POST /api/page-builder/floorplans/scan
 *
 * Scans a project folder on disk for CSV and backplate files.
 * Body: { projectFolderPath: string, csvSubfolder?: string, backplateSubfolder?: string }
 * Returns: { csvFiles: string[], backplateFiles: string[], backplateThumbnails: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectFolderPath,
      csvSubfolder = 'csv_floorplan_unit',
      backplateSubfolder = 'backplate_image_floorplan_unit',
    } = body;

    if (!projectFolderPath) {
      return NextResponse.json(
        { status: 'error', error: 'projectFolderPath is required' },
        { status: 400 },
      );
    }

    const csvPath = path.join(projectFolderPath, csvSubfolder);
    const backplatePath = path.join(projectFolderPath, backplateSubfolder);

    let csvFiles: string[] = [];
    let backplateFiles: string[] = [];

    try {
      const csvEntries = await fs.readdir(csvPath);
      csvFiles = csvEntries.filter((f) => f.endsWith('.csv')).sort();
    } catch {
      return NextResponse.json(
        { status: 'error', error: `CSV folder not found: ${csvPath}` },
        { status: 400 },
      );
    }

    try {
      const bpEntries = await fs.readdir(backplatePath);
      backplateFiles = bpEntries.filter((f) => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg')).sort();
    } catch {
      return NextResponse.json(
        { status: 'error', error: `Backplate folder not found: ${backplatePath}` },
        { status: 400 },
      );
    }

    const thumbnails = backplateFiles.filter((f) => f.includes('_w640_q10') || f.includes('_thumb'));
    const mainBackplates = backplateFiles.filter((f) => !f.includes('_w640_q10') && !f.includes('_thumb') && !f.includes('Thumbs.db'));

    return NextResponse.json({
      status: 'success',
      data: {
        csvFiles,
        backplateFiles: mainBackplates,
        backplateThumbnails: thumbnails,
        csvPath,
        backplatePath,
        csvCount: csvFiles.length,
        backplateCount: mainBackplates.length,
      },
    });
  } catch (error) {
    console.error('Error scanning folder:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 },
    );
  }
}
