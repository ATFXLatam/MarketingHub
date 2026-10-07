"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AREA_LABEL, AREAS, PRIORITIES, PRIORITY_LABEL, SUBTYPES, type Area } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import { addBusinessDays, BRIEF_CHECKS, deliveryDays, tierFor, type BriefTier } from "@/lib/estimate";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import { Button } from "../../button/button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Select } from "../../select/select";
import { Slider } from "../../slider/slider";
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

/** Score after the heaviest `count` checks pass, so the slider walks the brief in the order that moves the date most. */
const scoreAt = (count: number) => BRIEF_CHECKS.slice(0, count).reduce((total, check) => total + check.weight, 0);
const STOPS = BRIEF_CHECKS.length;
const briefMarks = TIERS.slice(1).map((tier) => ({ value: Array.from({ length: STOPS + 1 }, (_, count) => count).find((count) => tierFor(scoreAt(count)) === tier.id) ?? STOPS, label: tier.name }));
const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

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

export interface DeliveryCalculatorProps {
  /** YYYY-MM-DD the business days count from. */
  today: string;
  /** Shown as the main action when the viewer can open a request. */
  onRequest?: () => void;
}

/** How long a request takes depending on what it is, how urgent it is, and how complete its brief is: the same rule the form applies. */
export function DeliveryCalculator({ today, onRequest }: DeliveryCalculatorProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const [area, setArea] = useState<Area>("diseno");
  const [subtype, setSubtype] = useState<string>(SUBTYPES.diseno[0].value);
  const [briefCount, setBriefCount] = useState(3);
  const [priorityIndex, setPriorityIndex] = useState(0);
  const [listRef, listHeight] = useContentHeight<HTMLUListElement>();

  const priority = PRIORITIES[Math.round(priorityIndex)];
  const count = Math.round(briefCount);
  const score = scoreAt(count);
  const tierId = tierFor(score);
  const tier = TIERS.findIndex((item) => item.id === tierId);
  const plan = TIERS[tier];
  const piece = SUBTYPES[area].find((item) => item.value === subtype) ?? SUBTYPES[area][0];
  const result = deliveryDays(area, piece.value, priority, tierId);
  const date = addBusinessDays(today, result.days);
  const met = BRIEF_CHECKS.slice(0, count);
  const next = BRIEF_CHECKS[count];
  const reason = next ? `Siguiente: ${next.label.toLowerCase()}` : "No le falta nada";

  // Remember which way the tier moved so the meter fills forward and empties backward.
  const [shown, setShown] = useState({ tier, direction: 1 });
  if (shown.tier !== tier) setShown({ tier, direction: tier > shown.tier ? 1 : -1 });

  function pickArea(value: string) {
    const next = value as Area;
    setArea(next);
    setSubtype(SUBTYPES[next][0].value);
  }

  const itemTransition = reduce
    ? { duration: duration.instant }
    : { layout: spring.smooth, default: { duration: duration.standard, ease: enterEase, delay: .08 } };

  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <div className={styles.layout}>
        <header className={styles.head}>
          <h2 id={`${id}-title`}>Calcula tu fecha de entrega</h2>
          <p>Cada tipo de pieza tiene un plazo base. La prioridad lo acorta y un brief incompleto lo alarga, porque el equipo tiene que pedirte lo que falta.</p>
        </header>

        <div className={styles.controls}>
          <SegmentedControl label="Área" value={area} onValueChange={pickArea} options={AREAS.map((value) => ({ value, label: AREA_LABEL[value] }))} />
          <Select label="Tipo de pieza" value={piece.value} onValueChange={setSubtype} options={SUBTYPES[area].map(({ value, label }) => ({ value, label }))} />
          <Slider label="Qué tan completo está el brief" value={briefCount} onValueChange={setBriefCount} min={0} max={STOPS} step={1} marks={briefMarks} format={(value) => `${Math.round(value)} de ${STOPS}`} />
          <Slider label="Prioridad" value={priorityIndex} onValueChange={setPriorityIndex} min={0} max={PRIORITIES.length - 1} step={1} format={(value) => PRIORITY_LABEL[PRIORITIES[Math.round(value)]]} />
        </div>

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
            <p className={styles.reason}><Swap id={reason}>{reason}</Swap></p>
          </div>

          <div className={styles.price}>
            <Days value={result.days} className={styles.priceValue} />
            <span className={styles.per}>{result.days === 1 ? "día hábil" : "días hábiles"}</span>
          </div>
          <p className={styles.billed}>
            <Swap id={date}>{`Lista el ${formatDay(date)} si la pides hoy`}</Swap>
          </p>

          <motion.div className={styles.featuresFrame} initial={false} animate={{ height: listHeight }} transition={reduce ? { duration: 0 } : spring.smooth}>
            <ul ref={listRef} className={styles.features} aria-label="Lo que ya trae el brief">
              <AnimatePresence mode="popLayout" initial={false}>
                {met.map((check, index) => (
                  <motion.li
                    key={check.label}
                    layout="position"
                    layoutDependency={count}
                    className={styles.feature}
                    data-new={index === count - 1 || undefined}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0, transition: { duration: duration.instant } } : { opacity: 0, transition: { duration: duration.fast, ease: standardEase } }}
                    transition={itemTransition}
                  >
                    <DrawnCheck className={styles.check} />
                    <span className={styles.featureLabel}>{check.label}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>

          {onRequest && <div className={styles.action}>
            <Button className={styles.cta} variant="primary" onClick={onRequest} aria-describedby={`${id}-note`}>Pedir una pieza</Button>
            <p className={styles.note} id={`${id}-note`}>La fecha final se calcula con el brief que envíes.</p>
          </div>}
          <p className={styles.srOnly} aria-live="polite">{`${plan.title}. ${plural(result.days, "día hábil", "días hábiles")}.`}</p>
        </aside>

        <section className={styles.breakdown} aria-labelledby={`${id}-breakdown`}>
          <h3 id={`${id}-breakdown`}>De dónde sale el plazo</h3>
          <dl className={styles.rows}>
            <div className={styles.row}>
              <dt><span className={styles.rowLabel}><TextMorph>{piece.label}</TextMorph></span><small>Plazo base de {AREA_LABEL[area].toLowerCase()}</small></dt>
              <dd><Days value={result.base} /></dd>
            </div>
            <div className={styles.row}>
              <dt><span className={styles.rowLabel}>Prioridad {PRIORITY_LABEL[priority].toLowerCase()}</span><small>Adelanta la pieza en la fila; el trabajo no se achica</small></dt>
              <dd><Swap id={result.priority ? "faster" : "same"} className={styles.alignEnd}>{result.priority ? <Days value={-result.priority} prefix="−" /> : <span className={styles.included}>Sin cambio</span>}</Swap></dd>
            </div>
            <div className={styles.row}>
              <dt><span className={styles.rowLabel}>{plan.title}</span><small>{score} de 100 puntos</small></dt>
              <dd><Swap id={result.brief ? "slower" : "none"} className={styles.alignEnd}>{result.brief ? <Days value={result.brief} prefix="+" /> : <span className={styles.included}>Sin días extra</span>}</Swap></dd>
            </div>
            <div className={`${styles.row} ${styles.total}`}>
              <dt><span className={styles.rowLabel}>Entrega estimada</span><small>Días hábiles, de lunes a viernes</small></dt>
              <dd><Days value={result.days} /></dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}

export default DeliveryCalculator;
