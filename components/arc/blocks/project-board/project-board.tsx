"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Avatar } from "../../avatar/avatar";
import { AvatarGroup } from "../../avatar-group/avatar-group";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./project-board.module.css";

/**
 * Arc Pro project-board, adapted to a read-only board: stages, filters, people and cards come from props, and the move
 * and add actions are gone because status is edited in monday.
 */
export interface ProjectBoardStage {
  id: string;
  label: string;
}

export interface ProjectBoardPerson {
  name: string;
  src?: string;
}

export interface ProjectBoardTask {
  id: string;
  title: string;
  stage: string;
  owners: ProjectBoardPerson[];
  /** Small label at the top left of the card, such as the area. */
  project: string;
  /** Top right, such as the due date. */
  due?: string;
  dueSoon?: boolean;
  /** Bottom row beside the owners, such as a priority badge. */
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
  /** Everyone with work on the board, shown in the header. */
  team: ProjectBoardPerson[];
  stages: ProjectBoardStage[];
  tasks: ProjectBoardTask[];
  /** The stage that counts as finished for the progress bar. */
  doneStage: string;
  /** The first filter shows everything. Leave it out when the page filters the tasks itself. */
  filters?: ProjectBoardFilter[];
  emptyLabel?: string;
  /** Opens a card's details; without it cards are not interactive. */
  onSelect?: (id: string) => void;
}

export function ProjectBoard({ title, team, stages, tasks, doneStage, filters = [], emptyLabel = "No requests", onSelect }: ProjectBoardProps) {
  const reduce = useReducedMotion();
  const groupId = useId();
  const [filter, setFilter] = useState(filters[0]?.value ?? "");
  const shown = filters.length < 2 || filter === filters[0]?.value ? tasks : tasks.filter((task) => task.filterKey === filter);
  const completed = shown.filter((task) => task.stage === doneStage).length;
  const spring = reduce ? { duration: 0 } : motionTokens.spring.gentle;
  // A stage with cards takes two tracks and lays them out two per row, so no column becomes the long one; an empty stage stays narrow.
  const tracks = stages.reduce((sum, stage) => sum + (shown.some((task) => task.stage === stage.id) ? 2 : 1), 0);

  return <LayoutGroup id={groupId}><section className={styles.board} aria-label={title} style={{ ["--stage-count" as string]: stages.length, ["--tracks" as string]: tracks }}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        <p><span className={styles.tabular}>{completed}</span> of <span className={styles.tabular}>{shown.length}</span> done</p>
      </div>
      <div className={styles.headerActions}>
        {team.length > 0 && <div className={styles.people}><AvatarGroup members={team} max={4} size="sm" label="Team" /></div>}
        {filters.length > 1 && <div className={styles.filters} role="group" aria-label="Filter by area">
          {filters.map(({ value, label }) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {filter === value && <motion.span layoutId="filter" className={styles.filterHighlight} transition={reduce ? { duration: 0 } : motionTokens.spring.snappy} aria-hidden="true" />}
            <span>{label}</span>
          </button>)}
        </div>}
      </div>
    </header>
    <div className={styles.progress} aria-hidden="true"><motion.span initial={false} animate={{ scaleX: shown.length ? completed / shown.length : 0 }} transition={spring} /></div>

    <motion.div className={styles.stageScroll} layoutScroll>
      <div className={styles.stages}>
        {stages.map((stage) => {
          const cards = shown.filter((task) => task.stage === stage.id);
          return <section className={styles.stage} key={stage.id} data-wide={cards.length > 0 || undefined} aria-label={`${stage.label}, ${cards.length} ${cards.length === 1 ? "request" : "requests"}`}>
            <div className={styles.stageHead}><h3>{stage.label}</h3><span className={styles.stageCount}>{cards.length}</span></div>
            <div className={styles.cardStack}>
              <AnimatePresence mode="popLayout" initial={false}>
                {cards.map((task) => <motion.article key={task.id} layoutId={reduce ? undefined : `task-${task.id}`} layoutCrossfade={false} initial={reduce ? false : { opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: .98 }} transition={spring} className={styles.card} data-done={stage.id === doneStage || undefined}
                  {...(onSelect ? { role: "button", tabIndex: 0, "aria-label": `${task.title}, view details`, onClick: () => onSelect(task.id), onKeyDown: (event: KeyboardEvent<HTMLElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(task.id); } } } : {})}>
                  <div className={styles.cardTop}><span>{task.project}</span>{task.due && <span className={styles.due} data-soon={task.dueSoon && stage.id !== doneStage ? "" : undefined}>{task.due}</span>}</div>
                  <h4>{task.title}</h4>
                  {(task.owners.length > 0 || task.footer) && <div className={styles.cardBottom}>
                    {task.owners.map((owner) => <Avatar key={owner.name} name={owner.name} src={owner.src} size="sm" />)}
                    {task.footer && <span className={styles.footer}>{task.footer}</span>}
                  </div>}
                </motion.article>)}
              </AnimatePresence>
              {cards.length === 0 && <p className={styles.empty}>{emptyLabel}</p>}
            </div>
          </section>;
        })}
      </div>
    </motion.div>
  </section></LayoutGroup>;
}

export default ProjectBoard;
