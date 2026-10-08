"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import styles from "./section.module.css";

export interface SectionProps {
  title: string;
  /** One line under the title that says what the block answers. */
  subtitle?: string;
  /** How to read the block, behind an info icon so it never competes with the data. */
  hint?: string;
  /** Controls on the right of the heading: filters, view switch, a toggle. */
  actions?: ReactNode;
  /** Folds the body behind a Show button, so secondary reads wait until someone asks; the subtitle stays as the summary. */
  collapsible?: boolean;
  children: ReactNode;
}

/** Every block on the page opens the same way, so people learn to scan the left edge: what it is, then why it matters. */
export function Section({ title, subtitle, hint, actions, collapsible = false, children }: SectionProps) {
  const id = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(!collapsible);
  return (
    <section className={styles.root} aria-labelledby={id}>
      <div className={styles.head}>
        <div className={styles.text}>
          <h2 id={id} className={styles.title}>
            {title}
            {hint && (
              <Tooltip content={hint}>
                <button type="button" className={styles.hint} aria-label={`About ${title}: ${hint}`}>
                  <Info size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Tooltip>
            )}
          </h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {(actions || collapsible) && (
          <div className={styles.actions}>
            {open && actions}
            {collapsible && (
              <Button variant="primary" size="sm" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((value) => !value)}>
                {open ? "Hide" : "Show"}
              </Button>
            )}
          </div>
        )}
      </div>
      {open && <div id={bodyId} className={styles.body}>{children}</div>}
    </section>
  );
}
