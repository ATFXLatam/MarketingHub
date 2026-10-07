import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { allowedEmail } from "@/lib/access";
import styles from "./layout.module.css";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className={styles.center}><Skeleton label="Cargando" lines={4} /></div>}>
      <ClerkProvider signInUrl="/sign-in">
        <Gate>{children}</Gate>
      </ClerkProvider>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user || !allowedEmail(user)) {
    return (
      <div className={styles.center}>
        <Alert tone="warning" title="Tu cuenta no tiene acceso">
          Entra con tu correo corporativo de ATFX. Si ya lo usas, pide acceso al equipo de marketing.
        </Alert>
      </div>
    );
  }
  return children;
}
