import type { Metadata } from "next";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { Alert } from "@/components/arc/alert/alert";
import { RequestForm } from "@/components/intake/request-form";
import { isAllowedEmail } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default function SolicitarPage() {
  return (
    <main className="page">
      <header className={styles.header}>
        <h1>Nueva solicitud</h1>
        <p>Elige el área y completa el brief. Llega directo al tablero del equipo en monday con su fecha estimada.</p>
      </header>
      <Suspense>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!user || !email || !isAllowedEmail(email)) {
    return (
      <Alert tone="warning" title="Tu cuenta no tiene acceso">
        Entra con tu correo corporativo. Si ya lo usas, pide acceso al equipo de marketing.
      </Alert>
    );
  }
  return <RequestForm requester={user.fullName?.trim() || email} today={todayIn()} />;
}
