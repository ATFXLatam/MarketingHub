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
  { id: "incompleto", name: "Incompleto", title: "Brief incompleto" },
  { id: "parcial", name: "Parcial", title: "Brief parcial" },
  { id: "completo", name: "Completo", title: "Brief completo" },
];

/** A day count on the shared odometer, sized by its parent. */
function Days({ value, prefix, className }: { value: number; prefix?: string; className?: string }) {
  return <span className={[styles.money, className].filter(Boolean).join(" ")}><AnimatedCounter value={value} prefix={prefix} locale="es-MX" /></span>;
}

/** Replaces a short phrase in place: the new one rises into place, the old one lifts away faster.
 *  Both phrases share one grid cell, so the outgoing one keeps its own width and anchor instead of being popped out of flow. */
function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0, transition: { duration: duration.instant } } : { opacity: 0, y: -4, transition: { duration: duration.fast, ease: standardEase } }}
          transition={reduce ? { duration: duration.instant } : { duration: duration.standard, ease: enterEase }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
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

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

export interface EstimateCardProps {
  /** The live estimate of the draft; null until an area is picked. */
  result: Estimate | null;
  /** Takes the person to where a missing piece is filled in. */
  onFix?: (gap: BriefGap) => void;
}

/** The delivery date a draft would get right now, beside every step, with what is still missing as links to fill it in. */
export function EstimateCard({ result, onFix }: EstimateCardProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const [listRef, listHeight] = useContentHeight<HTMLUListElement>();
  const tier = result ? TIERS.findIndex((item) => item.id === result.tier) : -1;
  const [shown, setShown] = useState({ tier, direction: 1 });
  if (shown.tier !== tier) setShown({ tier, direction: tier > shown.tier ? 1 : -1 });

  const itemTransition = reduce
    ? { duration: duration.instant }
    : { layout: spring.smooth, default: { duration: duration.standard, ease: enterEase, delay: .08 } };

  if (!result) {
    return (
      <aside className={styles.card} aria-labelledby={`${id}-plan`}>
        <div className={styles.planHead}>
          <h3 id={`${id}-plan`} className={styles.planName}>Fecha estimada</h3>
          <p className={styles.reason}>Elige un área y la fecha aparece aquí mientras llenas la solicitud.</p>
        </div>
      </aside>
    );
  }
  const plan = TIERS[tier];
  const [next] = result.gaps;

  return (
    <aside className={styles.card} aria-labelledby={`${id}-plan`}>
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

      <div className={styles.planHead}>
        <TextMorph as="h3" id={`${id}-plan`} className={styles.planName}>{plan.title}</TextMorph>
        <p className={styles.reason}><Swap id={next?.label ?? "listo"}>{next ? `Siguiente: ${next.label.toLowerCase()}` : "No le falta nada"}</Swap></p>
      </div>

      <div className={styles.price}>
        <Days value={result.days} className={styles.priceValue} />
        <span className={styles.per}>{result.days === 1 ? "día hábil" : "días hábiles"}</span>
      </div>
      <p className={styles.billed}><Swap id={result.date}>{`Estimada para el ${formatDay(result.date)}`}</Swap></p>

      <motion.div className={styles.featuresFrame} initial={false} animate={{ height: listHeight }} transition={reduce ? { duration: 0 } : spring.smooth}>
        <ul ref={listRef} className={styles.features} aria-label="Qué trae el brief">
          <AnimatePresence mode="popLayout" initial={false}>
            {[...result.met.map((gap) => ({ gap, done: true })), ...result.gaps.map((gap) => ({ gap, done: false }))].map(({ gap, done }) => (
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
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.div>
      {/* Only a change in days is announced, so typing in the brief does not read the summary out on every key. */}
      <p className={styles.srOnly} role="status">{plural(result.days, "día hábil", "días hábiles")}</p>
    </aside>
  );
}

/** Where the delivery days come from, for the review step before sending. */
export function EstimateBreakdown({ result, pieceLabel, priorityLabel }: { result: Estimate; pieceLabel: string; priorityLabel: string }) {
  const id = useId();
  const { base, priority, brief, days } = result.breakdown;
  const plan = TIERS.find((item) => item.id === result.tier)!;
  return (
    <section className={styles.breakdown} aria-labelledby={`${id}-breakdown`}>
      <h3 id={`${id}-breakdown`}>De dónde sale el plazo</h3>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt><span className={styles.rowLabel}>{pieceLabel}</span><small>Plazo base del tipo de pieza</small></dt>
          <dd><Days value={base} /></dd>
        </div>
        <div className={styles.row}>
          <dt><span className={styles.rowLabel}>Prioridad {priorityLabel.toLowerCase()}</span><small>Adelanta la pieza en la fila; el trabajo no se achica</small></dt>
          <dd><Swap id={priority ? "faster" : "same"} className={styles.alignEnd}>{priority ? <Days value={-priority} prefix="−" /> : <span className={styles.included}>Sin cambio</span>}</Swap></dd>
        </div>
        <div className={styles.row}>
          <dt><span className={styles.rowLabel}>{plan.title}</span><small>{result.score} de 100 puntos</small></dt>
          <dd><Swap id={brief ? "slower" : "none"} className={styles.alignEnd}>{brief ? <Days value={brief} prefix="+" /> : <span className={styles.included}>Sin días extra</span>}</Swap></dd>
        </div>
        <div className={`${styles.row} ${styles.total}`}>
          <dt><span className={styles.rowLabel}>Entrega estimada</span><small>{`${formatDay(result.date)}, días hábiles de lunes a viernes`}</small></dt>
          <dd><Days value={days} /></dd>
        </div>
      </dl>
    </section>
  );
}
