"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { CommentThread, type ThreadComment } from "@/components/arc/comment-thread/comment-thread";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { getConversation, postComment, type Viewer } from "@/app/actions/conversation";
import { TEAM_TIME_ZONE } from "@/lib/dates";
import type { ConversationComment } from "@/lib/conversation";
import styles from "./task-drawer.module.css";

const WHEN = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TEAM_TIME_ZONE });

const LABELS = {
  thread: "Request comments",
  commentCount: (count: number) => `${count} ${count === 1 ? "comment" : "comments"} in monday`,
  peopleCount: (count: number) => `${count} ${count === 1 ? "person" : "people"}`,
  empty: "No comments yet. Write the first one.",
  reply: "Reply",
  cancel: "Cancel",
  send: "Send",
  replyingTo: (name: string) => `Replying to ${name}`,
  cancelReply: "Cancel reply",
  showReplies: (count: number) => `Show ${count} ${count === 1 ? "reply" : "replies"}`,
  hideReplies: "Hide replies",
  mentions: "People",
};

const toThread = (comment: ConversationComment): ThreadComment => ({
  id: comment.id,
  author: { id: comment.author.id, name: comment.author.name, avatar: comment.author.photo ?? undefined },
  body: comment.body,
  createdAt: WHEN.format(new Date(comment.createdAt)),
  replies: comment.replies.map(toThread),
});

type State =
  | { status: "loading" }
  | { status: "error"; error: string; signIn?: boolean }
  | { status: "ready"; brief: string | null; comments: ThreadComment[]; viewer: Viewer };

/** The brief and the monday updates of one request, read and answered from the drawer. */
export function TaskConversation({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getConversation(taskId)
      .then((result) => {
        if (!live) return;
        setState(result.success
          ? { status: "ready", brief: result.data.conversation.brief, comments: result.data.conversation.comments.map(toThread), viewer: result.data.viewer }
          : { status: "error", error: result.error, signIn: result.signIn });
      })
      .catch(() => live && setState({ status: "error", error: "We could not load the conversation." }));
    return () => {
      live = false;
    };
  }, [taskId, attempt]);

  if (state.status === "loading") return <Skeleton label="Loading the brief and comments" lines={4} />;
  if (state.status === "error") {
    return (
      <Alert tone={state.signIn ? "info" : "warning"} title={state.signIn ? "Brief and comments" : "Could not load"}>
        {state.error}
        <span className={styles.alertAction}>
          {state.signIn
            ? <Button size="sm" variant="secondary" onClick={() => router.push("/")}>Sign in</Button>
            : <Button size="sm" variant="secondary" onClick={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }}>Try again</Button>}
        </span>
      </Alert>
    );
  }

  const { brief, comments, viewer } = state;
  return (
    <>
      <section className={styles.section} aria-labelledby={`${taskId}-brief`}>
        <h3 id={`${taskId}-brief`}>Description</h3>
        {brief ? <p className={styles.brief}>{brief}</p> : <p className={styles.muted}>No brief in monday.</p>}
      </section>
      <CommentThread
        title="Comments"
        currentUser={{ id: viewer.id, name: viewer.name, avatar: viewer.photo ?? undefined }}
        comments={comments}
        maxDepth={1}
        allowReactions={false}
        allowEdit={false}
        allowResolve={false}
        placeholder="Write a comment for the team"
        nowLabel="Now"
        labels={LABELS}
        notice={notice && <p className={styles.notice} role="alert">{notice}</p>}
        onCommentsChange={(next, event) => {
          if (event.type !== "reply") return;
          const previous = comments;
          setNotice(null);
          setState({ ...state, comments: next });
          postComment({ itemId: taskId, parentId: event.parentId, body: event.comment.body, idempotencyKey: crypto.randomUUID() })
            .then((result) => {
              if (result.success) {
                // The thread made up an id; replies must point at monday's, or the server rejects them as unknown.
                const swap = (list: ThreadComment[]): ThreadComment[] =>
                  list.map((comment) => (comment.id === event.comment.id ? { ...comment, id: result.data.id } : { ...comment, replies: comment.replies && swap(comment.replies) }));
                setState((current) => (current.status === "ready" ? { ...current, comments: swap(current.comments) } : current));
                return;
              }
              setState((current) => (current.status === "ready" ? { ...current, comments: previous } : current));
              setNotice(result.error);
            })
            .catch(() => {
              setState((current) => (current.status === "ready" ? { ...current, comments: previous } : current));
              setNotice("The comment was not sent. Try again.");
            });
        }}
      />
    </>
  );
}
