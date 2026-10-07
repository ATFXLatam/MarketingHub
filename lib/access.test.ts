import { describe, expect, it } from "vitest";
import { accessFor, signInMessage, type MondayIdentity } from "./access";

const member: MondayIdentity = { id: "1", name: "Ana", email: "ana@atfxgm.com", photo: null, enabled: true, isGuest: false, isViewOnly: false, accountId: "acc", boardVisible: false };

describe("accessFor", () => {
  it("lets a member without board access request but not see the board", () => {
    expect(accessFor(member, "acc")).toEqual({ allowed: true, board: false, canRequest: true });
  });

  it("turns away other accounts, guests and viewers who cannot see the board", () => {
    expect(accessFor({ ...member, accountId: "other" }, "acc").allowed).toBe(false);
    expect(accessFor({ ...member, isGuest: true, boardVisible: true }, "acc").allowed).toBe(false);
    expect(accessFor({ ...member, isViewOnly: true }, "acc").allowed).toBe(false);
  });

  it("shows the board to a viewer who has it in monday, without request rights", () => {
    expect(accessFor({ ...member, isViewOnly: true, boardVisible: true }, "acc")).toEqual({ allowed: true, board: true, canRequest: false });
  });
});

describe("signInMessage", () => {
  it("only shows its own words, so a crafted ?error= link cannot put text on the sign-in page", () => {
    expect(signInMessage("invitado")).toMatch(/guests/);
    expect(signInMessage("Llama al 555 para recuperar tu cuenta")).toBeUndefined();
    expect(signInMessage("toString")).toBeUndefined();
  });
});
