'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { Copy, Check, Clipboard, ClipboardCheck, Pencil, X, ChevronDown, ChevronRight } from 'lucide-react';

interface ParsedRow {
  tableName: string;
  columns: string[];
  values: string[];
  originalQuery: string;
}

function splitParenthesizedList(str: string): string[] {
  const items: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let depth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      current += ch;
      if (ch === stringChar && str[i + 1] === stringChar) {
        current += str[i + 1];
        i++;
      } else if (ch === stringChar) {
        inString = false;
      }
    } else {
      if (ch === "'" || ch === '"') {
        inString = true;
        stringChar = ch;
        current += ch;
      } else if (ch === '(') {
        depth++;
        current += ch;
      } else if (ch === ')') {
        depth--;
        current += ch;
      } else if (ch === ',' && depth === 0) {
        items.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function extractOuterParenContent(str: string, startIdx: number): { content: string; endIdx: number } | null {
  let i = startIdx;
  while (i < str.length && str[i] !== '(') i++;
  if (i >= str.length) return null;

  let depth = 0;
  let inString = false;
  let stringChar = '';
  const begin = i + 1;

  for (; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (ch === stringChar && str[i + 1] === stringChar) {
        i++;
      } else if (ch === stringChar) {
        inString = false;
      }
    } else {
      if (ch === "'" || ch === '"') {
        inString = true;
        stringChar = ch;
      } else if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
        if (depth === 0) {
          return { content: str.substring(begin, i), endIdx: i };
        }
      }
    }
  }
  return null;
}

function parseInsertQuery(query: string): ParsedRow | null {
  const trimmed = query.trim().replace(/;$/, '').trim();

  const insertMatch = trimmed.match(/^INSERT\s+INTO\s+/i);
  if (!insertMatch) return null;
  let pos = insertMatch[0].length;

  let tableName = '';
  while (pos < trimmed.length && trimmed[pos] !== '(') {
    tableName += trimmed[pos];
    pos++;
  }
  tableName = tableName.trim();
  if (!tableName) return null;

  const colsParen = extractOuterParenContent(trimmed, pos);
  if (!colsParen) return null;
  const columns = colsParen.content.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

  let afterCols = colsParen.endIdx + 1;
  const valuesKeyword = trimmed.substring(afterCols).match(/^\s*VALUES\s*/i);
  if (!valuesKeyword) return null;
  afterCols += valuesKeyword[0].length;

  const valsParen = extractOuterParenContent(trimmed, afterCols);
  if (!valsParen) return null;
  const values = splitParenthesizedList(valsParen.content);

  if (columns.length !== values.length) return null;

  return { tableName, columns, values, originalQuery: query.trim() };
}

function isBooleanValue(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'true' || v === 'false';
}

function buildInsertQuery(row: ParsedRow, selected?: Set<number>): string {
  const indices = selected
    ? row.columns.map((_, i) => i).filter((i) => selected.has(i))
    : row.columns.map((_, i) => i);
  const cols = indices.map((i) => `"${row.columns[i]}"`).join(', ');
  const vals = indices.map((i) => row.values[i]).join(', ');
  return `INSERT INTO ${row.tableName} (${cols}) VALUES (${vals});`;
}

function getIdValue(row: ParsedRow): string | null {
  const idx = row.columns.findIndex((c) => c.toLowerCase() === 'id');
  return idx >= 0 ? row.values[idx] : null;
}

function buildDeleteQuery(row: ParsedRow): string | null {
  const idVal = getIdValue(row);
  if (!idVal) return null;
  return `DELETE FROM ${row.tableName} WHERE "Id" = ${idVal};`;
}

function buildDeleteAllQuery(rows: ParsedRow[]): string | null {
  if (rows.length === 0) return null;
  const ids = rows.map(getIdValue).filter(Boolean);
  if (ids.length === 0) return null;
  return `BEGIN;\nDELETE FROM ${rows[0].tableName} WHERE "Id" IN (${ids.join(', ')});\nCOMMIT;`;
}

function buildUpdateQuery(row: ParsedRow, whereColIndex: number, selected?: Set<number>): string {
  const setClauses = row.columns
    .map((col, i) => {
      if (i === whereColIndex) return null;
      if (selected && !selected.has(i)) return null;
      return `"${col}" = ${row.values[i]}`;
    })
    .filter(Boolean)
    .join(', ');
  return `UPDATE ${row.tableName} SET ${setClauses} WHERE "${row.columns[whereColIndex]}" = ${row.values[whereColIndex]};`;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
        copied
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
      }`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function UpdateButton({ row, selected }: { row: ParsedRow; selected: Set<number> }) {
  const [showPicker, setShowPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSelect = useCallback(
    (colIdx: number) => {
      const sql = buildUpdateQuery(row, colIdx, selected);
      navigator.clipboard.writeText(sql).then(() => {
        setShowPicker(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    },
    [row, selected]
  );

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker((p) => !p)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
          copied
            ? 'bg-green-100 text-green-700 border border-green-300'
            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300'
        }`}
      >
        {copied ? <Check size={14} /> : <Pencil size={14} />}
        {copied ? 'Copied!' : 'Copy UPDATE'}
      </button>
      {showPicker && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">WHERE column:</span>
            <button onClick={() => setShowPicker(false)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {row.columns.map((col, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className="w-full text-left px-2 py-1.5 text-xs font-mono rounded hover:bg-indigo-50 hover:text-indigo-700 transition-colors truncate"
              >
                {col} <span className="text-slate-400">= {row.values[i].substring(0, 30)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EditableSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const [customMode, setCustomMode] = useState(false);

  if (customMode) {
    return (
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent min-w-0"
          autoFocus
        />
        <button
          onClick={() => setCustomMode(false)}
          className="px-1.5 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
          title="Back to dropdown"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <select
        value={options.includes(value) ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white min-w-0"
      >
        {!options.includes(value) && (
          <option value="" disabled>{value} (custom)</option>
        )}
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <button
        onClick={() => setCustomMode(true)}
        className="px-1.5 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
        title="Enter custom value"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}

function RowEditor({
  row,
  index,
  selectedColumns,
  columnOptions,
  gridCols,
  onValueChange,
  onToggleColumn,
  onSelectAll,
  onSelectNone,
}: {
  row: ParsedRow;
  index: number;
  selectedColumns: Set<number>;
  columnOptions: Record<string, string[]>;
  gridCols: number;
  onValueChange: (rowIndex: number, colIndex: number, value: string) => void;
  onToggleColumn: (rowIndex: number, colIndex: number) => void;
  onSelectAll: (rowIndex: number) => void;
  onSelectNone: (rowIndex: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const deleteQuery = buildDeleteQuery(row);
  const allSelected = selectedColumns.size === row.columns.length;
  const noneSelected = selectedColumns.size === 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          Row {index + 1} — <span className="text-indigo-600 font-mono">{row.tableName}</span>
        </button>
        <div className="flex items-center gap-2">
          <CopyButton text={buildInsertQuery(row, selectedColumns)} label="Copy INSERT" />
          <UpdateButton row={row} selected={selectedColumns} />
          {deleteQuery && (
            <CopyButton text={deleteQuery} label="Copy DELETE" />
          )}
        </div>
      </div>
      {!collapsed && <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <span className="text-xs font-medium text-slate-500">Columns ({selectedColumns.size}/{row.columns.length}):</span>
        <button
          onClick={() => onSelectAll(index)}
          disabled={allSelected}
          className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 transition-colors"
        >
          Select All
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={() => onSelectNone(index)}
          disabled={noneSelected}
          className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 transition-colors"
        >
          Select None
        </button>
      </div>}
      {!collapsed && (
        <div className={`grid gap-px bg-slate-200 ${gridCols === 1 ? 'grid-cols-1' : gridCols === 2 ? 'grid-cols-2' : gridCols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {row.columns.map((col, colIdx) => {
            const isSelected = selectedColumns.has(colIdx);
            const options = columnOptions[col];
            return (
              <div key={colIdx} className={`bg-white p-3 ${!isSelected ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleColumn(index, colIdx)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 shrink-0"
                  />
                  <span className="font-mono text-xs font-semibold text-slate-600 truncate">{col}</span>
                </div>
                {isBooleanValue(row.values[colIdx]) ? (
                  <label className="inline-flex items-center gap-2 px-1 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.values[colIdx].trim().toLowerCase() === 'true'}
                      onChange={(e) => onValueChange(index, colIdx, e.target.checked ? 'true' : 'false')}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    <span className="text-xs font-mono text-slate-600">{row.values[colIdx]}</span>
                  </label>
                ) : options ? (
                  <EditableSelect
                    value={row.values[colIdx]}
                    options={options}
                    onChange={(val) => onValueChange(index, colIdx, val)}
                  />
                ) : (
                  <textarea
                    value={row.values[colIdx]}
                    onChange={(e) => onValueChange(index, colIdx, e.target.value)}
                    rows={1}
                    className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-y min-h-[32px]"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SqlQueryValueEditor() {
  const [inputSql, setInputSql] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<number>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [allCopied, setAllCopied] = useState(false);
  const [gridCols, setGridCols] = useState(3);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  const handleParse = useCallback(() => {
    const statements = inputSql
      .split(/;\s*\n|;\s*$/)
      .map((s) => s.trim())
      .filter(Boolean);

    const parsed: ParsedRow[] = [];
    const errors: string[] = [];

    statements.forEach((stmt, i) => {
      const result = parseInsertQuery(stmt);
      if (result) {
        parsed.push(result);
      } else {
        errors.push(`Statement ${i + 1}: Could not parse — "${stmt.substring(0, 80)}..."`);
      }
    });

    setRows(parsed);
    setSelectedColumns(parsed.map((r) => new Set(r.columns.map((_, i) => i))));
    setParseErrors(errors);
    setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [inputSql]);

  const handleValueChange = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      setRows((prev) =>
        prev.map((row, ri) =>
          ri === rowIndex
            ? { ...row, values: row.values.map((v, ci) => (ci === colIndex ? value : v)) }
            : row
        )
      );
    },
    []
  );

  const handleToggleColumn = useCallback((rowIndex: number, colIndex: number) => {
    setSelectedColumns((prev) =>
      prev.map((set, ri) => {
        if (ri !== rowIndex) return set;
        const next = new Set(set);
        if (next.has(colIndex)) next.delete(colIndex);
        else next.add(colIndex);
        return next;
      })
    );
  }, []);

  const handleSelectAll = useCallback((rowIndex: number) => {
    setSelectedColumns((prev) =>
      prev.map((set, ri) =>
        ri === rowIndex ? new Set(rows[rowIndex].columns.map((_, i) => i)) : set
      )
    );
  }, [rows]);

  const handleSelectNone = useCallback((rowIndex: number) => {
    setSelectedColumns((prev) =>
      prev.map((set, ri) => (ri === rowIndex ? new Set<number>() : set))
    );
  }, []);

  const columnOptions = useMemo(() => {
    if (rows.length < 2) return {} as Record<string, string[]>;
    const map: Record<string, string[]> = {};
    const colNames = rows[0]?.columns || [];
    colNames.forEach((col, colIdx) => {
      if (isBooleanValue(rows[0].values[colIdx])) return;
      const allVals = rows.map((r) => r.values[colIdx]);
      const nonEmpty = allVals.filter((v) => v !== "''" && v !== '""' && v.trim() !== '');
      if (nonEmpty.every((v) => !isNaN(Number(v)))) return;
      if (nonEmpty.length < 2) return;
      const unique = Array.from(new Set(nonEmpty));
      if (unique.length < nonEmpty.length) {
        map[col] = Array.from(new Set(allVals));
      }
    });
    return map;
  }, [rows]);

  const allInserts = 'BEGIN;\n' + rows.map((r, i) => buildInsertQuery(r, selectedColumns[i])).join('\n') + '\nCOMMIT;';

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(allInserts).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    });
  }, [allInserts]);

  return (
    <div className="space-y-6">
      {/* Input area */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Paste INSERT statements below
        </label>
        <textarea
          value={inputSql}
          onChange={(e) => setInputSql(e.target.value)}
          placeholder={`INSERT INTO "MyTable" ("Col1", "Col2") VALUES ('val1', 'val2');\nINSERT INTO "MyTable" ("Col1", "Col2") VALUES ('val3', 'val4');`}
          rows={8}
          className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-y"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleParse}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Parse Queries
          </button>
          {rows.length > 0 && (
            <span className="text-xs text-slate-500">
              {rows.length} row{rows.length > 1 ? 's' : ''} parsed
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Grid:</span>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setGridCols(n)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  gridCols === n
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-2">Parse Errors</h3>
          <ul className="text-xs text-red-600 space-y-1">
            {parseErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bulk action buttons */}
      {rows.length > 1 && (
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCopyAll}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              allCopied
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-slate-800 text-white hover:bg-slate-900'
            }`}
          >
            {allCopied ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
            {allCopied ? 'All Copied!' : 'Copy All INSERTs'}
          </button>
          {buildDeleteAllQuery(rows) && (
            <CopyButton text={buildDeleteAllQuery(rows)!} label="Copy DELETE All" />
          )}
        </div>
      )}

      {/* Row editors */}
      <div ref={resultsSectionRef} className="space-y-4">
        {rows.map((row, i) => (
          <RowEditor
            key={i}
            row={row}
            index={i}
            selectedColumns={selectedColumns[i] || new Set()}
            columnOptions={columnOptions}
            gridCols={gridCols}
            onValueChange={handleValueChange}
            onToggleColumn={handleToggleColumn}
            onSelectAll={handleSelectAll}
            onSelectNone={handleSelectNone}
          />
        ))}
      </div>
    </div>
  );
}
