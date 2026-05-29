import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const AUTOMATION_PROJECT_ROOT = path.join(
  'C:', 'Users', 'akodappana', 'Captivate', 'Automation', 'project',
);

/**
 * GET /api/page-builder/floorplans/projects
 *
 * Lists all project folders in the Automation/project directory,
 * and for each, detects available subfolders (csv, backplate, etc.)
 */
export async function GET() {
  try {
    const entries = await fs.readdir(AUTOMATION_PROJECT_ROOT, { withFileTypes: true });
    const projectFolders = entries
      .filter((e) => e.isDirectory() && e.name.startsWith('project_'))
      .map((e) => e.name)
      .sort();

    const projects = await Promise.all(
      projectFolders.map(async (folder) => {
        const fullPath = path.join(AUTOMATION_PROJECT_ROOT, folder);
        const subEntries = await fs.readdir(fullPath, { withFileTypes: true });
        const subfolders = subEntries.filter((e) => e.isDirectory()).map((e) => e.name);

        const csvFolder = subfolders.find((s) => s.startsWith('csv_floorplan')) || '';
        const backplateFolder = subfolders.find((s) => s.startsWith('backplate_image_floorplan')) || '';

        const codeParts = folder.replace('project_1-0-0_', '').split('_');
        const projectCode = codeParts[codeParts.length - 1] || folder;
        const cdnBaseUrl = `/container_projects/${folder}/`;

        return {
          folder,
          fullPath,
          projectCode,
          cdnBaseUrl,
          csvFolder,
          backplateFolder,
          subfolders,
        };
      }),
    );

    return NextResponse.json({ status: 'success', data: projects });
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Failed to list projects' },
      { status: 500 },
    );
  }
}
