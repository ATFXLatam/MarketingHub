"use client";

import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion, type Transition, type Variants } from "motion/react";
import { Check } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { Input } from "../../input/input";
import { OtpInput } from "../../otp-input/otp-input";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./sign-in.module.css";

/**
 * Arc sign-in block, adapted: the email and code steps call the auth provider through props instead of simulating it,
 * and the passkey and single sign-on options are gone because the app signs in with an email code only.
 */
type Step = "email" | "code" | "done";
type StepCustom = { direction: number; reduce: boolean; still?: boolean };

export interface SignInAccount { name: string; email: string; photo?: string }
export interface SignInProps {
  title: string;
  subtitle: string;
  /** Sends the code; reject with an Error whose message is shown under the field. */
  onSendCode: (email: string) => Promise<void>;
  /** Checks the code and resolves with the signed-in account; reject with a readable Error otherwise. */
  onVerifyCode: (code: string) => Promise<SignInAccount>;
  /** Called after the welcome step has shown, to move on into the app. */
  onDone?: (account: SignInAccount) => void;
}

const RESEND_SECONDS = 30;
const DONE_PAUSE_MS = 1400;
const domainFixes: Record<string, string> = { "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmai.com": "gmail.com", "gnail.com": "gmail.com", "gmail.co": "gmail.com", "hotmial.com": "hotmail.com", "outlok.com": "outlook.com", "outlook.co": "outlook.com", "iclod.com": "icloud.com", "icoud.com": "icloud.com", "yaho.com": "yahoo.com" };

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
function suggestionFor(value: string) {
  const [local, domain, extra] = value.trim().toLowerCase().split("@");
  return local && domain && extra === undefined && domainFixes[domain] ? `${local}@${domainFixes[domain]}` : "";
}
/** A provisional name from the address, shown on the code step until the provider returns the real one. */
function accountFor(value: string): SignInAccount {
  const email = value.trim().toLowerCase();
  const parts = email.split("@")[0].split(/[._+-]+/).filter(Boolean);
  return { name: parts.slice(0, 2).map(part => part[0].toUpperCase() + part.slice(1)).join(" ") || email, email };
}
const messageOf = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

const stepMotion: Variants = {
  enter: ({ direction, reduce, still }: StepCustom) => still ? { opacity: 1, x: 0, filter: "blur(0px)" } : reduce ? { opacity: 0 } : { opacity: 0, x: direction * 28, filter: `blur(${motionTokens.blur.soft}px)` },
  center: ({ reduce }: StepCustom) => ({ opacity: 1, x: 0, filter: "blur(0px)", transition: reduce ? { duration: motionTokens.duration.instant } : { x: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter, delay: .05 }, filter: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter } } }),
  exit: ({ direction, reduce }: StepCustom) => reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: direction * -20, filter: `blur(${motionTokens.blur.soft}px)`, transition: { x: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard }, filter: { duration: motionTokens.duration.exit } } },
};
/** Seconds roll down while the timer runs and back up when a new code restarts it. */
const roll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${-0.7 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (direction: number) => ({ opacity: 0, y: `${0.7 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
};

function RollingTime({ seconds, reduce }: { seconds: number; reduce: boolean }) {
  const [shown, setShown] = useState({ seconds, direction: 1 });
  if (shown.seconds !== seconds) setShown({ seconds, direction: seconds < shown.seconds ? 1 : -1 });
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const transition: Transition = reduce ? { duration: 0 } : { y: motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast }, filter: { duration: motionTokens.duration.fast } };
  return <span className={styles.time}>{text.split("").map((character, index) => <span key={index} className={styles.timeColumn}>
    <AnimatePresence initial={false} mode="popLayout" custom={shown.direction}><motion.span key={character} custom={shown.direction} variants={roll} initial="enter" animate="center" exit="exit" transition={transition}>{character}</motion.span></AnimatePresence>
  </span>)}</span>;
}

/** The card follows its content on a spring only while the step changes; otherwise it stays auto, so field messages open without lag. */
function useStepHeight(step: Step, reduce: boolean) {
  const track = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  const measured = useRef(0);
  const gliding = useRef(false);
  const lastStep = useRef(step);
  const glide = useCallback((to: number) => {
    gliding.current = true;
    animate(height, to, { ...motionTokens.spring.smooth, onComplete: () => { gliding.current = false; height.jump("auto"); } });
  }, [height]);
  useEffect(() => {
    const node = track.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      measured.current = entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight;
      if (gliding.current) glide(measured.current);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [glide]);
  useLayoutEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    const current = height.get();
    const from = typeof current === "number" ? current : measured.current;
    const to = track.current?.offsetHeight ?? 0;
    if (reduce || !from || !to) { gliding.current = false; height.jump("auto"); return; }
    if (current === "auto") height.jump(from);
    glide(to);
  }, [step, reduce, height, glide]);
  return { track, height };
}

export function SignIn({ title, subtitle, onSendCode, onVerifyCode, onDone }: SignInProps) {
  const id = useId();
  const reduce = !!useReducedMotion();
  const [step, setStep] = useState<Step>("email");
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [sendError, setSendError] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState<null | "email" | "code">(null);
  const [account, setAccount] = useState<SignInAccount>({ name: "", email: "" });
  const [status, setStatus] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<"email" | "done" | null>(null);
  const { track, height } = useStepHeight(step, reduce);

  const formatError = (touched || attempted) && !isEmail(email) ? (email.trim() ? "Escribe el correo completo, como nombre@empresa.com." : "Escribe tu correo.") : "";
  const emailError = formatError || sendError;
  const suggestion = touched || attempted ? suggestionFor(email) : "";
  const custom: StepCustom = { direction, reduce };
  const avatarTransition: Transition = reduce ? { duration: 0 } : motionTokens.spring.morph;
  const rise = (index: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: `blur(${motionTokens.blur.soft}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: (reduce ? { duration: motionTokens.duration.instant } : { y: { ...motionTokens.spring.smooth, delay: .14 + index * motionTokens.stagger.line }, opacity: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter, delay: .14 + index * motionTokens.stagger.line }, filter: { duration: motionTokens.duration.standard, delay: .14 + index * motionTokens.stagger.line } }) as Transition,
  });

  useEffect(() => {
    if (step !== "code" || resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [step, resendIn]);
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "email") { emailRef.current?.focus(); emailRef.current?.select(); }
    if (target === "done") doneRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (step !== "done") return;
    const timer = window.setTimeout(() => onDone?.(account), DONE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [step, account, onDone]);

  function go(next: Step, towards: number, focus: "email" | "done" | null = null) { focusNext.current = focus; setDirection(towards); setStep(next); }
  const focusCode = () => codeRef.current?.querySelector("input")?.focus();

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setAttempted(true);
    setSendError("");
    if (!isEmail(email)) { emailRef.current?.focus(); return; }
    setBusy("email");
    setStatus("Enviando el código");
    try {
      await onSendCode(email.trim());
      setAccount(accountFor(email));
      setCode("");
      setCodeError("");
      setResendIn(RESEND_SECONDS);
      go("code", 1);
      setStatus("Código enviado");
    } catch (error) {
      setSendError(messageOf(error, "No pudimos enviar el código. Intenta de nuevo."));
      setStatus("No se envió el código");
      emailRef.current?.focus();
    } finally {
      setBusy(null);
    }
  }

  function applySuggestion() {
    setEmail(suggestion);
    setStatus(`Correo cambiado a ${suggestion}`);
    emailRef.current?.focus();
  }

  async function verify(value: string) {
    if (busy) return;
    if (value.length < 6) { setCodeError("Escribe los 6 dígitos."); focusCode(); return; }
    setBusy("code");
    setStatus("Revisando el código");
    try {
      const signedIn = await onVerifyCode(value);
      setAccount(signedIn);
      go("done", 1, "done");
      setStatus("Sesión iniciada");
    } catch (error) {
      setCode("");
      setCodeError(messageOf(error, "El código no coincide. Revisa el último correo e intenta de nuevo."));
      setStatus("El código no coincide");
      focusCode();
    } finally {
      setBusy(null);
    }
  }

  function changeCode(value: string) {
    if (busy) return;
    setCode(value);
    if (codeError && value) setCodeError("");
    if (value.length === 6) void verify(value);
  }

  async function resend() {
    if (busy || resendIn > 0) return;
    setResendIn(RESEND_SECONDS);
    setCode("");
    setCodeError("");
    try {
      await onSendCode(account.email);
      setStatus("Enviamos un código nuevo");
    } catch (error) {
      setCodeError(messageOf(error, "No pudimos reenviar el código."));
    }
    focusCode();
  }

  function changeEmail() {
    if (busy) return;
    setAttempted(false);
    go("email", -1, "email");
    setStatus("Edita tu correo");
  }

  return (
    <section className={styles.signIn} aria-label="Iniciar sesión">
      <LayoutGroup id={id}>
        <motion.div className={styles.viewport} style={{ height }}>
          <div ref={track} className={styles.track}>
            <AnimatePresence mode="popLayout" initial={false} custom={custom}>
              {step === "email" && <motion.div key="email" className={styles.step} custom={custom} variants={stepMotion} initial="enter" animate="center" exit="exit">
                <div className={styles.heading}><h2>{title}</h2><p>{subtitle}</p></div>
                <form className={styles.form} onSubmit={submitEmail} noValidate>
                  <div className={styles.fieldGroup}>
                    <Input ref={emailRef} label="Correo" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="nombre@atfxgm.com" value={email} readOnly={busy === "email"} error={emailError} onChange={event => { setEmail(event.target.value); if (sendError) setSendError(""); }} onBlur={() => { if (email.trim()) setTouched(true); }} />
                    <AnimatePresence initial={false}>
                      {suggestion && <motion.div key="suggestion" className={styles.suggestion} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}>
                        <p>¿Quisiste decir <button type="button" className={styles.textButton} aria-label={`Usar ${suggestion}`} onClick={applySuggestion}>{suggestion}</button>?</p>
                      </motion.div>}
                    </AnimatePresence>
                  </div>
                  <Button type="submit" className={styles.wide} loading={busy === "email"}>Continuar</Button>
                </form>
              </motion.div>}

              {step === "code" && <motion.div key="code" className={styles.step} custom={custom} variants={stepMotion} initial="enter" animate="center" exit="exit">
                <div className={styles.heading}><h2>Revisa tu correo</h2><p>Escribe el código de 6 dígitos que te enviamos. Vence en 10 minutos.</p></div>
                <div className={styles.identity}>
                  <motion.span layoutId="account-avatar" className={`${styles.avatarMover} ${styles.avatarSmall}`} transition={avatarTransition}><Avatar name={account.name} src={account.photo} size="xl" className={styles.avatarFill} /></motion.span>
                  <span className={styles.identityEmail}>{account.email}</span>
                  <Button type="button" variant="ghost" size="sm" aria-label="Cambiar correo" onClick={changeEmail}>Cambiar</Button>
                </div>
                <form className={styles.form} onSubmit={event => { event.preventDefault(); void verify(code); }} noValidate>
                  <div ref={codeRef}><OtpInput label="Código de verificación" value={code} onChange={changeCode} error={codeError} autoFocus /></div>
                  <Button type="submit" className={styles.wide} loading={busy === "code"}>Verificar</Button>
                </form>
                <button type="button" className={styles.resend} aria-disabled={resendIn > 0 || undefined} aria-label={resendIn > 0 ? `Reenviar código, disponible en ${resendIn} segundos` : "Reenviar código"} onClick={() => void resend()}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={resendIn > 0 ? "wait" : "ready"} className={styles.resendLabel} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast } }} transition={reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }}>
                      {resendIn > 0 ? <>Reenviar código en <RollingTime seconds={resendIn} reduce={reduce} /></> : "Reenviar código"}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </motion.div>}

              {step === "done" && <motion.div key="done" className={styles.step} custom={{ ...custom, still: true }} variants={stepMotion} initial="enter" animate="center" exit="exit">
                <div className={styles.avatarStage}>
                  <svg className={styles.ring} viewBox="0 0 96 96" aria-hidden="true"><motion.circle cx="48" cy="48" r="47" fill="none" stroke="currentColor" strokeWidth="1.5" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ pathLength: { duration: motionTokens.duration.considered * 1.25, ease: motionTokens.ease.inOut, delay: .22 }, opacity: { duration: motionTokens.duration.instant, delay: .22 } }} /></svg>
                  <motion.span layoutId="account-avatar" className={`${styles.avatarMover} ${styles.avatarLarge}`} initial={false} animate={{ opacity: 1, scale: 1 }} transition={avatarTransition}><Avatar name={account.name} src={account.photo} size="xl" className={styles.avatarFill} /></motion.span>
                  <motion.span className={styles.badge} aria-hidden="true" initial={reduce ? false : { opacity: 0, scale: .4 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...motionTokens.spring.snappy, delay: .78 }}><Check size={14} strokeWidth={2.25} /></motion.span>
                </div>
                <motion.div className={styles.heading} {...rise(0)}><h2 ref={doneRef} tabIndex={-1}>Hola, {account.name.split(" ")[0]}</h2><p className={styles.email}>{account.email}</p></motion.div>
              </motion.div>}
            </AnimatePresence>
          </div>
        </motion.div>
      </LayoutGroup>

      <footer className={styles.footer}>
        <p className={styles.srOnly} role="status" aria-live="polite">{status}</p>
        <span className={styles.status} aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={status} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast } }} transition={reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }}>{status}</motion.span>
          </AnimatePresence>
        </span>
      </footer>
    </section>
  );
}

export default SignIn;
