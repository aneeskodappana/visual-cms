# CLAUDE.md — visual-cms

## Project overview

**WOACMS** (World of Aldar CMS) is an internal Next.js 14 tool for inspecting and editing Aldar's real-estate experience data: ViewConfigs, Layout2Ds, Markers, Projects, Units, and related assets. It connects directly to a PostgreSQL database and to Mulesoft APIs.

Dev server always runs on **port 3001** (`npm run dev` → `next dev --port 3001`).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, `'use client'` components) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| DB client | `pg` (raw SQL — no ORM query builder) |
| Schema introspection | Prisma (schema only, not used for queries) |
| 2D tiled viewer | OpenSeadragon v5.0.1 (`.dzi` backplates) |
| 2D pan/zoom | react-zoom-pan-pinch (non-DZI backplates) |
| Icons | lucide-react |
| UUID generation | `uuid` v11 |

---

## Environment

Secrets live in `.env` (git-ignored). Copy `.env.sample` to get started.

Key env vars:
- `DATABASE_URL` — PostgreSQL connection string
- `MULESOFT_*` — Mulesoft API credentials/base URL

The DB selector modal (`DatabaseSelectorModal`) lets users switch between environments at runtime without restarting the server.

---

## Project structure

```
src/
  app/
    page.tsx                          ← Home dashboard (quick links, Marker Kinds/SubTypes reference)
    layout.tsx
    projects/
      page.tsx                        ← Project list
      [id]/page.tsx                   ← Project detail (units, Mulesoft integration, SQL export)
    viewconfig-search/page.tsx        ← Search ViewConfigs by code/title
    viewconfig-url/page.tsx           ← Resolve ViewConfig from a WebApp URL
    viewconfig/[id]/
      page.tsx                        ← ViewConfig viewer + marker editor (main page)
      layout3d/page.tsx               ← 3D layout viewer
      web-app-3d/page.tsx             ← WebApp 3D integration
    unit-search/page.tsx
    project-search/page.tsx
    sql-editor/page.tsx               ← Raw SQL query editor
    uuid-generator/page.tsx
    yasparkplace/page.tsx
    api/
      viewconfig/
        route.ts                      ← GET/PUT ViewConfig
        search/route.ts               ← Search ViewConfigs (by UUID or code)
        markers/route.ts              ← GET/POST/PUT/PATCH/DELETE Markers
        resolve-url/route.ts
        layout3d/route.ts
        hotspots/route.ts
      projects/
        route.ts
        [id]/route.ts
        [id]/sales-lead/route.ts
      project/search/route.ts
      unit/search/route.ts
      mulesoft/
        unit-details/route.ts
        environments/route.ts
      database/route.ts
      db-test/route.ts
      yasparkplace/floorplates/route.ts
  components/
    Layout2DDziViewer.tsx             ← OpenSeadragon DZI viewer with marker overlay
    ProjectDetailComponent.tsx        ← Project detail with grouped unit view, SQL generation
    ProjectListComponent.tsx
    ProjectSearchComponent.tsx
    ViewConfigSearchComponent.tsx
    ViewConfigUrlResolverComponent.tsx
    UnitSearchComponent.tsx
    DatabaseTestComponent.tsx
    DatabaseSelectorModal.tsx
    OpenSeadragonPreview.tsx
    FloorplateMarkerAdder.tsx
    SqlQueryValueEditor.tsx
    UuidGeneratorComponent.tsx
  lib/
    cdnUtils.ts                       ← Enums (ViewTypes, MarkerTypes, MarkerSubTypes) + URL helpers
    db.ts                             ← pg Pool singleton
```

---

## Key domain concepts

### ViewConfig
Top-level configuration for a view in the WebApp. Has a `Code` (e.g. `"abu-dhabi-city"`) and one or more `Layout2D` children.

### Layout2D
A 2D backplate (image or DZI tile set) with a collection of `Markers`. Fields include `BackplateUrl`, `BackplateWidth`, `BackplateHeight`.

### Marker
A hotspot placed on a Layout2D. Key fields:

| Field | Notes |
|---|---|
| `Kind` | Numeric `MarkerTypes` enum value (0–20) |
| `SubType` | Numeric `MarkerSubTypes` enum value |
| `PositionTop` / `PositionLeft` | Position in a 2048×2048 reference coordinate space |
| `IconUrl` | Relative path under `https://worlddev.aldar.com/assets/`. Values starting with `#` (e.g. `#ui-villas-and-towers`) are built-in WebApp refs — render as a fallback dot |
| `KeepScale` | `true` = marker stays constant visible size as user zooms; `false` = marker grows with the image |
| `MinZoom` / `MaxZoom` | Effective scale thresholds for visibility (desktop). `effectiveScale = osdZoom × (windowWidth / 2048)` |
| `MobileMinZoom` / `MobileMaxZoom` | Same for mobile |
| `IconWidth` / `IconHeight` | Used for image-relative sizing of SVG overlays |

### MarkerTypes enum (Kind values)
0 Base · 1 AldarProjectCity · 2 GlobeCity · 3 Project · 4 Cluster · 5 City · 6 Landmark · 7 Unit · 8 Floor · 9 Floorplan · 10 RoomWaypoint · 11 Exterior360 · 12 OnSideLandmark · 13 Viewpoint · 14 Project_Animated · 15 IFrame · **16 Project_Overlay** · 17 Amenity · 18 Hero · 19 Parking_Lot · 20 Retail_Floor_Hotspot

### CDN / assets
All asset URLs are relative paths. Full URL = `https://worlddev.aldar.com/assets/<path>`.  
Helper: `constructCdnUrl(backplatePath, cdnBaseUrl)` in `src/lib/cdnUtils.ts`.

---

## ViewConfig viewer (`viewconfig/[id]/page.tsx`)

The main editor page. Full-screen viewer with floating panels.

### Backplate rendering
- **DZI** (`.dzi` extension) → `Layout2DDziViewer` component (OpenSeadragon)
- **Non-DZI** (regular image) → `TransformWrapper` + `<img>` (react-zoom-pan-pinch)

### Marker rendering
- `MarkerIcon`: renders marker icon from CDN. SVGs that fail to load (missing `xmlns`) are fetched as text and injected inline (`dangerouslySetInnerHTML`).
- `MarkerFallbackDot`: used when `IconUrl` is absent, `#`-prefixed, or image load fails.
- Inline SVG markers use **image-relative sizing**: `width = (IconWidth / BackplateWidth) * 100%`.
- Inline SVG fill overridden to `rgba(255,255,255,0.45)` via scoped `<style>` tags.
- **KeepScale=true** (OSD mode): `visualScale = 1` (constant size, OSD handles no parent CSS scale).
- **KeepScale=false** (OSD mode): `visualScale = effectiveScale` (grows with image).

### Edit mode
Drag markers to reposition. Actions per marker: Replicate · Edit (title/icon) · Delete · Copy SQL.  
All changes are staged locally; "Save" opens a confirmation modal with generated SQL (`BEGIN/COMMIT` wrapped).

### Floating panels
- **Header** (top-left, draggable): title, edit/save controls, quick SQL copy buttons
- **Layout selector** (top-center): navigate between Layout2Ds
- **Zoom controls** (bottom-left, non-DZI only): +/−/Reset
- **Markers widget** (bottom-right, collapsible): full marker list with bulk INSERT/DELETE SQL

---

## Layout2DDziViewer (`src/components/Layout2DDziViewer.tsx`)

Standalone OpenSeadragon viewer for `.dzi` backplates with full marker overlay.

- Uses `tiledImage.getContentSize()` for actual DZI pixel dimensions (NOT `BackplateWidth` from DB which is in a different coordinate space).
- Uses `tiledImage.imageToViewerElementCoordinates()` to size/position the HTML overlay layer over the OSD canvas.
- `VIEWPORT_REFERENCE_WIDTH = 2048` — matches WebApp's constant for zoom scale calculations.
- `effectiveScale = osdZoom × (windowWidth / 2048)` — mirrors WebApp's `useMarkerScaleRef` + `useMarkerVisibility`.

---

## Home page (`src/app/page.tsx`)

Dashboard with:
- **Quick links** to all sub-pages
- **Marker Kinds** — collapsible grid showing all `MarkerTypes` enum entries (numeric value + name)
- **Marker SubTypes** — same for `MarkerSubTypes`
- **Database Status** — live connection check via `DatabaseTestComponent`

---

## Database access pattern

All DB queries use raw SQL via the `pg` Pool in `src/lib/db.ts`. No ORM.  
API routes are in `src/app/api/`. Marker CRUD: `GET/POST/PUT/PATCH/DELETE` at `/api/viewconfig/markers`.

---

## WebApp reference

The companion app (`C:\Users\akodappana\Captivate\WebApp`) is the production React app these CMS edits feed into. Key WebApp patterns mirrored in this CMS:

- `VIEWPORT_REFERENCE_WIDTH = 2048` — coordinate reference for marker positions
- `useMarkerVisibility` — MinZoom/MaxZoom gating with `effectiveScale`
- `useMarkerScaleRef` — scale = `windowWidth / 2048`
- `openSeaDragonOverlaysUtils.ts` — OSD overlay/marker container setup, `MouseTracker` for click re-dispatch

---

## Common gotchas

- **DZI dimensions**: always use `tiledImage.getContentSize()`, never `BackplateWidth` from DB for OSD coordinate math.
- **`#`-prefixed IconUrls**: these are WebApp built-in icon refs (e.g. `#ui-villas-and-towers`), not real paths — always fall back to dot.
- **Missing SVG xmlns**: CDN SVGs sometimes lack `xmlns="http://www.w3.org/2000/svg"`. The `MarkerIcon` component handles this with an `onError` → fetch → inline inject fallback.
- **OSD click interception**: OpenSeadragon captures pointer events. Marker clicks inside OSD overlays must be re-dispatched via `new OpenSeadragon.MouseTracker({ clickHandler })`.
- **Never use PowerShell** — use cmd or Bash tool only.
