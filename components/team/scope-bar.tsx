"use client";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/arc/button/button";
import type { TeamMember } from "@/lib/team";
import { PERSON_PARAM, setUrlParam } from "./url-state";
import styles from "./scope-bar.module.css";

/**
 * Picking a person changes every block below the fold, and nothing there said so. The bar follows the scroll so the
 * filter is always visible and one click from undone.
 */
export function ScopeBar({ person }: { person: TeamMember }) {
  return (
    <div className={styles.root} role="status">
      <Avatar name={person.name} src={person.photo ?? undefined} size="sm" />
      <p className={styles.text}>
        Showing <strong>{person.name.split(" ")[0]}</strong>&rsquo;s work in every block
      </p>
      <Button variant="primary" size="sm" onClick={() => setUrlParam(PERSON_PARAM, null)}>
        Show All Tasks
      </Button>
    </div>
  );
}
