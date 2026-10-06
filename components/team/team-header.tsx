"use client";

import type { ReactNode } from "react";
import { Clock, Layers } from "lucide-react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { InViewTitle } from "@/components/arc/in-view-title/in-view-title";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import type { TeamMember } from "@/lib/team";
import { LocalTime } from "./local-time";
import styles from "./team-header.module.css";

const icon = { size: 14, strokeWidth: 1.75, "aria-hidden": true } as const;
const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

export interface TeamHeaderProps {
  title: string;
  description: string;
  members: TeamMember[];
  /** Primary action and account or theme control, top right. */
  actions: ReactNode;
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
      <ul className={styles.members} aria-label="Equipo">
        {members.map((member) => (
          <li key={member.id} className={styles.member}>
            <div className={styles.identity}>
              <Avatar name={member.name} src={member.photo ?? undefined} size="lg" status={member.current.length ? "online" : "offline"} />
              <div className={styles.body}>
                <span className={styles.name}>{member.name}</span>
                <span className={styles.meta}>
                  {member.title && <span>{member.title}</span>}
                  {member.timeZone && (
                    <span className={styles.item}>
                      <Clock {...icon} />
                      <LocalTime timeZone={member.timeZone} />
                    </span>
                  )}
                </span>
              </div>
            </div>
            <p className={styles.status}>
              {member.current.length ? (
                <>
                  <span className={styles.pulse} aria-hidden="true" />
                  <span className={styles.statusLabel}>Trabajando en</span>
                  <TextShimmer>{member.current[0].title}</TextShimmer>
                  {member.current.length > 1 && <span className={styles.statusLabel}>y {member.current.length - 1} más</span>}
                </>
              ) : (
                <span className={styles.statusLabel}>Sin trabajo en curso</span>
              )}
            </p>
            <p className={styles.load}>
              <Layers {...icon} />
              {plural(member.open, "abierta", "abiertas")} · {plural(member.done, "entregada", "entregadas")} en 30 días
            </p>
          </li>
        ))}
      </ul>
    </header>
  );
}
