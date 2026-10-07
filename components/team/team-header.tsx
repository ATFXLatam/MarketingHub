"use client";

import type { ReactNode } from "react";
import { TeamDirectory, type DirectoryPerson } from "@/components/arc/blocks/team-directory/team-directory";
import { InViewTitle } from "@/components/arc/in-view-title/in-view-title";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { AREA_LABEL, STAGE_LABEL, type Area } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import type { TeamMember } from "@/lib/team";
import { LocalTime } from "./local-time";
import styles from "./team-header.module.css";

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;
const AREA_FILTERS = (Object.keys(AREA_LABEL) as Area[]).map((value) => ({ value, label: AREA_LABEL[value] }));

export interface TeamHeaderProps {
  title: string;
  description: string;
  members: TeamMember[];
  /** Primary action and account or theme control, top right. */
  actions: ReactNode;
}

function toPerson(member: TeamMember): DirectoryPerson {
  const [working, ...more] = member.current;
  const next = member.queue.find((task) => task.stage !== "en-curso");
  return {
    id: member.id,
    name: member.name,
    role: member.title ?? "Marketing LATAM",
    teams: member.areas,
    photo: member.photo ?? undefined,
    available: member.current.length > 0,
    about: working ? (
      <>
        Trabajando en <TextShimmer>{working.title}</TextShimmer>
        {more.length > 0 && ` y ${more.length} más`}
      </>
    ) : undefined,
    facts: [
      ...(member.timeZone ? [{ label: "Hora", value: <LocalTime timeZone={member.timeZone} /> }] : []),
      { label: "Carga", value: `${plural(member.open, "abierta", "abiertas")} · ${plural(member.done, "entregada", "entregadas")} en 30 días` },
      ...(next ? [{ label: "Sigue", value: `${next.title} · ${STAGE_LABEL[next.stage]}${next.dueDate ? ` · ${formatDay(next.dueDate)}` : ""}` }] : []),
      ...(member.areas.length ? [{ label: "Áreas", value: member.areas.map((area) => AREA_LABEL[area]).join(", ") }] : []),
    ],
  };
}

/** Who is on the team and what each person is on right now, before any board or number. */
export function TeamHeader({ title, description, members, actions }: TeamHeaderProps) {
  return (
    <header className={styles.root}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <InViewTitle as="h1" variant="blur" text={title} className={styles.title} />
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.actions}>{actions}</div>
      </div>
      {members.length > 0 && <TeamDirectory people={members.map(toPerson)} filters={AREA_FILTERS} title="Equipo" />}
    </header>
  );
}
