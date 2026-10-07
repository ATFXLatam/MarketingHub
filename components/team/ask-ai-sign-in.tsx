"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/arc/dialog/dialog";
import { MondayMark } from "@/components/auth/monday-mark";
import styles from "./board-assistant.module.css";

/**
 * Ask AI on the shared board link: the model costs monday AI credits and reads the board, so it answers only people
 * signed in with a monday user that sees the board. Signing in lands them on the dashboard, where the panel lives.
 */
export function AskAiSignIn() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
          Ask AI
        </Button>
      </DialogTrigger>
      <DialogContent title="Sign in to ask the board" description="monday AI answers about load, due dates and owners for people whose monday user can see the requests board.">
        <form action="/api/monday/oauth/start" method="get" className={styles.signIn}>
          <input type="hidden" name="redirect_url" value="/" />
          <Button type="submit">
            <MondayMark />
            Sign in with monday
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
