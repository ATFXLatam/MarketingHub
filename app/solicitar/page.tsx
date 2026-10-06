import type { Metadata } from "next";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { RequestForm } from "@/components/intake/request-form";
import { isAllowedEmail } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import { PageTop } from "@/components/theme/page-top";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default function SolicitarPage() {
  return (
    <main className="page">
      <PageTop title="Nueva solicitud" />
      <div className="narrow">
        <Suspense fallback={<Skeleton label="Cargando el formulario" lines={6} />}>
          <Gate />
        </Suspense>
      </div>
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
