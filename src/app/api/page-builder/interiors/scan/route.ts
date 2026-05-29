import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * POST /api/page-builder/interiors/scan
 *
 * Scans a project folder for interior assets: 360 images, GLB models, CSV camera files.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectFolderPath,
      hotspotSubfolder = 'image_360_property_unit',
      collisionSubfolder = 'model_360-collision_property_variation',
      csvCameraSubfolder = 'csv_camera_property_variation',
    } = body;

    if (!projectFolderPath) {
      return NextResponse.json({ status: 'error', error: 'projectFolderPath required' }, { status: 400 });
    }

    const hotspotPath = path.join(projectFolderPath, hotspotSubfolder);
    const collisionPath = path.join(projectFolderPath, collisionSubfolder);
    const csvCameraPath = path.join(projectFolderPath, csvCameraSubfolder);

    let hotspotFolders: string[] = [];
    let collisionFiles: string[] = [];
    let csvCameraFiles: string[] = [];

    try {
      const entries = await fs.readdir(hotspotPath, { withFileTypes: true });
      hotspotFolders = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    } catch {
      return NextResponse.json({ status: 'error', error: `Hotspot folder not found: ${hotspotPath}` }, { status: 400 });
    }

    try {
      const entries = await fs.readdir(collisionPath);
      collisionFiles = entries.filter((f) => f.endsWith('.glb')).sort();
    } catch {
      return NextResponse.json({ status: 'error', error: `Collision folder not found: ${collisionPath}` }, { status: 400 });
    }

    try {
      const entries = await fs.readdir(csvCameraPath);
      csvCameraFiles = entries.filter((f) => f.endsWith('.csv')).sort();
    } catch {
      return NextResponse.json({ status: 'error', error: `CSV camera folder not found: ${csvCameraPath}` }, { status: 400 });
    }

    // For each hotspot folder, list the 360 images inside
    const hotspotDetails: Record<string, string[]> = {};
    for (const folder of hotspotFolders) {
      try {
        const files = await fs.readdir(path.join(hotspotPath, folder));
        hotspotDetails[folder] = files.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
      } catch {
        hotspotDetails[folder] = [];
      }
    }

    return NextResponse.json({
      status: 'success',
      data: {
        hotspotFolders,
        hotspotDetails,
        collisionFiles,
        csvCameraFiles,
        hotspotPath,
        collisionPath,
        csvCameraPath,
      },
    });
  } catch (error) {
    console.error('Error scanning interior folder:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 },
    );
  }
}
