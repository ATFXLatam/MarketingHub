import "server-only";

const ENDPOINT = "https://api.monday.com/v2";
// Pinned: without the header monday moves every client to the new Current version each quarter.
export const API_VERSION = "2026-07";

export class MondayError extends Error {
  constructor(
    message: string,
    readonly retryInSeconds?: number,
  ) {
    super(message);
  }
}

export function mondayConfigured(): boolean {
  return Boolean(process.env.MONDAY_API_TOKEN);
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string; retry_in_seconds?: number } }[];
  error_message?: string;
}

export async function mondayQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new MondayError("MONDAY_API_TOKEN no está configurado");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "API-Version": API_VERSION,
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  let payload: GraphQLResponse<T>;
  try {
    payload = (await response.json()) as GraphQLResponse<T>;
  } catch {
    throw new MondayError(`monday respondió ${response.status} sin JSON`);
  }

  const first = payload.errors?.[0];
  if (!response.ok || first || payload.error_message || !payload.data) {
    const retry = first?.extensions?.retry_in_seconds;
    throw new MondayError(first?.message ?? payload.error_message ?? `monday respondió ${response.status}`, retry);
  }
  return payload.data;
}
