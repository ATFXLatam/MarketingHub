import { describe, expect, it } from "vitest";
import { cardText, newRequestCard } from "./teams";

describe("teams card", () => {
  it("strips markdown that could turn a typed title into a link", () => {
    expect(cardText("Promo [click here](https://evil.example) <https://evil.example>")).toBe("Promo click herehttps://evil.example https://evil.example");
  });

  it("links the card to the monday item and names the area owners", () => {
    const card = JSON.stringify(
      newRequestCard({
        itemId: "123",
        request: { title: "Black Friday LP", area: "web", priority: "alta", market: "LATAM", dueDate: "2026-11-20" },
        requester: "Ana",
        estimate: { date: "2026-11-25", tight: true },
        owners: ["Karen Ortiz"],
      }),
    );
    expect(card).toContain("https://atfx.monday.com/boards/18424308173/pulses/123");
    expect(card).toContain("Karen Ortiz");
    expect(card).toContain("after the requested date");
  });
});
