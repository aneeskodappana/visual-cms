'use client';

import { ViewTypes } from '@/lib/cdnUtils';
import type { PageDraft, ParentLinkField } from '@/lib/pageBuilderTypes';
import { BoolField, SelectField, TextField, enumToList } from './fields';

const viewTypeOptions = enumToList(ViewTypes);

const parentLinkFields: ParentLinkField[] = [
  'ProjectId',
  'ClusterId',
  'CityId',
  'NationId',
  'AmenityId',
  'UnitId',
];

interface Props {
  page: PageDraft;
  onChange: (patch: Partial<PageDraft>) => void;
}

export function PageMetaPanel({ page, onChange }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Page (ViewConfig)</h2>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Kind (ViewType)"
          value={page.Kind}
          onChange={(v) => onChange({ Kind: v })}
          options={viewTypeOptions}
        />
        <TextField
          label="Code"
          value={page.Code}
          onChange={(v) => onChange({ Code: v })}
          placeholder="e.g. yasparkplace"
        />
        <TextField label="Title" value={page.Title} onChange={(v) => onChange({ Title: v })} />
        <TextField
          label="Subtitle"
          value={page.Subtitle}
          onChange={(v) => onChange({ Subtitle: v })}
        />
        <TextField
          label="CdnBaseUrl"
          value={page.CdnBaseUrl}
          onChange={(v) => onChange({ CdnBaseUrl: v })}
          placeholder="folder/path/"
        />
        <BoolField
          label="HasGallery"
          value={page.HasGallery}
          onChange={(v) => onChange({ HasGallery: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Parent link field</label>
          <select
            value={page.ParentLinkField}
            onChange={(e) => onChange({ ParentLinkField: e.target.value as ParentLinkField })}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {parentLinkFields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <TextField
          label="Parent id (UUID, optional)"
          value={page.ParentLinkId}
          onChange={(v) => onChange({ ParentLinkId: v })}
          placeholder="leave blank to omit"
        />
      </div>
      <p className="text-xs text-slate-500">
        ViewConfig Id: <span className="font-mono">{page.Id}</span>
      </p>
    </div>
  );
}
