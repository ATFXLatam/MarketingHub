"use client";

import { memo, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, UIEvent as ReactUIEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { ArrowUp, Copy, Download, FunnelX, ListFilter, Redo2, Search, Trash2, Undo2, X } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { motionTokens } from "../lib/motion-tokens";
import {
  aggregate, clamp, compact, defaultAggregate, download, extend, format, isFilterActive, isNumeric, letter, numberFilter, parse, parseHtmlTable, parseTsv,
  rowMatcher, slug, sortRows, toCsv, toHtml, toTsv, writeClipboard,
  type DataGridAggregate, type DataGridColumn, type DataGridDensity, type DataGridFilters, type DataGridRow, type DataGridSort, type DataGridValue,
} from "./data-grid-model";
import { ColumnsMenu, DensityMenu, GridCheckbox, HeaderMenu, SelectFilter } from "./data-grid-menus";
import styles from "./data-grid.module.css";

export type { DataGridAggregate, DataGridColumn, DataGridColumnType, DataGridDensity, DataGridFilters, DataGridRow, DataGridSort, DataGridValue } from "./data-grid-model";

const { spring, duration, ease } = motionTokens;

export interface DataGridBulkAction {
  label: string;
  icon?: ReactNode;
  /** Danger actions are drawn in the danger color. */
  tone?: "danger";
  /** Receives the checked rows in their current order. */
  onAction: (rows: DataGridRow[]) => void;
}

/**
 * A spreadsheet-style grid for working with tabular data in place. Drag or shift-click to select a range, type or double-click to edit,
 * drag the corner handle to fill a series, and copy or paste straight to and from Excel and Google Sheets. Columns sort (shift-click to add
 * a second key), filter from a filter row, pin, hide, and resize. Rows are virtualized, so tens of thousands stay smooth, and a sticky
 * footer totals every numeric column over the filtered rows. Check rows to copy, export, or delete them together. Undo and redo cover
 * every edit. Every piece of view state works controlled or uncontrolled.
 */
export interface DataGridProps {
  columns: DataGridColumn[];
  /** Controlled rows. Pair with `onRowsChange`. */
  rows?: DataGridRow[];
  /** Starting rows when uncontrolled. */
  defaultRows?: DataGridRow[];
  /** Called after every edit, fill, paste, cut, clear, delete, undo, or redo. */
  onRowsChange?: (rows: DataGridRow[]) => void;
  /** Accessible name for the grid. Also names the exported file. */
  label: string;
  /** Tallest the scrolling area grows before it scrolls, in px. Defaults to 400. */
  maxHeight?: number;

  /** Sort keys in priority order. */
  sort?: DataGridSort[];
  defaultSort?: DataGridSort[];
  onSortChange?: (sort: DataGridSort[]) => void;

  filters?: DataGridFilters;
  defaultFilters?: DataGridFilters;
  onFiltersChange?: (filters: DataGridFilters) => void;

  /** Checked row ids. */
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  onSelectedRowIdsChange?: (ids: string[]) => void;

  hiddenColumns?: string[];
  defaultHiddenColumns?: string[];
  onHiddenColumnsChange?: (keys: string[]) => void;

  pinnedColumns?: string[];
  defaultPinnedColumns?: string[];
  onPinnedColumnsChange?: (keys: string[]) => void;

  density?: DataGridDensity;
  /** Defaults to "standard". */
  defaultDensity?: DataGridDensity;
  onDensityChange?: (density: DataGridDensity) => void;

  /** Show the row gutter with checkboxes. Defaults to true. */
  rowSelection?: boolean;
  /** Show the toolbar with search, filters, columns, density, and export. Defaults to true. */
  toolbar?: boolean;
  /** Show the sticky totals row. Defaults to true. */
  totals?: boolean;
  /** Extra actions for checked rows, shown between Export and Delete. */
  bulkActions?: DataGridBulkAction[];
  /** Let people delete checked rows. Defaults to true. Deleting can be undone. */
  canDeleteRows?: boolean;
  /** File name for CSV export, without the extension. Defaults to the label. */
  exportFileName?: string;
  /** Show placeholder rows while data loads. */
  loading?: boolean;
  /** Shown when there are no rows at all. */
  emptyMessage?: string;
}

type Cell = { r: number; c: number };
type Range = { r0: number; r1: number; c0: number; c1: number };
type Editing = { r: number; c: number; draft: string; invalid: boolean; mode: "enter" | "edit"; list: boolean };
type Geo = { lefts: number[]; widths: number[]; pinCount: number; pinEdge: number; lead: number; total: number };
type Status = { text: string; n: number; action?: { label: string; run: () => void } };
type HistoryEntry = { rows: DataGridRow[]; range?: Range };

const ROW_HEIGHT: Record<DataGridDensity, number> = { compact: 32, standard: 40, comfortable: 48 };
const HEAD = 40;
const FILTER_ROW = 40;
const TOTALS_ROW = 40;
const GUTTER = 48;
const OVERSCAN = 6;
const HISTORY = 100;
const SEP = String.fromCharCode(31);

const rangeOf = (a: Cell, b: Cell): Range => ({ r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const done = (n: number, one: string, many: string, verb: string) => `${plural(n, one, many)} ${verb}`;
const aggregateLabel: Record<DataGridAggregate, string> = { sum: "Sum", average: "Avg", min: "Min", max: "Max", count: "Count", none: "" };

function useControllable<T>(value: T | undefined, initial: () => T, onChange?: (next: T) => void) {
  const [own, setOwn] = useState<T>(initial);
  const controlled = value !== undefined;
  const current = controlled ? value : own;
  const set = useCallback((next: T) => { if (!controlled) setOwn(next); onChange?.(next); }, [controlled, onChange]);
  return [current, set] as const;
}

/**
 * A rectangle over the cells that follows its range on a spring. A range that starts in a pinned column sits in a sticky layer, so it
 * stays on its pinned cells in the same frame the browser scrolls them; a range that scrolls under the pinned edge is clipped there.
 * Only range changes spring.
 */
function GridRect({ range, geo, rowH, scrollX, instant, className, children, ...rest }: { range: Range; geo: Geo; rowH: number; scrollX: MotionValue<number>; instant?: boolean; className: string; children?: ReactNode; [data: `data-${string}`]: string | undefined }) {
  const reduce = !!useReducedMotion();
  const target = { left: geo.lefts[range.c0] ?? 0, right: (geo.lefts[range.c1] ?? 0) + (geo.widths[range.c1] ?? 0), top: range.r0 * rowH, bottom: (range.r1 + 1) * rowH };
  const left = useMotionValue(target.left), right = useMotionValue(target.right), top = useMotionValue(target.top), bottom = useMotionValue(target.bottom);
  const startPinned = range.c0 < geo.pinCount, endPinned = range.c1 < geo.pinCount;
  const sp = useMotionValue(startPinned ? 1 : 0), ep = useMotionValue(endPinned ? 1 : 0), edge = useMotionValue(geo.pinEdge);
  const pinEdge = geo.pinEdge;

  useEffect(() => {
    sp.jump(startPinned ? 1 : 0);
    ep.jump(endPinned ? 1 : 0);
    edge.jump(pinEdge);
    const pairs: [MotionValue<number>, number][] = [[left, target.left], [right, target.right], [top, target.top], [bottom, target.bottom]];
    if (instant || reduce) { pairs.forEach(([value, to]) => value.jump(to)); return; }
    const controls = pairs.map(([value, to]) => animate(value, to, spring.snappy));
    return () => controls.forEach(control => control.stop());
  }, [target.left, target.right, target.top, target.bottom, startPinned, endPinned, pinEdge, instant, reduce, left, right, top, bottom, sp, ep, edge]);

  // In the sticky layer x is already in the pinned frame; only a range that runs past the pinned edge reads the scroll, for its far end.
  const width = useTransform(() => {
    const end = ep.get() || !sp.get() ? right.get() : Math.max(right.get() - scrollX.get(), edge.get());
    return Math.max(0, end - left.get());
  });
  const height = useTransform(() => bottom.get() - top.get());
  const clipPath = useTransform(() => {
    const hidden = sp.get() ? 0 : scrollX.get() + edge.get() - left.get();
    return `inset(-8px -8px -8px ${hidden > 0 ? hidden : -8}px)`;
  });
  return <div className={styles.rectLayer} data-pinned={startPinned || undefined}>
    <motion.div className={className} style={{ x: left, y: top, width, height, clipPath }} aria-hidden="true" {...rest}>{children}</motion.div>
  </div>;
}

type ColumnSlot = { column: DataGridColumn; width: number; left: number; pinned: boolean; edge: boolean; numeric: boolean };

type RowProps = {
  row: DataGridRow; r: number; y: number; slots: ColumnSlot[]; uid: string; ariaRow: number; gutter: boolean;
  checked: boolean; inRows: boolean; rangeC0: number; rangeC1: number; editingC: number; editor: ReactNode;
  onToggle: (id: string, index: number, shift: boolean) => void;
};

/** One virtualized row. Memoized so scrolling, selection moves, and typing re-render only the rows they touch. */
const GridRow = memo(function GridRow({ row, r, y, slots, uid, ariaRow, gutter, checked, inRows, rangeC0, rangeC1, editingC, editor, onToggle }: RowProps) {
  const offset = gutter ? 2 : 1;
  const name = String((slots[0] && row[slots[0].column.key]) || row.id);
  return <div role="row" aria-rowindex={ariaRow} aria-selected={gutter ? checked : undefined} className={styles.row} data-checked={checked || undefined}
    data-editing={editingC >= 0 || undefined} style={{ transform: `translateY(${y}px)` }}>
    {gutter && <div role="gridcell" aria-colindex={1} className={styles.gutter} data-in-range={inRows || undefined}>
      <span className={styles.rowNumber} aria-hidden="true">{(r + 1).toLocaleString("en-US")}</span>
      <GridCheckbox checked={checked} label={`Select ${name}`} onToggle={e => onToggle(row.id, r, e.shiftKey)} />
    </div>}
    {slots.map((slot, c) => {
      const { column } = slot;
      const inRange = inRows && c >= rangeC0 && c <= rangeC1;
      const isEditing = editingC === c;
      const text = format(row[column.key], column);
      return <div key={column.key} id={`${uid}-${r}-${c}`} role="gridcell" aria-colindex={c + offset} aria-selected={inRange}
        aria-readonly={column.editable === false || undefined} className={styles.cell} data-num={slot.numeric || undefined}
        data-pinned={slot.pinned || undefined} data-pin-edge={slot.edge || undefined} data-editing={isEditing || undefined}
        style={{ width: slot.width, left: slot.pinned ? slot.left : undefined }}>
        {isEditing ? editor : <span className={styles.value} title={text.length > 18 ? text : undefined}>{text}</span>}
      </div>;
    })}
  </div>;
});

function CellEditor({ column, options, editing, label, openUp, onDraft, onCommit, onCancel }: {
  column: DataGridColumn; options: string[]; editing: Editing; label: string; openUp: boolean;
  onDraft: (draft: string) => void; onCommit: (move?: { dr: number; dc: number }, value?: string) => void; onCancel: () => void;
}) {
  const isSelect = column.type === "select";
  const [list, setList] = useState(isSelect && editing.list);
  const [pick, setPick] = useState(0);
  const matches = useMemo(() => {
    if (!isSelect) return [];
    const q = editing.draft.trim().toLowerCase();
    if (!q || options.some(o => o.toLowerCase() === q)) return options;
    return [...options.filter(o => o.toLowerCase().startsWith(q)), ...options.filter(o => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q))];
  }, [isSelect, editing.draft, options]);
  const current = Math.max(0, matches.findIndex(o => o.toLowerCase() === editing.draft.trim().toLowerCase()));
  const active = clamp(pick, 0, Math.max(0, matches.length - 1));
  const listId = `${label.replace(/\W+/g, "-")}-options`;
  const choose = () => list && matches[active] !== undefined ? matches[active] : undefined;

  return <>
    <input className={styles.editor} value={editing.draft} autoFocus aria-label={label} aria-invalid={editing.invalid || undefined}
      inputMode={isNumeric(column) ? "decimal" : undefined} spellCheck={false} autoComplete="off"
      role={isSelect ? "combobox" : undefined} aria-expanded={isSelect ? list : undefined} aria-controls={isSelect && list ? listId : undefined}
      aria-activedescendant={isSelect && list && matches.length ? `${listId}-${active}` : undefined}
      onFocus={e => { const end = e.currentTarget.value.length; e.currentTarget.setSelectionRange(end, end); }}
      onChange={e => { onDraft(e.target.value); if (isSelect) { setList(true); setPick(0); } }}
      onBlur={() => onCommit()}
      onKeyDown={e => {
        e.stopPropagation();
        const arrowsMove = editing.mode === "enter";
        if (isSelect && e.altKey && e.key === "ArrowDown") { e.preventDefault(); setList(true); setPick(current); return; }
        if (isSelect && list && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          setPick(p => clamp(clamp(p, 0, matches.length - 1) + (e.key === "ArrowDown" ? 1 : -1), 0, Math.max(0, matches.length - 1)));
          return;
        }
        if (e.key === "Enter") { e.preventDefault(); onCommit({ dr: e.shiftKey ? -1 : 1, dc: 0 }, choose()); }
        else if (e.key === "Tab") { e.preventDefault(); onCommit({ dr: 0, dc: e.shiftKey ? -1 : 1 }, choose()); }
        else if (e.key === "Escape") { e.preventDefault(); if (isSelect && list) setList(false); else onCancel(); }
        else if (arrowsMove && e.key.startsWith("Arrow")) {
          e.preventDefault();
          const move = { ArrowUp: { dr: -1, dc: 0 }, ArrowDown: { dr: 1, dc: 0 }, ArrowLeft: { dr: 0, dc: -1 }, ArrowRight: { dr: 0, dc: 1 } }[e.key];
          if (move) onCommit(move);
        }
      }} />
    {isSelect && list && <div id={listId} role="listbox" aria-label={`${column.label} options`} className={styles.options} data-up={openUp || undefined}>
      {matches.length ? matches.map((option, i) => <div key={option} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={styles.option}
        data-active={i === active || undefined} data-current={option === editing.draft || undefined}
        onPointerDown={e => e.preventDefault()} onPointerEnter={() => setPick(i)} onClick={() => onCommit({ dr: 0, dc: 0 }, option)}>{option}</div>)
        : <div className={styles.optionEmpty}>No matches</div>}
    </div>}
  </>;
}

export function DataGrid(props: DataGridProps) {
  const {
    columns, rows: controlledRows, defaultRows, onRowsChange, label, maxHeight = 400,
    rowSelection = true, toolbar = true, totals: showTotals = true, bulkActions, canDeleteRows = true, exportFileName, loading = false, emptyMessage = "No rows yet",
  } = props;
  const reduce = !!useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // Data and view state. Every piece works controlled or uncontrolled.
  const [ownRows, setOwnRows] = useState<DataGridRow[]>(() => defaultRows ?? controlledRows ?? []);
  const data = controlledRows ?? ownRows;
  const [sort, setSort] = useControllable(props.sort, () => props.defaultSort ?? [], props.onSortChange);
  const [filters, setFilters] = useControllable(props.filters, () => props.defaultFilters ?? {}, props.onFiltersChange);
  const [checkedIds, setCheckedIds] = useControllable(props.selectedRowIds, () => props.defaultSelectedRowIds ?? [], props.onSelectedRowIdsChange);
  const [hidden, setHidden] = useControllable(props.hiddenColumns, () => props.defaultHiddenColumns ?? columns.filter(c => c.hidden).map(c => c.key), props.onHiddenColumnsChange);
  const [pinned, setPinned] = useControllable(props.pinnedColumns, () => props.defaultPinnedColumns ?? (columns.some(c => c.pinned !== undefined) ? columns.filter(c => c.pinned).map(c => c.key) : columns.slice(0, 1).map(c => c.key)), props.onPinnedColumnsChange);
  const [density, setDensity] = useControllable(props.density, () => props.defaultDensity ?? "standard", props.onDensityChange);
  const [search, setSearch] = useState("");
  const [filterRow, setFilterRow] = useState(() => Object.keys(props.filters ?? props.defaultFilters ?? {}).length > 0);

  const [widths, setWidths] = useState<Record<string, number>>(() => Object.fromEntries(columns.map(c => [c.key, c.width ?? 140])));
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [firstRow, setFirstRow] = useState(0);
  const [sel, setSel] = useState<{ anchor: Cell; focus: Cell }>({ anchor: { r: 0, c: 0 }, focus: { r: 0, c: 0 } });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [fill, setFill] = useState<Range | null>(null);
  const [wash, setWash] = useState<{ range: Range; n: number } | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });

  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const scrollX = useMotionValue(0);
  const past = useRef<HistoryEntry[]>([]);
  const future = useRef<HistoryEntry[]>([]);
  const drag = useRef<{ mode: "select" | "fill" | "rows"; range: Range; pointer: { x: number; y: number }; frame: number } | null>(null);
  const touchTap = useRef<{ cell: Cell & { gutter: boolean }; id: number } | null>(null);
  const lastChecked = useRef<number | null>(null);
  const statusTimer = useRef<number | undefined>(undefined);
  const movingTimer = useRef<number | undefined>(undefined);
  /** Set once an edit has been committed or cancelled, so the blur that follows does not commit it again. */
  const closing = useRef(false);

  // Columns in view order: pinned first, then the rest, each in definition order.
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);
  const cols = useMemo(() => {
    const visible = columns.filter(c => !hiddenSet.has(c.key));
    return [...visible.filter(c => pinnedSet.has(c.key)), ...visible.filter(c => !pinnedSet.has(c.key))];
  }, [columns, hiddenSet, pinnedSet]);
  const colCount = cols.length;
  const rowH = ROW_HEIGHT[density];
  const headH = HEAD + (filterRow ? FILTER_ROW : 0);
  const footH = showTotals ? TOTALS_ROW : 0;
  const lead = rowSelection ? GUTTER : 0;

  // Pinned columns never take more than about half of a narrow grid; the last column absorbs spare width on a wide one.
  const geo: Geo = useMemo(() => {
    const w = cols.map(c => widths[c.key] ?? c.width ?? 140);
    const pinCount = cols.filter(c => pinnedSet.has(c.key)).length;
    const pinnedTotal = w.slice(0, pinCount).reduce((s, x) => s + x, 0);
    const budget = viewport.w ? Math.max(96, Math.floor(viewport.w * .5) - lead) : Infinity;
    if (pinnedTotal > budget) for (let i = 0; i < pinCount; i++) w[i] = Math.max(Math.min(cols[i].minWidth ?? 72, 96), Math.floor(w[i] * budget / pinnedTotal));
    const sum = w.reduce((s, x) => s + x, 0) + lead;
    if (viewport.w > sum && w.length) w[w.length - 1] += viewport.w - sum;
    const lefts: number[] = [];
    let x = lead;
    for (const width of w) { lefts.push(x); x += width; }
    return { lefts, widths: w, pinCount, pinEdge: lead + w.slice(0, pinCount).reduce((s, v) => s + v, 0), lead, total: x };
  }, [cols, widths, pinnedSet, viewport.w, lead]);

  const slots: ColumnSlot[] = useMemo(() => cols.map((column, i) => ({
    column, width: geo.widths[i], left: geo.lefts[i], pinned: i < geo.pinCount, edge: i === geo.pinCount - 1, numeric: isNumeric(column),
  })), [cols, geo]);

  // Options for select columns: declared, or the distinct values already present.
  const optionsFor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const column of columns) {
      if (column.type !== "select") continue;
      if (column.options) { map.set(column.key, column.options); continue; }
      const seen = new Set<string>();
      for (const row of data) { const v = row[column.key]; if (v !== null && v !== undefined && v !== "") seen.add(String(v)); if (seen.size > 200) break; }
      map.set(column.key, [...seen].sort((a, b) => a.localeCompare(b)));
    }
    return map;
  }, [columns, data]);
  const filterOptionsFor = useCallback((column: DataGridColumn) => {
    const base = optionsFor.get(column.key) ?? [];
    return data.some(row => row[column.key] === "" || row[column.key] === null || row[column.key] === undefined) ? [...base, ""] : base;
  }, [optionsFor, data]);

  // The view: rows in filtered, sorted order. It is recomputed when sort, filters, search, or the set of rows changes, but not when a
  // value is edited, so rows never jump or vanish under the cursor while you work. Like a spreadsheet, a sort is a one-time reorder.
  const deferredFilters = useDeferredValue(filters);
  const deferredSearch = useDeferredValue(search);
  const idsKey = useMemo(() => data.map(r => r.id).join(SEP), [data]);
  const spec = JSON.stringify([sort, deferredFilters, deferredSearch, cols.map(c => c.key)]);
  const computeView = () => {
    const match = rowMatcher(columns, deferredFilters, deferredSearch, cols);
    const kept = match ? data.filter(match) : data;
    return sortRows(kept, sort, columns).map(r => r.id);
  };
  const [view, setView] = useState(() => ({ idsKey, spec, ids: computeView() }));
  if (view.idsKey !== idsKey || view.spec !== spec) setView({ idsKey, spec, ids: computeView() });
  const byId = useMemo(() => new Map(data.map(row => [row.id, row])), [data]);
  const display = useMemo(() => view.ids.flatMap(id => { const row = byId.get(id); return row ? [row] : []; }), [view.ids, byId]);
  const rowCount = loading ? 0 : display.length;
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const activeFilters = cols.filter(c => isFilterActive(c, filters[c.key])).length + columns.filter(c => hiddenSet.has(c.key) && isFilterActive(c, filters[c.key])).length;
  const narrowed = activeFilters > 0 || search.trim() !== "";

  // Selection, clamped to whatever is visible now.
  const maxR = Math.max(0, rowCount - 1), maxC = Math.max(0, colCount - 1);
  const anchor = { r: clamp(sel.anchor.r, 0, maxR), c: clamp(sel.anchor.c, 0, maxC) };
  const focus = { r: clamp(sel.focus.r, 0, maxR), c: clamp(sel.focus.c, 0, maxC) };
  const range = rangeOf(anchor, focus);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setViewport(v => v.w === el.clientWidth && v.h === el.clientHeight ? v : { w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Density keeps the row you were looking at in place.
  const lastRowH = useRef(rowH);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && lastRowH.current !== rowH) el.scrollTop = Math.round(el.scrollTop * rowH / lastRowH.current);
    lastRowH.current = rowH;
  }, [rowH]);

  useEffect(() => () => { window.clearTimeout(statusTimer.current); window.clearTimeout(movingTimer.current); }, []);

  const flashStatus = (text: string, action?: Status["action"]) => {
    window.clearTimeout(statusTimer.current);
    setStatus(current => ({ text, n: (current?.n ?? 0) + 1, action }));
    setAnnouncement(text);
    statusTimer.current = window.setTimeout(() => setStatus(null), action ? 6000 : 2400);
  };

  const pushRows = (next: DataGridRow[]) => { if (!controlledRows) setOwnRows(next); onRowsChange?.(next); };
  const commitRows = (next: DataGridRow[], affected?: Range) => {
    past.current = [...past.current.slice(-HISTORY + 1), { rows: data, range: affected }];
    future.current = [];
    setHistorySize({ past: past.current.length, future: 0 });
    pushRows(next);
  };

  /** Writes values by view position. Read-only columns and values that do not fit their column are skipped. */
  const writeCells = (writes: { r: number; c: number; value: DataGridValue }[], affected?: Range) => {
    const changes = new Map<string, Record<string, DataGridValue>>();
    let count = 0;
    for (const { r, c, value } of writes) {
      const column = cols[c], row = display[r];
      if (!row || !column || column.editable === false) continue;
      if (isNumeric(column) && value !== null && typeof value !== "number") continue;
      if ((row[column.key] ?? null) === value || (value === "" && (row[column.key] ?? "") === "")) continue;
      changes.set(row.id, { ...changes.get(row.id), [column.key]: value });
      count++;
    }
    if (count) commitRows(data.map(row => changes.has(row.id) ? { ...row, ...changes.get(row.id) } : row), affected);
    return count;
  };

  const reveal = useCallback((cell: Cell) => {
    const el = scroller.current;
    if (!el) return;
    const top = cell.r * rowH, bottom = top + rowH;
    const visibleTop = el.scrollTop, visibleBottom = el.scrollTop + el.clientHeight - headH - footH;
    if (top < visibleTop) el.scrollTop = top;
    else if (bottom > visibleBottom) el.scrollTop = bottom - (el.clientHeight - headH - footH);
    if (cell.c < geo.pinCount) return;
    const left = geo.lefts[cell.c], right = left + geo.widths[cell.c];
    if (left - geo.pinEdge < el.scrollLeft) el.scrollLeft = left - geo.pinEdge;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
  }, [geo, rowH, headH, footH]);

  const select = (a: Cell, f: Cell = a, show: Cell = f) => { setSel({ anchor: a, focus: f }); reveal(show); };
  const focusGrid = () => grid.current?.focus({ preventScroll: true });
  const flash = (r: Range) => setWash(current => ({ range: r, n: (current?.n ?? 0) + 1 }));

  /* Editing */

  const startEdit = (cell: Cell, typed?: string, list = false) => {
    const column = cols[cell.c], row = display[cell.r];
    if (!row || !column) return;
    if (column.editable === false) { flashStatus(`${column.label} is read-only`); return; }
    select(cell);
    closing.current = false;
    const value = row[column.key];
    setEditing({ r: cell.r, c: cell.c, draft: typed ?? (value === null || value === undefined ? "" : String(value)), invalid: false, mode: typed === undefined ? "edit" : "enter", list: list || (column.type === "select" && typed !== undefined) });
  };

  const finishEdit = (move?: { dr: number; dc: number }, override?: string) => {
    if (!editing || closing.current) return;
    const column = cols[editing.c], row = display[editing.r];
    const parsed = parse(override ?? editing.draft, column, optionsFor.get(column.key));
    if (!parsed.ok) {
      if (move) {
        setEditing({ ...editing, invalid: true, list: column.type === "select" });
        setAnnouncement(column.type === "select" ? `Choose one of the ${column.label} options` : `${column.label} needs a number`);
        return;
      }
      closing.current = true;
      setEditing(null);
      return;
    }
    closing.current = true;
    if (row && (row[column.key] ?? null) !== parsed.value) {
      writeCells([{ r: editing.r, c: editing.c, value: parsed.value }], { r0: editing.r, r1: editing.r, c0: editing.c, c1: editing.c });
      setAnnouncement(`${column.label} for ${String(row[cols[0].key] ?? "")} changed to ${format(parsed.value, column) || "empty"}`);
    }
    setEditing(null);
    if (move && (move.dr || move.dc)) select({ r: clamp(editing.r + move.dr, 0, maxR), c: clamp(editing.c + move.dc, 0, maxC) });
    focusGrid();
  };

  const cancelEdit = () => { closing.current = true; setEditing(null); focusGrid(); };

  const clearRange = (r: Range) => {
    const writes = [];
    for (let row = r.r0; row <= r.r1; row++) for (let c = r.c0; c <= r.c1; c++) writes.push({ r: row, c, value: isNumeric(cols[c]) ? null : "" });
    const n = writeCells(writes, r);
    flashStatus(n ? done(n, "cell", "cells", "cleared") : "Nothing to clear");
  };

  const undo = () => {
    const entry = past.current.pop();
    if (!entry) { flashStatus("Nothing to undo"); return; }
    future.current.push({ rows: data, range: entry.range });
    setHistorySize({ past: past.current.length, future: future.current.length });
    pushRows(entry.rows);
    if (entry.range) { setSel({ anchor: { r: entry.range.r0, c: entry.range.c0 }, focus: { r: entry.range.r1, c: entry.range.c1 } }); flash(entry.range); }
    flashStatus("Undone");
  };
  const redo = () => {
    const entry = future.current.pop();
    if (!entry) { flashStatus("Nothing to redo"); return; }
    past.current.push({ rows: data, range: entry.range });
    setHistorySize({ past: past.current.length, future: future.current.length });
    pushRows(entry.rows);
    if (entry.range) { setSel({ anchor: { r: entry.range.r0, c: entry.range.c0 }, focus: { r: entry.range.r1, c: entry.range.c1 } }); flash(entry.range); }
    flashStatus("Redone");
  };

  /* Sorting, filters, columns */

  const applySort = (next: DataGridSort[]) => {
    setSort(next);
    window.clearTimeout(movingTimer.current);
    setMoving(true);
    movingTimer.current = window.setTimeout(() => setMoving(false), 700);
    const named = next.map(s => `${columns.find(c => c.key === s.key)?.label ?? s.key} ${s.dir === "asc" ? "ascending" : "descending"}`);
    setAnnouncement(named.length ? `Sorted by ${named.join(", then ")}` : "Original order restored");
  };
  const toggleSort = (key: string, additive: boolean) => {
    const existing = sort.find(s => s.key === key);
    const dir = !existing ? "asc" : existing.dir === "asc" ? "desc" : null;
    if (additive) applySort(!existing ? [...sort, { key, dir: "asc" }] : dir ? sort.map(s => s.key === key ? { key, dir } : s) : sort.filter(s => s.key !== key));
    else applySort(dir ? [{ key, dir }] : []);
  };

  const setFilter = (key: string, value: string | string[] | undefined) => {
    const next = { ...filters };
    if (value === undefined || value === "") delete next[key]; else next[key] = value;
    setFilters(next);
  };
  const clearFilters = () => { setFilters({}); setSearch(""); flashStatus("Filters cleared"); };
  const openFilter = (key: string) => {
    setFilterRow(true);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-filter-key="${CSS.escape(key)}"]`)?.focus());
  };

  const togglePin = (key: string) => { setPinned(pinnedSet.has(key) ? pinned.filter(k => k !== key) : [...pinned, key]); };
  const toggleHidden = (key: string) => {
    if (!hiddenSet.has(key) && colCount <= 1) return;
    setHidden(hiddenSet.has(key) ? hidden.filter(k => k !== key) : [...hidden, key]);
  };

  /* Row checks */

  const toggleRow = (id: string, index: number, shift: boolean) => {
    const on = !checkedSet.has(id);
    const next = new Set(checkedSet);
    if (shift && lastChecked.current !== null) {
      const [a, b] = [Math.min(lastChecked.current, index), Math.max(lastChecked.current, index)];
      for (let i = a; i <= b; i++) { const rid = display[i]?.id; if (rid) { if (on) next.add(rid); else next.delete(rid); } }
    } else if (on) next.add(id); else next.delete(id);
    lastChecked.current = index;
    setCheckedIds(data.filter(r => next.has(r.id)).map(r => r.id));
  };
  const toggleRows = (r0: number, r1: number) => {
    const ids = display.slice(r0, r1 + 1).map(r => r.id);
    const on = !ids.every(id => checkedSet.has(id));
    const next = new Set(checkedSet);
    ids.forEach(id => on ? next.add(id) : next.delete(id));
    setCheckedIds(data.filter(r => next.has(r.id)).map(r => r.id));
    setAnnouncement(on ? done(ids.length, "row", "rows", "selected") : done(ids.length, "row", "rows", "deselected"));
  };
  const [allChecked, someChecked] = useMemo(() => {
    if (!checkedSet.size || !display.length) return [false, false];
    const every = display.every(r => checkedSet.has(r.id));
    return [every, !every && display.some(r => checkedSet.has(r.id))];
  }, [display, checkedSet]);
  const toggleAll = () => {
    const next = new Set(checkedSet);
    display.forEach(r => allChecked ? next.delete(r.id) : next.add(r.id));
    setCheckedIds(data.filter(r => next.has(r.id)).map(r => r.id));
    setAnnouncement(allChecked ? "Row selection cleared" : done(display.length, "row", "rows", "selected"));
  };
  const checkedRows = useMemo(() => data.filter(r => checkedSet.has(r.id)), [data, checkedSet]);

  // Rows stay memoized, so the checkbox handler reads the latest state through a ref.
  const live = useRef({ toggleRow, undo });
  useLayoutEffect(() => { live.current = { toggleRow, undo }; });
  const onToggleRow = useCallback((id: string, index: number, shift: boolean) => live.current.toggleRow(id, index, shift), []);

  /* Clipboard, export, delete */

  const matrixFor = (r: Range, withHeader = false, formatted = false) => {
    const lines: string[][] = withHeader ? [cols.slice(r.c0, r.c1 + 1).map(c => c.label)] : [];
    for (let row = r.r0; row <= r.r1; row++) {
      const cells: string[] = [];
      for (let c = r.c0; c <= r.c1; c++) { const v = display[row]?.[cols[c].key]; cells.push(formatted ? format(v, cols[c]) : v === null || v === undefined ? "" : String(v)); }
      lines.push(cells);
    }
    return lines;
  };
  const rowsMatrix = (rowsOut: DataGridRow[], formatted: boolean) => [cols.map(c => c.label), ...rowsOut.map(row => cols.map(c => formatted ? format(row[c.key], c) : String(row[c.key] ?? "")))];

  const copyChecked = async () => {
    const ok = await writeClipboard(toTsv(rowsMatrix(checkedRows, false)), toHtml(rowsMatrix(checkedRows, true)));
    flashStatus(ok ? done(checkedRows.length, "row", "rows", "copied") : "Could not copy. The browser blocked the clipboard");
  };
  const exportCsv = (rowsOut: DataGridRow[]) => {
    download(`${exportFileName ?? slug(label)}.csv`, toCsv(cols, rowsOut), "text/csv;charset=utf-8");
    flashStatus(done(rowsOut.length, "row", "rows", "exported"));
  };
  const deleteChecked = () => {
    const n = checkedRows.length;
    commitRows(data.filter(r => !checkedSet.has(r.id)));
    setCheckedIds([]);
    flashStatus(done(n, "row", "rows", "deleted"), { label: "Undo", run: () => { live.current.undo(); focusGrid(); } });
  };

  const pasteMatrix = (matrix: string[][]) => {
    const h = matrix.length, w = Math.max(...matrix.map(l => l.length));
    const H = range.r1 - range.r0 + 1, W = range.c1 - range.c0 + 1;
    // A selection that is a whole multiple of the clipboard gets the clipboard tiled across it, like Excel.
    const tile = (H > h || W > w) && H % h === 0 && W % w === 0;
    const rowsOut = tile ? H : Math.min(h, rowCount - range.r0), colsOut = tile ? W : Math.min(w, colCount - range.c0);
    const writes: { r: number; c: number; value: DataGridValue }[] = [];
    let skipped = 0;
    for (let i = 0; i < rowsOut; i++) for (let j = 0; j < colsOut; j++) {
      const text = matrix[i % h]?.[j % w] ?? "";
      const column = cols[range.c0 + j];
      const parsed = parse(text, column, optionsFor.get(column.key));
      if (parsed.ok) writes.push({ r: range.r0 + i, c: range.c0 + j, value: parsed.value });
      else skipped++;
    }
    const pasted: Range = { r0: range.r0, c0: range.c0, r1: range.r0 + rowsOut - 1, c1: range.c0 + colsOut - 1 };
    const n = writeCells(writes, pasted);
    setSel({ anchor: { r: pasted.r0, c: pasted.c0 }, focus: { r: pasted.r1, c: pasted.c1 } });
    flash(pasted);
    const cut = !tile && (h > rowsOut || w > colsOut);
    flashStatus(`${done(n, "cell", "cells", "pasted")}${skipped ? `, ${skipped} skipped for lack of space` : ""}${cut ? ". Some cells fell outside the table" : ""}`);
  };

  // The grid is not a text field, so clipboard events are read at the document while the grid itself has focus.
  const clipboard = useRef<{ copy: (e: ClipboardEvent) => void; cut: (e: ClipboardEvent) => void; paste: (e: ClipboardEvent) => void } | null>(null);
  useEffect(() => {
    const size = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
    const put = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData("text/plain", toTsv(matrixFor(range)));
      e.clipboardData?.setData("text/html", toHtml(matrixFor(range, false, true)));
    };
    clipboard.current = {
      copy: e => { if (!rowCount) return; put(e); flash(range); flashStatus(done(size, "cell", "cells", "copied")); },
      cut: e => { if (!rowCount) return; put(e); clearRange(range); },
      paste: e => {
        if (!rowCount) return;
        const html = e.clipboardData?.getData("text/html") ?? "";
        const text = e.clipboardData?.getData("text/plain") ?? "";
        const matrix = (html && parseHtmlTable(html)) || (text ? parseTsv(text) : null);
        if (!matrix?.length) return;
        e.preventDefault();
        pasteMatrix(matrix);
      },
    };
  });
  useEffect(() => {
    const active = () => document.activeElement === grid.current;
    const copy = (e: ClipboardEvent) => { if (active()) clipboard.current?.copy(e); };
    const cut = (e: ClipboardEvent) => { if (active()) clipboard.current?.cut(e); };
    const paste = (e: ClipboardEvent) => { if (active()) clipboard.current?.paste(e); };
    document.addEventListener("copy", copy);
    document.addEventListener("cut", cut);
    document.addEventListener("paste", paste);
    return () => { document.removeEventListener("copy", copy); document.removeEventListener("cut", cut); document.removeEventListener("paste", paste); };
  }, []);

  /* Pointer */

  const cellAt = (clientX: number, clientY: number): (Cell & { gutter: boolean }) | null => {
    const el = scroller.current, b = body.current;
    if (!el || !b || !rowCount || !colCount) return null;
    const frame = el.getBoundingClientRect(), box = b.getBoundingClientRect();
    const r = clamp(Math.floor((clientY - box.top) / rowH), 0, rowCount - 1);
    const fx = clientX - frame.left;
    if (fx < geo.pinEdge) {
      if (fx < geo.lead) return { r, c: 0, gutter: true };
      for (let i = 0; i < geo.pinCount; i++) if (fx < geo.lefts[i] + geo.widths[i]) return { r, c: i, gutter: false };
    }
    const x = clientX - box.left;
    let c = colCount - 1;
    for (let i = geo.pinCount; i < colCount; i++) if (x < geo.lefts[i] + geo.widths[i]) { c = i; break; }
    return { r, c: Math.max(Math.min(geo.pinCount, colCount - 1), c), gutter: false };
  };

  const fillTarget = (source: Range, cell: Cell): Range | null => {
    const dy = cell.r > source.r1 ? cell.r - source.r1 : cell.r < source.r0 ? cell.r - source.r0 : 0;
    const dx = cell.c > source.c1 ? cell.c - source.c1 : cell.c < source.c0 ? cell.c - source.c0 : 0;
    if (!dy && !dx) return null;
    return Math.abs(dy) >= Math.abs(dx)
      ? { ...source, r0: Math.min(source.r0, cell.r), r1: Math.max(source.r1, cell.r) }
      : { ...source, c0: Math.min(source.c0, cell.c), c1: Math.max(source.c1, cell.c) };
  };

  const track = (clientX: number, clientY: number) => {
    const d = drag.current;
    if (!d) return;
    const cell = cellAt(clientX, clientY);
    if (!cell) return;
    if (d.mode === "rows") setSel(current => current.focus.r === cell.r ? current : { anchor: { ...current.anchor, c: 0 }, focus: { r: cell.r, c: colCount - 1 } });
    else if (d.mode === "select") setSel(current => current.focus.r === cell.r && current.focus.c === cell.c ? current : { ...current, focus: { r: cell.r, c: cell.c } });
    else setFill(fillTarget(d.range, cell));
  };

  /** While a drag holds the pointer past an edge, the grid scrolls toward it, faster the further out the pointer is. */
  const autoScroll = () => {
    const d = drag.current, el = scroller.current;
    if (!d || !el) return;
    const frame = el.getBoundingClientRect();
    const { x, y } = d.pointer;
    const speed = (over: number) => Math.sign(over) * Math.min(28, Math.abs(over) * .35);
    const dy = y > frame.bottom - footH - 8 ? speed(y - frame.bottom + footH + 8) : y < frame.top + headH ? speed(y - frame.top - headH) : 0;
    const dx = x > frame.right - 8 ? speed(x - frame.right + 8) : x < frame.left + geo.pinEdge && el.scrollLeft > 0 && d.mode !== "rows" ? speed(x - frame.left - geo.pinEdge) : 0;
    if (dx || dy) { el.scrollTop += dy; el.scrollLeft += dx; track(x, y); }
    d.frame = requestAnimationFrame(autoScroll);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || drag.current) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, [role=listbox], button")) return;
    const isFill = !!target.closest("[data-fill-handle]");
    const cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    // A finger selects on release, so a pan that starts on a cell scrolls instead. Only the fill handle takes over a touch drag.
    if (e.pointerType === "touch" && !isFill) { touchTap.current = { cell, id: e.pointerId }; return; }
    e.preventDefault();
    focusGrid();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (cell.gutter) {
      setSel(current => e.shiftKey ? { anchor: { r: current.anchor.r, c: 0 }, focus: { r: cell.r, c: colCount - 1 } } : { anchor: { r: cell.r, c: 0 }, focus: { r: cell.r, c: colCount - 1 } });
    } else if (!isFill) setSel(current => e.shiftKey ? { ...current, focus: cell } : { anchor: cell, focus: cell });
    drag.current = { mode: isFill ? "fill" : cell.gutter ? "rows" : "select", range, pointer: { x: e.clientX, y: e.clientY }, frame: 0 };
    drag.current.frame = requestAnimationFrame(autoScroll);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.pointer = { x: e.clientX, y: e.clientY };
    track(e.clientX, e.clientY);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const tap = touchTap.current;
    if (tap && tap.id === e.pointerId) {
      touchTap.current = null;
      const { cell } = tap;
      if (cell.gutter) { select({ r: cell.r, c: 0 }, { r: cell.r, c: colCount - 1 }); return; }
      const same = anchor.r === cell.r && anchor.c === cell.c && range.r0 === range.r1 && range.c0 === range.c1;
      if (same && !editing) startEdit(cell);
      else { setSel({ anchor: cell, focus: cell }); focusGrid(); }
      return;
    }
    endDrag();
  };

  const endDrag = () => {
    touchTap.current = null;
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.frame);
    drag.current = null;
    if (d.mode !== "fill") return;
    const target = fill;
    setFill(null);
    if (!target) return;
    const source = d.range, writes: { r: number; c: number; value: DataGridValue }[] = [];
    const cellValue = (r: number, c: number) => display[r]?.[cols[c].key] ?? null;
    if (target.r0 !== source.r0 || target.r1 !== source.r1) {
      const forward = target.r1 > source.r1, count = forward ? target.r1 - source.r1 : source.r0 - target.r0;
      for (let c = source.c0; c <= source.c1; c++) {
        const values = extend(Array.from({ length: source.r1 - source.r0 + 1 }, (_, i) => cellValue(source.r0 + i, c)), count, forward);
        values.forEach((value, k) => writes.push({ r: forward ? source.r1 + 1 + k : source.r0 - 1 - k, c, value }));
      }
    } else {
      const forward = target.c1 > source.c1, count = forward ? target.c1 - source.c1 : source.c0 - target.c0;
      for (let r = source.r0; r <= source.r1; r++) {
        const values = extend(Array.from({ length: source.c1 - source.c0 + 1 }, (_, i) => cellValue(r, source.c0 + i)), count, forward);
        values.forEach((value, k) => writes.push({ r, c: forward ? source.c1 + 1 + k : source.c0 - 1 - k, value }));
      }
    }
    const added: Range = target.r1 > source.r1 ? { ...target, r0: source.r1 + 1 } : target.r0 < source.r0 ? { ...target, r1: source.r0 - 1 } : target.c1 > source.c1 ? { ...target, c0: source.c1 + 1 } : { ...target, c1: source.c0 - 1 };
    const n = writeCells(writes, target);
    setSel({ anchor: { r: target.r0, c: target.c0 }, focus: { r: target.r1, c: target.c1 } });
    flash(added);
    flashStatus(n ? done(n, "cell", "cells", "filled") : "Nothing to fill");
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, button, [role=listbox], [data-fill-handle]")) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell && !cell.gutter) startEdit(cell, undefined, true);
  };

  /* Keyboard */

  const pageRows = Math.max(1, Math.floor(((viewport.h || maxHeight) - headH - footH) / rowH) - 1);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
    if (mod && key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && key === "y") { e.preventDefault(); redo(); return; }
    if (!rowCount) return;
    if (mod && key === "a") { e.preventDefault(); setSel({ anchor: { r: 0, c: 0 }, focus: { r: rowCount - 1, c: colCount - 1 } }); setAnnouncement(`${plural(rowCount * colCount, "cell selected", "cells selected")}`); return; }
    if (mod && key === "d") {
      e.preventDefault();
      if (range.r0 === range.r1) { flashStatus("Select more than one row to fill down"); return; }
      const writes = [];
      for (let r = range.r0 + 1; r <= range.r1; r++) for (let c = range.c0; c <= range.c1; c++) writes.push({ r, c, value: display[range.r0]?.[cols[c].key] ?? null });
      const n = writeCells(writes, range);
      flash({ ...range, r0: range.r0 + 1 });
      flashStatus(n ? `${done(n, "cell", "cells", "filled")} down` : "Nothing to fill");
      return;
    }
    if (e.key === " " && e.shiftKey && rowSelection) { e.preventDefault(); toggleRows(range.r0, range.r1); return; }
    if (e.key === " " && e.ctrlKey) { e.preventDefault(); setSel({ anchor: { r: 0, c: range.c0 }, focus: { r: rowCount - 1, c: range.c1 } }); return; }

    const step: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], PageUp: [-pageRows, 0], PageDown: [pageRows, 0], Home: [0, -colCount], End: [0, colCount] };
    if (step[e.key]) {
      if (e.altKey && e.key === "ArrowDown" && cols[anchor.c]?.type === "select") { e.preventDefault(); startEdit(anchor, undefined, true); return; }
      e.preventDefault();
      const [dr, dc] = step[e.key];
      const from = e.shiftKey ? focus : anchor;
      const far = mod && e.key.startsWith("Arrow");
      const to = { r: clamp(far ? (dr < 0 ? 0 : dr > 0 ? rowCount - 1 : from.r) : from.r + dr, 0, rowCount - 1), c: clamp(far ? (dc < 0 ? 0 : dc > 0 ? colCount - 1 : from.c) : from.c + dc, 0, colCount - 1) };
      if (mod && (e.key === "Home" || e.key === "End")) to.r = e.key === "Home" ? 0 : rowCount - 1;
      if (e.shiftKey) select(anchor, to);
      else select(to);
      return;
    }
    if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); startEdit(anchor); return; }
    if (e.key === "Escape") {
      if (range.r0 !== range.r1 || range.c0 !== range.c1) { e.preventDefault(); select(anchor); }
      else if (checkedIds.length) { e.preventDefault(); setCheckedIds([]); setAnnouncement("Row selection cleared"); }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); clearRange(range); return; }
    if (e.key.length === 1 && !mod && !e.altKey) { e.preventDefault(); startEdit(anchor, e.key); }
  };

  /* Column resize: drag the header edge, use Alt and arrow keys on the header, or double-click the edge to restore the starting width. */

  const startResize = (key: string, c: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget, startX = e.clientX, startW = geo.widths[c], min = cols[c].minWidth ?? 72;
    el.setPointerCapture(e.pointerId);
    setResizing(key);
    const move = (ev: PointerEvent) => setWidths(current => ({ ...current, [key]: clamp(Math.round(startW + ev.clientX - startX), min, 560) }));
    const up = () => { setResizing(null); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const nudgeWidth = (key: string, c: number, delta: number) => setWidths(current => ({ ...current, [key]: clamp((current[key] ?? geo.widths[c]) + delta, cols[c].minWidth ?? 72, 560) }));
  const resetWidth = (column: DataGridColumn) => setWidths(current => ({ ...current, [column.key]: column.width ?? 140 }));

  /* Summaries */

  const { r0: sr0, r1: sr1, c0: sc0, c1: sc1 } = range;
  const summary = useMemo(() => {
    let sum = 0, count = 0, filled = 0;
    const types = new Set<string>();
    for (let r = sr0; r <= sr1; r++) {
      const row = display[r];
      if (!row) continue;
      for (let c = sc0; c <= sc1; c++) {
        const v = row[cols[c]?.key];
        if (v !== null && v !== undefined && v !== "") filled++;
        if (typeof v === "number") { sum += v; count++; types.add(cols[c].type ?? "number"); }
      }
    }
    const type = types.size === 1 ? [...types][0] : "number";
    return { sum, count, filled, avg: count ? sum / count : 0, prefix: type === "currency" ? "$" : "", suffix: type === "percent" ? "%" : "" };
  }, [sr0, sr1, sc0, sc1, display, cols]);
  const totals = useMemo(() => showTotals ? cols.map(column => { const kind = defaultAggregate(column); return { kind, value: aggregate(display, column, kind) }; }) : [], [cols, display, showTotals]);

  /* Virtual window */

  const onScroll = (e: ReactUIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    scrollX.set(el.scrollLeft);
    root.current?.toggleAttribute("data-scrolled-x", el.scrollLeft > 0);
    const next = Math.max(0, Math.floor(el.scrollTop / rowH));
    if (next !== firstRow) setFirstRow(next);
  };
  const visibleCount = Math.ceil((viewport.h || maxHeight) / rowH);
  const start = Math.max(0, firstRow - OVERSCAN), end = Math.min(rowCount, firstRow + visibleCount + OVERSCAN);
  const rendered: number[] = [];
  for (let i = start; i < end; i++) rendered.push(i);
  // The active cell and the cell being edited stay mounted even when scrolled away, so focus and assistive tech never lose them.
  for (const extra of [anchor.r, focus.r, editing?.r ?? -1]) if (extra >= 0 && extra < rowCount && (extra < start || extra >= end) && !rendered.includes(extra)) rendered.push(extra);

  const headRows = filterRow ? 2 : 1;
  const selectionInstant = resizing !== null;
  const activeId = rowCount ? `${uid}-${focus.r}-${focus.c}` : undefined;
  const bodyHeight = loading ? 6 * rowH : rowCount ? rowCount * rowH : 176;

  const editor = editing && cols[editing.c] && display[editing.r] ? <CellEditor key={`${editing.r}-${editing.c}`} column={cols[editing.c]} options={optionsFor.get(cols[editing.c].key) ?? []}
    editing={editing} label={`${cols[editing.c].label} for ${String(display[editing.r][cols[0].key] ?? "")}`}
    openUp={(editing.r + 1) * rowH + 220 > firstRow * rowH + (viewport.h || maxHeight) - headH - footH && editing.r * rowH > 220}
    onDraft={draft => setEditing(current => current ? { ...current, draft, invalid: false } : current)}
    onCommit={finishEdit} onCancel={cancelEdit} /> : null;

  const bulkMode = rowSelection && checkedIds.length > 0;
  const rowWord = `${rowCount.toLocaleString("en-US")}${narrowed ? ` of ${data.length.toLocaleString("en-US")}` : ""} ${data.length === 1 && !narrowed ? "row" : "rows"}`;

  return <div ref={root} className={styles.root} data-density={density} style={{ ["--row-h" as string]: `${rowH}px` }}>
    {toolbar && <div className={styles.toolbar}>
      <AnimatePresence initial={false}>
        {bulkMode
          ? <motion.div key="bulk" className={styles.toolbarRow} data-bulk=""
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }} transition={{ duration: duration.standard, ease: ease.standard }}>
            <button type="button" className={styles.toolIcon} aria-label="Clear row selection" onClick={() => setCheckedIds([])}><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>
            <span className={styles.bulkCount}><AnimatedCounter value={checkedIds.length} /> {checkedIds.length === 1 ? "seleccionada" : "seleccionadas"}</span>
            <span className={styles.toolSpacer} />
            <button type="button" className={styles.toolButton} onClick={copyChecked}><Copy size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.toolLabel}>Copy</span></button>
            <button type="button" className={styles.toolButton} onClick={() => exportCsv(checkedRows)}><Download size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.toolLabel}>Export</span></button>
            {bulkActions?.map(action => <button key={action.label} type="button" className={styles.toolButton} data-tone={action.tone} onClick={() => action.onAction(checkedRows)}>
              {action.icon}<span className={styles.toolLabel}>{action.label}</span>
            </button>)}
            {canDeleteRows && <button type="button" className={styles.toolButton} data-tone="danger" onClick={deleteChecked}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.toolLabel}>Delete</span></button>}
          </motion.div>
          : <motion.div key="tools" className={styles.toolbarRow}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }} transition={{ duration: duration.standard, ease: ease.standard }}>
            <label className={styles.search}>
              <Search size={16} strokeWidth={1.75} aria-hidden="true" />
              <input ref={searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" aria-label={`Search ${label}`} spellCheck={false}
                onKeyDown={e => { if (e.key === "Escape") { if (search) setSearch(""); else focusGrid(); } else if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focusGrid(); } }} />
              {search && <button type="button" className={styles.searchClear} aria-label="Clear search" onClick={() => { setSearch(""); searchInput.current?.focus(); }}><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
            </label>
            <span className={styles.rowCount} aria-live="polite">{rowWord}</span>
            <span className={styles.toolSpacer} />
            <span className={styles.toolGroup}>
              <button type="button" className={styles.toolIcon} aria-label="Undo" disabled={!historySize.past} onClick={() => { undo(); focusGrid(); }}><Undo2 size={16} strokeWidth={1.75} aria-hidden="true" /></button>
              <button type="button" className={styles.toolIcon} aria-label="Redo" disabled={!historySize.future} onClick={() => { redo(); focusGrid(); }}><Redo2 size={16} strokeWidth={1.75} aria-hidden="true" /></button>
            </span>
            <button type="button" className={styles.toolButton} aria-pressed={filterRow} aria-label="Filters" onClick={() => setFilterRow(open => !open)}>
              <ListFilter size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.toolLabel}>Filter</span>
              {activeFilters > 0 && <span className={styles.toolCount}>{activeFilters}</span>}
            </button>
            <ColumnsMenu columns={columns} hidden={hiddenSet} pinned={pinnedSet} onToggle={toggleHidden} onShowAll={() => setHidden([])} />
            <DensityMenu density={density} onChange={setDensity} />
            <button type="button" className={styles.toolButton} aria-label="Export CSV" onClick={() => exportCsv(display)} disabled={!rowCount}>
              <Download size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.toolLabel}>Export</span>
            </button>
          </motion.div>}
      </AnimatePresence>
    </div>}

    <div ref={scroller} className={styles.scroller} style={{ maxHeight }} onScroll={onScroll}>
      <div ref={grid} className={styles.grid} role="grid" tabIndex={0} aria-label={label} aria-multiselectable="true" aria-busy={loading || undefined}
        aria-rowcount={rowCount + headRows + (showTotals ? 1 : 0)} aria-colcount={colCount + (rowSelection ? 1 : 0)}
        aria-activedescendant={editing ? undefined : activeId} onKeyDown={onKeyDown} style={{ width: geo.total }}>

        <div role="rowgroup" className={styles.head}>
          <div role="row" aria-rowindex={1} className={styles.headRow}>
            {rowSelection && <div role="columnheader" aria-colindex={1} className={styles.gutterHead}>
              <GridCheckbox checked={allChecked ? true : someChecked ? "mixed" : false} label={allChecked ? "Clear row selection" : "Select all rows"} onToggle={toggleAll} tabbable />
            </div>}
            {slots.map((slot, c) => {
              const { column } = slot;
              const sortIndex = sort.findIndex(s => s.key === column.key);
              const sorted = sortIndex >= 0 ? sort[sortIndex].dir : null;
              const sortable = column.sortable !== false;
              return <div key={column.key} role="columnheader" aria-colindex={c + (rowSelection ? 2 : 1)} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                className={styles.headCell} data-pinned={slot.pinned || undefined} data-pin-edge={slot.edge || undefined} data-num={slot.numeric || undefined}
                data-selected={rowCount > 0 && c >= range.c0 && c <= range.c1 || undefined} data-sorted={sorted ?? undefined}
                style={{ width: slot.width, left: slot.pinned ? slot.left : undefined }}>
                <button type="button" className={styles.sortButton} disabled={!sortable} onClick={e => toggleSort(column.key, e.shiftKey)}
                  onKeyDown={e => { if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); nudgeWidth(column.key, c, e.key === "ArrowRight" ? 16 : -16); } }}
                  aria-label={`${column.label}${sorted ? `, sorted ${sorted === "asc" ? "ascendente" : "descendente"}${sort.length > 1 ? `, priority ${sortIndex + 1}` : ""}` : ""}. ${sortable ? "Sort, hold Shift to add another criterion. " : ""}Alt and arrow keys change the width`}>
                  <span className={styles.headLabel}>{column.label}</span>
                  {sortable && <span className={styles.sortIcon} data-dir={sorted ?? undefined} aria-hidden="true">
                    <ArrowUp size={14} strokeWidth={1.75} />
                    {sort.length > 1 && sortIndex >= 0 && <span className={styles.sortOrder}>{sortIndex + 1}</span>}
                  </span>}
                </button>
                <HeaderMenu column={column} sorted={sorted} pinned={slot.pinned} canHide={colCount > 1}
                  onSort={dir => applySort(dir ? [{ key: column.key, dir }] : sort.filter(s => s.key !== column.key))}
                  onFilter={column.filterable === false ? null : () => openFilter(column.key)}
                  onPin={() => togglePin(column.key)} onHide={() => toggleHidden(column.key)} />
                <div className={styles.resizer} aria-hidden="true" data-active={resizing === column.key || undefined}
                  onPointerDown={startResize(column.key, c)} onDoubleClick={() => resetWidth(column)} />
              </div>;
            })}
          </div>

          <AnimatePresence initial={false}>
          {filterRow && <motion.div key="filters" role="row" aria-rowindex={2} className={styles.filterRow}
            initial={{ height: reduce ? FILTER_ROW : 0, opacity: 0 }} animate={{ height: FILTER_ROW, opacity: 1 }}
            exit={{ height: reduce ? FILTER_ROW : 0, opacity: 0, transition: reduce ? { duration: duration.exit, ease: ease.standard } : { height: spring.smooth, opacity: { duration: duration.exit, ease: ease.exit } } }}
            transition={reduce ? { duration: duration.fast, ease: ease.standard } : { height: spring.smooth, opacity: { duration: duration.fast, ease: ease.standard } }}>
            {rowSelection && <div role="gridcell" aria-colindex={1} className={styles.gutterHead}>
              {narrowed && <button type="button" className={styles.clearFilters} aria-label="Clear all filters" onClick={clearFilters}><FunnelX size={15} strokeWidth={1.75} aria-hidden="true" /></button>}
            </div>}
            {slots.map((slot, c) => {
              const { column } = slot;
              const value = filters[column.key];
              const invalid = isNumeric(column) && typeof value === "string" && numberFilter(value) === "invalid";
              return <div key={column.key} role="gridcell" aria-colindex={c + (rowSelection ? 2 : 1)} className={styles.filterCell}
                data-pinned={slot.pinned || undefined} data-pin-edge={slot.edge || undefined} style={{ width: slot.width, left: slot.pinned ? slot.left : undefined }}>
                {column.filterable === false ? null : column.type === "select"
                  ? <SelectFilter column={column} options={filterOptionsFor(column)} value={Array.isArray(value) ? value : undefined} onChange={next => setFilter(column.key, next)} />
                  : <input className={styles.filterInput} data-filter-key={column.key} data-num={slot.numeric || undefined} data-active={isFilterActive(column, value) || undefined}
                    aria-invalid={invalid || undefined} value={typeof value === "string" ? value : ""} spellCheck={false} autoComplete="off"
                    placeholder={slot.numeric ? "> 100, 10..50" : "Contains"} aria-label={`Filter ${column.label}${slot.numeric ? ". Use > < = or a range like 10..50" : ""}`}
                    onChange={e => setFilter(column.key, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Escape") { e.preventDefault(); if (value) setFilter(column.key, undefined); else focusGrid(); }
                      else if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focusGrid(); }
                    }} />}
              </div>;
            })}
          </motion.div>}
          </AnimatePresence>
        </div>

        <div ref={body} role="rowgroup" className={styles.body} data-moving={moving && !reduce || undefined} data-any-checked={checkedIds.length > 0 || undefined}
          style={{ height: bodyHeight }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={endDrag} onDoubleClick={onDoubleClick}>
          {loading && Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.row} aria-hidden="true" style={{ transform: `translateY(${i * rowH}px)`, width: geo.total }}>
            {rowSelection && <div className={styles.gutter} />}
            {slots.map(slot => <div key={slot.column.key} className={styles.cell} data-num={slot.numeric || undefined} data-pinned={slot.pinned || undefined} data-pin-edge={slot.edge || undefined}
              style={{ width: slot.width, left: slot.pinned ? slot.left : undefined }}><span className={styles.skeleton} style={{ width: `${40 + ((i * 7 + slot.width) % 45)}%` }} /></div>)}
          </div>)}

          {!loading && rendered.map(r => {
            const row = display[r];
            const inRows = r >= range.r0 && r <= range.r1;
            return <GridRow key={row.id} row={row} r={r} y={r * rowH} slots={slots} uid={uid} ariaRow={r + headRows + 1} gutter={rowSelection}
              checked={checkedSet.has(row.id)} inRows={inRows} rangeC0={inRows ? range.c0 : -1} rangeC1={inRows ? range.c1 : -1}
              editingC={editing?.r === r ? editing.c : -1} editor={editing?.r === r ? editor : null} onToggle={onToggleRow} />;
          })}

          {!loading && rowCount === 0 && <div className={styles.empty} style={{ left: 0, width: viewport.w || "100%" }}>
            <p className={styles.emptyTitle}>{narrowed ? "No rows match" : emptyMessage}</p>
            {narrowed && <button type="button" className={styles.toolButton} onClick={clearFilters}><FunnelX size={16} strokeWidth={1.75} aria-hidden="true" />Clear filters</button>}
          </div>}

          {rowCount > 0 && colCount > 0 && <>
            <GridRect className={styles.selection} range={range} geo={geo} rowH={rowH} scrollX={scrollX} instant={selectionInstant} data-editing={editing ? "" : undefined}>
              {!editing && <span className={styles.fillHandle} data-fill-handle="" />}
            </GridRect>
            <GridRect className={styles.activeCell} range={rangeOf(anchor, anchor)} geo={geo} rowH={rowH} scrollX={scrollX} instant={selectionInstant} />
            {fill && <GridRect className={styles.fillPreview} range={fill} geo={geo} rowH={rowH} scrollX={scrollX} />}
            <AnimatePresence>
              {wash && <motion.div key={wash.n} className={styles.washLayer} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: reduce ? duration.standard : .9, ease: "easeOut" }}
                onAnimationComplete={() => setWash(current => current?.n === wash.n ? null : current)}>
                <GridRect className={styles.wash} range={{ r0: clamp(wash.range.r0, 0, maxR), r1: clamp(wash.range.r1, 0, maxR), c0: clamp(wash.range.c0, 0, maxC), c1: clamp(wash.range.c1, 0, maxC) }} geo={geo} rowH={rowH} scrollX={scrollX} instant />
              </motion.div>}
            </AnimatePresence>
          </>}
        </div>

        {showTotals && <div role="rowgroup" className={styles.foot}>
          <div role="row" aria-rowindex={rowCount + headRows + 1} className={styles.totalsRow}>
            {rowSelection && <div role="gridcell" aria-colindex={1} className={styles.gutterHead} />}
            {slots.map((slot, c) => {
              const total = totals[c];
              const first = c === 0 && total?.kind === "none";
              const value = total?.value;
              const parts = value !== null && value !== undefined ? compact(value) : null;
              const suffix = (parts?.unit ?? "") + (slot.column.type === "percent" ? "%" : "");
              return <div key={slot.column.key} role="gridcell" aria-colindex={c + (rowSelection ? 2 : 1)} className={styles.totalCell}
                data-num={slot.numeric || undefined} data-pinned={slot.pinned || undefined} data-pin-edge={slot.edge || undefined}
                style={{ width: slot.width, left: slot.pinned ? slot.left : undefined }}
                aria-label={first ? rowWord : parts ? `${slot.column.label} ${aggregateLabel[total.kind].toLowerCase()} ${format(Math.round(value! * 100) / 100, { ...slot.column, decimals: slot.column.type === "percent" ? 1 : slot.column.decimals })}` : undefined}>
                {first ? <span className={styles.totalLabel}>{loading ? "Cargando" : rowWord}</span>
                  : parts && <>
                    <span className={styles.totalLabel} aria-hidden="true">{aggregateLabel[total.kind]}</span>
                    <span className={styles.totalValue} aria-hidden="true"><AnimatedCounter value={parts.value} decimals={parts.decimals} prefix={slot.column.type === "currency" ? "$" : ""} suffix={suffix} /></span>
                  </>}
              </div>;
            })}
          </div>
        </div>}
      </div>
    </div>

    <div className={styles.statusBar}>
      <span className={styles.address} aria-label={rowCount ? `Selection ${letter(range.c0)}${range.r0 + 1}` : undefined}>
        {rowCount ? `${letter(range.c0)}${range.r0 + 1}${range.r0 === range.r1 && range.c0 === range.c1 ? "" : `:${letter(range.c1)}${range.r1 + 1}`}` : "–"}
      </span>
      {rowCount > 0 && <span className={styles.stats}>
        {summary.count > 1 && <>
          <span className={styles.stat}><span className={styles.statLabel}>Sum</span><span className={styles.statValue}><AnimatedCounter value={Math.round(summary.sum * 100) / 100} prefix={summary.prefix} suffix={summary.suffix} decimals={Number.isInteger(Math.round(summary.sum * 100) / 100) ? 0 : 2} /></span></span>
          <span className={styles.stat}><span className={styles.statLabel}>Average</span><span className={styles.statValue}><AnimatedCounter value={Math.round(summary.avg * 10) / 10} prefix={summary.prefix} suffix={summary.suffix} decimals={Number.isInteger(Math.round(summary.avg * 10) / 10) ? 0 : 1} /></span></span>
        </>}
        <span className={styles.stat}><span className={styles.statLabel}>Count</span><span className={styles.statValue}><AnimatedCounter value={summary.filled} /></span></span>
      </span>}
      <span className={styles.status}>
        <AnimatePresence initial={false}>
          {status && <motion.span key={status.n} className={styles.statusText}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: duration.fast } }}
            transition={{ duration: duration.standard, ease: ease.standard }}>
            <span aria-hidden="true">{status.text}</span>
            {status.action && <button type="button" className={styles.statusAction} onClick={() => { const run = status.action!.run; setStatus(null); run(); }}>{status.action.label}</button>}
          </motion.span>}
        </AnimatePresence>
      </span>
    </div>
    <p className={styles.srOnly} aria-live="polite">{announcement}</p>
  </div>;
}

export default DataGrid;
