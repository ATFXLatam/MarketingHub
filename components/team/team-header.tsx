"use client";

import type { ReactNode } from "react";
import { TeamDirectory, type DirectoryPerson, type TeamDirectoryProps } from "@/components/arc/blocks/team-directory/team-directory";
import { AtfxLogo } from "@/components/brand/atfx-logo";
import { LinkedinMark } from "@/components/brand/linkedin-mark";
import { InViewTitle } from "@/components/arc/in-view-title/in-view-title";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { AREA_LABEL, DEFAULT_AVATAR, STAGE_LABEL, type Area } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import type { TeamMember } from "@/lib/team";
import { LocalTime } from "./local-time";
import { PERSON_PARAM, setUrlParam, useUrlParam } from "./url-state";
import styles from "./team-header.module.css";

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
    action: member.linkedin ? (
      <a href={member.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on LinkedIn`} title="LinkedIn">
        <LinkedinMark />
      </a>
    ) : undefined,
    about: working ? (
      <>
        Working on <TextShimmer>{working.title}</TextShimmer>
        {more.length > 0 && ` and ${more.length} more`}
      </>
    ) : undefined,
    facts: [
      ...(member.timeZone ? [{ label: "Time", value: <LocalTime timeZone={member.timeZone} /> }] : []),
      { label: "Load", value: `${member.open} open · ${member.done} delivered in 30 days` },
      ...(next ? [{ label: "Next up", value: `${next.title} · ${STAGE_LABEL[next.stage]}${next.dueDate ? ` · ${formatDay(next.dueDate)}` : ""}` }] : []),
      ...(member.areas.length ? [{ label: "Areas", value: member.areas.map((area) => AREA_LABEL[area]).join(", ") }] : []),
    ],
  };
}

/** The idle state of the directory: the whole team, which is what every widget shows until someone is picked. */
function everyone(members: TeamMember[]): NonNullable<TeamDirectoryProps["everyone"]> {
  const working = members.filter((member) => member.current.length > 0);
  return {
    name: "Show All Tasks",
    role: `${members.length} people · Marketing LATAM`,
    photo: DEFAULT_AVATAR,
    available: working.length > 0,
    about: "Every widget shows the whole team. Pick someone to see only their work.",
    facts: working.length ? [{ label: "Working now", value: working.map((member) => member.name.split(" ")[0]).join(", ") }] : [],
  };
}

/** Who is on the team and what each person is on right now, before any board or number. */
export function TeamHeader({ title, description, members, actions }: TeamHeaderProps) {
  const personId = useUrlParam(PERSON_PARAM);
  // Picking someone scopes every widget to their work; Show All Tasks clears it.
  const pick = (person: { id: string } | null) => setUrlParam(PERSON_PARAM, person?.id ?? null);
  const selectedId = members.some((member) => member.id === personId) ? personId : null;
  return (
    <header className={styles.root}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <div className={styles.lockup}>
            <AtfxLogo height={26} />
            <InViewTitle as="h1" variant="blur" text={title} className={styles.title} />
          </div>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.actions}>{actions}</div>
      </div>
      {members.length > 0 && <TeamDirectory people={members.map(toPerson)} filters={AREA_FILTERS} title="Team" everyone={everyone(members)} selectedId={selectedId} onPersonSelect={pick} />}
    </header>
  );
}
