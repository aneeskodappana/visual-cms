'use client';

import { Trash2 } from 'lucide-react';
import { MarkerTypes, MarkerSubTypes } from '@/lib/cdnUtils';
import type { MarkerDraft } from '@/lib/pageBuilderTypes';
import { BoolField, NumberField, Section, SelectField, TextField, enumToList } from './fields';

const markerKindOptions = enumToList(MarkerTypes);
const markerSubTypeOptions = [{ value: -1, name: '(none)' }, ...enumToList(MarkerSubTypes)];

interface Props {
  marker: MarkerDraft | null;
  onChange: (id: string, patch: Partial<MarkerDraft>) => void;
  onRemove: (id: string) => void;
}

export function MarkerEditorPanel({ marker, onChange, onRemove }: Props) {
  if (!marker) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Marker</h2>
        <p className="text-sm text-slate-500">Select a marker on the canvas to edit its fields.</p>
      </div>
    );
  }

  const set = (patch: Partial<MarkerDraft>) => onChange(marker.Id, patch);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Marker #{marker.MarkerIndex}
        </h2>
        <button
          onClick={() => onRemove(marker.Id)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded hover:bg-rose-100"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <div className="space-y-3">
        <Section title="Basic" defaultOpen>
          <SelectField label="Kind" value={marker.Kind} onChange={(v) => set({ Kind: v })} options={markerKindOptions} />
          <SelectField
            label="SubType"
            value={marker.SubType ?? -1}
            onChange={(v) => set({ SubType: v === -1 ? null : v })}
            options={markerSubTypeOptions}
          />
          <NumberField label="MarkerIndex" value={marker.MarkerIndex} onChange={(v) => set({ MarkerIndex: v ?? 0 })} />
          <TextField label="Code" value={marker.Code} onChange={(v) => set({ Code: v })} />
          <TextField label="Title" value={marker.Title} onChange={(v) => set({ Title: v })} />
          <BoolField label="TitleVisible" value={marker.TitleVisible} onChange={(v) => set({ TitleVisible: v })} />
          <TextField label="NavigateTo (URL)" value={marker.NavigateTo ?? ''} onChange={(v) => set({ NavigateTo: v })} />
          <BoolField label="IsShallowLink" value={marker.IsShallowLink} onChange={(v) => set({ IsShallowLink: v })} />
          <BoolField label="IsVisible" value={marker.IsVisible} onChange={(v) => set({ IsVisible: v })} />
          <BoolField label="IsExplorable" value={marker.IsExplorable} onChange={(v) => set({ IsExplorable: v })} />
          <BoolField label="IsPriority" value={marker.IsPriority} onChange={(v) => set({ IsPriority: v })} />
          <NumberField label="Logo" value={marker.Logo} onChange={(v) => set({ Logo: v })} allowNull />
          <NumberField label="Version" value={marker.Version} onChange={(v) => set({ Version: v })} allowNull />
        </Section>

        <Section title="Position" defaultOpen>
          <NumberField label="PositionLeft (px)" value={marker.PositionLeft} onChange={(v) => set({ PositionLeft: v ?? 0 })} step={0.01} />
          <NumberField label="PositionTop (px)" value={marker.PositionTop} onChange={(v) => set({ PositionTop: v ?? 0 })} step={0.01} />
          <NumberField label="AnchorPositionLeft" value={marker.AnchorPositionLeft} onChange={(v) => set({ AnchorPositionLeft: v })} allowNull step={0.01} />
          <NumberField label="AnchorPositionTop" value={marker.AnchorPositionTop} onChange={(v) => set({ AnchorPositionTop: v })} allowNull step={0.01} />
          <NumberField label="LinkToMarkerIndex" value={marker.LinkToMarkerIndex} onChange={(v) => set({ LinkToMarkerIndex: v })} allowNull />
          <TextField label="LngLatJson" value={marker.LngLatJson} onChange={(v) => set({ LngLatJson: v })} />
        </Section>

        <Section title="Icon (default state)">
          <TextField label="IconUrl" value={marker.IconUrl ?? ''} onChange={(v) => set({ IconUrl: v })} />
          <NumberField label="IconVersion" value={marker.IconVersion} onChange={(v) => set({ IconVersion: v })} allowNull />
          <NumberField label="IconWidth" value={marker.IconWidth} onChange={(v) => set({ IconWidth: v })} allowNull />
          <NumberField label="IconHeight" value={marker.IconHeight} onChange={(v) => set({ IconHeight: v })} allowNull />
        </Section>

        <Section title="Zoom & Scale">
          <NumberField label="Scale" value={marker.Scale} onChange={(v) => set({ Scale: v ?? 100 })} />
          <BoolField label="KeepScale" value={marker.KeepScale} onChange={(v) => set({ KeepScale: v })} />
          <NumberField label="MinZoom" value={marker.MinZoom} onChange={(v) => set({ MinZoom: v ?? 0 })} step={0.1} />
          <NumberField label="MaxZoom" value={marker.MaxZoom} onChange={(v) => set({ MaxZoom: v ?? 2.5 })} step={0.1} />
          <NumberField label="MobileScale" value={marker.MobileScale} onChange={(v) => set({ MobileScale: v ?? 100 })} />
          <NumberField label="MobileMinZoom" value={marker.MobileMinZoom} onChange={(v) => set({ MobileMinZoom: v ?? 0 })} step={0.1} />
          <NumberField label="MobileMaxZoom" value={marker.MobileMaxZoom} onChange={(v) => set({ MobileMaxZoom: v ?? 2.5 })} step={0.1} />
        </Section>

        <Section title="Hover state">
          <TextField label="HoverTitle" value={marker.HoverTitle ?? ''} onChange={(v) => set({ HoverTitle: v })} />
          <BoolField label="HoverTitleVisible" value={marker.HoverTitleVisible} onChange={(v) => set({ HoverTitleVisible: v })} />
          <TextField label="HoverIconUrl" value={marker.HoverIconUrl ?? ''} onChange={(v) => set({ HoverIconUrl: v })} />
          <NumberField label="HoverIconVersion" value={marker.HoverIconVersion} onChange={(v) => set({ HoverIconVersion: v })} allowNull />
          <NumberField label="HoverIconWidth" value={marker.HoverIconWidth} onChange={(v) => set({ HoverIconWidth: v })} allowNull />
          <NumberField label="HoverIconHeight" value={marker.HoverIconHeight} onChange={(v) => set({ HoverIconHeight: v })} allowNull />
          <NumberField label="HoverScale" value={marker.HoverScale} onChange={(v) => set({ HoverScale: v })} allowNull />
        </Section>

        <Section title="Selected state">
          <TextField label="SelectedTitle" value={marker.SelectedTitle ?? ''} onChange={(v) => set({ SelectedTitle: v })} />
          <BoolField label="SelectedTitleVisible" value={marker.SelectedTitleVisible} onChange={(v) => set({ SelectedTitleVisible: v })} />
          <TextField label="SelectedIconUrl" value={marker.SelectedIconUrl ?? ''} onChange={(v) => set({ SelectedIconUrl: v })} />
          <NumberField label="SelectedIconVersion" value={marker.SelectedIconVersion} onChange={(v) => set({ SelectedIconVersion: v })} allowNull />
          <NumberField label="SelectedIconWidth" value={marker.SelectedIconWidth} onChange={(v) => set({ SelectedIconWidth: v })} allowNull />
          <NumberField label="SelectedIconHeight" value={marker.SelectedIconHeight} onChange={(v) => set({ SelectedIconHeight: v })} allowNull />
          <NumberField label="SelectedScale" value={marker.SelectedScale} onChange={(v) => set({ SelectedScale: v })} allowNull />
        </Section>

        <Section title="Advanced JSON">
          <TextField label="ConnectionLineJson" value={marker.ConnectionLineJson} onChange={(v) => set({ ConnectionLineJson: v })} />
        </Section>
      </div>
    </div>
  );
}
