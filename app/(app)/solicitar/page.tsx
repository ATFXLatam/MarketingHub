import type { Metadata } from "next";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { RequestForm } from "@/components/intake/request-form";
import { PageTop } from "@/components/theme/page-top";
import { isAllowedEmail } from "@/lib/access";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default function SolicitarPage() {
  return (
    <main className="page">
      <PageTop
        title="Nueva solicitud"
        description="Cuéntanos qué necesitas. Mientras más completo el brief, antes podemos entregarlo."
        showToggle={false}
      />
      <Suspense fallback={<Skeleton label="Cargando el formulario" lines={6} />}>
        <Form />
      </Suspense>
    </main>
  );
}

async function Form() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  // The layout already turns away other accounts; this only covers the page rendering alongside it.
  if (!user || !email || !isAllowedEmail(email)) return null;
  return <RequestForm requester={user.fullName?.trim() || email} today={todayIn()} />;
}
