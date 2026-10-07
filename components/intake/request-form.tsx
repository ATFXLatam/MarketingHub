"use client";

import { useRef, useState } from "react";
import { EstimateTotal, SummaryRows } from "@/components/arc/blocks/usage-pricing/usage-pricing";
import { Avatar } from "@/components/arc/avatar/avatar";
import { upload } from "@vercel/blob/client";
import { submitRequest } from "@/app/(app)/solicitar/actions";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
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
import { estimate, type BriefGap, type Estimate } from "@/lib/estimate";
import {
  ACCEPTED_TYPES,
  MAX_FILES,
  MAX_UPLOAD_BYTES,
  UPLOAD_PREFIX,
} from "@/lib/intake/uploads";
import { RequestSummary } from "./request-summary";
import { RequirementFields } from "./requirement-fields";
import { stepErrors, type Draft } from "./validation";
import type { AreaOwner } from "@/lib/area-owners";
import { OBJECTIVES, type DetailKey } from "@/lib/requirements";

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
  details: {},
};

const STEP_IDS = ["area", "brief", "requisitos", "cuando", "material", "revision"] as const;
const REVIEW = STEP_IDS.indexOf("revision");

const toIsoDate = (date?: Date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";

interface RequestFormProps {
  requester: string;
  /** Who answers for each area, shown before sending so the requester knows who will pick it up. */
  areaOwners: Record<Area, AreaOwner[]>;
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
  areaOwners,
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
  const [jump, setJump] = useState<{ step: number; nonce: number; focus?: string }>();
  // Set when a summary link sent the person back to fill something in; Continuar then returns to review.
  const [returning, setReturning] = useState(false);

  function fix(gap: BriefGap) {
    setReturning(true);
    setJump((current) => ({ step: STEP_IDS.indexOf(gap.step), nonce: (current?.nonce ?? 0) + 1, focus: gap.field }));
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => field !== key),
      ),
    );
  };
  const setDetail = (key: DetailKey, value: string) => {
    setDraft((current) => ({ ...current, details: { ...current.details, [key]: value } }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => field !== key)));
  };
  const validFiles = files.filter((item) => !item.error);
  const area = draft.area || null;
  const owner = area ? areaOwners[area][0] : undefined;

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
        blockers: draft.blockers,
        details: draft.details,
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
    const found = stepErrors(STEP_IDS[index], draft, { pendingUploads });
    setErrors(found);
    const valid = Object.keys(found).length === 0;
    if (valid && returning && index < REVIEW) {
      setReturning(false);
      setJump((current) => ({ step: REVIEW, nonce: (current?.nonce ?? 0) + 1 }));
      return false;
    }
    return valid;
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
      details: Object.fromEntries(Object.entries(draft.details).filter(([, value]) => value?.trim())),
      attachments,
    };
    try {
      const response = await submitRequest(payload, submissionKey.current);
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
  const pieceLabel = subtypes.find((item) => item.value === draft.subtype)?.label;

  return (
    <MultiStepForm
      surface="none"
      formLabel="Nueva solicitud"
      completeLabel="Enviar solicitud"
      onStepContinue={onStepContinue}
      onComplete={onComplete}
      jump={jump}
      fill
      actionsStart={<EstimateTotal result={preview} />}
      aside={<RequestSummary area={area} pieceLabel={pieceLabel} priority={draft.priority} owner={owner} result={preview} onFix={fix} />}
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
            <>
              <RadioCards
                name="area"
                required
                minColumnWidth={220}
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
                options={AREAS.map((value) => {
                  const [lead] = areaOwners[value];
                  return {
                    value,
                    label: AREA_LABEL[value],
                    description: AREA_HINT[value],
                    meta: lead ? (
                      <>
                        <Avatar name={lead.name} src={lead.photo ?? undefined} size="sm" />
                        {`${lead.assigned ? "La toma" : "Suele tomarla"} ${lead.name.split(" ")[0]}`}
                      </>
                    ) : (
                      "La asigna el equipo"
                    ),
                  };
                })}
              />
              {errors.area && <Alert tone="danger" title={errors.area} />}
            </>
          ),
        },
        {
          id: "brief",
          title: "Brief",
          description: area ? BRIEF_HINT[area] : undefined,
          content: (
            <>
              <Input
                label="Título"
                placeholder="Landing webinar de oro, octubre"
                value={draft.title}
                onChange={(event) => set("title", event.target.value)}
                error={errors.title}
                maxLength={120}
              />
              <>
                <Select
                  id="subtype"
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
              </>
              <Select
                id="objective"
                label="Objetivo"
                placeholder="Elige uno"
                options={OBJECTIVES.map((value) => ({ value, label: value }))}
                value={draft.details.objective ?? ""}
                onValueChange={(value) => setDetail("objective", value)}
              />
              <Input
                id="audience"
                label="Público"
                placeholder="Traders nuevos en México, clientes con cuenta fondeada"
                value={draft.details.audience ?? ""}
                onChange={(event) => setDetail("audience", event.target.value)}
                maxLength={300}
              />
              <Textarea
                id="brief"
                label="Descripción y especificaciones"
                error={errors.brief}
                rows={7}
                value={draft.brief}
                onChange={(event) => set("brief", event.target.value)}
                maxLength={5000}
              />
            </>
          ),
        },
        {
          id: "requisitos",
          title: area ? `Requisitos de ${AREA_LABEL[area].toLowerCase()}` : "Requisitos",
          description: "Lo que el equipo necesita para arrancar sin volver a preguntarte. Nada es obligatorio, pero cada punto acorta la entrega.",
          content: (
            <>
              {area && <RequirementFields area={area} details={draft.details} errors={errors} onChange={setDetail} />}
              <Textarea
                id="blockers"
                label="Bloqueadores"
                description="Lo que falta para poder empezar: copy, logos, accesos, aprobaciones. Déjalo vacío si no falta nada."
                rows={3}
                value={draft.blockers}
                onChange={(event) => set("blockers", event.target.value)}
                maxLength={2000}
              />
            </>
          ),
        },
        {
          id: "cuando",
          title: "Fecha y prioridad",
          content: (
            <>
              <>
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
                  id="market"
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
              </>
              <RadioGroup
                label="Prioridad"
                name="priority"
                value={draft.priority}
                onValueChange={(value) => set("priority", value as Priority)}
                options={PRIORITIES.map((value) => ({
                  value,
                  label: PRIORITY_LABEL[value],
                }))}
              />
            </>
          ),
        },
        {
          id: "material",
          title: "Material",
          description: "Opcional, pero acorta la entrega.",
          content: (
            <>
              <Input
                id="drive"
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
            </>
          ),
        },
        {
          id: "revision",
          title: "Revisión",
          description: `Se enviará como ${requester}.`,
          content: (
            <>
              {area && (
                <SummaryRows
                  title="Lo que se enviará"
                  rows={[
                    { label: "Título", value: draft.title || "Sin título" },
                    { label: "Área", value: AREA_LABEL[area], note: pieceLabel },
                    { label: "Responsable", value: owner?.name ?? "Lo asigna el equipo", note: owner && !owner.assigned ? "Quien suele tomar esta área" : undefined },
                    { label: "Fecha requerida", value: draft.dueDate ? formatDay(toIsoDate(draft.dueDate)) : "Sin fecha" },
                    { label: "Prioridad", value: PRIORITY_LABEL[draft.priority] },
                    { label: "Mercado", value: draft.market || "Sin mercado" },
                    { label: "Material", value: [draft.drive && "Carpeta Drive", validFiles.length && `${validFiles.length} adjuntos`].filter(Boolean).join(" y ") || "Sin material" },
                  ]}
                />
              )}
              {preview?.tight && (
                <Alert
                  tone="warning"
                  title="La fecha requerida es anterior a la estimada"
                >
                  El equipo revisará si es posible. Completar el brief o subir
                  la prioridad ayuda.
                </Alert>
              )}
              {submitError && <Alert tone="danger" title={submitError} />}
              {!preview?.tight && !submitError && (
                <Alert tone="info" title="Todo listo para enviar">
                  La solicitud llega al tablero del equipo en monday con su
                  fecha estimada.
                </Alert>
              )}
            </>
          ),
        },
      ]}
    />
  );
}
