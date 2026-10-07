"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./checkout-summary.module.css";

export interface CheckoutSummaryItem {
  name: string;
  description?: string;
  /** Right column beside the item, such as who takes it. */
  aside?: ReactNode;
  /** Thumbnail or mark. */
  media?: ReactNode;
}

export interface CheckoutSummaryLine {
  id: string;
  label: string;
  /** Signed amount; zero shows the empty label. */
  amount: number;
  /** Short note under the label. */
  note?: string;
  /** Shown instead of a zero amount. */
  emptyLabel?: string;
  /** Tint a positive amount as a cost, for lines where more is worse. */
  costly?: boolean;
}

export interface CheckoutSummaryProps {
  title: string;
  item: CheckoutSummaryItem;
  lines: CheckoutSummaryLine[];
  /** Left out when the total is shown elsewhere, such as beside the actions. */
  total?: { label: string; value: number; unit: string; note?: string };
  /** "none" drops the card frame when the summary already sits in a bordered column. */
  surface?: "card" | "none";
  /** Below the total, such as what is still missing. */
  children?: ReactNode;
  className?: string;
}

const { spring, duration } = motionTokens;
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}`;

/**
 * A summary of what is being asked for, adapted from Arc's checkout summary: the item, the lines that move the total,
 * and a total that counts to its new value. Lines open and close as they start or stop affecting the total.
 */
export function CheckoutSummary({ title, item, lines, total, surface = "card", children, className }: CheckoutSummaryProps) {
  const reduced = !!useReducedMotion();
  return (
    <section className={[styles.root, className].filter(Boolean).join(" ")} data-surface={surface} aria-label={title}>
      <h3 className={styles.title}>{title}</h3>

      <div className={styles.item}>
        {item.media ? <div className={styles.media}>{item.media}</div> : null}
        <div className={styles.itemText}>
          <span className={styles.itemName}>{item.name}</span>
          {item.description ? <span className={styles.itemDescription}>{item.description}</span> : null}
        </div>
        {item.aside ? <span className={styles.itemPrice}>{item.aside}</span> : null}
      </div>

      <dl className={styles.lines}>
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              className={`${styles.line} ${styles.lineAnimated}`}
              data-discount={line.amount < 0 || undefined}
              data-cost={(line.costly && line.amount > 0) || undefined}
              initial={{ height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0 }}
              animate={{ height: "auto", opacity: 1, paddingTop: 5, paddingBottom: 5 }}
              exit={{ height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0 }}
              transition={reduced ? { duration: 0 } : { default: spring.smooth, opacity: { duration: duration.standard } }}
            >
              <dt>{line.label}{line.note ? <span className={styles.lineNote}>{line.note}</span> : null}</dt>
              <dd className={line.amount === 0 ? styles.muted : undefined}>{line.amount === 0 ? line.emptyLabel ?? "0" : signed(line.amount)}</dd>
            </motion.div>
          ))}
        </AnimatePresence>
        {total && <div className={`${styles.line} ${styles.total}`}>
          <dt>{total.label}{total.note ? <span className={styles.lineNote}>{total.note}</span> : null}</dt>
          <dd>
            <span className={styles.srOnly}>{`${total.value} ${total.unit}`}</span>
            <span className={styles.totalValue} aria-hidden="true"><span className={styles.inline}><AnimatedCounter value={total.value} locale="es-MX" /></span><span className={styles.totalUnit}>{total.unit}</span></span>
          </dd>
        </div>}
      </dl>

      {children}
    </section>
  );
}

export default CheckoutSummary;
