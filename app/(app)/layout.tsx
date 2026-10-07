import { Suspense } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { currentSession } from "@/lib/auth/current";
import styles from "./layout.module.css";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className={styles.center}><Skeleton label="Loading" lines={4} /></div>}>
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
