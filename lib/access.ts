/** What monday says about the person signing in, from their own token. */
export interface MondayIdentity {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  enabled: boolean;
  isGuest: boolean;
  isViewOnly: boolean;
  accountId: string;
  /** Their token can open the requests board. */
  boardVisible: boolean;
}

/** Why sign-in failed, as a code: the sign-in page maps it to its own words, so a crafted link cannot put text there. */
export const SIGN_IN_ERRORS = {
  cuenta: "Tu usuario de monday no es de la cuenta de ATFX.",
  desactivado: "Tu usuario de monday está desactivado.",
  invitado: "Los invitados de monday no tienen acceso al hub.",
  "solo-lectura": "Tu usuario de monday es de solo lectura. Pide un asiento de miembro para hacer solicitudes.",
  expirada: "El inicio de sesión expiró. Vuelve a intentarlo.",
  cancelada: "Cancelaste la conexión con monday.",
  monday: "monday no respondió. Intenta de nuevo en un momento.",
  verificacion: "No pudimos confirmar tu acceso con monday. Vuelve a entrar.",
} as const;
export type SignInError = keyof typeof SIGN_IN_ERRORS;

export function signInMessage(code: string | null): string | undefined {
  return code && Object.hasOwn(SIGN_IN_ERRORS, code) ? SIGN_IN_ERRORS[code as SignInError] : undefined;
}

export type Access = { allowed: true; board: boolean; canRequest: boolean } | { allowed: false; reason: SignInError };

/**
 * Only active people of the ATFX monday account get in. Members may request work; the board and its tasks open only to
 * whoever monday itself lets see the board, so the hub never shows more than monday would.
 */
export function accessFor(identity: MondayIdentity, hubAccountId: string): Access {
  if (identity.accountId !== hubAccountId) return { allowed: false, reason: "cuenta" };
  if (!identity.enabled) return { allowed: false, reason: "desactivado" };
  if (identity.isGuest) return { allowed: false, reason: "invitado" };
  const canRequest = !identity.isViewOnly;
  if (!canRequest && !identity.boardVisible) {
    return { allowed: false, reason: "solo-lectura" };
  }
  return { allowed: true, board: identity.boardVisible, canRequest };
}
