"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type Transition, type Variants } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { Input } from "../../input/input";
import { OtpInput } from "../../otp-input/otp-input";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./login-split.module.css";

type Step = "email" | "code" | "done";
export interface LoginSplitAccount { name: string; email: string; photo?: string }
export interface LoginSplitProps {
  /** Fill the viewport (100dvh, no frame) when the screen is used as a page. */
  fullScreen?: boolean;
  brand: ReactNode;
  title: string;
  subtitle: string;
  /** Sends a one time code to the address. Throw with a message the person can act on. */
  onSendCode: (email: string) => Promise<void>;
  /** Checks the code and returns who signed in. Throw with a message the person can act on. */
  onVerifyCode: (code: string) => Promise<LoginSplitAccount>;
  /** Runs once the person is signed in, usually to navigate away. */
  onDone?: (account: LoginSplitAccount) => void;
  /** The wide screen half beside the form. */
  aside?: ReactNode;
}
type StepCustom = { direction: number; reduce: boolean };

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : "Algo salió mal. Intenta de nuevo.");

const stepMotion: Variants = {
  enter: ({ direction, reduce }: StepCustom) => reduce ? { opacity: 0 } : { opacity: 0, y: direction * 14, filter: `blur(${motionTokens.blur.soft}px)` },
  center: ({ reduce }: StepCustom) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: reduce ? { duration: motionTokens.duration.instant } : { y: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter, delay: .06 }, filter: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter, delay: .06 } } }),
  exit: ({ direction, reduce }: StepCustom) => reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: direction * -8, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { y: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard }, filter: { duration: motionTokens.duration.exit } } },
};
/** In-place copy changes: the new words rise in, the old ones lift away. */
const swap = (reduce: boolean) => ({
  initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.soft}px)` },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast } },
  transition: (reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }) as Transition,
});
/** Rows that open and close their height on a spring, so nothing below them jumps. */

const roll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${-0.7 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (direction: number) => ({ opacity: 0, y: `${0.7 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
};

/** Each digit rolls down as the countdown runs and back up when a new link restarts it. */
function Countdown({ seconds, reduce }: { seconds: number; reduce: boolean }) {
  const [shown, setShown] = useState({ seconds, direction: 1 });
  if (shown.seconds !== seconds) setShown({ seconds, direction: seconds < shown.seconds ? 1 : -1 });
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const transition: Transition = reduce ? { duration: 0 } : { y: motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast }, filter: { duration: motionTokens.duration.fast } };
  return <span className={styles.time}>{text.split("").map((character, index) => <span key={index} className={styles.timeColumn}>
    <AnimatePresence initial={false} mode="popLayout" custom={shown.direction}><motion.span key={character} custom={shown.direction} variants={roll} initial="enter" animate="center" exit="exit" transition={transition}>{character}</motion.span></AnimatePresence>
  </span>)}</span>;
}

function CheckMark({ reduce }: { reduce: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: motionTokens.duration.considered * .7, ease: motionTokens.ease.enter, delay: .14 }} />
  </svg>;
}

/** The form follows its content on a spring only while the step changes; otherwise it stays auto, so messages open without lag. */
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

export function LoginSplit({ fullScreen = false, brand, title, subtitle, onSendCode, onVerifyCode, onDone, aside }: LoginSplitProps) {
  const reduce = !!useReducedMotion();
  const [step, setStep] = useState<Step>("email");
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [sendError, setSendError] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submit, setSubmit] = useState<"idle" | "checking" | "success">("idle");
  const [resendIn, setResendIn] = useState(0);
  const [account, setAccount] = useState<LoginSplitAccount | null>(null);
  const [status, setStatus] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<"email" | "done" | null>(null);
  const { track, height } = useStepHeight(step, reduce);
  const Heading = fullScreen ? "h1" : "h2";
  const emailError = (touched || attempted) && !isEmail(email) ? (email.trim() ? "Escribe el correo completo, como nombre@atfx.com." : "Escribe tu correo.") : "";
  const custom: StepCustom = { direction, reduce };

  useEffect(() => {
    if (step !== "code" || resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [step, resendIn]);
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "email") { emailRef.current?.focus({ preventScroll: true }); emailRef.current?.select(); }
    if (target === "done") doneRef.current?.focus({ preventScroll: true });
  }, [step]);

  function go(next: Step, towards: number, focus: "email" | "done" | null = null) { focusNext.current = focus; setDirection(towards); setStep(next); }
  function shake() {
    if (reduce || !fieldRef.current) return;
    animate(fieldRef.current, { x: [0, -7, 6, -4, 2, 0] }, { duration: .42, ease: motionTokens.ease.standard });
  }
  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setAttempted(true);
    if (!isEmail(email)) { emailRef.current?.focus(); return; }
    const address = email.trim();
    setBusy(true);
    setSendError("");
    setStatus("Enviando el código");
    try {
      await onSendCode(address);
      setCode("");
      setCodeError("");
      setSubmit("idle");
      setResendIn(RESEND_SECONDS);
      go("code", 1);
      setStatus(`Código enviado a ${address}`);
    } catch (error) {
      setSendError(messageOf(error));
      setStatus("No se pudo enviar el código");
    } finally {
      setBusy(false);
    }
  }
  async function verify(value: string) {
    if (submit !== "idle") return;
    if (value.length < CODE_LENGTH) { setCodeError(`Escribe los ${CODE_LENGTH} dígitos.`); shake(); return; }
    setSubmit("checking");
    setCodeError("");
    setStatus("Revisando el código");
    try {
      const next = await onVerifyCode(value);
      setSubmit("success");
      setAccount(next);
      setStatus(`Entraste como ${next.email}`);
      go("done", 1, "done");
      onDone?.(next);
    } catch (error) {
      setSubmit("idle");
      setCodeError(messageOf(error));
      setStatus("Código incorrecto");
      shake();
    }
  }
  function changeCode(value: string) {
    setCode(value);
    if (codeError) setCodeError("");
    if (value.length === CODE_LENGTH) void verify(value);
  }
  async function resend() {
    if (resendIn > 0 || busy) return;
    setBusy(true);
    try {
      await onSendCode(email.trim());
      setResendIn(RESEND_SECONDS);
      setStatus("Te enviamos un código nuevo");
    } catch (error) {
      setCodeError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }
  function changeEmail() {
    setSubmit("idle");
    setAttempted(false);
    go("email", -1, "email");
    setStatus("Corrige tu correo");
  }

  return (
    <section className={styles.root} data-full-screen={fullScreen || undefined} aria-label={title}>
      <div className={styles.layout}>
        <div className={styles.formSide}>
          <header className={styles.topBar}>
            <span className={styles.brand}>{brand}</span>
          </header>

          <div className={styles.main}>
            <motion.div className={styles.viewport} style={{ height }}>
              <div ref={track} className={styles.track}>
                <AnimatePresence mode="popLayout" initial={false} custom={custom}>
                  {step === "email" && <motion.div key="email" className={styles.step} custom={custom} variants={stepMotion} initial="enter" animate="center" exit="exit">
                    <div className={styles.heading}><Heading>{title}</Heading><p>{subtitle}</p></div>
                    <form className={styles.form} onSubmit={submitEmail} noValidate>
                      <Input ref={emailRef} label="Correo" type="email" name="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="nombre@atfx.com" value={email} readOnly={busy} error={emailError || sendError || undefined} onChange={event => { setEmail(event.target.value); setSendError(""); }} onBlur={() => setTouched(true)} />
                      <Button type="submit" className={styles.wide} loading={busy}>Enviar código</Button>
                    </form>
                  </motion.div>}

                  {step === "code" && <motion.div key="code" className={styles.step} custom={custom} variants={stepMotion} initial="enter" animate="center" exit="exit">
                    <div className={styles.heading}>
                      <Heading>Revisa tu correo</Heading>
                      <button type="button" className={styles.chip} aria-label={`${email.trim()}, cambiar correo`} onClick={changeEmail}>
                        <span className={styles.chipEmail}>{email.trim()}</span>
                        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                    <form className={styles.form} onSubmit={event => { event.preventDefault(); void verify(code); }} noValidate>
                      <div className={styles.fieldGroup}>
                        <div ref={fieldRef}>
                          <OtpInput label="Código de 6 dígitos" length={CODE_LENGTH} value={code} onChange={changeCode} autoFocus disabled={submit !== "idle"} error={codeError || undefined} />
                        </div>
                        <p className={styles.notice}>
                          <span>¿No llegó? Revisa spam.</span>
                          <button type="button" className={styles.textLink} aria-disabled={resendIn > 0 || busy || undefined} aria-label={resendIn > 0 ? `Reenviar código, disponible en ${resendIn} segundos` : "Reenviar código"} onClick={() => void resend()}>
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span key={resendIn > 0 ? "wait" : "ready"} className={styles.resendLabel} {...swap(reduce)}>{resendIn > 0 ? <>Reenviar en <Countdown seconds={resendIn} reduce={reduce} /></> : "Reenviar código"}</motion.span>
                            </AnimatePresence>
                          </button>
                        </p>
                      </div>
                      <div className={styles.submitRow}>
                        <motion.div className={styles.submitSlot} data-success={submit === "success" || undefined} initial={false} animate={{ width: submit === "success" ? 44 : "100%" }} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
                          <Button type="submit" className={styles.submit} loading={submit === "checking"} aria-label={submit === "success" ? "Código aceptado" : undefined}>
                            {submit === "success" ? <CheckMark reduce={reduce} /> : "Entrar"}
                          </Button>
                        </motion.div>
                      </div>
                    </form>
                  </motion.div>}

                  {step === "done" && account && <motion.div key="done" className={styles.step} custom={custom} variants={stepMotion} initial="enter" animate="center" exit="exit">
                    <div className={styles.account}>
                      <Avatar name={account.name} src={account.photo} />
                      <span className={styles.accountText}><span className={styles.strong}>{account.name}</span><span className={styles.accountEmail}>{account.email}</span></span>
                    </div>
                    <div className={styles.heading}>
                      <Heading ref={doneRef} tabIndex={-1}>Entrando</Heading>
                      <p>Te llevamos al tablero del equipo.</p>
                    </div>
                    <div className={styles.progress} aria-hidden="true"><motion.span className={styles.progressFill} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={reduce ? { duration: 0 } : { duration: 1.4, ease: motionTokens.ease.standard }} /></div>
                  </motion.div>}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          <footer className={styles.footer}>
            <p className={styles.srOnly} role="status" aria-live="polite">{status}</p>
            <span className={styles.status} aria-hidden="true">
              <AnimatePresence mode="popLayout" initial={false}><motion.span key={status} {...swap(reduce)}>{status}</motion.span></AnimatePresence>
            </span>
          </footer>
        </div>

        {aside && <div className={styles.photoSide}>{aside}</div>}
      </div>
    </section>
  );
}

export default LoginSplit;
