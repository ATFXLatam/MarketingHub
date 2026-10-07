"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./metrics-dashboard.module.css";

export interface DashboardMetric {
  key: string;
  label: string;
  lowerIsBetter?: boolean;
}

export interface DashboardRange {
  value: string;
  /** Short label on the range control, such as "7D". */
  label: string;
  /** Spoken and subtitle label, such as "Últimos 7 días". */
  long: string;
  days: number;
  /** Days per chart point; 7 draws one point per week. */
  step: number;
}

export interface DashboardDay {
  /** YYYY-MM-DD. */
  date: string;
  values: Record<string, number>;
}

export interface DashboardBreakdown {
  title: string;
  column: string;
  rows: { name: string; value: number }[];
}

export interface MetricsDashboardProps {
  title: string;
  /** Shown before the range, such as the source of the numbers. */
  subtitle?: string;
  metrics: DashboardMetric[];
  /** Daily totals, oldest first and ending on the last day shown. Twice the longest range lets every range compare. */
  daily: DashboardDay[];
  ranges: DashboardRange[];
  /** Lists under the chart for each range value. */
  breakdowns?: Record<string, DashboardBreakdown[]>;
  defaultRange?: string;
}

type Point = { date: Date; value: number; previous: number };

const sum = (days: DashboardDay[], key: string) => days.reduce((total, day) => total + (day.values[key] ?? 0), 0);
const toDate = (isoDate: string) => new Date(`${isoDate}T12:00:00`);

function buildRange(daily: DashboardDay[], metrics: DashboardMetric[], range: DashboardRange) {
  const { days, step } = range;
  const total = daily.length;
  const current = daily.slice(Math.max(0, total - days));
  const previous = daily.slice(Math.max(0, total - days * 2), Math.max(0, total - days));
  const series: Record<string, Point[]> = {};
  for (const metric of metrics) {
    const points: Point[] = [];
    for (let i = 0; i < current.length; i += step) {
      const before = previous.slice(i, i + step);
      points.push({ date: toDate(current[i].date), value: sum(current.slice(i, i + step), metric.key), previous: sum(before, metric.key) });
    }
    series[metric.key] = points;
  }
  // A previous period with nothing in it, or missing from the data, has no meaningful change to show.
  const comparable = previous.length === current.length;
  const totals = Object.fromEntries(metrics.map((m) => {
    const now = sum(current, m.key);
    const before = sum(previous, m.key);
    return [m.key, { value: now, delta: comparable && before > 0 ? ((now - before) / before) * 100 : null }];
  })) as Record<string, { value: number; delta: number | null }>;
  return { series, totals, step };
}

const countFormat = new Intl.NumberFormat("es-MX");
const compactFormat = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
const dayFormat = new Intl.DateTimeFormat("es-MX", { month: "short", day: "numeric" });
const formatValue = (value: number) => countFormat.format(Math.round(value));
const formatAxis = (value: number) => compactFormat.format(value);

function niceScale(min: number, max: number, percent: boolean) {
  const lo = percent ? Math.max(0, min - (max - min) * 0.6) : 0;
  const span = max - lo || 1;
  const raw = span / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  return { min: start, max: start + step * 3, ticks: [0, 1, 2, 3].map((i) => start + step * i) };
}

/** Counts a number to its new value with tabular numerals; reduced motion swaps it instantly. */
function CountValue({ value, format }: { value: number; format: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const formatRef = useRef(format);
  const [initial] = useState(() => format(value));
  const reduce = useReducedMotion();
  useEffect(() => { formatRef.current = format; });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) { shown.current = value; node.textContent = formatRef.current(value); return; }
    const controls = animate(shown.current, value, {
      duration: motionTokens.duration.considered,
      ease: motionTokens.ease.standard,
      onUpdate: (v) => { shown.current = v; node.textContent = formatRef.current(v); },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref}>{initial}</span>;
}

/** Monotone cubic path: smooth without overshooting past the real data points. */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 3) return pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const n = pts.length;
  const slope = pts.slice(1).map(([x, y], i) => (y - pts[i][1]) / (x - pts[i][0]));
  const tangent = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    const a = slope[i - 1], b = slope[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = (x1 - x0) / 3;
    d += ` C${(x0 + h).toFixed(1)} ${(y0 + tangent[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)} ${(y1 - tangent[i + 1] * h).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

const W = 600;
const H = 180;

export function MetricsDashboard({ title, subtitle, metrics, daily, ranges, breakdowns = {}, defaultRange }: MetricsDashboardProps) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [range, setRange] = useState(defaultRange ?? ranges[0].value);
  const [metricKey, setMetricKey] = useState(metrics[0].key);
  const [compare, setCompare] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<"lg" | "md" | "sm">("lg");

  // Layout follows the block's own width so it works in narrow previews as well as full pages.
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = (width: number) => setSize(width < 460 ? "sm" : width < 640 ? "md" : "lg");
    measure(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rangeInfo = ranges.find((r) => r.value === range) ?? ranges[0];
  const data = useMemo(() => buildRange(daily, metrics, rangeInfo), [daily, metrics, rangeInfo]);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const points = data.series[metric.key];

  const chart = useMemo(() => {
    const values = points.flatMap((p) => (compare ? [p.value, p.previous] : [p.value]));
    const scale = niceScale(Math.min(...values), Math.max(...values), false);
    const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
    const y = (v: number) => H - ((v - scale.min) / (scale.max - scale.min)) * H;
    const line = (key: "value" | "previous") => smoothPath(points.map((p, i) => [x(i), y(p[key])]));
    const current = line("value");
    return { scale, x, y, current, previous: line("previous"), area: current + ` L${W} ${H} L0 ${H} Z` };
  }, [points, compare]);

  const labelEvery = Math.ceil(points.length / (size === "sm" ? 4 : size === "md" ? 5 : 6));
  const focus = active === null ? null : points[active];

  function selectRange(value: string) { setRange(value); setActive(null); }
  function inspect(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setActive(Math.round(ratio * (points.length - 1)));
  }
  function onChartKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const last = points.length - 1;
    setActive((current) => {
      if (event.key === "Home") return 0;
      if (event.key === "End") return last;
      const from = current ?? last;
      return Math.min(last, Math.max(0, from + (event.key === "ArrowRight" ? 1 : -1)));
    });
  }
  const rescale = reduce ? { duration: 0 } : motionTokens.spring.smooth;
  // The tooltip sits in the half of the plot away from the point, so it never covers what it describes.
  const tooltipLeft = focus ? Math.min(88, Math.max(12, (chart.x(active!) / W) * 100)) : 0;

  return (
    <section ref={rootRef} className={styles.dashboard} data-size={size} aria-label={title}>
      <header className={styles.header}>
        <div className={styles.title}>
          <h2>{title}</h2>
          <p>{subtitle ? `${subtitle} · ` : ""}{rangeInfo.long}</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.segmented} role="group" aria-label="Periodo">
            {ranges.map((r) => (
              <button key={r.value} type="button" aria-pressed={range === r.value} aria-label={r.long} onClick={() => selectRange(r.value)}>
                {range === r.value && <motion.span layoutId={`${uid}-range`} className={styles.segmentThumb} transition={reduce ? { duration: 0 } : motionTokens.spring.snappy} />}
                <span className={styles.segmentLabel}>{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.kpis} role="tablist" aria-label="Métrica" style={{ ["--kpi-count" as string]: metrics.length }}>
        {metrics.map((m) => {
          const total = data.totals[m.key];
          const good = total.delta !== null && (m.lowerIsBetter ? total.delta < 0 : total.delta > 0);
          const selected = metric.key === m.key;
          return (
            <button key={m.key} type="button" role="tab" aria-selected={selected} className={styles.kpi} onClick={() => { setMetricKey(m.key); setActive(null); }}>
              {selected && <motion.span layoutId={`${uid}-kpi`} className={styles.kpiIndicator} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth} />}
              <span className={styles.kpiLabel}>{m.label}</span>
              <span className={styles.kpiValue}><CountValue value={total.value} format={formatValue} /></span>
              {total.delta === null ? <span className={styles.delta}>Sin periodo anterior</span> : <span className={`${styles.delta} ${good ? styles.good : styles.bad}`}>
                {total.delta >= 0 ? <ArrowUpRight size={13} aria-hidden /> : <ArrowDownRight size={13} aria-hidden />}
                <span>{Math.abs(total.delta).toFixed(0)}%</span>
                <span className={styles.srOnly}>{total.delta >= 0 ? "más" : "menos"} que el periodo anterior</span>
              </span>}
            </button>
          );
        })}
      </div>

      <div className={styles.chartSection}>
        <div className={styles.chartBar}>
          <div className={styles.legend} aria-hidden>
            <span><i className={styles.swatch} />{metric.label}</span>
            {compare && <span><i className={styles.swatchPrevious} />Periodo anterior</span>}
          </div>
          <label className={styles.compare}>
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            <span className={styles.check} aria-hidden><Check size={11} strokeWidth={2.5} /></span>
            Comparar
          </label>
        </div>

        <div className={styles.plot}>
          <div className={styles.yAxis} aria-hidden>
            {[...chart.scale.ticks].reverse().map((t) => <span key={t}>{formatAxis(t)}</span>)}
          </div>
          <div
            className={styles.chartArea}
            tabIndex={0}
            role="img"
            aria-label={`${metric.label}, ${rangeInfo.long.toLowerCase()}. Usa las flechas para revisar cada punto.`}
            onPointerMove={inspect}
            onPointerDown={inspect}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
            onKeyDown={onChartKey}
            onBlur={() => setActive(null)}
          >
            <div className={styles.grid} aria-hidden>{chart.scale.ticks.map((t) => <span key={t} />)}</div>
            <AnimatePresence initial={false}>
              <motion.svg
                key={range + metricKey}
                className={styles.svg}
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                aria-hidden
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : motionTokens.duration.standard, ease: motionTokens.ease.standard }}
              >
                {/* Toggling compare rescales the axis; the paths morph to the new scale in place instead of snapping. */}
                <motion.path className={styles.area} initial={false} animate={{ d: chart.area }} transition={rescale} />
                <motion.path className={styles.previous} initial={false} animate={{ d: chart.previous, opacity: compare ? 1 : 0 }} transition={rescale} />
                <motion.path className={styles.line} initial={false} animate={{ d: chart.current }} transition={rescale} />
              </motion.svg>
            </AnimatePresence>
            {focus && (
              <>
                <span className={styles.crosshair} style={{ left: `${(chart.x(active!) / W) * 100}%` }} aria-hidden />
                <span className={styles.dot} style={{ left: `${(chart.x(active!) / W) * 100}%`, top: `${(chart.y(focus.value) / H) * 100}%` }} aria-hidden />
                <div className={styles.tooltip} style={{ left: `${tooltipLeft}%`, ...(chart.y(focus.value) / H < 0.5 ? { top: "auto", bottom: 6 } : null) }} role="status">
                  <span className={styles.tooltipDate}>{data.step > 1 ? "Semana del " : ""}{dayFormat.format(focus.date)}</span>
                  <strong>{formatValue(focus.value)}</strong>
                  {compare && <span className={styles.tooltipPrevious}>{formatValue(focus.previous)} antes</span>}
                </div>
              </>
            )}
          </div>
          <div className={styles.xAxis} aria-hidden>
            {points.map((p, i) => {
              if (i % labelEvery !== 0) return null;
              const pct = (chart.x(i) / W) * 100;
              return <span key={i} style={{ left: `${pct}%`, transform: `translateX(${i === 0 ? 0 : pct > 92 ? -100 : -50}%)` }}>{dayFormat.format(p.date)}</span>;
            })}
          </div>
        </div>
      </div>

      {(breakdowns[rangeInfo.value] ?? []).length > 0 && <div className={styles.breakdowns}>
        {breakdowns[rangeInfo.value].map((breakdown) => <Breakdown key={breakdown.title} {...breakdown} reduce={!!reduce} />)}
      </div>}
    </section>
  );
}

function Breakdown({ title, column, rows, reduce }: DashboardBreakdown & { reduce: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className={styles.breakdown} aria-label={title}>
      <div className={styles.breakdownHead}><h3>{title}</h3><span>{column}</span></div>
      <ul>
        {rows.map((row) => (
          <li key={row.name}>
            <span className={styles.bar} style={{ clipPath: `inset(0 ${(100 - (row.value / max) * 100).toFixed(2)}% 0 0 round 6px)`, transitionDuration: reduce ? "0ms" : undefined }} aria-hidden />
            <span className={styles.rowName} title={row.name}>{row.name}</span>
            <span className={styles.rowValue}><CountValue value={row.value} format={formatValue} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MetricsDashboard;
