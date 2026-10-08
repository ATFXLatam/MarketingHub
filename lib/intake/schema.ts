import { z } from "zod";
import { LANDING_SUBTYPES, MARKETS, PRIORITIES, SUBTYPES } from "../board-config";
import { COPY_READY, OBJECTIVES, VIDEO_FORMATS } from "../requirements";
import { MAX_FILES } from "./uploads";

const values = <T extends { value: string }>(items: readonly T[]) =>
  items.map((item) => item.value) as [string, ...string[]];

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

// Shape only; the server action narrows it to our own store host (ownBlobHref), which needs the env.
const blobUrl = z.url({ protocol: /^https$/ });

export const AttachmentSchema = z.object({
  url: blobUrl,
  name: text(1, 200),
});

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalNumber = z.union([z.literal(""), z.string().regex(/^\d{1,6}$/, "Enter numbers only")]).optional();

/** Structured requirements; each is optional because missing ones cost points, not the submission. */
export const DetailsSchema = z
  .object({
    objective: z.union([z.literal(""), z.enum(OBJECTIVES)]).optional(),
    audience: optionalText(300),
    cta: optionalText(120),
    url: z.union([z.literal(""), z.url({ protocol: /^https$/ })]).optional(),
    format: z.union([z.literal(""), z.enum(VIDEO_FORMATS)]).optional(),
    duration: optionalNumber,
    sizes: optionalText(300),
    copyReady: z.enum(["", COPY_READY, "no"]).optional(),
    eventDate: z.union([z.literal(""), z.iso.date()]).optional(),
    venue: optionalText(200),
    attendees: optionalNumber,
    budget: optionalText(120),
  })
  .strict()
  .default({});

const common = {
  title: text(3, 120),
  dueDate: z.iso.date(),
  brief: text(20, 5000),
  priority: z.enum(PRIORITIES),
  market: z.enum(MARKETS),
  drive: z.union([z.literal(""), z.url({ protocol: /^https$/ })]).optional(),
  attachments: z.array(AttachmentSchema).max(MAX_FILES).default([]),
  blockers: z.string().trim().max(2000).optional(),
  details: DetailsSchema,
};

/** One branch per area mirrors the show-if rules of the old monday form: each area only carries its own fields. */
export const RequestSchema = z
  .discriminatedUnion("area", [
    z.object({
      ...common,
      area: z.literal("web"),
      subtype: z.enum(values(SUBTYPES.web)),
      landingSubtype: z.enum(values(LANDING_SUBTYPES)).optional(),
    }),
    z.object({ ...common, area: z.literal("video"), subtype: z.enum(values(SUBTYPES.video)) }),
    z.object({ ...common, area: z.literal("eventos"), subtype: z.enum(values(SUBTYPES.eventos)) }),
    z.object({ ...common, area: z.literal("diseno"), subtype: z.enum(values(SUBTYPES.diseno)) }),
    z.object({ ...common, area: z.literal("copy"), subtype: z.enum(values(SUBTYPES.copy)) }),
    z.object({ ...common, area: z.literal("digital"), subtype: z.enum(values(SUBTYPES.digital)) }),
    z.object({ ...common, area: z.literal("data"), subtype: z.enum(values(SUBTYPES.data)) }),
  ])
  .superRefine((request, ctx) => {
    if (request.area === "web" && request.subtype === "landing" && !request.landingSubtype) {
      ctx.addIssue({ code: "custom", path: ["landingSubtype"], message: "Choose the landing type" });
    }
  });

export type IntakeRequest = z.infer<typeof RequestSchema>;
