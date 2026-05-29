import type {
  BackplateDraft,
  LayoutDraft,
  MarkerDraft,
  PageDraft,
} from './pageBuilderTypes';

/**
 * Builds psql INSERT statements for a {@link PageDraft}.
 *
 * Mirrors the escaping style proven in Automation/src/helper/database.ts, but type-aware:
 *  - null / undefined  -> NULL
 *  - boolean           -> TRUE / FALSE
 *  - number            -> raw (no quotes)
 *  - string            -> single-quoted, with embedded ' doubled ('')
 *
 * Every draft entity already carries a client-generated UUID, so foreign keys (ViewConfigId,
 * Layout2DId) resolve across the emitted statements without RETURNING round-trips.
 */

export type SqlValue = string | number | boolean | null | undefined;

export function formatValue(value: SqlValue): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Build a single `INSERT INTO public."Table" (...) VALUES (...);` from a column->value object. */
export function buildInsert(table: string, row: Record<string, SqlValue>): string {
  const columns = Object.keys(row);
  const cols = columns.map((c) => `"${c}"`).join(', ');
  const vals = columns.map((c) => formatValue(row[c])).join(', ');
  return `INSERT INTO public."${table}" (${cols}) VALUES (${vals});`;
}

// --- Row extraction: drop local-only fields / children, attach foreign keys. -------------------

function viewConfigRow(page: PageDraft): Record<string, SqlValue> {
  const row: Record<string, SqlValue> = {
    Id: page.Id,
    Kind: page.Kind,
    Code: page.Code,
    Title: page.Title,
    Subtitle: page.Subtitle,
    HasGallery: page.HasGallery,
    CdnBaseUrl: page.CdnBaseUrl,
  };
  if (page.ParentLinkId.trim()) {
    row[page.ParentLinkField] = page.ParentLinkId.trim();
  }
  return row;
}

function layoutRow(layout: LayoutDraft, viewConfigId: string): Record<string, SqlValue> {
  const { backplates: _b, markers: _m, ...columns } = layout;
  void _b;
  void _m;
  return { ...columns, ViewConfigId: viewConfigId };
}

function backplateRow(backplate: BackplateDraft, layout2DId: string): Record<string, SqlValue> {
  return { ...backplate, Layout2DId: layout2DId };
}

function markerRow(marker: MarkerDraft, layout2DId: string): Record<string, SqlValue> {
  return { ...marker, Layout2DId: layout2DId };
}

/** Emit the full, ordered set of INSERTs for a page: ViewConfig -> Layout2Ds -> Backplates+Markers. */
export function buildPageSql(page: PageDraft): string {
  const blocks: string[] = [];

  blocks.push('-- ViewConfig');
  blocks.push(buildInsert('ViewConfigs', viewConfigRow(page)));

  page.layouts.forEach((layout, i) => {
    blocks.push('');
    blocks.push(`-- Layout2D #${i + 1} (${layout.DisplayName || layout.Id})`);
    blocks.push(buildInsert('Layout2Ds', layoutRow(layout, page.Id)));

    if (layout.backplates.length) {
      blocks.push('-- Backplates');
      layout.backplates.forEach((bp) => {
        blocks.push(buildInsert('Backplates', backplateRow(bp, layout.Id)));
      });
    }

    if (layout.markers.length) {
      blocks.push('-- Markers');
      layout.markers.forEach((mk) => {
        blocks.push(buildInsert('Markers', markerRow(mk, layout.Id)));
      });
    }
  });

  return blocks.join('\n');
}
