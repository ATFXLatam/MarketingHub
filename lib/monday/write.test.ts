import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { asRequesterOrHub } = await import("./write");
const { MondayError } = await import("./client");

describe("asRequesterOrHub", () => {
  it("writes as the requester when monday allows it", async () => {
    const run = vi.fn(async (token: string | undefined) => token);
    expect(await asRequesterOrHub("user-token", run)).toEqual({ value: "user-token", token: "user-token" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("falls back to the hub's token only when monday refuses the requester", async () => {
    const run = vi.fn(async (token: string | undefined) => {
      if (token) throw new MondayError("User unauthorized to perform action", undefined, "UserUnauthorizedException");
      return "created";
    });
    expect(await asRequesterOrHub("user-token", run)).toEqual({ value: "created", token: undefined });
    expect(run).toHaveBeenLastCalledWith(undefined);
  });

  it("does not retry with the hub's token after an outage, so a request is never written twice", async () => {
    const run = vi.fn(async () => {
      throw new MondayError("monday answered 500");
    });
    await expect(asRequesterOrHub("user-token", run)).rejects.toThrow("500");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
