"use client";

import { useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { LoginSplit } from "@/components/arc/blocks/login-split/login-split";
import { signInMessage } from "@/lib/access";
import { AtfxLogo } from "./atfx-logo";
import { MondayMark } from "./monday-mark";
import styles from "./monday-sign-in.module.css";

/** One door: the person's monday user. Who they are and what they may see both come from monday. */
export function MondaySignIn() {
  const params = useSearchParams();
  const next = params.get("redirect_url");
  const error = signInMessage(params.get("error"));
  const still = !!useReducedMotion();
  return (
    <LoginSplit
      fullScreen
      brand={
        <>
          <AtfxLogo />
          <span className={styles.brandName}>Marketing LATAM</span>
        </>
      }
      title="Entra con monday"
      subtitle="Usa tu usuario de monday de ATFX. Si ves el tablero de solicitudes en monday, aquí también lo verás."
      provider={{ label: "Entrar con monday", icon: <MondayMark />, href: "/api/monday/oauth/start", params: next ? { redirect_url: next } : undefined, error }}
      aside={
        <div className={styles.aside}>
          {/* Decorative: muted, no controls, and still for people who ask the system for less motion. */}
          <video key={still ? "still" : "live"} className={styles.media} src="/brand/login-mercado.mp4" poster="/brand/login-mercado.jpg" autoPlay={!still} loop muted playsInline preload="metadata" aria-hidden="true" />
          <span className={styles.overlay} aria-hidden="true" />
          <div className={styles.copy}>
          <p className={styles.lead}>Pide una pieza, sigue cómo avanza y recíbela en la fecha que viste al pedirla.</p>
          <ul className={styles.points}>
            <li>La fecha estimada sale de qué tan completo está tu brief.</li>
            <li>Quien ve el tablero en monday ve aquí quién trabaja en qué.</li>
            <li>Comentas como tú mismo: lo que escribes llega a monday con tu nombre.</li>
          </ul>
          </div>
        </div>
      }
    />
  );
}
