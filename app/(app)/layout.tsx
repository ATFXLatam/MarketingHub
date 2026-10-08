import { Suspense } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { BoardLoader } from "@/components/shell/board-loader";
import { currentSession } from "@/lib/auth/current";
import styles from "./layout.module.css";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<BoardLoader label="Checking your monday access" />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

// The proxy already sends people without a session to sign-in; this covers a cookie that expired between the two.
async function Gate({ children }: { children: React.ReactNode }) {
  if (!(await currentSession())) {
    return (
      <div className={styles.center}>
        <Alert tone="warning" title="Your session ended">
          Sign in again with your monday user.
        </Alert>
      </div>
    );
  }
  return children;
}
