"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { Search, X } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./team-directory.module.css";

export interface DirectoryFact {
  label: string;
  value: ReactNode;
}

export interface DirectoryPerson {
  id: string;
  name: string;
  role: string;
  /** Filter values this person belongs to; one person can sit in several. */
  teams: string[];
  photo?: string;
  available: boolean;
  /** Short line under the name in the profile. */
  about?: ReactNode;
  facts: DirectoryFact[];
  /** A small control beside the person in the list and in their profile, such as a link to their profile elsewhere. */
  action?: ReactNode;
}

export interface TeamDirectoryProps {
  people: DirectoryPerson[];
  /** Filter chips after "All". Only the ones somebody belongs to are shown. */
  filters?: { value: string; label: string }[];
  title?: string;
  /** An entry above the people that stands for the whole team. It is the idle state, and picking it reports null. */
  everyone?: Omit<DirectoryPerson, "id" | "teams">;
  /** Controlled selection; null is the everyone entry. Leave undefined to let the directory keep its own. */
  selectedId?: string | null;
  onPersonSelect?: (person: { id: string; name: string } | null) => void;
}

const ALL = "__all";
const EVERYONE = "__everyone";

export function TeamDirectory({ people, filters: teamFilters = [], title = "Team", everyone, selectedId: controlledId, onPersonSelect }: TeamDirectoryProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(ALL);
  const [ownSelectedId, setOwnSelectedId] = useState(everyone ? EVERYONE : people[0]?.id);
  const selectedId = controlledId === undefined ? ownSelectedId : (controlledId ?? EVERYONE);
  const filters = [{ value: ALL, label: "All" }, ...teamFilters.filter((item) => people.some((person) => person.teams.includes(item.value)))];
  const teamLabel = (value: string) => teamFilters.find((item) => item.value === value)?.label ?? value;

  const needle = query.trim().toLowerCase();
  const visible = people.filter((person) => {
    const matchesFilter = filter === ALL || person.teams.includes(filter);
    const terms = `${person.name} ${person.role} ${person.teams.map(teamLabel).join(" ")}`.toLowerCase();
    return matchesFilter && terms.includes(needle);
  });
  // The everyone entry stays above any filter or search, so the way back to the whole team is never hidden.
  const rows = everyone ? [{ ...everyone, id: EVERYONE, teams: [] }, ...visible] : visible;
  const selected = rows.find((person) => person.id === selectedId) ?? rows[0];

  function choose(person: DirectoryPerson) {
    setOwnSelectedId(person.id);
    onPersonSelect?.(person.id === EVERYONE ? null : { id: person.id, name: person.name });
  }

  function reset() {
    setQuery("");
    setFilter(ALL);
    searchRef.current?.focus();
  }

  const listTransition = reduce ? { duration: 0 } : motionTokens.spring.smooth;

  return (
    <section className={styles.directory} aria-labelledby={`${uid}-title`}>
      <header className={styles.header}>
        <h2 id={`${uid}-title`}>{title} <span className={styles.count}>{people.length}</span></h2>
        <label className={styles.search}>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.srOnly}>Search people</span>
          <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && query) { event.preventDefault(); setQuery(""); } }} placeholder="Search name, role or area" />
          <span className={styles.clearSlot}>{query && <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear search"><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>}</span>
        </label>
      </header>

      <div className={styles.filters} role="group" aria-label="Filter by area">
        {filters.map((item) => {
          const count = item.value === ALL ? people.length : people.filter((person) => person.teams.includes(item.value)).length;
          return <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
            {filter === item.value && <motion.span layoutId={`${uid}-filter`} className={styles.filterHighlight} transition={reduce ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
            <span className={styles.filterLabel}>{item.label}<span className={styles.filterCount}>{count}</span></span>
          </button>;
        })}
      </div>

      <div className={styles.body}>
        <div className={styles.listPane}>
          <ul className={styles.peopleList} aria-label="Team members">
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((person) => {
                const isSelected = selected?.id === person.id;
                return <motion.li
                  key={person.id}
                  layout={reduce ? false : "position"}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.exit } }}
                  transition={{ layout: listTransition, opacity: { duration: reduce ? 0 : motionTokens.duration.fast } }}
                >
                  <button type="button" className={styles.personRow} data-action={person.action ? "" : undefined} aria-pressed={isSelected} onClick={() => choose(person)}>
                    {isSelected && <RowHighlight layoutId={`${uid}-row-${filter}-${needle}`} reduce={Boolean(reduce)} />}
                    <Avatar name={person.name} src={person.photo} status={person.available ? "online" : "offline"} />
                    <span className={styles.personText}><span className={styles.personName}>{person.name}</span><span className={styles.personRole}>{person.role}</span></span>
                  </button>
                  {/* Beside the row button, not inside it: a link nested in a button is neither valid nor reachable by keyboard. */}
                  {person.action && <span className={styles.personAction}>{person.action}</span>}
                </motion.li>;
              })}
            </AnimatePresence>
          </ul>
          {visible.length === 0 && <div className={styles.empty}>
            <p>No one matches{needle ? ` “${query.trim()}”` : ""}</p>
            <button type="button" onClick={reset}>Clear filters</button>
          </div>}
        </div>

        {/* Stacked on a phone, the profile rides up with the list as rows leave instead of jumping ahead of it. */}
        <motion.div className={styles.detailPane} layout={reduce ? false : "position"} transition={{ layout: listTransition }} aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
          {selected ? <motion.article
            key={selected.id}
            className={styles.profile}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }}
            transition={{ duration: reduce ? 0 : motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
            aria-label={`${selected.name}, ${selected.role}`}
          >
            <div className={styles.profileTop}>
              <Avatar name={selected.name} src={selected.photo} size="lg" />
              <div className={styles.profileIdentity}>
                <h3>{selected.name}</h3>
                <p>{selected.role}</p>
              </div>
              {selected.action && <span className={styles.profileAction}>{selected.action}</span>}
            </div>
            {selected.about && <p className={styles.about}>{selected.about}</p>}
            <dl className={styles.facts}>
              <div><dt>Status</dt><dd><span className={styles.dot} data-available={selected.available || undefined} aria-hidden="true" />{selected.available ? "Working" : "Nothing in progress"}</dd></div>
              {selected.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
            </dl>
          </motion.article> : <motion.div key="none" className={styles.noProfile} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.exit } }} transition={{ duration: reduce ? 0 : motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }}><p>No one selected</p><span>Clear the search to see the team.</span></motion.div>}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

/** The shared selection highlight. Its layout id carries the filter and query, so it morphs between rows on a click but rides along
 *  with its row when a filter moves the selection. A row that is leaving drops it at once, so the highlight never holds the exit open or splits in two. */
function RowHighlight({ layoutId, reduce }: { layoutId: string; reduce: boolean }) {
  const present = useIsPresent();
  if (!present) return null;
  return <motion.span layoutId={layoutId} className={styles.rowHighlight} transition={reduce ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />;
}

export default TeamDirectory;
