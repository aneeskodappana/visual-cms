'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  CSSProperties,
  ReactNode,
} from 'react';
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
  KeepScale,
} from 'react-zoom-pan-pinch';
import OpenSeadragon from 'openseadragon';

/* eslint-disable @typescript-eslint/no-explicit-any */

const CDN_BASE = 'https://worlddev.aldar.com/assets';

const SVG_SPRITE_URLS = [
  '/common/icons/svg-icons-ui.svg',
  '/common/icons/svg-icons-country-flags.svg',
  '/common/icons/svg-icons-amenities.svg',
  '/common/icons/svg-icons-landmarks.svg',
  '/common/icons/svg-icons-sports.svg',
  '/common/icons/svg-icons-social.svg',
  '/common/icons/svg-icons-cam-orientations.svg',
];

function useSvgSprites() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const existing = document.getElementById('preview-svg-sprites');
    if (existing) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const svgNS = 'http://www.w3.org/2000/svg';

    Promise.all(
      SVG_SPRITE_URLS.map((url) =>
        fetch(url)
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => '')
      )
    ).then((results) => {
      if (cancelled) return;
      const masterSvg = document.createElementNS(svgNS, 'svg');
      masterSvg.id = 'preview-svg-sprites';
      masterSvg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;');

      results.forEach((svgText) => {
        if (!svgText) return;
        const innerMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
        if (!innerMatch) return;
        const tempSvg = document.createElementNS(svgNS, 'svg');
        tempSvg.innerHTML = innerMatch[1];
        const symbols = tempSvg.querySelectorAll('symbol');
        symbols.forEach((s) => masterSvg.appendChild(s));
      });

      document.body.appendChild(masterSvg);
      setLoaded(true);
    });

    return () => { cancelled = true; };
  }, [loaded]);

  return loaded;
}

function PreviewIcon({
  src,
  width,
  height,
  alt,
  className = '',
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  className?: string;
}) {
  const isSvgSprite = src.includes('#');

  if (isSvgSprite) {
    const href = src.startsWith('http')
      ? src.substring(src.indexOf('#'))
      : src;

    return (
      <svg
        width={width}
        height={height}
        fill="white"
        className={className}
        style={{ maxWidth: 'none' }}>
        <title>{alt.replaceAll('[br]', ' ')}</title>
        <use href={href} />
      </svg>
    );
  }

  return (
    <img
      src={src}
      width={width}
      height={height}
      alt={alt}
      draggable={false}
      className={className}
      style={{ maxWidth: 'none' }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types (matching WebApp shape from the preview API)
// ─────────────────────────────────────────────────────────────────────────────
interface MapLayoutPreview {
  id: string;
  displayOrder: number;
  displayName: string;
  isDefault: boolean;
  backplate: BackplatePreview;
  backplates: BackplatePreview[];
  markers?: Record<string, MarkerPreview[]>;
  desktopTransformSettings: TransformSettingsPreview;
  mobileTransformSettings: TransformSettingsPreview;
  focusedMarkerId?: number;
  markerConnectionSettings?: any;
}

interface BackplatePreview {
  backplateUrl: string;
  version: number;
  width: number;
  height: number;
  videoLoopEnabled: boolean;
  videoAutoplay: boolean;
  showVideoControls: boolean;
  backplateFormat: string;
  theme: string;
  thumbnailUrl: string;
}

interface MarkerPreview {
  id: number;
  kind: string;
  subType?: string;
  code: string;
  position: { left: number; top: number };
  keepScale: boolean;
  isExploreDisabled?: boolean;
  isHidden: boolean;
  title?: string;
  titleVisible?: boolean;
  icon?: { url: string; width: number; height: number; version?: number };
  hover?: {
    title?: string;
    titleVisible?: boolean;
    icon?: { url: string; width: number; height: number };
    scale?: number;
    keepScale?: boolean;
  };
  selected?: {
    title?: string;
    icon?: { url: string; width: number; height: number };
    scale?: number;
  };
  scale?: number;
  navigateTo?: string;
  minZoom?: number;
  maxZoom?: number;
  mobileScale?: number;
  mobileMinZoom?: number;
  mobileMaxZoom?: number;
  isPriority?: boolean;
  version?: number;
  logo?: string;
  anchorPosition?: { left: number; top: number };
  connectionLine?: any;
  lngLat?: { lng: number; lat: number };
}

interface TransformSettingsPreview {
  disabled: boolean;
  minScale: number;
  maxScale: number;
  ui: { hideZoomControls: boolean };
}

interface Props {
  mapLayout: MapLayoutPreview;
  cdnBaseUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MapPin — positions a marker using percentage-based left/top within a
// relative-positioned container whose size matches the backplate.
// ─────────────────────────────────────────────────────────────────────────────
function PreviewMapPin({
  id,
  kind,
  children,
  leftPct,
  topPct,
  href = '',
  hoverScale = 100,
  zIndex = 30,
  className = '',
  keepScale: keepScaleProp = false,
  isTiledBackplate = false,
}: {
  id: number;
  kind: string;
  children: ReactNode;
  leftPct: number;
  topPct: number;
  href?: string;
  hoverScale?: number;
  zIndex?: number;
  className?: string;
  keepScale?: boolean;
  isTiledBackplate?: boolean;
}) {
  const KeepScaleConditional = useMemo(
    () =>
      keepScaleProp && !isTiledBackplate
        ? KeepScale
        : ({ children }: { children: ReactNode }) => <>{children}</>,
    [keepScaleProp, isTiledBackplate],
  );

  const pinStyle: CSSProperties = {
    position: 'absolute',
    left: `${leftPct}%`,
    top: `${topPct}%`,
    zIndex,
  };

  const inner = (
    <div className="flex flex-col justify-center items-center relative">
      <div>{children}</div>
    </div>
  );

  return (
    <div
      id={`Pin-${id}`}
      className={`map-pin absolute pointer-events-auto group ${className}`}
      style={pinStyle}
      data-kind={kind}
    >
      <KeepScaleConditional>
        <div className="transform-gpu transition-transform origin-center duration-200 ease-out absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {href ? (
            <a href={href} target="_self">{inner}</a>
          ) : (
            inner
          )}
        </div>
      </KeepScaleConditional>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MapPinTitle — cloned from WebApp src/components/MapPin/MapPinTitle
// ─────────────────────────────────────────────────────────────────────────────
function PreviewMapPinTitle({
  title,
  hoverTitle,
  className = '',
}: {
  title: string;
  hoverTitle: string;
  className?: string;
}) {
  const defaultStyling = 'group w-28 text-xl sm:text-sm';
  const styling = `${defaultStyling} ${className}`;

  const titleLines = title.split('[br]').map((line, i) => (
    <p key={i} className="text-white text-center group-hover:hidden">
      {line}
    </p>
  ));

  const hoverTitleLines = hoverTitle.split('[br]').map((line, i) => (
    <p key={i} className="text-white text-center hidden group-hover:block">
      {line}
    </p>
  ));

  return (
    <div className={styling}>
      {titleLines}
      {hoverTitleLines}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RenderMarker — simplified clone of WebApp src/components/RenderMarker
// Handles all marker kinds with the same rendering approach.
// ─────────────────────────────────────────────────────────────────────────────
function RenderPreviewMarker({
  marker,
  mapLayout,
  className = '',
  isTiledBackplate = false,
}: {
  marker: MarkerPreview;
  mapLayout: MapLayoutPreview;
  className?: string;
  isTiledBackplate?: boolean;
}) {
  const title = marker.title ?? '';
  const hoverTitle = marker.hover?.title || title;
  const navigationUrl = marker.navigateTo ?? '';
  const hoverScale = marker.hover?.scale ?? 100;
  const isProjectOverlay = marker.kind === 'Project_Overlay';

  const markerScale = marker.scale ?? 100;
  const scaleClass = `scale-${markerScale}`;

  const defaultTitleStyling =
    'mt-1 w-auto whitespace-nowrap absolute left-1/2 top-1/2 transform -translate-x-1/2 translate-y-1/2 bg-black bg-opacity-75 group-hover:border-opacity-100 border-2 border-white border-opacity-10 p-1 rounded-md pointer-events-auto z-10';

  const landmarkTitleStyling =
    'absolute left-1/2 transform -translate-x-1/2 group-hover:bg-black group-hover:rounded-md px-1';

  const isLandmark = marker.kind === 'Landmark' || marker.kind === 'OnSideLandmark';
  const titleStyling = isLandmark ? landmarkTitleStyling : defaultTitleStyling;

  const zIndexMap: Record<string, number> = {
    City: 10,
    AldarProjectCity: 20,
    Project: 40,
    Cluster: 30,
    Landmark: 20,
    OnSideLandmark: 20,
    Unit: 20,
    Floorplan: 20,
    Amenity: 30,
    Viewpoint: 40,
    Exterior360: 40,
    Project_Animated: 40,
    IFrame: 40,
    Project_Overlay: 10,
    Hero: 20,
    Parking_Lot: 40,
    Retail_Floor_Hotspot: 40,
  };

  const zIndex = zIndexMap[marker.kind] ?? 20;

  // Version 2 markers have animated border
  const version = marker.version ?? 0;
  const displayStyle = version === 2 ? 'rounded-full' : '';
  const hasHoverIcon = marker.hover?.icon != null;

  return (
    <PreviewMapPin
      id={marker.id}
      kind={marker.kind}
      leftPct={(marker.position.left / (mapLayout.backplate?.width || 1)) * 100}
      topPct={(marker.position.top / (mapLayout.backplate?.height || 1)) * 100}
      href={navigationUrl}
      hoverScale={hoverScale}
      zIndex={zIndex}
      className={`${className} ${isProjectOverlay ? '' : scaleClass}`}
      keepScale={marker.keepScale}
      isTiledBackplate={isTiledBackplate}
    >
      {/* Title (for non-landmark markers) */}
      {!isLandmark && marker.titleVisible && (
        <PreviewMapPinTitle
          title={title}
          hoverTitle={hoverTitle}
          className={titleStyling}
        />
      )}

      {/* Icon */}
      {marker.icon ? (
        <div className="flex items-center justify-center group transition-transform transform">
          {isLandmark ? (
            <>
              <div className="absolute">
                <PreviewIcon
                  className={displayStyle}
                  src={marker.icon.url}
                  width={marker.icon.width}
                  height={marker.icon.height}
                  alt={marker.title ?? ''}
                />
              </div>
              {hasHoverIcon && version === 2 && (
                <div className="relative">
                  <PreviewIcon
                    className="invisible group-hover:visible"
                    src={marker.hover!.icon!.url}
                    width={marker.hover!.icon!.width}
                    height={marker.hover!.icon!.height}
                    alt={marker.hover!.title ?? ''}
                  />
                </div>
              )}
              {(marker.titleVisible || marker.hover?.titleVisible) && (
                <PreviewMapPinTitle
                  title={title}
                  hoverTitle={hoverTitle}
                  className={landmarkTitleStyling}
                />
              )}
            </>
          ) : (
            <PreviewIcon
              src={marker.icon.url}
              width={marker.icon.width}
              height={marker.icon.height}
              alt={marker.title ?? ''}
            />
          )}
        </div>
      ) : (
        <img
          src="https://worlddev.aldar.com/assets/pins/MapPin.svg"
          alt=""
          width={36}
          height={24}
          draggable={false}
          className="h-[24px] w-[36px]"
        />
      )}
    </PreviewMapPin>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarkerRenderer — cloned from WebApp src/components/MapLayoutView/MarkerRenderer
// Groups markers by kind and renders each group in a layer.
// ─────────────────────────────────────────────────────────────────────────────

const MarkerTypesRenderingOrder: Record<string, number> = {
  Project_Overlay: 0,
  City: 1,
  AldarProjectCity: 2,
  Landmark: 3,
  OnSideLandmark: 4,
  Cluster: 5,
  Project: 6,
  Project_Animated: 7,
  Floorplan: 8,
  Unit: 9,
  Amenity: 10,
  Viewpoint: 11,
  Exterior360: 12,
  IFrame: 13,
  Hero: 14,
  Parking_Lot: 15,
  Retail_Floor_Hotspot: 16,
  Education: 17,
  Commercial: 18,
  Base: 99,
};

function PreviewMarkerRenderer({
  processedMarkers,
  mapLayout,
  currentScale,
  isTiledBackplate,
}: {
  processedMarkers: MarkerPreview[][];
  mapLayout: MapLayoutPreview;
  currentScale: number;
  isTiledBackplate: boolean;
}) {
  const sorted = useMemo(() => {
    if (processedMarkers.length === 0) return [];
    return [...processedMarkers].sort((a, b) => {
      const aOrder = MarkerTypesRenderingOrder[a[0]?.kind] ?? 99;
      const bOrder = MarkerTypesRenderingOrder[b[0]?.kind] ?? 99;
      return aOrder - bOrder;
    });
  }, [processedMarkers]);

  if (sorted.length === 0) return null;

  return (
    <>
      {sorted.map((markersGroup) => (
        <div
          key={markersGroup[0].kind}
          id={`Markers-${markersGroup[0].kind}`}
          className="pointer-events-none"
          style={{ position: 'absolute', inset: 0 }}
        >
          {markersGroup.map((marker) => {
            if (marker.isHidden) return null;
            if (!checkMarkerVisibility(marker, currentScale)) return null;

            return (
              <RenderPreviewMarker
                key={`${marker.kind}-${marker.id}`}
                marker={marker}
                mapLayout={mapLayout}
                isTiledBackplate={isTiledBackplate}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

function checkMarkerVisibility(
  marker: MarkerPreview,
  currentScale: number,
): boolean {
  const minZoom = marker.minZoom ?? 0;
  const maxZoom = marker.maxZoom ?? 0;
  if (minZoom === 0 && maxZoom === 0) return true;
  if (maxZoom > 0 && currentScale > maxZoom) return false;
  if (minZoom > 0 && currentScale < minZoom) return false;
  return true;
}

function useProcessedMarkers(markers: Record<string, MarkerPreview[]> | undefined) {
  return useMemo(() => {
    if (!markers) return [];
    return Object.values(markers).filter((v) => v && v.length > 0);
  }, [markers]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Image / Video backplate (react-zoom-pan-pinch — mirrors WebApp MapView)
// ─────────────────────────────────────────────────────────────────────────────
function ImagePreview({ mapLayout }: Props) {
  const backplate = mapLayout.backplate;
  const [currentScale, setCurrentScale] = useState(1);
  const isVideo = backplate.backplateFormat === 'Video';
  const ts = mapLayout.desktopTransformSettings;
  const processedMarkers = useProcessedMarkers(mapLayout.markers);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  const allMarkers = useMemo(() => {
    if (!mapLayout.markers) return [];
    return Object.values(mapLayout.markers).flat().filter((m) => !m.isHidden);
  }, [mapLayout.markers]);

  return (
    <TransformWrapper
      ref={transformRef}
      minScale={ts.minScale || 0.5}
      maxScale={ts.maxScale || 12}
      centerOnInit
      limitToBounds={false}
      doubleClick={{ disabled: true }}
      onInit={(ref) => setCurrentScale(ref.state.scale)}
      onZoom={(ref) => setCurrentScale(ref.state.scale)}
      onTransformed={(ref) => setCurrentScale(ref.state.scale)}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            {/* This relative div is the "map canvas": backplate + markers */}
            <div
              style={{
                position: 'relative',
                width: backplate.width,
                height: backplate.height,
              }}
            >
              {/* Backplate image */}
              {isVideo ? (
                <video
                  src={backplate.backplateUrl}
                  autoPlay={backplate.videoAutoplay}
                  loop={backplate.videoLoopEnabled}
                  muted
                  playsInline
                  controls={backplate.showVideoControls}
                  style={{ display: 'block', width: '100%', height: '100%' }}
                />
              ) : (
                <img
                  src={backplate.backplateUrl}
                  alt="backplate"
                  draggable={false}
                  style={{ display: 'block', width: '100%', height: '100%' }}
                />
              )}

              {/* Markers — absolute positioned using % of backplate */}
              {allMarkers.map((marker) => {
                if (!checkMarkerVisibility(marker, currentScale)) return null;

                const leftPct = (marker.position.left / backplate.width) * 100;
                const topPct = (marker.position.top / backplate.height) * 100;

                return (
                  <div
                    key={`${marker.kind}-${marker.id}`}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 50,
                      pointerEvents: 'auto',
                    }}
                    className="group"
                  >
                    {marker.keepScale ? (
                      <KeepScale>
                        <MarkerContent marker={marker} />
                      </KeepScale>
                    ) : (
                      <MarkerContent marker={marker} />
                    )}
                  </div>
                );
              })}
            </div>
          </TransformComponent>

          {/* Zoom controls */}
          {!ts.ui?.hideZoomControls && (
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-1">
              <button onClick={() => zoomIn()} className="bg-black/70 text-white px-3 py-2 rounded hover:bg-black/90 text-lg">+</button>
              <button onClick={() => zoomOut()} className="bg-black/70 text-white px-3 py-2 rounded hover:bg-black/90 text-lg">−</button>
              <button onClick={() => resetTransform()} className="bg-black/70 text-white px-3 py-2 rounded hover:bg-black/90 text-xs mt-1">Reset</button>
            </div>
          )}
        </>
      )}
    </TransformWrapper>
  );
}

function MarkerContent({ marker }: { marker: MarkerPreview }) {
  const title = marker.title ?? '';
  const hoverTitle = marker.hover?.title || title;
  const navigationUrl = marker.navigateTo ?? '';

  switch (marker.kind) {
    case 'Amenity':
      return <AmenityMarkerContent marker={marker} />;
    case 'Hero':
      return <HeroMarkerContent marker={marker} />;
    case 'Project':
    case 'Project_Animated':
      return <ProjectMarkerContent marker={marker} />;
    case 'Cluster':
      return <ClusterMarkerContent marker={marker} />;
    case 'Landmark':
    case 'OnSideLandmark':
      return <LandmarkMarkerContent marker={marker} />;
    default:
      return <DefaultMarkerContent marker={marker} />;
  }
}

function AmenityMarkerContent({ marker }: { marker: MarkerPreview }) {
  const subType = marker.subType || '';
  let svgSrc = `#amenity-${subType.toLowerCase().replace(/_/g, '-')}`;

  if (marker.icon?.url?.startsWith('#')) {
    const iconHash = marker.icon.url.replace('#', '').toLowerCase();
    // Icons like #ferrari-world map to symbol IDs like amenity-landmark-ferrari-world
    svgSrc = `#amenity-landmark-${iconHash}`;
  }

  const title = marker.title ?? '';
  const hoverTitle = marker.hover?.title || title;

  return (
    <div className="flex flex-col items-center justify-center group">
      <div className="bg-white/0 group-hover:bg-amber-500 rounded-full border-2 border-white/0 backdrop-blur-md shadow-md shadow-black/75">
        <div className="bg-black/60 group-hover:bg-amber-600 rounded-full p-2 sm:p-1 border-white/0">
          <svg width={28} height={28} fill="white" className="w-7 h-7 group-hover:w-8 group-hover:h-8" viewBox="0 0 24 24">
            <use href={svgSrc} />
          </svg>
        </div>
      </div>
      {(marker.titleVisible || marker.hover?.titleVisible) && (
        <div className="whitespace-nowrap mt-2 px-2 py-1 w-fit max-w-28 min-w-10 absolute left-1/2 transform -translate-x-1/2 top-full group-hover:backdrop-blur-md group-hover:bg-black/50 group-hover:rounded-md group-hover:z-50">
          <p className="text-white text-center text-sm font-medium leading-4 group-hover:hidden">{marker.titleVisible ? title : ''}</p>
          <p className="text-white text-center text-sm font-medium leading-4 hidden group-hover:block">{marker.hover?.titleVisible ? hoverTitle : ''}</p>
        </div>
      )}
    </div>
  );
}

function HeroMarkerContent({ marker }: { marker: MarkerPreview }) {
  const title = marker.title ?? '';
  const navigationUrl = marker.navigateTo ?? '';
  const hoverIcon = marker.hover?.icon;

  const propertyIcon = () => {
    switch (marker.subType) {
      case 'Villa': return '#ui-villas-only';
      case 'Tower': return '#ui-towers-only';
      case 'LondonSquare': return '#ui-london-square';
      default: return '#ui-villas-and-towers';
    }
  };

  return (
    <div className={`z-10 shadow rounded-sm pointer-events-auto bg-black ${navigationUrl ? 'bg-opacity-70' : 'bg-opacity-30'} flex flex-col border-white/20 backdrop-blur-sm border scale-200`}>
      {hoverIcon && (
        <img src={hoverIcon.url} width={hoverIcon.width} height={hoverIcon.height} alt={title} className="object-contain w-full" draggable={false} />
      )}
      <div className="flex-col gap-1.5">
        {marker.icon && (
          <div className="inline-flex flex-row items-center justify-between gap-1.5 p-1.5">
            <svg width={16} height={16} fill="white"><use href={propertyIcon()} /></svg>
            <div className="flex h-5 w-px bg-white" />
            <PreviewIcon src={marker.icon.url} width={marker.icon.width} height={marker.icon.height} alt={title} />
          </div>
        )}
        <div className="flex w-full px-1.5 pb-1.5">
          {navigationUrl ? (
            <a href={navigationUrl} className="w-full h-4 py-0.5 bg-current rounded-sm border border-white/10 flex items-center justify-center">
              <span className="text-center text-white text-[10px]">{title ? 'Explore' : 'Coming Soon'}</span>
            </a>
          ) : (
            <div className="w-full h-4 py-0.5 bg-gray-600 rounded-sm border border-white/10 flex items-center justify-center opacity-50">
              <span className="text-center text-white text-[10px]">Coming Soon</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectMarkerContent({ marker }: { marker: MarkerPreview }) {
  const title = marker.title ?? '';
  const navigationUrl = marker.navigateTo ?? '';
  const version = marker.version ?? 0;
  const isPriority = marker.isPriority ?? false;

  const propertyIconSrc = () => {
    switch (marker.subType) {
      case 'Villa': return '#ui-villas-only';
      case 'Tower': return '#ui-towers-only';
      case 'Plot': return '#ui-plots';
      case 'LondonSquare': return '#ui-london-square-borderless';
      default: return '';
    }
  };

  const projectLogo = () => {
    if (marker.logo === 'LondonSquare') return '#ui-london-square';
    if (marker.logo === 'Aldar') return '#ui-aldar';
    if (marker.subType === 'LondonSquare') return '#ui-london-square';
    return '#ui-aldar';
  };

  if (marker.subType === 'Text') {
    return (
      <div className={`z-10 shadow rounded-3xl pointer-events-auto bg-neutral-800/60 inline-flex justify-start items-start py-1 px-2.5 gap-2.5 border-2 border-white/20`}>
        <span className="text-center text-white text-xs font-normal leading-none whitespace-nowrap">{title}</span>
      </div>
    );
  }

  if (version === 2 || ['Villa', 'Tower', 'Plot'].includes(marker.subType || '')) {
    return (
      <div className={`z-10 shadow rounded-3xl pointer-events-auto bg-white ${navigationUrl ? 'opacity-100' : 'opacity-70'} flex justify-start items-start py-1 px-2.5 gap-2.5 w-fit ${isPriority ? 'border-2 border-amber-500' : 'border-2 border-white'}`}>
        <div className="inline-flex flex-row items-center justify-between gap-1.5">
          {propertyIconSrc() && (
            <svg width={16} height={16} fill="black" className="w-4 h-4"><use href={propertyIconSrc()} /></svg>
          )}
          <span className="text-center text-black text-xs font-normal leading-none whitespace-nowrap">{title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`z-10 shadow rounded-sm pointer-events-auto bg-black ${navigationUrl ? 'bg-opacity-70' : 'bg-opacity-30'} flex flex-col p-1.5 border-white/20 backdrop-blur-sm gap-1.5 border`}>
      <div className="inline-flex flex-row items-center justify-between gap-1.5">
        <svg width={16} height={16} fill="white"><use href={projectLogo()} /></svg>
        <div className="flex h-5 w-px bg-white" />
        {marker.icon && <PreviewIcon src={marker.icon.url} width={marker.icon.width} height={marker.icon.height} alt={title} />}
      </div>
      <div className="flex w-full">
        <a href={navigationUrl || '#'} className="w-full h-4 py-0.5 bg-current rounded-sm border border-white/10 flex items-center justify-center">
          <span className="text-center text-white text-[10px]">{title || 'Explore'}</span>
        </a>
      </div>
    </div>
  );
}

function ClusterMarkerContent({ marker }: { marker: MarkerPreview }) {
  const title = marker.title ?? '';
  const hoverTitle = marker.hover?.title || title;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="rounded-full bg-current animate-pulse">
        {marker.icon ? (
          <PreviewIcon src={marker.icon.url} width={marker.icon.width} height={marker.icon.height} alt={title} />
        ) : (
          <div className="w-3 h-3 rounded-full bg-current" />
        )}
      </div>
      {marker.titleVisible && (
        <div className="mt-3 w-auto whitespace-nowrap absolute left-1/2 top-1/2 transform -translate-x-1/2 translate-y-1/2 bg-black bg-opacity-75 group-hover:border-opacity-100 border-2 border-white border-opacity-10 px-2 py-1 rounded-md pointer-events-auto z-10 backdrop-blur-sm">
          <p className="text-white text-center text-sm group-hover:hidden">{title}</p>
          <p className="text-white text-center text-sm hidden group-hover:block">{hoverTitle}</p>
        </div>
      )}
    </div>
  );
}

function LandmarkMarkerContent({ marker }: { marker: MarkerPreview }) {
  const title = marker.title ?? '';
  const hoverTitle = marker.hover?.title || title;
  const version = marker.version ?? 0;
  const hasHoverIcon = marker.hover?.icon != null;

  return (
    <div className="flex items-center justify-center group transition-transform transform">
      {marker.icon && (
        <>
          <div className="absolute">
            <PreviewIcon
              className={version === 2 ? 'rounded-full' : ''}
              src={marker.icon.url}
              width={marker.icon.width}
              height={marker.icon.height}
              alt={title}
            />
          </div>
          {hasHoverIcon && version === 2 && (
            <div className="relative">
              <PreviewIcon
                className="invisible group-hover:visible"
                src={marker.hover!.icon!.url}
                width={marker.hover!.icon!.width}
                height={marker.hover!.icon!.height}
                alt={marker.hover!.title ?? ''}
              />
            </div>
          )}
        </>
      )}
      {(marker.titleVisible || marker.hover?.titleVisible) && (
        <div className="absolute left-1/2 transform -translate-x-1/2 top-full mt-1 group-hover:bg-black group-hover:rounded-md px-1">
          <p className="text-white text-center text-sm group-hover:hidden">{marker.titleVisible ? title : ''}</p>
          <p className="text-white text-center text-sm hidden group-hover:block">{marker.hover?.titleVisible ? hoverTitle : ''}</p>
        </div>
      )}
    </div>
  );
}

function DefaultMarkerContent({ marker }: { marker: MarkerPreview }) {
  const title = marker.title ?? '';
  const hoverTitle = marker.hover?.title || title;
  const navigationUrl = marker.navigateTo ?? '';

  const defaultTitleStyling =
    'mt-1 w-auto whitespace-nowrap absolute left-1/2 top-1/2 transform -translate-x-1/2 translate-y-1/2 bg-black bg-opacity-75 group-hover:border-opacity-100 border-2 border-white border-opacity-10 p-1 rounded-md pointer-events-auto z-10';

  return (
    <div className="flex flex-col items-center justify-center group">
      {marker.titleVisible && (
        <div className={defaultTitleStyling}>
          <p className="text-white text-center text-sm group-hover:hidden">{title}</p>
          <p className="text-white text-center text-sm hidden group-hover:block">{hoverTitle}</p>
        </div>
      )}
      {marker.icon ? (
        <PreviewIcon src={marker.icon.url} width={marker.icon.width} height={marker.icon.height} alt={title} />
      ) : (
        <img src="https://worlddev.aldar.com/assets/pins/MapPin.svg" alt="" width={36} height={24} draggable={false} className="h-[24px] w-[36px]" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DZI / Tiled backplate (OpenSeadragon — mirrors WebApp MapViewTiledBackplate)
// ─────────────────────────────────────────────────────────────────────────────
const VIEWPORT_REFERENCE_WIDTH = 2048;

function TiledPreview({ mapLayout }: Props) {
  const backplate = mapLayout.backplate;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [currentScale, setCurrentScale] = useState(1);
  const processedMarkers = useProcessedMarkers(mapLayout.markers);

  useEffect(() => {
    if (!containerRef.current || !backplate.backplateUrl) return;

    const viewer = OpenSeadragon({
      element: containerRef.current,
      tileSources: backplate.backplateUrl,
      prefixUrl: '',
      showNavigationControl: false,
      animationTime: 0.3,
      blendTime: 0.1,
      constrainDuringPan: true,
      maxZoomPixelRatio: 2,
      visibilityRatio: 1,
      minZoomLevel: 0.5,
      defaultZoomLevel: 1,
      gestureSettingsMouse: { clickToZoom: false },
      gestureSettingsTouch: { clickToZoom: false },
    });

    viewerRef.current = viewer;

    const updateScale = () => {
      const zoom = viewer.viewport.getZoom(true);
      const containerWidth = viewer.viewport.getContainerSize().x;
      const tiledWidth =
        viewer.world.getItemAt(0)?.getContentSize()?.x ?? VIEWPORT_REFERENCE_WIDTH;
      const effectiveScale = (zoom * containerWidth) / tiledWidth;
      setCurrentScale(effectiveScale);
    };

    viewer.addHandler('zoom', updateScale);
    viewer.addHandler('open', updateScale);
    viewer.addHandler('resize', updateScale);

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [backplate.backplateUrl]);

  const refW = backplate.width || VIEWPORT_REFERENCE_WIDTH;
  const refH = backplate.height || VIEWPORT_REFERENCE_WIDTH;

  const wrapperStyle: CSSProperties = {
    width: '100vw',
    height: '100vh',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={wrapperStyle} />
      <div
        ref={overlayRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <TiledMarkerLayer
          processedMarkers={processedMarkers}
          mapLayout={mapLayout}
          viewer={viewerRef}
          refW={refW}
          refH={refH}
          currentScale={currentScale}
        />
      </div>
    </div>
  );
}

function TiledMarkerLayer({
  processedMarkers,
  mapLayout,
  viewer,
  refW,
  refH,
  currentScale,
}: {
  processedMarkers: MarkerPreview[][];
  mapLayout: MapLayoutPreview;
  viewer: React.RefObject<OpenSeadragon.Viewer | null>;
  refW: number;
  refH: number;
  currentScale: number;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    const update = () => setTick((t) => t + 1);
    v.addHandler('animation', update);
    v.addHandler('animation-finish', update);
    return () => {
      v.removeHandler('animation', update);
      v.removeHandler('animation-finish', update);
    };
  }, [viewer]);

  const v = viewer.current;
  if (!v || !v.viewport || !v.world.getItemAt(0)) return null;

  const aspect = refH / refW;
  const sorted = [...processedMarkers].sort((a, b) => {
    const aOrder = MarkerTypesRenderingOrder[a[0]?.kind] ?? 99;
    const bOrder = MarkerTypesRenderingOrder[b[0]?.kind] ?? 99;
    return aOrder - bOrder;
  });

  return (
    <>
      {sorted.map((markersGroup) => (
        <div
          key={markersGroup[0].kind}
          id={`Markers-${markersGroup[0].kind}`}
          className="w-full h-full max-h-full pointer-events-none"
          style={{ position: 'absolute', inset: 0 }}
        >
          {markersGroup.map((marker) => {
            if (marker.isHidden) return null;
            if (!checkMarkerVisibility(marker, currentScale)) return null;

            const vpPoint = new OpenSeadragon.Point(
              marker.position.left / refW,
              (marker.position.top / refH) * aspect,
            );
            const pixelPoint = v.viewport.viewportToViewerElementCoordinates(vpPoint);

            const markerScale = (marker.scale ?? 100) / 100;
            const effectiveScale = marker.keepScale
              ? markerScale
              : markerScale * currentScale;

            return (
              <div
                key={`${marker.kind}-${marker.id}`}
                style={{
                  position: 'absolute',
                  left: pixelPoint.x,
                  top: pixelPoint.y,
                  transform: `translate(-50%, -50%) scale(${effectiveScale})`,
                  transformOrigin: 'center',
                  pointerEvents: 'auto',
                  zIndex: MarkerTypesRenderingOrder[marker.kind] ?? 20,
                }}
                className="group"
              >
                <TiledMarkerContent marker={marker} />
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function TiledMarkerContent({ marker }: { marker: MarkerPreview }) {
  const title = marker.title ?? '';
  const hoverTitle = marker.hover?.title || title;
  const isLandmark = marker.kind === 'Landmark' || marker.kind === 'OnSideLandmark';
  const version = marker.version ?? 0;
  const displayStyle = version === 2 ? 'rounded-full' : '';
  const hasHoverIcon = marker.hover?.icon != null;

  const defaultTitleStyling =
    'mt-1 w-auto whitespace-nowrap absolute left-1/2 top-1/2 transform -translate-x-1/2 translate-y-1/2 bg-black bg-opacity-75 border-2 border-white border-opacity-10 p-1 rounded-md z-10';
  const landmarkTitleStyling =
    'absolute left-1/2 transform -translate-x-1/2 group-hover:bg-black group-hover:rounded-md px-1';

  return (
    <div className="flex flex-col justify-center items-center relative">
      {/* Title for non-landmark markers */}
      {!isLandmark && marker.titleVisible && title && (
        <PreviewMapPinTitle title={title} hoverTitle={hoverTitle} className={defaultTitleStyling} />
      )}
      {marker.icon ? (
        isLandmark ? (
          <div className="flex items-center justify-center group transition-transform transform">
            <div className="absolute">
              <PreviewIcon
                className={displayStyle}
                src={marker.icon.url}
                width={marker.icon.width}
                height={marker.icon.height}
                alt={title}
              />
            </div>
            {hasHoverIcon && version === 2 && (
              <div className="relative">
                <PreviewIcon
                  className="invisible group-hover:visible"
                  src={marker.hover!.icon!.url}
                  width={marker.hover!.icon!.width}
                  height={marker.hover!.icon!.height}
                  alt={marker.hover!.title ?? ''}
                />
              </div>
            )}
            {(marker.titleVisible || marker.hover?.titleVisible) && (
              <PreviewMapPinTitle title={title} hoverTitle={hoverTitle} className={landmarkTitleStyling} />
            )}
          </div>
        ) : (
          <PreviewIcon
            src={marker.icon.url}
            width={marker.icon.width}
            height={marker.icon.height}
            alt={title}
          />
        )
      ) : (
        <img
          src="https://worlddev.aldar.com/assets/pins/MapPin.svg"
          alt=""
          width={36}
          height={24}
          draggable={false}
          className="h-[24px] w-[36px]"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — picks the right renderer based on backplate format
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewRenderer({ mapLayout, cdnBaseUrl }: Props) {
  const spritesLoaded = useSvgSprites();
  const format = mapLayout.backplate.backplateFormat;

  if (!mapLayout.backplate.backplateUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500">
        No backplate URL configured
      </div>
    );
  }

  if (!spritesLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        Loading assets…
      </div>
    );
  }

  if (format === 'Tiled') {
    return <TiledPreview mapLayout={mapLayout} cdnBaseUrl={cdnBaseUrl} />;
  }

  return <ImagePreview mapLayout={mapLayout} cdnBaseUrl={cdnBaseUrl} />;
}
