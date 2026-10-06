"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { submitRequest } from "@/app/(app)/solicitar/actions";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import {
  FileUpload,
  type FileUploadItem,
} from "@/components/arc/file-upload/file-upload";
import { Input } from "@/components/arc/input/input";
import { MultiStepForm } from "@/components/arc/multi-step-form/multi-step-form";
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
import { formatDay } from "@/lib/dates";
import { estimate, type Estimate } from "@/lib/estimate";
import {
  ACCEPTED_TYPES,
  MAX_FILES,
  MAX_UPLOAD_BYTES,
  UPLOAD_PREFIX,
} from "@/lib/intake/uploads";
import { EstimatePanel } from "./estimate-panel";
import { stepErrors, type Draft } from "./validation";
import styles from "./request-form.module.css";

const AREA_HINT: Record<Area, string> = {
  web: "Landings, cambios, tracking y accesos",
  video: "Reels, promos, webinars y testimoniales",
  eventos: "Eventos internos o con clientes",
  diseno: "Piezas para Meta, Google, email e impresos",
};

const BRIEF_HINT: Record<Area, string> = {
  web: "Objetivo, público, secciones, copy y CTA. Si es una ronda de cambios, lista cada cambio con su URL.",
  video:
    "Formato (horizontal o vertical), duración, idioma y canal donde se publicará.",
  eventos:
    "Fecha y lugar, asistentes esperados, qué necesitas de marketing y presupuesto si aplica.",
  diseno: "Tipo de pieza, público, idioma, copy, CTA, tamaño y formato.",
};

const EMPTY: Draft = {
  title: "",
  area: "",
  subtype: "",
  landingSubtype: "",
  priority: "normal",
  market: "",
  brief: "",
  drive: "",
  blockers: "",
};

const toIsoDate = (date?: Date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";

interface RequestFormProps {
  requester: string;
  /** Today in the team's time zone, from the server, so the estimate matches the one written to monday. */
  today: string;
}

export function RequestForm(props: RequestFormProps) {
  // Bumping the key remounts the wizard on "send another", so it starts again from the first step.
  const [round, setRound] = useState(0);
  return (
    <RequestWizard
      key={round}
      {...props}
      onAnother={() => setRound((value) => value + 1)}
    />
  );
}

function RequestWizard({
  requester,
  today,
  onAnother,
}: RequestFormProps & { onAnother: () => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent] = useState<Estimate | null>(null);
  const uploaded = useRef(new Map<File, { url: string; name: string }>());
  // Kept across retries of the same submission so monday never creates the item twice.
  const submissionKey = useRef<string | null>(null);
  const website = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => field !== key),
      ),
    );
  };
  const validFiles = files.filter((item) => !item.error);
  const area = draft.area || null;

  const preview = area
    ? estimate({
        area,
        subtype: draft.subtype || undefined,
        landingSubtype: draft.landingSubtype || undefined,
        priority: draft.priority,
        brief: draft.brief,
        market: draft.market || undefined,
        drive: draft.drive,
        attachmentCount: validFiles.length,
        blockers: area === "web" ? draft.blockers : undefined,
        today,
        dueDate: toIsoDate(draft.dueDate) || undefined,
      })
    : null;

  async function uploadFile(
    file: File,
    options: { onProgress: (percent: number) => void; signal: AbortSignal },
  ) {
    const blob = await upload(`${UPLOAD_PREFIX}${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      abortSignal: options.signal,
      onUploadProgress: ({ percentage }) => options.onProgress(percentage),
    });
    uploaded.current.set(file, { url: blob.url, name: file.name });
  }

  function onStepContinue(index: number): boolean {
    const pendingUploads = validFiles.some(
      (item) => !uploaded.current.has(item.file),
    );
    const found = stepErrors(index, draft, { pendingUploads });
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function onComplete(): Promise<boolean> {
    setSubmitError("");
    submissionKey.current ??= crypto.randomUUID();
    const attachments = validFiles
      .map((item) => uploaded.current.get(item.file))
      .filter((file) => file !== undefined);
    const payload = {
      ...draft,
      dueDate: toIsoDate(draft.dueDate),
      landingSubtype: draft.landingSubtype || undefined,
      blockers: draft.blockers || undefined,
      attachments,
    };
    try {
      const response = await submitRequest(
        payload,
        submissionKey.current,
        website.current?.value ?? "",
      );
      if (!response.success) {
        setErrors(response.fieldErrors ?? {});
        setSubmitError(
          response.fieldErrors
            ? `${response.error} Vuelve a los pasos anteriores para corregirlos.`
            : response.error,
        );
        return false;
      }
      submissionKey.current = null;
      setSent(response.data.estimate);
      return true;
    } catch {
      setSubmitError(
        "Se perdió la conexión. Vuelve a enviar: no se duplicará.",
      );
      return false;
    }
  }

  const subtypes = area ? SUBTYPES[area] : [];

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <MultiStepForm
          formLabel="Nueva solicitud"
          completeLabel="Enviar solicitud"
          onStepContinue={onStepContinue}
          onComplete={onComplete}
          successTitle="Solicitud enviada"
          successNote={
            sent &&
            `Entrega estimada: ${formatDay(sent.date)} (${sent.days} días hábiles). ${
              sent.initialStage === "ready"
                ? "Quedó lista para arrancar y el responsable del área ya la ve en monday."
                : "Quedó en Nuevas: el responsable del área la revisará y te escribirá si falta algo."
            }`
          }
          successAction={
            <Button variant="secondary" type="button" onClick={onAnother}>
              Enviar otra solicitud
            </Button>
          }
          steps={[
            {
              id: "area",
              title: "Área",
              description: "¿Qué equipo necesitas?",
              content: (
                <div className={styles.fields}>
                  <RadioCards
                    name="area"
                    required
                    minColumnWidth={260}
                    value={draft.area || null}
                    onValueChange={(value) => {
                      setDraft((current) => ({
                        ...current,
                        area: value as Area,
                        subtype: "",
                        landingSubtype: "",
                      }));
                      setErrors({});
                    }}
                    options={AREAS.map((value) => ({
                      value,
                      label: AREA_LABEL[value],
                      description: AREA_HINT[value],
                    }))}
                  />
                  {errors.area && <Alert tone="danger" title={errors.area} />}
                </div>
              ),
            },
            {
              id: "brief",
              title: "Brief",
              description: area ? BRIEF_HINT[area] : undefined,
              content: (
                <div className={styles.fields}>
                  <Input
                    label="Título"
                    placeholder="Landing webinar de oro, octubre"
                    value={draft.title}
                    onChange={(event) => set("title", event.target.value)}
                    error={errors.title}
                    maxLength={120}
                  />
                  <div className={styles.row}>
                    <Select
                      label="Tipo de pieza"
                      placeholder="Elige uno"
                      options={subtypes.map(({ value, label }) => ({
                        value,
                        label,
                      }))}
                      value={draft.subtype}
                      onValueChange={(value) => {
                        set("subtype", value);
                        set("landingSubtype", "");
                      }}
                      description={errors.subtype}
                    />
                    {area === "web" && draft.subtype === "landing" && (
                      <Select
                        label="Tipo de landing"
                        placeholder="Elige uno"
                        options={LANDING_SUBTYPES.map(({ value, label }) => ({
                          value,
                          label,
                        }))}
                        value={draft.landingSubtype}
                        onValueChange={(value) => set("landingSubtype", value)}
                        description={errors.landingSubtype}
                      />
                    )}
                  </div>
                  <Textarea
                    label="Descripción y especificaciones"
                    error={errors.brief}
                    rows={7}
                    value={draft.brief}
                    onChange={(event) => set("brief", event.target.value)}
                    maxLength={5000}
                  />
                  {area === "web" && (
                    <Textarea
                      label="Bloqueadores"
                      description="Lo que falta para poder empezar: copy, logos, accesos. Déjalo vacío si no falta nada."
                      rows={3}
                      value={draft.blockers}
                      onChange={(event) => set("blockers", event.target.value)}
                      maxLength={2000}
                    />
                  )}
                </div>
              ),
            },
            {
              id: "cuando",
              title: "Fecha y prioridad",
              content: (
                <div className={styles.fields}>
                  <div className={styles.row}>
                    <DatePicker
                      label="Fecha requerida"
                      locale="es-MX"
                      value={draft.dueDate}
                      onChange={(date) => set("dueDate", date)}
                      minDate={new Date(`${today}T00:00:00`)}
                      description={errors.dueDate}
                      placeholder="Elige una fecha"
                    />
                    <Select
                      label="Mercado"
                      placeholder="Elige uno"
                      options={MARKETS.map((value) => ({
                        value,
                        label: value,
                      }))}
                      value={draft.market}
                      onValueChange={(value) => set("market", value)}
                      description={errors.market}
                    />
                  </div>
                  <RadioGroup
                    label="Prioridad"
                    name="priority"
                    value={draft.priority}
                    onValueChange={(value) =>
                      set("priority", value as Priority)
                    }
                    options={PRIORITIES.map((value) => ({
                      value,
                      label: PRIORITY_LABEL[value],
                    }))}
                  />
                </div>
              ),
            },
            {
              id: "material",
              title: "Material",
              description: "Opcional, pero acorta la entrega.",
              content: (
                <div className={styles.fields}>
                  <Input
                    label="Carpeta Drive"
                    type="url"
                    inputMode="url"
                    placeholder="https://drive.google.com/..."
                    value={draft.drive}
                    onChange={(event) => set("drive", event.target.value)}
                    error={errors.drive}
                  />
                  <FileUpload
                    label="Adjuntos"
                    description={`Hasta ${MAX_FILES} archivos de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB: imágenes, PDF, Office o CSV.`}
                    accept={ACCEPTED_TYPES.join(",")}
                    maxSize={MAX_UPLOAD_BYTES}
                    value={files}
                    onChange={(next) => setFiles(next.slice(0, MAX_FILES))}
                    onUpload={uploadFile}
                  />
                  {errors.attachments && (
                    <Alert tone="warning" title={errors.attachments} />
                  )}
                </div>
              ),
            },
            {
              id: "revision",
              title: "Revisión",
              description: `Se enviará como ${requester}.`,
              content: (
                <div className={styles.fields}>
                  {preview?.tight && (
                    <Alert
                      tone="warning"
                      title="La fecha requerida es anterior a la estimada"
                    >
                      El equipo revisará si es posible. Completar el brief o
                      subir la prioridad ayuda.
                    </Alert>
                  )}
                  {submitError && <Alert tone="danger" title={submitError} />}
                  {!preview?.tight && !submitError && (
                    <Alert tone="info" title="Todo listo para enviar">
                      La solicitud llega al tablero del equipo en monday con su
                      fecha estimada.
                    </Alert>
                  )}
                  <input
                    ref={website}
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className={styles.honeypot}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>
      <aside className={styles.aside} aria-label="Estimación en vivo">
        {preview ? (
          <EstimatePanel result={preview} />
        ) : (
          <EmptyState
            title="Elige un área"
            description="La estimación aparece en cuanto sepamos qué necesitas."
          />
        )}
      </aside>
    </div>
  );
}
