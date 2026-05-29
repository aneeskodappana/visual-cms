'use client';

import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
const inputCls =
  'w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500';

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  allowNull = false,
  step,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowNull?: boolean;
  step?: number;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="number"
        step={step}
        value={value === null || value === undefined ? '' : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(allowNull ? null : 0);
            return;
          }
          const n = Number(raw);
          onChange(Number.isNaN(n) ? (allowNull ? null : 0) : n);
        }}
        className={inputCls}
      />
    </div>
  );
}

export function BoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer py-1">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; name: string }[];
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.name} ({o.value})
          </option>
        ))}
      </select>
    </div>
  );
}

export function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="p-3 grid grid-cols-2 gap-3">{children}</div>}
    </div>
  );
}

/** Build a sorted {value,name}[] from a numeric TS enum (same trick as src/app/page.tsx). */
export function enumToList(e: object) {
  return Object.entries(e)
    .filter(([k]) => !isNaN(Number(k)))
    .map(([k, v]) => ({ value: Number(k), name: String(v) }))
    .sort((a, b) => a.value - b.value);
}
