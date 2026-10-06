"use client";

import { useRef, useState, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import { submitRequest, type SubmitResult } from "@/app/solicitar/actions";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { FileUpload, type FileUploadItem } from "@/components/arc/file-upload/file-upload";
import { Input } from "@/components/arc/input/input";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";
import { Select } from "@/components/arc/select/select";
import { Textarea } from "@/components/arc/textarea/textarea";
import {
  AREA_LABEL,
  AREAS,
  LANDING_SUBTYPES,
  MARKETS,
  PRIORITIES,
  PRIORITY_LABEL,
  SUBTYPES,
  type Area,
  type Priority,
} from "@/lib/board-config";
import { estimate } from "@/lib/estimate";
import { ACCEPTED_TYPES, MAX_FILES, MAX_UPLOAD_BYTES, UPLOAD_PREFIX } from "@/lib/intake/uploads";
import { DoneScreen } from "./done-screen";
import { EstimatePanel } from "./estimate-panel";
import styles from "./request-form.module.css";

const AREA_HINT: Record<Area, string> = {
  web: "Landings, cambios, tracking y accesos",
  video: "Reels, promos, webinars y testimoniales",
  eventos: "Eventos internos o con clientes",
  diseno: "Piezas para Meta, Google, email e impresos",
};

const BRIEF_HINT: Record<Area, string> = {
  web: "Objetivo, público, secciones, copy y CTA. Si es una ronda de cambios, lista cada cambio con su URL.",
  video: "Formato (horizontal o vertical), duración, idioma y canal donde se publicará.",
  eventos: "Fecha y lugar, asistentes esperados, qué necesitas de marketing y presupuesto si aplica.",
  diseno: "Tipo de pieza, público, idioma, copy, CTA, tamaño y formato.",
};

interface Draft {
  title: string;
  area: Area | "";
  subtype: string;
  landingSubtype: string;
  priority: Priority;
  market: string;
  dueDate?: Date;
  brief: string;
  drive: string;
  blockers: string;
}

const EMPTY: Draft = { title: "", area: "", subtype: "", landingSubtype: "", priority: "normal", market: "", brief: "", drive: "", blockers: "" };

const toIsoDate = (date?: Date) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "";

interface RequestFormProps {
  requester: string;
  /** Today in the team's time zone, from the server, so the estimate matches the one written to monday. */
  today: string;
}

export function RequestForm({ requester, today }: RequestFormProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const uploaded = useRef(new Map<File, { url: string; name: string }>());
  // Kept across retries of the same submission so monday never creates the item twice.
  const submissionKey = useRef<string | null>(null);
  const website = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const errors = result && !result.success ? (result.fieldErrors ?? {}) : {};
  const validFiles = files.filter((item) => !item.error);

  const preview = draft.area
    ? estimate({
        area: draft.area,
        subtype: draft.subtype || undefined,
        landingSubtype: draft.landingSubtype || undefined,
        priority: draft.priority,
        brief: draft.brief,
        market: draft.market || undefined,
        drive: draft.drive,
        attachmentCount: validFiles.length,
        blockers: draft.area === "web" ? draft.blockers : undefined,
        today,
        dueDate: toIsoDate(draft.dueDate) || undefined,
      })
    : null;

  async function uploadFile(file: File, options: { onProgress: (percent: number) => void; signal: AbortSignal }) {
    const blob = await upload(`${UPLOAD_PREFIX}${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      abortSignal: options.signal,
      onUploadProgress: ({ percentage }) => options.onProgress(percentage),
    });
    uploaded.current.set(file, { url: blob.url, name: file.name });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const attachments = validFiles.map((item) => uploaded.current.get(item.file)).filter((file) => file !== undefined);
    if (attachments.length < validFiles.length) {
      setResult({ success: false, error: "Espera a que terminen de subir los adjuntos, o quita los que fallaron." });
      return;
    }
    setPending(true);
    submissionKey.current ??= crypto.randomUUID();
    const payload = {
      ...draft,
      dueDate: toIsoDate(draft.dueDate),
      landingSubtype: draft.landingSubtype || undefined,
      blockers: draft.blockers || undefined,
      attachments,
    };
    try {
      const response = await submitRequest(payload, submissionKey.current, website.current?.value ?? "");
      setResult(response);
      if (response.success) submissionKey.current = null;
    } catch {
      setResult({ success: false, error: "Se perdió la conexión. Vuelve a enviar: no se duplicará." });
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setDraft(EMPTY);
    setFiles([]);
    setResult(null);
    uploaded.current.clear();
  }

  if (result?.success) return <DoneScreen estimate={result.data.estimate} onAnother={reset} />;

  const area = draft.area || null;
  const subtypes = area ? SUBTYPES[area] : [];

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <p className={styles.muted}>Enviando como {requester}</p>

      <section className={styles.section} aria-labelledby="area-heading">
        <h2 id="area-heading">¿Qué área necesitas?</h2>
        <RadioCards
          name="area"
          required
          minColumnWidth={200}
          value={draft.area || null}
          onValueChange={(value) => setDraft((current) => ({ ...current, area: value as Area, subtype: "", landingSubtype: "" }))}
          options={AREAS.map((value) => ({ value, label: AREA_LABEL[value], description: AREA_HINT[value] }))}
        />
        {errors.area && <p className={styles.error}>Elige un área</p>}
      </section>

      {area && (
        <>
          <section className={styles.section} aria-labelledby="brief-heading">
            <h2 id="brief-heading">El brief</h2>
            <Input label="Título" placeholder="Landing webinar de oro, octubre" value={draft.title} onChange={(event) => set("title", event.target.value)} error={errors.title} maxLength={120} />
            <div className={styles.row}>
              <Select
                label="Tipo de pieza"
                placeholder="Elige uno"
                options={subtypes.map(({ value, label }) => ({ value, label }))}
                value={draft.subtype}
                onValueChange={(value) => setDraft((current) => ({ ...current, subtype: value, landingSubtype: "" }))}
                description={errors.subtype}
              />
              {area === "web" && draft.subtype === "landing" && (
                <Select
                  label="Tipo de landing"
                  placeholder="Elige uno"
                  options={LANDING_SUBTYPES.map(({ value, label }) => ({ value, label }))}
                  value={draft.landingSubtype}
                  onValueChange={(value) => set("landingSubtype", value)}
                  description={errors.landingSubtype}
                />
              )}
            </div>
            <Textarea label="Brief, descripción y especificaciones" description={errors.brief ? undefined : BRIEF_HINT[area]} error={errors.brief} rows={7} value={draft.brief} onChange={(event) => set("brief", event.target.value)} maxLength={5000} />
            {area === "web" && (
              <Textarea label="Bloqueadores" description="Lo que falta para poder empezar: copy, logos, accesos. Déjalo vacío si no falta nada." rows={3} value={draft.blockers} onChange={(event) => set("blockers", event.target.value)} maxLength={2000} />
            )}
          </section>

          <section className={styles.section} aria-labelledby="when-heading">
            <h2 id="when-heading">Para cuándo y dónde</h2>
            <div className={styles.row}>
              <DatePicker label="Fecha requerida" locale="es-MX" value={draft.dueDate} onChange={(date) => set("dueDate", date)} minDate={new Date(`${today}T00:00:00`)} description={errors.dueDate} placeholder="Elige una fecha" />
              <Select label="Mercado" placeholder="Elige uno" options={MARKETS.map((value) => ({ value, label: value }))} value={draft.market} onValueChange={(value) => set("market", value)} description={errors.market} />
            </div>
            <RadioGroup label="Prioridad" name="priority" value={draft.priority} onValueChange={(value) => set("priority", value as Priority)} options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABEL[value] }))} />
          </section>

          <section className={styles.section} aria-labelledby="material-heading">
            <h2 id="material-heading">Material</h2>
            <Input label="Carpeta Drive" type="url" inputMode="url" placeholder="https://drive.google.com/..." value={draft.drive} onChange={(event) => set("drive", event.target.value)} error={errors.drive} />
            <FileUpload
              label="Adjuntos"
              description={`Hasta ${MAX_FILES} archivos de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB: imágenes, PDF, Office o CSV.`}
              accept={ACCEPTED_TYPES.join(",")}
              maxSize={MAX_UPLOAD_BYTES}
              value={files}
              onChange={(next) => setFiles(next.slice(0, MAX_FILES))}
              onUpload={uploadFile}
            />
          </section>

          {preview && <EstimatePanel result={preview} />}

          <input ref={website} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className={styles.honeypot} />

          {result && !result.success && <Alert tone="danger" title={result.error} />}

          <div className={styles.actions}>
            <Button type="submit" size="lg" loading={pending}>Enviar solicitud</Button>
          </div>
        </>
      )}
    </form>
  );
}
