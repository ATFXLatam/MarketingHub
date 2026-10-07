import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkSignIn } from "@/components/auth/clerk-sign-in";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <main>
      <Suspense>
        <ClerkProvider signInUrl="/sign-in">
          <ClerkSignIn />
        </ClerkProvider>
      </Suspense>
    </main>
  );
}
