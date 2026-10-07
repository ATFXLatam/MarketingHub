import type { Metadata } from "next";
import { Suspense } from "react";
import { MondaySignIn } from "@/components/auth/monday-sign-in";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <main>
      <Suspense>
        <MondaySignIn />
      </Suspense>
    </main>
  );
}
