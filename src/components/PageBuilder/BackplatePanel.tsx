'use client';

import { useState } from 'react';
import { Plus, Trash2, Ruler } from 'lucide-react';
import { constructCdnUrl, isAbsoluteAssetUrl } from '@/lib/cdnUtils';
import type { BackplateDraft, LayoutDraft } from '@/lib/pageBuilderTypes';
import { BoolField, NumberField, Section, SelectField, TextField } from './fields';

const themeOptions = [
  { value: 0, name: 'Light' },
  { value: 1, name: 'Dark' },
];

const typeOptions = [
  { value: 0, name: 'Image' },
  { value: 1, name: 'Video' },
  { value: 2, name: 'Tiled' },
  { value: 3, name: 'MapBox' },
];

interface Props {
  layout: LayoutDraft;
  activeTheme: number;
  cdnBaseUrl: string;
  onAddBackplate: (theme: number) => void;
  onChangeBackplate: (id: string, patch: Partial<BackplateDraft>) => void;
  onRemoveBackplate: (id: string) => void;
}

/** Reads an image's natural dimensions in the browser. */
function loadDimensions(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

export function BackplatePanel({
  layout,
  activeTheme,
  cdnBaseUrl,
  onAddBackplate,
  onChangeBackplate,
  onRemoveBackplate,
}: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function autoFillSize(bp: BackplateDraft) {
    if (!bp.Url) return;
    setLoadingId(bp.Id);
    try {
      const resolved = isAbsoluteAssetUrl(bp.Url) ? bp.Url : constructCdnUrl(bp.Url, cdnBaseUrl);
      const { w, h } = await loadDimensions(resolved);
      onChangeBackplate(bp.Id, { Width: w, Height: h });
    } catch {
      /* leave dimensions as-is on failure */
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Backplates</h2>
        <button
          onClick={() => onAddBackplate(activeTheme)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> Add ({activeTheme === 1 ? 'Dark' : 'Light'})
        </button>
      </div>

      {layout.backplates.length === 0 && (
        <p className="text-sm text-slate-500">
          No backplates yet. Add one and paste a CDN image URL.
        </p>
      )}

      <div className="space-y-3">
        {layout.backplates.map((bp) => (
          <div
            key={bp.Id}
            className={`rounded-lg border p-3 space-y-3 ${
              bp.Theme === activeTheme ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Theme: {bp.Theme === 1 ? 'Dark (1)' : 'Light (0)'}
              </span>
              <button
                onClick={() => onRemoveBackplate(bp.Id)}
                className="text-rose-600 hover:text-rose-800"
                title="Remove backplate"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label="Url"
                  value={bp.Url}
                  onChange={(v) => onChangeBackplate(bp.Id, { Url: v })}
                  placeholder="https://worlddev.aldar.com/assets/..."
                />
              </div>
              <button
                onClick={() => autoFillSize(bp)}
                disabled={loadingId === bp.Id || !bp.Url}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-200 disabled:opacity-50"
                title="Load width/height from image"
              >
                <Ruler size={14} /> {loadingId === bp.Id ? '…' : 'Size'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Theme"
                value={bp.Theme}
                onChange={(v) => onChangeBackplate(bp.Id, { Theme: v })}
                options={themeOptions}
              />
              <SelectField
                label="Type"
                value={bp.Type}
                onChange={(v) => onChangeBackplate(bp.Id, { Type: v })}
                options={typeOptions}
              />
              <NumberField
                label="Width"
                value={bp.Width}
                onChange={(v) => onChangeBackplate(bp.Id, { Width: v ?? 0 })}
              />
              <NumberField
                label="Height"
                value={bp.Height}
                onChange={(v) => onChangeBackplate(bp.Id, { Height: v ?? 0 })}
              />
              <NumberField
                label="Version"
                value={bp.Version}
                onChange={(v) => onChangeBackplate(bp.Id, { Version: v ?? 1 })}
              />
            </div>

            <Section title="Zoom / Geo / Video">
              <NumberField
                label="MinZoomLevel"
                value={bp.MinZoomLevel}
                onChange={(v) => onChangeBackplate(bp.Id, { MinZoomLevel: v ?? 0 })}
                step={0.1}
              />
              <NumberField
                label="MaxZoomLevel"
                value={bp.MaxZoomLevel}
                onChange={(v) => onChangeBackplate(bp.Id, { MaxZoomLevel: v ?? 0 })}
                step={0.1}
              />
              <TextField
                label="LngLatJson"
                value={bp.LngLatJson}
                onChange={(v) => onChangeBackplate(bp.Id, { LngLatJson: v })}
              />
              <TextField
                label="LngLatBoundsJson"
                value={bp.LngLatBoundsJson}
                onChange={(v) => onChangeBackplate(bp.Id, { LngLatBoundsJson: v })}
              />
              <BoolField
                label="VideoLoopEnabled"
                value={bp.VideoLoopEnabled}
                onChange={(v) => onChangeBackplate(bp.Id, { VideoLoopEnabled: v })}
              />
              <BoolField
                label="VideoAutoplay"
                value={bp.VideoAutoplay}
                onChange={(v) => onChangeBackplate(bp.Id, { VideoAutoplay: v })}
              />
              <BoolField
                label="ShowVideoControls"
                value={bp.ShowVideoControls}
                onChange={(v) => onChangeBackplate(bp.Id, { ShowVideoControls: v })}
              />
            </Section>

            <Section title="Thumbnail">
              <TextField
                label="ThumbnailUrl"
                value={bp.ThumbnailUrl ?? ''}
                onChange={(v) => onChangeBackplate(bp.Id, { ThumbnailUrl: v })}
              />
              <NumberField
                label="ThumbnailVersion"
                value={bp.ThumbnailVersion}
                onChange={(v) => onChangeBackplate(bp.Id, { ThumbnailVersion: v })}
                allowNull
              />
              <NumberField
                label="ThumbnailWidth"
                value={bp.ThumbnailWidth}
                onChange={(v) => onChangeBackplate(bp.Id, { ThumbnailWidth: v })}
                allowNull
              />
              <NumberField
                label="ThumbnailHeight"
                value={bp.ThumbnailHeight}
                onChange={(v) => onChangeBackplate(bp.Id, { ThumbnailHeight: v })}
                allowNull
              />
            </Section>
          </div>
        ))}
      </div>
    </div>
  );
}
