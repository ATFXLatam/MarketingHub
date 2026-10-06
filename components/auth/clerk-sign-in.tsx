"use client";

import { useRef } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { SignIn, type SignInAccount } from "@/components/arc/blocks/sign-in/sign-in";
import { safeDestination } from "@/lib/auth/destination";

type ClerkResult = { error: { code: string; message: string; longMessage?: string } | null };

function raise(result: ClerkResult): void {
  if (result.error) throw new Error(result.error.longMessage ?? result.error.message);
}

function nameFrom(email: string): string {
  const parts = email.split("@")[0].split(/[._+-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ") || email;
}

/** Email code sign-in on Clerk's custom flow API: an unknown address signs up with the same code step. */
export function ClerkSignIn() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const params = useSearchParams();
  const mode = useRef<"signIn" | "signUp">("signIn");
  const email = useRef("");

  async function sendCode(address: string) {
    if (!signIn || !signUp) throw new Error("El inicio de sesión todavía está cargando. Intenta en un momento.");
    email.current = address;
    const sent = await signIn.emailCode.sendCode({ emailAddress: address });
    if (!sent.error) {
      mode.current = "signIn";
      return;
    }
    if (sent.error.code !== "form_identifier_not_found") raise(sent);
    raise(await signUp.create({ emailAddress: address }));
    raise(await signUp.verifications.sendEmailCode());
    mode.current = "signUp";
  }

  async function verifyCode(code: string): Promise<SignInAccount> {
    if (!signIn || !signUp) throw new Error("El inicio de sesión todavía está cargando. Intenta en un momento.");
    if (mode.current === "signIn") {
      raise(await signIn.emailCode.verifyCode({ code }));
      if (signIn.status !== "complete") throw new Error("Tu cuenta pide un paso más. Escríbele al equipo de marketing.");
      raise(await signIn.finalize());
    } else {
      raise(await signUp.verifications.verifyEmailCode({ code }));
      if (signUp.status !== "complete") throw new Error("Falta completar tu registro. Escríbele al equipo de marketing.");
      raise(await signUp.finalize());
    }
    return { name: nameFrom(email.current), email: email.current };
  }

  return (
    <SignIn
      title="Marketing LATAM"
      subtitle="Entra con tu correo de ATFX y te enviamos un código de 6 dígitos."
      onSendCode={sendCode}
      onVerifyCode={verifyCode}
      onDone={() => router.replace(safeDestination(params.get("redirect_url"), window.location.origin))}
    />
  );
}
