import "server-only";
import { z } from "zod";
import type { MondayIdentity } from "../access";
import { BOARD_ID } from "../board-config";
import { ownerPhoto } from "../public-dto";
import { MondayError, mondayQuery } from "./client";

const AUTHORIZE = "https://auth.monday.com/oauth2/authorize";
const TOKEN = "https://auth.monday.com/oauth2/token";
export const CALLBACK_PATH = "/api/monday/oauth/callback";

function clientCredentials(): { id: string; secret: string } {
  const id = process.env.MONDAY_CLIENT_ID;
  const secret = process.env.MONDAY_CLIENT_SECRET;
  if (!id || !secret) throw new MondayError("MONDAY_CLIENT_ID or MONDAY_CLIENT_SECRET is not set");
  return { id, secret };
}

export function authorizeUrl(state: string, redirectUri: string): string {
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({ client_id: clientCredentials().id, redirect_uri: redirectUri, state }).toString();
  return url.href;
}

const TokenSchema = z.object({ access_token: z.string().min(1) });

/** Trades the one-time code for the person's token; monday tokens do not expire until the app is uninstalled. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const { id, secret } = clientCredentials();
  const response = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: id, client_secret: secret, code, redirect_uri: redirectUri }),
  });
  const parsed = TokenSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success) throw new MondayError(`monday did not return a token (${response.status})`);
  return parsed.data.access_token;
}

const Id = z.union([z.string(), z.number()]).transform(String);
const IdentitySchema = z.object({
  me: z.object({
    id: Id,
    name: z.string(),
    email: z.string(),
    photo_thumb_small: z.string().nullable(),
    enabled: z.boolean(),
    // Strict: a null here fails the sign-in instead of reading as "not a guest".
    is_guest: z.boolean(),
    is_view_only: z.boolean(),
    account: z.object({ id: Id }),
  }),
  boards: z.array(z.object({ id: Id })).nullable(),
});

/** Who the token belongs to and whether monday lets them open the requests board, asked with their own token. */
export async function identify(token: string): Promise<MondayIdentity> {
  const { me, boards } = IdentitySchema.parse(
    await mondayQuery(
      `query ($board: [ID!]) { me { id name email photo_thumb_small enabled is_guest is_view_only account { id } } boards(ids: $board) { id } }`,
      { board: [BOARD_ID] },
      { token },
    ),
  );
  return {
    id: me.id,
    name: me.name,
    email: me.email,
    photo: ownerPhoto(me.photo_thumb_small),
    enabled: me.enabled,
    isGuest: me.is_guest,
    isViewOnly: me.is_view_only,
    accountId: me.account.id,
    boardVisible: (boards ?? []).some((board) => board.id === String(BOARD_ID)),
  };
}

const AccountSchema = z.object({ me: z.object({ account: z.object({ id: Id }) }) });
let hubAccount: Promise<string> | null = null;

/** The ATFX account, read from the app's own token: whoever signs in must belong to the same one. */
export function hubAccountId(): Promise<string> {
  hubAccount ??= mondayQuery(`query { me { account { id } } }`)
    .then((data) => AccountSchema.parse(data).me.account.id)
    .catch((error: unknown) => {
      hubAccount = null;
      throw error;
    });
  return hubAccount;
}
