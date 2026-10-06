import { z } from "zod";
import { LANDING_SUBTYPES, MARKETS, PRIORITIES, SUBTYPES } from "../board-config";
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

const common = {
  title: text(3, 120),
  dueDate: z.iso.date(),
  brief: text(20, 5000),
  priority: z.enum(PRIORITIES),
  market: z.enum(MARKETS),
  drive: z.union([z.literal(""), z.url({ protocol: /^https$/ })]).optional(),
  attachments: z.array(AttachmentSchema).max(MAX_FILES).default([]),
};

/** One branch per area mirrors the show-if rules of the old monday form: each area only carries its own fields. */
export const RequestSchema = z
  .discriminatedUnion("area", [
    z.object({
      ...common,
      area: z.literal("web"),
      subtype: z.enum(values(SUBTYPES.web)),
      landingSubtype: z.enum(values(LANDING_SUBTYPES)).optional(),
      blockers: z.string().trim().max(2000).optional(),
    }),
    z.object({ ...common, area: z.literal("video"), subtype: z.enum(values(SUBTYPES.video)) }),
    z.object({ ...common, area: z.literal("eventos"), subtype: z.enum(values(SUBTYPES.eventos)) }),
    z.object({ ...common, area: z.literal("diseno"), subtype: z.enum(values(SUBTYPES.diseno)) }),
  ])
  .superRefine((request, ctx) => {
    if (request.area === "web" && request.subtype === "landing" && !request.landingSubtype) {
      ctx.addIssue({ code: "custom", path: ["landingSubtype"], message: "Elige el tipo de landing" });
    }
  });

export type IntakeRequest = z.infer<typeof RequestSchema>;
