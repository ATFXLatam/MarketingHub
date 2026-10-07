import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { TeamPage } from "@/components/team/team-page";
import { todayIn } from "@/lib/dates";
import { AskAiSignIn } from "@/components/team/ask-ai-sign-in";
import { RequestButton } from "@/components/team/request-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getBoardSnapshot } from "@/lib/monday/read";
import { safeEqual } from "@/lib/secrets";

// The board is shared by link: anyone with PUBLIC_BOARD_TOKEN sees it, nobody can guess it, and rotating it is an env change.
export function generateStaticParams() {
  return [{ token: process.env.PUBLIC_BOARD_TOKEN ?? "sin-configurar" }];
}

export const metadata: Metadata = {
  title: "Marketing LATAM",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PublicBoardPage({ params }: PageProps<"/p/[token]">) {
  return (
    <Suspense fallback={<Skeleton label="Loading the board" lines={8} />}>
      <Board params={params} />
    </Suspense>
  );
}

async function Board({ params }: Pick<PageProps<"/p/[token]">, "params">) {
  const { token } = await params;
  if (!safeEqual(token, process.env.PUBLIC_BOARD_TOKEN)) notFound();

  const snapshot = await getBoardSnapshot();
  if (!snapshot.configured) {
    return (
      <Alert tone="warning" title="The board is not connected yet">
        Monday access is not configured on the server.
      </Alert>
    );
  }
  // The page prerenders, so "today" comes from the snapshot: due-date counts match the data they describe.
  return <TeamPage tasks={snapshot.tasks} activity={snapshot.activity} roster={snapshot.roster} now={Date.parse(snapshot.fetchedAt)} today={todayIn(undefined, new Date(snapshot.fetchedAt))} actions={<><AskAiSignIn /><RequestButton /><ThemeToggle /></>} />;
}
