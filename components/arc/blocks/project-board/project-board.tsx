"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./project-board.module.css";

/**
 * Arc Pro project-board, adapted to a read-only board: stages, filters and cards come from props, and the move and add
 * actions are gone because status is edited in monday.
 */
export interface ProjectBoardStage {
  id: string;
  label: string;
}

export interface ProjectBoardTask {
  id: string;
  title: string;
  stage: string;
  /** Small label at the top left of the card, such as the area. */
  project: string;
  /** Top right, such as the due date. */
  due?: string;
  dueSoon?: boolean;
  /** Bottom row, such as a priority badge. */
  footer?: ReactNode;
  /** Key the active filter matches against. */
  filterKey: string;
}

export interface ProjectBoardFilter {
  value: string;
  label: string;
}

export interface ProjectBoardProps {
  title: string;
  stages: ProjectBoardStage[];
  tasks: ProjectBoardTask[];
  /** The stage that counts as finished for the progress bar. */
  doneStage: string;
  /** The first filter shows everything. */
  filters: ProjectBoardFilter[];
  emptyLabel?: string;
}

export function ProjectBoard({ title, stages, tasks, doneStage, filters, emptyLabel = "Sin solicitudes" }: ProjectBoardProps) {
  const reduce = useReducedMotion();
  const groupId = useId();
  const [filter, setFilter] = useState(filters[0]?.value ?? "");
  const shown = filter === filters[0]?.value ? tasks : tasks.filter((task) => task.filterKey === filter);
  const completed = shown.filter((task) => task.stage === doneStage).length;
  const spring = reduce ? { duration: 0 } : motionTokens.spring.gentle;

  return <LayoutGroup id={groupId}><section className={styles.board} aria-label={title} style={{ ["--stage-count" as string]: stages.length }}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        <p><span className={styles.tabular}>{completed}</span> de <span className={styles.tabular}>{shown.length}</span> hechas</p>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.filters} role="group" aria-label="Filtrar por área">
          {filters.map(({ value, label }) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {filter === value && <motion.span layoutId="filter" className={styles.filterHighlight} transition={reduce ? { duration: 0 } : motionTokens.spring.snappy} aria-hidden="true" />}
            <span>{label}</span>
          </button>)}
        </div>
      </div>
    </header>
    <div className={styles.progress} aria-hidden="true"><motion.span initial={false} animate={{ scaleX: shown.length ? completed / shown.length : 0 }} transition={spring} /></div>

    <div className={styles.stageScroll}>
      <div className={styles.stages}>
        {stages.map((stage) => {
          const cards = shown.filter((task) => task.stage === stage.id);
          return <section className={styles.stage} key={stage.id} aria-label={`${stage.label}, ${cards.length} solicitudes`}>
            <div className={styles.stageHead}><h3>{stage.label}</h3><span className={styles.stageCount}>{cards.length}</span></div>
            <div className={styles.cardStack}>
              <AnimatePresence mode="popLayout" initial={false}>
                {cards.map((task) => <motion.article key={task.id} layout={!reduce} initial={reduce ? false : { opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: .98 }} transition={spring} className={styles.card} data-done={stage.id === doneStage || undefined}>
                  <div className={styles.cardTop}><span>{task.project}</span>{task.due && <span className={styles.due} data-soon={task.dueSoon && stage.id !== doneStage ? "" : undefined}>{task.due}</span>}</div>
                  <h4>{task.title}</h4>
                  {task.footer && <div className={styles.cardBottom}>{task.footer}</div>}
                </motion.article>)}
              </AnimatePresence>
              {cards.length === 0 && <p className={styles.empty}>{emptyLabel}</p>}
            </div>
          </section>;
        })}
      </div>
    </div>
  </section></LayoutGroup>;
}

export default ProjectBoard;
