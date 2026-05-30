# Page Builder — Technical Documentation

## Overview

The Page Builder is a visual CMS inside `visual-cms` used to create, edit, preview, and bulk-generate Captivate ViewConfigs. It consists of:

1. **Page Management Dashboard** (`/page-builder`) — browse, search, clone, delete ViewConfigs
2. **Page Editor** (`/page-builder/new` and `/page-builder/[id]`) — WYSIWYG editor for Layout2Ds, Markers, Backplates
3. **Preview** (`/page-builder/preview/[id]`) — renders a ViewConfig exactly like the WebApp
4. **Floorplan Generator** (`/page-builder/floorplans`) — bulk SQL generation for floorplan ViewConfigs
5. **Interior Generator** (`/page-builder/interiors`) — bulk SQL generation for interior 3D ViewConfigs

---

## Route Map

| Route | File | Purpose |
|-------|------|---------|
| `/page-builder` | `src/app/page-builder/page.tsx` | List all ViewConfigs with pagination, search, kind filter |
| `/page-builder/new` | `src/app/page-builder/new/page.tsx` | Create new page from template (Hero, Project, Cluster, etc.) |
| `/page-builder/[id]` | `src/app/page-builder/[id]/page.tsx` | Edit existing ViewConfig (loads from DB into builder) |
| `/page-builder/preview/[id]` | `src/app/page-builder/preview/[id]/page.tsx` | Preview renderer matching WebApp behavior |
| `/page-builder/floorplans` | `src/app/page-builder/floorplans/page.tsx` | Floorplan SQL bulk generator |
| `/page-builder/interiors` | `src/app/page-builder/interiors/page.tsx` | Interior 3D SQL bulk generator |

---

## API Routes

### `GET /api/page-builder/pages`

Lists ViewConfigs with aggregated counts.

**Query params:**
- `kind` — filter by ViewConfig Kind (0-9)
- `search` — case-insensitive search on Code or Title
- `page` — pagination page (default 1)
- `pageSize` — items per page (default 50, max 200)

**Response:**
```json
{
  "status": "success",
  "data": [{
    "id": "uuid",
    "kind": 3,
    "code": "yasparkplace",
    "title": "Yas Park Place",
    "layoutCount": 2,
    "markerCount": 15,
    "backplateCount": 4,
    "navigationCount": 3,
    "parentLink": { "field": "CityId", "id": "..." }
  }],
  "total": 120,
  "page": 1,
  "pageSize": 50,
  "totalPages": 3
}
```

Counts are computed via Prisma `_count` and `reduce`:
- `layoutCount` = `Layout2Ds` count
- `markerCount` = sum of `Markers` across all `Layout2Ds`
- `backplateCount` = sum of `Backplates` across all `Layout2Ds`
- `navigationCount` = `Navigations` count on ViewConfig

**Parent link resolution:** checks `ProjectId` → `ClusterId` → `CityId` → `NationId` → `AmenityId` → `UnitId`, returns first match.

### `DELETE /api/page-builder/pages?id=xxx`

Deletes a ViewConfig. Prisma cascades delete to child `Layout2Ds`, `Backplates`, `Markers`, `Navigations`, etc.

### `POST /api/page-builder/save`

Upserts a complete PageDraft with all nested children in a transaction.

**Body shape:**
```typescript
{
  Id: string;
  Kind: number;
  Code: string;
  Title: string;
  Subtitle: string;
  CdnBaseUrl: string;
  HasGallery: boolean;
  ParentLinkField: string; // e.g. "ProjectId"
  ParentLinkId: string;
  layouts: LayoutDraft[];
}
```

**Transaction logic:**
1. `tx.layout2D.deleteMany({ where: { ViewConfigId: Id } })` — wipes existing Layout2Ds (cascades to Backplates + Markers)
2. `tx.viewConfig.upsert({ ... })` — creates or updates ViewConfig
3. For each layout: `tx.layout2D.create({ ... })`
4. For each backplate in layout: `tx.backplate.create({ ... })`
5. For each marker in layout: `tx.marker.create({ ... })`

This guarantees the DB always exactly matches the builder state.

### `GET /api/page-builder/floorplans/projects`

Scans `Automation/project/` for project folders. Each folder must start with `project_`. Returns:

```typescript
{
  folder: string;        // e.g. "project_1-0-0_uae_abudhabi_yasparkplace"
  fullPath: string;      // absolute path
  projectCode: string;   // last segment after splitting by _
  cdnBaseUrl: string;    // "/container_projects/{folder}/"
  csvFolder: string;     // subfolder starting with "csv_floorplan"
  backplateFolder: string; // subfolder starting with "backplate_image_floorplan"
  subfolders: string[];
}
```

### `POST /api/page-builder/floorplans/scan`

Scans a project's CSV and backplate folders.

**Body:** `{ projectFolderPath, csvSubfolder, backplateSubfolder }`

**Response:**
```typescript
{
  csvFiles: string[];          // all csv_floorplan_*.csv files
  backplateFiles: string[];    // all .webp backplates (excludes thumbnails)
  backplateThumbnails: string[]; // files containing _w640 or _thumb
  csvPath: string;
  backplatePath: string;
  csvCount: number;
  backplateCount: number;
}
```

### `POST /api/page-builder/floorplans/generate`

Generates SQL INSERT statements for floorplan ViewConfigs.

**Per unit:**
- **ViewConfig** (Kind=7) — code = `{projectCode}_{baseName}`
- **Layout2D** — backplate 4096x4096, HideZoomControls=true
- **Markers** — parsed from CSV rows (RoomName, Y, X), each becomes a FloorplanWaypoint marker (Kind=9) with icon `/pins/floorplan-waypoint-default.png`

### `POST /api/page-builder/interiors/scan`

Scans a project folder for interior assets.

**Body:** `{ projectFolderPath, hotspotSubfolder, collisionSubfolder, csvCameraSubfolder }`

**Response:**
```typescript
{
  hotspotFolders: string[];      // subdirs in image_360_property_unit/
  hotspotDetails: Record<string, string[]>; // 360 images per folder
  collisionFiles: string[];     // .glb files
  csvCameraFiles: string[];      // .csv files
  hotspotPath: string;
  collisionPath: string;
  csvCameraPath: string;
}
```

### `POST /api/page-builder/interiors/generate`

Generates SQL INSERT statements for interior 3D ViewConfigs.

**Per unit:**
- **ViewConfig** (Kind=8)
- **Layout3D** — ModelUrl = collision GLB path, ModelScaleJson = `{"X":10,"Y":10,"Z":10}` (or `-10` if mirrored)
- **HotspotGroups** — one per room (extracted from image filename)
- **Hotspots** — each 360 image becomes a hotspot with position/rotation from CSV camera file

**CSV Camera parsing:**
- Format: `RoomName,PosX,PosY,PosZ,RotX,RotY,RotZ`
- Position JSON: `{ X: row[0]*mirrorMult, Y: row[2]*0.01, Z: row[1]*-0.01 }`
- Rotation JSON: `{ X: row[3], Y: row[5]+lrOffset+fbOffset, Z: row[4], W: 1.0 }`
- `mirrorMult` = `-0.01` if `mirror === 'MIRROR'`, else `0.01`

**Balcony skip:** if `skipBalcony=true`, rooms with "balcony" in the name are skipped unless the unit's tower matches `balconyException`.

---

## Interior Generator — Deep Dive

### File: `src/app/page-builder/interiors/page.tsx`

#### State Architecture

The page uses a 3-step wizard (`config` → `match` → `generate`) with URL sync via `?step=` query param.

**Key state variables:**

| State | Type | Purpose |
|-------|------|---------|
| `step` | `'config' \| 'match' \| 'generate'` | Current wizard step, synced to URL |
| `scanResult` | `ScanResult \| null` | Result of folder scan (hotspots, collision, CSV) |
| `matchedUnits` | `MatchedUnit[]` | Computed match results (auto-derived via useEffect) |
| `mulesoftUnits` | `MulesoftUnit[]` | Unit data from MuleSoft API |
| `collisionMatchMode` | `'fuzzy' \| 'exact'` | How to match collision GLB files |
| `csvCameraMatchMode` | `'fuzzy' \| 'exact'` | How to match CSV camera files |
| `selectedSchemes` | `string[]` | Scheme variations to generate (s1_0, s1_1, s2_0, s2_1) |

#### SessionStorage Persistence

All key state is persisted under the key prefix `interior-gen-state`:

```typescript
ssSet('state', {
  scanResult, matchedUnits, sql, genStats,
  mulesoftUnits, mulesoftLoaded,
  collisionMatchMode, csvCameraMatchMode,
  selectedSchemes, autoDuplexScheme, hotspotNesting,
  skipBalcony, balconyException,
});
```

On mount, if `initialStep !== 'config'`, the restore effect reads saved state and re-hydrates all config values. `matchedUnits` is NOT restored directly — it is recomputed by the unified `useEffect` once `scanResult` and matching modes are restored.

#### Unified Match Computation

`matchedUnits` is derived from a single `useEffect` that watches all inputs:

```typescript
useEffect(() => {
  if (scanResult) {
    setMatchedUnits(runMatch(scanResult, collisionMatchMode, csvCameraMatchMode));
  }
}, [scanResult, runMatch, collisionMatchMode, csvCameraMatchMode]);
```

This guarantees `matchedUnits` is always consistent with the current matching modes and scan data. `runMatch` is wrapped in `useCallback` with dependencies `[mulesoftUnits, selectedSchemes, autoDuplexScheme, projectCode, mulesoftLoaded]`.

`comboResults` is memoized with `useMemo` and also calls `runMatch` for each of the 4 possible mode combinations.

`applyCombo` only updates the mode states — the effect handles the recomputation:

```typescript
const applyCombo = useCallback((col, csv) => {
  setCollisionMatchMode(col);
  setCsvCameraMatchMode(csv);
}, []);
```

#### Unit Variant Code Generation

`getUnitVariantCode(unit)` constructs the search codes used for collision/CSV matching:

```
{unitType}_{premium}_{bedrooms}{st/duplex/empty}_{sanitizedFeatureSpec}
```

Examples:
- `a_p_2b_st_1a` (Apartment, Premium, 2 Bed, Standard, Type 1A)
- `th_s_3b_duplex_2b` (Townhouse, Standard, Duplex, Type 2B)
- `v_p__f_3a` (Villa, Premium, no bedrooms, Flipped, Type 3A)

**Unit type mapping:**
| Unit Type | Code |
|-----------|------|
| Villa | V |
| Townhouse | TH |
| Apartment | A |
| Duplex | A |
| Triplex | TX |
| Penthouse | PH |
| House | H |
| Sky villa | SV |

**Premium mapping:** `premiumApplicable === false` → `S`, else `P`

**Bedrooms:** included unless unit category contains "ST" or "duplex"

**Mirror:** `NORMAL` → no suffix, `MIRROR` → `F` suffix

**Feature spec:** stripped of non-alphanumeric chars, "type" removed

#### File Matching Logic

**Collision file matching:**
- Fuzzy: `scan.collisionFiles.find(f => f.toLowerCase().includes(searchCode))`
- Exact: `f === model_360-collision_{searchCode}_0.glb`

**CSV camera file matching:**
- Fuzzy: `scan.csvCameraFiles.find(f => f.toLowerCase().includes(searchCode))`
- Exact: `f === csv_camera_{searchCode}_{schemePart}.csv`

**MuleSoft unit → hotspot folder matching:**
```typescript
const unitSuffix = u.aldar_unit_number.split('-').slice(-3).join('-').toLowerCase();
return unitSuffix === folderNorm || folderNorm.includes(unitSuffix);
```

This matches `YasParkPlace-B5-08-09` to folder `b5-08-09`.

#### Combo Results Panel

The 4 possible mode combinations are always displayed as a grid of buttons:

| Combo | Collision | CSV |
|-------|-----------|-----|
| 1 | Fuzzy | Fuzzy |
| 2 | Fuzzy | Exact |
| 3 | Exact | Fuzzy |
| 4 | Exact | Exact |

Each button shows:
- `collisionHits / total` — how many units got a GLB match
- `csvHits / total` — how many units got a CSV match
- `BEST` badge — shown on the combo(s) with the highest combined score, but only if there is a strict winner (not all tied)

The currently active combo gets a blue highlight border.

#### MuleSoft Integration

**Environment config:** loaded from `/api/mulesoft/environments` — returns a list of configured env names.

**Unit data loading:**
1. User selects a DB project from `/api/projects?limit=200`
2. Community name = `project.Title`
3. POST to `/api/mulesoft/unit-details` with `{ environments: [selectedEnv], communityName }`
4. Response includes `debug` object with endpoint, client_id prefix, and request body for diagnostics

**Scan gate:** the Scan button is disabled until `mulesoftLoaded === true`. A warning banner reminds the user to load MuleSoft data first.

---

## Floorplan Generator — Deep Dive

### File: `src/app/page-builder/floorplans/page.tsx`

#### Matching Logic

1. Scans CSV folder for `csv_floorplan_*.csv` files
2. Extracts base name: `csv_floorplan_{base}.csv` → `{base}`
3. Searches backplate folder for `backplate_image_floorplan_*{base}*.webp` (excluding thumbnails)
4. Searches for thumbnail: `backplate_image_floorplan_*{base}*_w640_q10.webp`

**Code construction:**
```typescript
let code = `${projectCode}_${baseName}`;
// If baseName has tower-floor-unit_scheme pattern:
// e.g. "b2-02-06_s1_0" → code = "yasparkplace_b2-2-06_s1_0"
```

#### SQL Generation

For each matched CSV/backplate pair:
- **ViewConfig** (Kind=7): code, title = code, CdnBaseUrl
- **Layout2D**: BackplateUrl, BackplateWidth=4096, BackplateHeight=4096, HideZoomControls=true
- **Markers**: one per CSV row (RoomName, Y, X)
  - `PositionTop = Y / backplateHeight * 100`
  - `PositionLeft = X / backplateWidth * 100`
  - Icon = `/pins/floorplan-waypoint-default.png`
  - Kind = 9 (FloorplanWaypoint)

---

## Data Flow Summary

### Interior Generator

```
Automation/project/{project_folder}/
  ├── image_360_property_unit/     → hotspotFolders + 360 images
  ├── model_360-collision_property_variation/  → collision GLBs
  └── csv_camera_property_variation/           → CSV camera files

        ↓  POST /api/page-builder/interiors/scan

ScanResult { hotspotFolders, collisionFiles, csvCameraFiles }

        ↓  Client-side: runMatch()

MuleSoft data + scan data → matchedUnits[]

        ↓  POST /api/page-builder/interiors/generate

SQL INSERTs for ViewConfigs, Layout3Ds, HotspotGroups, Hotspots
```

### Floorplan Generator

```
Automation/project/{project_folder}/
  ├── csv_floorplan_*/             → CSV marker files
  └── backplate_image_floorplan_/  → Backplate .webp images

        ↓  POST /api/page-builder/floorplans/scan

ScanResult { csvFiles, backplateFiles, backplateThumbnails }

        ↓  Client-side: autoMatch()

matchedUnits[] (CSV ↔ backplate pairs)

        ↓  POST /api/page-builder/floorplans/generate

SQL INSERTs for ViewConfigs, Layout2Ds, Markers
```

---

## TODOs

- **Video Page Generator UI** — Add a new generator page (e.g., `/page-builder/videos`) for bulk-creating video ViewConfigs. This would scan a project folder for video assets (e.g., `video_property_unit/`), match them to MuleSoft units, and generate SQL for ViewConfig + Layout2D + Marker rows with video playback settings (VideoLoopEnabled, VideoAutoplay, ShowVideoControls). Should follow the same 3-step wizard pattern (config → match → generate) as the floorplan and interior generators.

---

## File Structure

```
src/app/page-builder/
├── page.tsx                    # Dashboard (list ViewConfigs)
├── new/page.tsx                # Create new page
├── [id]/page.tsx               # Edit existing page
├── preview/[id]/page.tsx       # Preview renderer
├── floorplans/page.tsx         # Floorplan generator UI
└── interiors/page.tsx          # Interior generator UI

src/app/api/page-builder/
├── pages/route.ts              # GET list / DELETE ViewConfig
├── save/route.ts               # POST upsert ViewConfig + children
├── preview/route.ts            # GET preview data
├── floorplans/
│   ├── projects/route.ts       # List Automation projects
│   ├── scan/route.ts           # Scan floorplan folders
│   └── generate/route.ts       # Generate floorplan SQL
└── interiors/
    ├── scan/route.ts           # Scan interior folders
    └── generate/route.ts       # Generate interior SQL
```

---

## Key Design Decisions

1. **Transaction-based save** — `save/route.ts` deletes all existing Layout2Ds before recreating them. This simplifies sync logic at the cost of slightly more DB writes.

2. **File-system scanning** — both generators scan the local `Automation/project/` folders directly. This requires the visual-cms app to run on the same machine (or have access to) the Automation project folder.

3. **MuleSoft as optional but gated** — interior matching falls back to folder-name parsing if MuleSoft data is absent, but the UI enforces loading MuleSoft data before scanning to ensure accurate collision/CSV matching.

4. **SessionStorage over URL params for config** — the heavy config state (scan results, matched units, MuleSoft data) is stored in `sessionStorage`. Only the `step` is synced to the URL (`?step=match`). This balances shareability with state size.

5. **useEffect-driven matchedUnits** — instead of manually setting `matchedUnits` in multiple places (after scan, after combo click, after MuleSoft load), a single `useEffect` derives it from `[scanResult, runMatch, collisionMatchMode, csvCameraMatchMode]`. This eliminates the stale-state desync bugs that occurred when multiple setters overwrote each other.
