import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkSignIn } from "@/components/auth/clerk-sign-in";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <main className={styles.center}>
      <Suspense>
        <ClerkProvider signInUrl="/sign-in">
          <ClerkSignIn />
        </ClerkProvider>
      </Suspense>
    </main>
  );
}
