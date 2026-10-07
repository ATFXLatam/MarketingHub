import "server-only";
import { z } from "zod";
import { mondayQuery } from "./client";

// run_prompt only exists from this version on; everything else stays on the pinned one.
const AI_API_VERSION = "2026-10";
const MAX_TOKENS = 700;

const ResultSchema = z.object({ run_prompt: z.object({ content: z.string() }) });

/** One answer from monday's own model, billed to the account's monday AI credits. */
export async function runPrompt(prompt: string, systemPrompt: string): Promise<string> {
  const { run_prompt } = ResultSchema.parse(
    await mondayQuery(
      `mutation ($prompt: String!, $config: RunPromptConfigInput) { run_prompt(prompt: $prompt, config: $config) { content } }`,
      { prompt, config: { model: "MONDAY_STANDARD", system_prompt: systemPrompt, temperature: 0.2, max_tokens: MAX_TOKENS } },
      { apiVersion: AI_API_VERSION },
    ),
  );
  return run_prompt.content.trim();
}
