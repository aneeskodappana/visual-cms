'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type OpenSeadragonType from 'openseadragon';

type OpenSeadragonPreviewProps = {
  assetUrl: string;
  title: string;
  className?: string;
};

function getInitialZoomLevel() {
  if (typeof window === 'undefined') {
    return 1;
  }

  const aspectRatio = window.innerWidth / window.innerHeight;
  return aspectRatio <= 1 ? 2.3 : 1;
}

export function OpenSeadragonPreview({ assetUrl, title, className }: OpenSeadragonPreviewProps) {
  const rawId = useId();
  const viewerId = useMemo(() => `osd-${rawId.replace(/[:]/g, '-')}`, [rawId]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let viewer: OpenSeadragonType.Viewer | null = null;
    let disposed = false;

    const initializeViewer = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        const module = await import('openseadragon');
        if (disposed || !containerRef.current) {
          return;
        }

        const OpenSeadragon = module.default;
        containerRef.current.innerHTML = '';

        viewer = OpenSeadragon({
          id: viewerId,
          tileSources: assetUrl,
          useCanvas: true,
          visibilityRatio: 1,
          minZoomImageRatio: 1,
          constrainDuringPan: true,
          defaultZoomLevel: getInitialZoomLevel(),
          minZoomLevel: getInitialZoomLevel(),
          maxZoomLevel: 7,
          homeFillsViewer: true,
          showZoomControl: false,
          showNavigator: false,
          showHomeControl: false,
          showFullPageControl: false,
          showRotationControl: false,
          showFlipControl: false,
          showSequenceControl: false,
          gestureSettingsMouse: {
            scrollToZoom: true,
            pinchToZoom: true,
            clickToZoom: false,
          },
          gestureSettingsTouch: {
            scrollToZoom: true,
            pinchToZoom: true,
            clickToZoom: false,
          },
          immediateRender: false,
          imageSmoothingEnabled: true,
          preload: false,
        });

        setError(null);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to initialize Deep Zoom preview');
      }
    };

    initializeViewer();

    return () => {
      disposed = true;
      if (viewer) {
        viewer.destroy();
      }
    };
  }, [assetUrl, viewerId]);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3 px-3 pt-3">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <button
          type="button"
          onClick={() => window.open(assetUrl, '_blank', 'noopener,noreferrer')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Open DZI Descriptor <ExternalLink size={14} />
        </button>
      </div>
      <div id={viewerId} ref={containerRef} className="h-[28rem] w-full bg-slate-100" />
      {error && (
        <div className="border-t border-slate-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
    </div>
  );
}
