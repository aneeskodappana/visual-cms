import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/page-builder/save
 *
 * Saves (upsert) a PageDraft to the database. Deletes existing child rows (Layout2Ds, Backplates,
 * Markers) for the given ViewConfig and recreates them from the draft so the DB always matches
 * what the builder shows.
 *
 * Body: PageDraft JSON (same shape used by the client builder).
 * Returns: { status: 'success', id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { Id, Kind, Code, Title, Subtitle, CdnBaseUrl, HasGallery, ParentLinkField, ParentLinkId, layouts } = body;

    if (!Id || !Array.isArray(layouts)) {
      return NextResponse.json(
        { status: 'error', error: 'Id and layouts[] are required' },
        { status: 400 },
      );
    }

    const parentLink: Record<string, string | null> = {
      NationId: null,
      CityId: null,
      ProjectId: null,
      ClusterId: null,
      AmenityId: null,
      UnitId: null,
    };
    if (ParentLinkField && ParentLinkId?.trim()) {
      parentLink[ParentLinkField] = ParentLinkId.trim();
    }

    await prisma.$transaction(async (tx) => {
      // Delete existing Layout2Ds (cascades to Backplates + Markers) if updating
      await tx.layout2D.deleteMany({ where: { ViewConfigId: Id } });

      // Upsert the ViewConfig
      await tx.viewConfig.upsert({
        where: { Id },
        create: {
          Id,
          Kind: Number(Kind),
          Code: Code || '',
          Title: Title || '',
          Subtitle: Subtitle || '',
          CdnBaseUrl: CdnBaseUrl || '',
          HasGallery: Boolean(HasGallery),
          ...parentLink,
        },
        update: {
          Kind: Number(Kind),
          Code: Code || '',
          Title: Title || '',
          Subtitle: Subtitle || '',
          CdnBaseUrl: CdnBaseUrl || '',
          HasGallery: Boolean(HasGallery),
          ...parentLink,
        },
      });

      // Create Layout2Ds + children
      for (const layout of layouts) {
        const {
          Id: layoutId,
          backplates,
          markers,
          ...layoutFields
        } = layout;

        await tx.layout2D.create({
          data: {
            Id: layoutId,
            IsDefault: Boolean(layoutFields.IsDefault),
            DisplayName: layoutFields.DisplayName || '',
            DisplayOrder: Number(layoutFields.DisplayOrder ?? 0),
            DesktopTransformSettingsJson: layoutFields.DesktopTransformSettingsJson || '',
            MobileTransformSettingsJson: layoutFields.MobileTransformSettingsJson || '',
            BackplateUrl: layoutFields.BackplateUrl || '',
            BackplateVersion: Number(layoutFields.BackplateVersion ?? 1),
            BackplateWidth: Number(layoutFields.BackplateWidth ?? 0),
            BackplateHeight: Number(layoutFields.BackplateHeight ?? 0),
            VideoLoopEnabled: Boolean(layoutFields.VideoLoopEnabled),
            VideoAutoplay: Boolean(layoutFields.VideoAutoplay),
            ShowVideoControls: Boolean(layoutFields.ShowVideoControls),
            BackplateFormat: Number(layoutFields.BackplateFormat ?? 0),
            NorthBearing: layoutFields.NorthBearing || '',
            BackplateThumbnailUrl: layoutFields.BackplateThumbnailUrl || '',
            BackplateThumbnailVersion: layoutFields.BackplateThumbnailVersion != null ? Number(layoutFields.BackplateThumbnailVersion) : 1,
            BackplateThumbnailWidth: layoutFields.BackplateThumbnailWidth != null ? Number(layoutFields.BackplateThumbnailWidth) : null,
            BackplateThumbnailHeight: layoutFields.BackplateThumbnailHeight != null ? Number(layoutFields.BackplateThumbnailHeight) : null,
            HasCallbackWindow: Boolean(layoutFields.HasCallbackWindow),
            MarkerConnectionSettings: layoutFields.MarkerConnectionSettings || '',
            FocusedMarkerId: Number(layoutFields.FocusedMarkerId ?? -1),
            ViewConfigId: Id,
          },
        });

        // Create Backplates
        if (Array.isArray(backplates)) {
          for (const bp of backplates) {
            await tx.backplate.create({
              data: {
                Id: bp.Id,
                Url: bp.Url || '',
                Version: Number(bp.Version ?? 1),
                Width: Number(bp.Width ?? 0),
                Height: Number(bp.Height ?? 0),
                Type: Number(bp.Type ?? 0),
                Theme: Number(bp.Theme ?? 0),
                LngLatJson: bp.LngLatJson || '',
                LngLatBoundsJson: bp.LngLatBoundsJson || '',
                MinZoomLevel: Number(bp.MinZoomLevel ?? 0),
                MaxZoomLevel: Number(bp.MaxZoomLevel ?? 0),
                VideoLoopEnabled: Boolean(bp.VideoLoopEnabled),
                VideoAutoplay: Boolean(bp.VideoAutoplay),
                ShowVideoControls: Boolean(bp.ShowVideoControls),
                ThumbnailUrl: bp.ThumbnailUrl || '',
                ThumbnailVersion: bp.ThumbnailVersion != null ? Number(bp.ThumbnailVersion) : 1,
                ThumbnailWidth: bp.ThumbnailWidth != null ? Number(bp.ThumbnailWidth) : null,
                ThumbnailHeight: bp.ThumbnailHeight != null ? Number(bp.ThumbnailHeight) : null,
                Layout2DId: layoutId,
              },
            });
          }
        }

        // Create Markers
        if (Array.isArray(markers)) {
          for (const mk of markers) {
            await tx.marker.create({
              data: {
                Id: mk.Id,
                Kind: Number(mk.Kind ?? 0),
                SubType: mk.SubType != null ? Number(mk.SubType) : null,
                MarkerIndex: Number(mk.MarkerIndex ?? 0),
                Code: mk.Code || '',
                IsVisible: mk.IsVisible !== false,
                IsExplorable: mk.IsExplorable !== false,
                NavigateTo: mk.NavigateTo || '',
                IsShallowLink: Boolean(mk.IsShallowLink),
                PositionTop: Number(mk.PositionTop ?? 0),
                PositionLeft: Number(mk.PositionLeft ?? 0),
                KeepScale: Boolean(mk.KeepScale),
                LngLatJson: mk.LngLatJson || '',
                ConnectionLineJson: mk.ConnectionLineJson || '',
                Scale: Number(mk.Scale ?? 100),
                MinZoom: Number(mk.MinZoom ?? 0),
                MaxZoom: Number(mk.MaxZoom ?? 2.5),
                MobileScale: Number(mk.MobileScale ?? 100),
                MobileMinZoom: Number(mk.MobileMinZoom ?? 0),
                MobileMaxZoom: Number(mk.MobileMaxZoom ?? 2.5),
                LinkToMarkerIndex: mk.LinkToMarkerIndex != null ? Number(mk.LinkToMarkerIndex) : null,
                AnchorPositionTop: mk.AnchorPositionTop != null ? Number(mk.AnchorPositionTop) : null,
                AnchorPositionLeft: mk.AnchorPositionLeft != null ? Number(mk.AnchorPositionLeft) : null,
                HoverTitle: mk.HoverTitle || null,
                HoverTitleVisible: mk.HoverTitleVisible != null ? Boolean(mk.HoverTitleVisible) : null,
                HoverIconUrl: mk.HoverIconUrl || null,
                HoverIconVersion: mk.HoverIconVersion != null ? Number(mk.HoverIconVersion) : null,
                HoverIconWidth: mk.HoverIconWidth != null ? Number(mk.HoverIconWidth) : null,
                HoverIconHeight: mk.HoverIconHeight != null ? Number(mk.HoverIconHeight) : null,
                HoverScale: mk.HoverScale != null ? Number(mk.HoverScale) : null,
                SelectedTitle: mk.SelectedTitle || null,
                SelectedTitleVisible: mk.SelectedTitleVisible != null ? Boolean(mk.SelectedTitleVisible) : null,
                SelectedIconUrl: mk.SelectedIconUrl || null,
                SelectedIconVersion: mk.SelectedIconVersion != null ? Number(mk.SelectedIconVersion) : null,
                SelectedIconWidth: mk.SelectedIconWidth != null ? Number(mk.SelectedIconWidth) : null,
                SelectedIconHeight: mk.SelectedIconHeight != null ? Number(mk.SelectedIconHeight) : null,
                SelectedScale: mk.SelectedScale != null ? Number(mk.SelectedScale) : null,
                Title: mk.Title || '',
                TitleVisible: mk.TitleVisible !== false,
                IconUrl: mk.IconUrl || null,
                IconVersion: mk.IconVersion != null ? Number(mk.IconVersion) : null,
                IconWidth: mk.IconWidth != null ? Number(mk.IconWidth) : null,
                IconHeight: mk.IconHeight != null ? Number(mk.IconHeight) : null,
                Version: mk.Version != null ? Number(mk.Version) : null,
                IsPriority: mk.IsPriority != null ? Boolean(mk.IsPriority) : null,
                Logo: mk.Logo != null ? Number(mk.Logo) : null,
                Layout2DId: layoutId,
              },
            });
          }
        }
      }
    });

    return NextResponse.json({ status: 'success', id: Id });
  } catch (error) {
    console.error('Error saving page:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to save page',
      },
      { status: 500 },
    );
  }
}
