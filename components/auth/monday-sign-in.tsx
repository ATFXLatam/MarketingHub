"use client";

import { useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { LoginSplit } from "@/components/arc/blocks/login-split/login-split";
import { signInMessage } from "@/lib/access";
import { AtfxLogo } from "@/components/brand/atfx-logo";
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
      title="Sign in with monday"
      subtitle="Use your ATFX monday user. If you can see the requests board in monday, you will see it here too."
      provider={{ label: "Sign in with monday", icon: <MondayMark />, href: "/api/monday/oauth/start", params: next ? { redirect_url: next } : undefined, error }}
      aside={
        <div className={styles.aside}>
          {/* Decorative: muted, no controls, and still for people who ask the system for less motion. */}
          <video key={still ? "still" : "live"} className={styles.media} src="/brand/login-mercado.mp4" poster="/brand/login-mercado.jpg" autoPlay={!still} loop muted playsInline preload="metadata" aria-hidden="true" />
          <span className={styles.overlay} aria-hidden="true" />
          <div className={styles.copy}>
          <p className={styles.lead}>Request a piece, follow its progress and get it on the date you saw when you asked.</p>
          <ul className={styles.points}>
            <li>The estimated date depends on how complete your brief is.</li>
            <li>If you see the board in monday, you see who is working on what here.</li>
            <li>You comment as yourself: what you write reaches monday under your name.</li>
          </ul>
          </div>
        </div>
      }
    />
  );
}
