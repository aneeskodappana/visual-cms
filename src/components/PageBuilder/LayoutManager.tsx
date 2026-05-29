'use client';

import { Plus, X } from 'lucide-react';
import type { LayoutDraft } from '@/lib/pageBuilderTypes';
import { BoolField, NumberField, Section, SelectField, TextField } from './fields';

const formatOptions = [
  { value: 0, name: 'Image' },
  { value: 1, name: 'Video' },
  { value: 2, name: 'Tiled' },
  { value: 3, name: 'MapBox' },
];

interface Props {
  layouts: LayoutDraft[];
  activeLayoutId: string;
  onSelectLayout: (id: string) => void;
  onAddLayout: () => void;
  onRemoveLayout: (id: string) => void;
  onChangeLayout: (id: string, patch: Partial<LayoutDraft>) => void;
}

export function LayoutManager({
  layouts,
  activeLayoutId,
  onSelectLayout,
  onAddLayout,
  onRemoveLayout,
  onChangeLayout,
}: Props) {
  const active = layouts.find((l) => l.Id === activeLayoutId);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Layouts (carousel slides)</h2>
        <button
          onClick={onAddLayout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> Add layout
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {layouts.map((l) => (
          <div
            key={l.Id}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm cursor-pointer ${
              l.Id === activeLayoutId
                ? 'border-blue-400 bg-blue-50 text-blue-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => onSelectLayout(l.Id)}
          >
            <span>{l.DisplayName || `Layout ${l.DisplayOrder + 1}`}</span>
            {l.IsDefault && <span className="text-[10px] text-green-600">default</span>}
            {layouts.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveLayout(l.Id);
                }}
                className="text-slate-400 hover:text-rose-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {active && (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="DisplayName"
              value={active.DisplayName}
              onChange={(v) => onChangeLayout(active.Id, { DisplayName: v })}
            />
            <NumberField
              label="DisplayOrder"
              value={active.DisplayOrder}
              onChange={(v) => onChangeLayout(active.Id, { DisplayOrder: v ?? 0 })}
            />
            <SelectField
              label="BackplateFormat"
              value={active.BackplateFormat}
              onChange={(v) => onChangeLayout(active.Id, { BackplateFormat: v })}
              options={formatOptions}
            />
            <NumberField
              label="FocusedMarkerId"
              value={active.FocusedMarkerId}
              onChange={(v) => onChangeLayout(active.Id, { FocusedMarkerId: v ?? -1 })}
            />
            <BoolField
              label="IsDefault"
              value={active.IsDefault}
              onChange={(v) => onChangeLayout(active.Id, { IsDefault: v })}
            />
            <BoolField
              label="HasCallbackWindow"
              value={active.HasCallbackWindow}
              onChange={(v) => onChangeLayout(active.Id, { HasCallbackWindow: v })}
            />
          </div>

          <Section title="Layout backplate fields & transforms">
            <TextField
              label="BackplateUrl"
              value={active.BackplateUrl}
              onChange={(v) => onChangeLayout(active.Id, { BackplateUrl: v })}
            />
            <NumberField
              label="BackplateVersion"
              value={active.BackplateVersion}
              onChange={(v) => onChangeLayout(active.Id, { BackplateVersion: v ?? 1 })}
            />
            <NumberField
              label="BackplateWidth"
              value={active.BackplateWidth}
              onChange={(v) => onChangeLayout(active.Id, { BackplateWidth: v ?? 0 })}
            />
            <NumberField
              label="BackplateHeight"
              value={active.BackplateHeight}
              onChange={(v) => onChangeLayout(active.Id, { BackplateHeight: v ?? 0 })}
            />
            <TextField
              label="NorthBearing"
              value={active.NorthBearing}
              onChange={(v) => onChangeLayout(active.Id, { NorthBearing: v })}
            />
            <TextField
              label="MarkerConnectionSettings"
              value={active.MarkerConnectionSettings}
              onChange={(v) => onChangeLayout(active.Id, { MarkerConnectionSettings: v })}
            />
            <TextField
              label="DesktopTransformSettingsJson"
              value={active.DesktopTransformSettingsJson}
              onChange={(v) => onChangeLayout(active.Id, { DesktopTransformSettingsJson: v })}
            />
            <TextField
              label="MobileTransformSettingsJson"
              value={active.MobileTransformSettingsJson}
              onChange={(v) => onChangeLayout(active.Id, { MobileTransformSettingsJson: v })}
            />
            <BoolField
              label="VideoLoopEnabled"
              value={active.VideoLoopEnabled}
              onChange={(v) => onChangeLayout(active.Id, { VideoLoopEnabled: v })}
            />
            <BoolField
              label="VideoAutoplay"
              value={active.VideoAutoplay}
              onChange={(v) => onChangeLayout(active.Id, { VideoAutoplay: v })}
            />
            <BoolField
              label="ShowVideoControls"
              value={active.ShowVideoControls}
              onChange={(v) => onChangeLayout(active.Id, { ShowVideoControls: v })}
            />
          </Section>
        </div>
      )}
    </div>
  );
}
