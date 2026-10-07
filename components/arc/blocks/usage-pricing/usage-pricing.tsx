"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatDay } from "@/lib/dates";
import type { BriefGap, BriefTier, Estimate } from "@/lib/estimate";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import { TextMorph } from "../../text-morph/text-morph";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./usage-pricing.module.css";

const { spring, duration, ease } = motionTokens;
const enterEase = [...ease.enter] as [number, number, number, number];
const standardEase = [...ease.standard] as [number, number, number, number];

const TIERS: { id: BriefTier; name: string; title: string }[] = [
  { id: "incompleto", name: "Incomplete", title: "Incomplete brief" },
  { id: "parcial", name: "Partial", title: "Partial brief" },
  { id: "completo", name: "Complete", title: "Complete brief" },
];

/** A day count on the shared odometer, sized by its parent. */
function Days({ value, prefix, className }: { value: number; prefix?: string; className?: string }) {
  return <span className={[styles.money, className].filter(Boolean).join(" ")}><AnimatedCounter value={value} prefix={prefix} locale="en-US" /></span>;
}

/** A check that draws itself when it first appears. Items already on screen keep their stroke. */
function DrawnCheck({ className, delay = .16 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <motion.path d="M20 6 9 17l-5-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={reduce ? { duration: 0 } : { duration: .34, ease: enterEase, delay }} />
    </svg>
  );
}

/** Measures content so its frame can spring to the new height instead of jumping. */
function useContentHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, height] as const;
}


export interface EstimateChecklistProps {
  /** The live estimate of the draft; null until an area is picked. */
  result: Estimate | null;
  /** Takes the person to where a missing piece is filled in. */
  onFix?: (gap: BriefGap) => void;
  /** Missing requirements listed before the rest collapse into a count, so the list never outgrows a fixed column. */
  limit?: number;
}

/** How complete the brief is, as a three step meter and the requirements it meets or misses, each missing one a link. */
export function EstimateChecklist({ result, onFix, limit = Infinity }: EstimateChecklistProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const [listRef, listHeight] = useContentHeight<HTMLUListElement>();
  const tier = result ? TIERS.findIndex((item) => item.id === result.tier) : -1;
  const [shown, setShown] = useState({ tier, direction: 1 });
  if (shown.tier !== tier) setShown({ tier, direction: tier > shown.tier ? 1 : -1 });

  const itemTransition = reduce
    ? { duration: duration.instant }
    : { layout: spring.smooth, default: { duration: duration.standard, ease: enterEase, delay: .08 } };

  if (!result) return <p className={styles.reason}>Choose an area to see what its brief needs.</p>;
  const plan = TIERS[tier];
  const shownGaps = result.gaps.slice(0, limit);
  const hidden = result.gaps.length - shownGaps.length;
  const rows = shownGaps.map((gap) => ({ gap, done: false }));

  return (
    <div className={styles.checklist} aria-labelledby={`${id}-tier`}>
      <div className={styles.meter} aria-hidden="true">
        {TIERS.map((item, index) => (
          <span key={item.id} className={styles.step} data-current={index === tier || undefined}>
            <span className={styles.bar}>
              <motion.span className={styles.fill} initial={false} animate={{ scaleX: index <= tier ? 1 : 0 }} transition={reduce ? { duration: 0 } : { ...spring.smooth, delay: Math.max(0, shown.direction > 0 ? index - 1 : 2 - index) * .07 }} />
            </span>
            <span className={styles.stepName}>{item.name}</span>
          </span>
        ))}
      </div>
      <p className={styles.tierLine}>
        <TextMorph as="span" id={`${id}-tier`} className={styles.planName}>{plan.title}</TextMorph>
        <span className={styles.score}><Days value={result.score} /> of 100</span>
      </p>

      <motion.div className={styles.featuresFrame} initial={false} animate={{ height: listHeight }} transition={reduce ? { duration: 0 } : spring.smooth}>
        <ul ref={listRef} className={styles.features} aria-label="Brief requirements">
          <AnimatePresence mode="popLayout" initial={false}>
            {rows.map(({ gap, done }) => (
              <motion.li
                key={gap.label}
                layout="position"
                className={styles.feature}
                data-missing={!done || undefined}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: duration.instant } } : { opacity: 0, transition: { duration: duration.fast, ease: standardEase } }}
                transition={itemTransition}
              >
                {done ? <DrawnCheck className={styles.check} /> : <span className={styles.check} aria-hidden="true" />}
                {done || !onFix
                  ? <span className={styles.featureLabel}>{gap.label}</span>
                  : <button type="button" className={styles.fix} onClick={() => onFix(gap)}>{gap.hint}</button>}
                <span className={styles.weight}>{done ? gap.weight : `+${gap.weight}`}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.div>
      <p className={styles.rest}>
        {[hidden > 0 && `${hidden} more pending`, `${result.met.length} of ${result.met.length + result.gaps.length} met`].filter(Boolean).join(" · ")}
      </p>
      {/* Only a change of tier is announced, so typing in the brief does not read the list out on every key. */}
      <p className={styles.srOnly} role="status">{plan.title}</p>
    </div>
  );
}

/** The running delivery estimate for the actions row: days counting to their new value and the date they land on. */
export function EstimateTotal({ result }: { result: Estimate | null }) {
  if (!result) return null;
  return (
    <span className={styles.total}>
      <span className={styles.totalDays}><Days value={result.days} /></span>
      <span className={styles.totalText}>
        <span>{result.days === 1 ? "business day" : "business days"}</span>
        <span className={styles.totalDate}>{`Due ${formatDay(result.date)}`}</span>
      </span>
    </span>
  );
}

/** Label and value rows, for reading back what will be sent before sending it. */
export function SummaryRows({ title, rows }: { title: string; rows: { label: string; value: ReactNode; note?: string }[] }) {
  const id = useId();
  return (
    <section className={styles.breakdown} aria-labelledby={`${id}-rows`}>
      <h3 id={`${id}-rows`}>{title}</h3>
      <dl className={styles.rows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt><span className={styles.rowLabel}>{row.label}</span>{row.note && <small>{row.note}</small>}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
