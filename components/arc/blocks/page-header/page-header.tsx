"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, ReactNode, UIEvent } from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion, type Transition, type Variants } from "motion/react";
import { Check, ChevronRight, Circle, CircleAlert, CircleCheck, CircleDashed, Ellipsis } from "lucide-react";
import { AnimatedCounter } from "../../animated-counter/animated-counter";
import { Avatar } from "../../avatar/avatar";
import { Badge, type BadgeTone } from "../../badge/badge";
import { Button } from "../../button/button";
import { Progress } from "../../progress/progress";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./page-header.module.css";

/** The header condenses past CONDENSE_AT and only opens again near the top, so it never flickers at the threshold. */
const CONDENSE_AT = 16;
const EXPAND_AT = 4;

export type PageHeaderSection = { value: string; label: string; count?: number; content: ReactNode };
/** onSelect may return the text to confirm in the toast; a thrown error shows as an error toast. */
export type PageHeaderMenuAction = { key: string; label: string; icon: ReactNode; onSelect: () => string | void | Promise<string | void>; separatorBefore?: boolean };

export interface PageHeaderProps {
  /** Ancestors first; the title closes the trail. */
  crumbs: string[];
  title: string;
  description?: string;
  status?: { tone: BadgeTone; label: string };
  meta?: ReactNode[];
  sections: PageHeaderSection[];
  primaryAction?: { label: string; icon?: ReactNode; onClick: () => void };
  menuActions?: PageHeaderMenuAction[];
  /** Account or theme control at the far end of the bar. */
  trailing?: ReactNode;
}

type Notice = { key: number; text: string; tone: "success" | "error" | "neutral" };

const still: Transition = { duration: 0 };
const quick: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
const blur = (px: number) => `blur(${px}px)`;
const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Panels slide a few pixels in the direction of the tab that was chosen. */
const panelSlide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 12 }),
  center: { opacity: 1, x: 0, transition: { x: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } } },
  exit: (direction: number) => ({ opacity: 0, x: direction * -8, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }),
};
const panelFade: Variants = { enter: { opacity: 0, x: 0 }, center: { opacity: 1, x: 0, transition: { duration: motionTokens.duration.instant } }, exit: { opacity: 0, x: 0, transition: { duration: motionTokens.duration.instant } } };

function StatusDot() {
  return <span className={styles.dot} />;
}

/** The overflow button never scales: it anchors the menu. A shared highlight glides between items under the pointer. */
function OverflowMenu({ actions, reduce, onResult }: { actions: PageHeaderMenuAction[]; reduce: boolean; onResult: (text: string, tone: Notice["tone"]) => void }) {
  const [highlight, setHighlight] = useState<{ top: number; height: number; glide: boolean } | null>(null);
  const pointer = useRef(false);
  const clearTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);
  function onFocus(event: FocusEvent<HTMLDivElement>) {
    const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[role="menuitem"]') : null;
    window.clearTimeout(clearTimer.current);
    if (!item) { clearTimer.current = window.setTimeout(() => setHighlight(null), pointer.current ? 70 : 0); return; }
    const glide = pointer.current;
    setHighlight(current => ({ top: item.offsetTop, height: item.offsetHeight, glide: glide && current !== null }));
  }
  async function run(action: PageHeaderMenuAction) {
    try {
      const text = await action.onSelect();
      if (text) onResult(text, "success");
    } catch (error) {
      onResult(error instanceof Error ? error.message : "No se pudo completar la acción.", "error");
    }
  }
  return <DropdownPrimitive.Root onOpenChange={open => { if (open) { window.clearTimeout(clearTimer.current); setHighlight(null); } }}>
    <DropdownPrimitive.Trigger asChild><Button variant="secondary" size="sm" className={styles.iconButton} aria-label="Más acciones"><Ellipsis size={17} strokeWidth={1.75} aria-hidden="true" /></Button></DropdownPrimitive.Trigger>
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={12} loop onFocus={onFocus} onPointerMoveCapture={() => { pointer.current = true; }} onKeyDownCapture={() => { pointer.current = false; }}>
        <motion.span className={styles.highlight} aria-hidden="true" initial={false} animate={highlight ? { y: highlight.top, height: highlight.height, opacity: 1 } : { opacity: 0 }} transition={{ default: highlight?.glide && !reduce ? motionTokens.spring.snappy : still, opacity: { duration: reduce ? 0 : .08 } }} />
        {actions.map(action => <Fragment key={action.key}>
          {action.separatorBefore && <DropdownPrimitive.Separator className={styles.separator} />}
          <DropdownPrimitive.Item className={styles.item} onSelect={() => void run(action)}>{action.icon}{action.label}</DropdownPrimitive.Item>
        </Fragment>)}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  </DropdownPrimitive.Root>;
}

const milestoneIcons = { done: CircleCheck, active: CircleDashed, planned: Circle };
export type OverviewMilestone = { key: string; name: string; note: string; state: keyof typeof milestoneIcons };
export type OverviewActivity = { key: string; who: string; text: string; time: string };

export interface PageHeaderOverviewProps {
  progress: { value: number; max: number; label: string };
  milestonesTitle: string;
  milestones: OverviewMilestone[];
  activity?: { title: string; items: OverviewActivity[]; empty: string };
}

/** The overview panel of the block: progress, a short list of states, and recent activity. */
export function PageHeaderOverview({ progress, milestonesTitle, milestones, activity }: PageHeaderOverviewProps) {
  return <div className={styles.overview}>
    <div className={styles.progress}><Progress value={progress.value} max={progress.max} label={progress.label} showValue /></div>
    <div>
      <h3 className={styles.sectionTitle}>{milestonesTitle}</h3>
      <ol className={styles.milestones}>{milestones.map(item => {
        const Icon = milestoneIcons[item.state];
        return <li key={item.key} data-state={item.state}><Icon size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.milestoneName}>{item.name}</span><span className={styles.note}>{item.note}</span></li>;
      })}</ol>
    </div>
    {activity && <div>
      <h3 className={styles.sectionTitle}>{activity.title}</h3>
      {activity.items.length === 0
        ? <p className={styles.note}>{activity.empty}</p>
        : <ul className={styles.activity}>{activity.items.map(item => <li key={item.key}><Avatar name={item.who} size="sm" /><p><strong>{item.who}</strong> {item.text}</p><span className={styles.note}>{item.time}</span></li>)}</ul>}
    </div>}
  </div>;
}

export function PageHeader({ crumbs, title, description, status, meta = [], sections, primaryAction, menuActions = [], trailing }: PageHeaderProps) {
  const id = useId();
  const reduce = useReducedMotion() ?? false;
  const scroller = useRef<HTMLDivElement>(null);
  const tabList = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const noticeCount = useRef(0);
  const first = sections[0]?.value ?? "";
  const [view, setView] = useState<{ section: string; direction: number }>({ section: first, direction: 1 });
  const [condensed, setCondensed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const order = (value: string) => sections.findIndex(item => item.value === value);
  const active = sections.find(item => item.value === view.section) ?? sections[0];

  useEffect(() => {
    if (!notice) return;
    const handle = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(handle);
  }, [notice]);

  // Keep the chosen tab in view when the list scrolls sideways on narrow screens.
  useEffect(() => {
    const list = tabList.current;
    const tab = list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (!list || !tab) return;
    const start = tab.offsetLeft - 12;
    const end = tab.offsetLeft + tab.offsetWidth + 12 - list.clientWidth;
    const behavior = reduce ? "auto" : "smooth";
    if (list.scrollLeft > start) list.scrollTo({ left: start, behavior });
    else if (list.scrollLeft < end) list.scrollTo({ left: end, behavior });
  }, [view.section, reduce]);

  function notify(text: string, tone: Notice["tone"]) {
    noticeCount.current += 1;
    setNotice({ key: noticeCount.current, text, tone });
  }

  /** Switching sections while condensed shows the top of the new panel and keeps the compact bar. */
  function selectSection(next: string) {
    setView(current => current.section === next ? current : { section: next, direction: order(next) > order(current.section) ? 1 : -1 });
    const node = scroller.current;
    if (node && next !== view.section && node.scrollTop > CONDENSE_AT + 1) node.scrollTop = CONDENSE_AT + 1;
  }

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const top = event.currentTarget.scrollTop;
    setCondensed(current => (current ? top > EXPAND_AT : top > CONDENSE_AT));
  }

  function backToTop() {
    scroller.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    titleRef.current?.focus({ preventScroll: true });
  }

  /** Leaving copy fades fast; arriving copy settles on the smooth spring with a short blur. */
  const swap = (entering: boolean): Transition => reduce ? still : { ...motionTokens.spring.smooth, opacity: { duration: entering ? motionTokens.duration.standard : motionTokens.duration.fast, ease: [...motionTokens.ease.standard], delay: entering ? .05 : 0 }, filter: { duration: entering ? motionTokens.duration.standard : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } };
  const shown = { opacity: 1, y: 0, scale: 1, filter: blur(0) };

  return (
    <TabsPrimitive.Root asChild value={active?.value ?? first} onValueChange={selectSection}>
      <section className={styles.frame} aria-labelledby={`${id}-title`} data-measured>
        <header className={styles.header}>
          <div className={styles.bar}>
            <div className={styles.lead}>
              <motion.nav className={styles.crumbs} aria-label="Ruta" inert={condensed} initial={false} animate={condensed ? { opacity: 0, y: -8, filter: blur(motionTokens.blur.subtle) } : shown} transition={swap(!condensed)}>
                <ol>
                  {crumbs.map((crumb, index) => <li key={crumb} className={index === 0 && crumbs.length > 1 ? styles.rootCrumb : undefined}><span>{crumb}</span><ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" /></li>)}
                  <li><span className={styles.current} aria-current="page">{title}</span></li>
                </ol>
              </motion.nav>
              <motion.button type="button" className={styles.compact} inert={!condensed} aria-label={`${title}, volver arriba`} onClick={backToTop} initial={false} animate={condensed ? shown : { opacity: 0, y: 14, filter: blur(motionTokens.blur.soft) }} transition={swap(condensed)}>
                <span className={styles.compactTitle}>{title}</span>
                {status && <Badge className={styles.compactBadge} size="sm" tone={status.tone} icon={<StatusDot />}>{status.label}</Badge>}
              </motion.button>
            </div>

            <div className={styles.actions}>
              <div className={styles.trailing}>
                {menuActions.length > 0 && <OverflowMenu actions={menuActions} reduce={reduce} onResult={notify} />}
                {primaryAction && <Button className={styles.create} size="sm" aria-label={primaryAction.label} onClick={primaryAction.onClick}>{primaryAction.icon}<span className={styles.createText}>{primaryAction.label}</span></Button>}
                {trailing}
              </div>
            </div>
          </div>

          <motion.div className={styles.intro} initial={false} animate={{ height: condensed ? 0 : "auto" }} transition={reduce ? still : motionTokens.spring.smooth}>
            <div className={styles.introInner}>
              <motion.div className={styles.titleRow} initial={false} animate={condensed ? { opacity: 0, y: -10, scale: .62, filter: blur(motionTokens.blur.subtle) } : shown} transition={swap(!condensed)}>
                <h1 ref={titleRef} id={`${id}-title`} className={styles.title} tabIndex={-1}>{title}</h1>
                {status && <Badge tone={status.tone} icon={<StatusDot />}>{status.label}</Badge>}
              </motion.div>
              {(description || meta.length > 0) && <motion.div className={styles.details} initial={false} animate={condensed ? { opacity: 0, y: -6 } : { opacity: 1, y: 0 }} transition={swap(!condensed)}>
                {description && <p className={styles.description}>{description}</p>}
                {meta.length > 0 && <div className={styles.meta}>{meta.map((item, index) => <span key={index} className={styles.metaIcon}>{item}</span>)}</div>}
              </motion.div>}
            </div>
          </motion.div>

          <LayoutGroup id={id}>
            <TabsPrimitive.List asChild aria-label="Secciones">
              <motion.div ref={tabList} layoutScroll className={styles.tabs}>
                {sections.map(item => <TabsPrimitive.Trigger key={item.value} value={item.value} className={styles.tab}>
                  <span className={styles.tabLabel}>{item.label}</span>
                  {item.count !== undefined && <span className={styles.count}><AnimatedCounter value={item.count} /></span>}
                  {active?.value === item.value && <motion.span className={styles.indicator} layoutId="indicator" layoutDependency={active.value} transition={reduce ? still : motionTokens.spring.morph} aria-hidden="true" />}
                </TabsPrimitive.Trigger>)}
              </motion.div>
            </TabsPrimitive.List>
          </LayoutGroup>
        </header>

        <div ref={scroller} className={styles.scroller} onScroll={onScroll}>
          <AnimatePresence initial={false} mode="popLayout" custom={view.direction}>
            {active && <TabsPrimitive.Content key={active.value} value={active.value} forceMount asChild>
              <motion.div className={styles.panel} custom={view.direction} variants={reduce ? panelFade : panelSlide} initial="enter" animate="center" exit="exit">
                {active.content}
              </motion.div>
            </TabsPrimitive.Content>}
          </AnimatePresence>
        </div>

        <div className={styles.toastLayer} aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {notice && <motion.div key={notice.key} className={styles.toast} data-tone={notice.tone} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: blur(motionTokens.blur.soft) }} animate={{ opacity: 1, y: 0, filter: blur(0) }} exit={reduce ? { opacity: 0, transition: still } : { opacity: 0, y: 8, filter: blur(motionTokens.blur.subtle), transition: quick }} transition={reduce ? { duration: motionTokens.duration.instant } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }, filter: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }}>
              {notice.tone === "success" ? <Check {...icon} /> : notice.tone === "error" ? <CircleAlert {...icon} /> : null}
              <span>{notice.text}</span>
            </motion.div>}
          </AnimatePresence>
        </div>
        <p className={styles.srOnly} role="status" aria-live="polite">{notice?.text}</p>
      </section>
    </TabsPrimitive.Root>
  );
}

export default PageHeader;
