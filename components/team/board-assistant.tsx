"use client";

import { Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { AiSidePanel, type Milestone, type PlanPage, type ScriptedAnswer } from "@/components/arc/blocks/ai-side-panel/ai-side-panel";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { askBoard } from "@/app/actions/assistant";
import { AREA_LABEL } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import type { PublicOwner, PublicTask } from "@/lib/public-dto";
import { teamMembers } from "@/lib/team";
import styles from "./board-assistant.module.css";

const SHOWN = 20;
const PROMPTS = ["Who is most loaded this week?", "What is overdue and who owns it?", "Summarize the board for the leadership team"];

const toOwner = (owner?: PublicOwner) => (owner ? { name: owner.name, avatar: owner.photo ?? undefined } : undefined);

function statusOf(task: PublicTask, today: string): Milestone["status"] {
  if (task.stage === "hecha") return "Done";
  if (task.stage === "on-hold" || (task.dueDate && task.dueDate < today)) return "At risk";
  if (task.stage === "en-curso") return "In progress";
  return "Not started";
}

/** The board as the block's page: open requests by due date, overdue first, so the chips the person picks are real tasks. */
function planFrom(tasks: PublicTask[], roster: PublicOwner[], today: string): PlanPage {
  const open = tasks.filter((task) => task.stage !== "hecha").sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const overdue = open.filter((task) => task.dueDate && task.dueDate < today).length;
  const next = open.find((task) => task.dueDate && task.dueDate >= today);
  const [busiest] = teamMembers(tasks, roster);
  return {
    title: "Delivery plan",
    project: "Marketing LATAM",
    status: overdue ? "At risk" : "On track",
    target: next?.dueDate ? formatDay(next.dueDate) : "No date",
    lead: busiest ? { name: busiest.name, avatar: busiest.photo ?? undefined } : { name: "No one yet" },
    intro: `${open.length} open requests across Web, Video, Events and Design. ${overdue ? `${overdue} are past their due date.` : "Nothing is overdue."} Pick a request to ask about it.`,
    milestones: open.slice(0, SHOWN).map((task) => ({
      id: task.id,
      name: task.area ? `${task.title} · ${AREA_LABEL[task.area]}` : task.title,
      owner: toOwner(task.owners[0]),
      due: task.dueDate ? formatDay(task.dueDate) : "No date",
      status: statusOf(task, today),
    })),
    notes: [],
  };
}

async function ask(question: string, focus: string[]): Promise<ScriptedAnswer> {
  try {
    const result = await askBoard({ question, focus });
    return { text: result.success ? result.data.text : result.error, actions: [] };
  } catch {
    return { text: "monday AI did not answer. Try again.", actions: [] };
  }
}

export interface BoardAssistantProps {
  tasks: PublicTask[];
  roster: PublicOwner[];
  today: string;
}

/** Ask AI over the board: monday's own model answers from the same data the page shows, and never changes the board. */
export function BoardAssistant({ tasks, roster, today }: BoardAssistantProps) {
  const [open, setOpen] = useState(false);
  const reduced = !!useReducedMotion();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j" && !open) { event.preventDefault(); setOpen(true); }
      else if (event.key === "Escape" && open && !event.defaultPrevented) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-keyshortcuts="Meta+J Control+J">
        <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
        Ask AI
      </Button>
      <AnimatePresence>
      {open && (
        <motion.div
          key="assistant"
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Board assistant"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter } }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit, ease: motionTokens.ease.exit } }}
        >
          {/* The page rises out of a slight blur while the backdrop fades, so the board recedes instead of being swapped out. */}
          <motion.div
            className={styles.stage}
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.98, filter: `blur(${motionTokens.blur.soft}px)` }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter } } }}
            exit={reduced ? undefined : { opacity: 0, y: 8, scale: 0.985, transition: { duration: motionTokens.duration.exit, ease: motionTokens.ease.exit } }}
          >
          <AiSidePanel
            className={styles.frame}
            defaultPage={planFrom(tasks, roster, today)}
            onAsk={(question, context) => ask(question, context)}
            prompts={PROMPTS}
            assistantName="Ask the board"
            welcomeText="I read the requests board with monday AI. I answer about load, due dates and owners, and I never change the board."
            hint="Answers by monday AI"
            onExit={() => setOpen(false)}
            labels={{ lead: "Most loaded", target: "Next delivery", items: "Open requests", item: "Request" }}
          />
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
