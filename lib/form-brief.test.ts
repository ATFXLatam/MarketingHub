import { describe, expect, it } from "vitest";
import { AFFILIATE_INTAKE } from "./campaign-intake";
import { briefMarkdown, createdOnFormBoard, withSubmitter } from "./form-brief";

describe("briefMarkdown", () => {
  const questions = [
    { id: "page", title: "Page", type: "PAGE_BLOCK" },
    { id: "name", title: "Request title", type: "Name" },
    { id: "country", title: "Target country", type: "MultiSelect" },
    { id: "ad", title: "Affiliate ad message", type: "LongText" },
    { id: "sizes", title: "Banner sizes", type: "MultiSelect" },
  ];

  it("lists the answers in form order, skips layout, title and empty answers, and gives long text a paragraph", () => {
    const answers = new Map([
      ["name", "Affiliate X"],
      ["ad", "  Gold, no fees  "],
      ["country", "Mexico, Chile"],
      ["sizes", ""],
    ]);
    expect(briefMarkdown(questions, answers)).toBe("**Target country:** Mexico, Chile\n\n**Affiliate ad message**\n\nGold, no fees");
  });
});

describe("createdOnFormBoard", () => {
  it("names the item only on boards fed by a form", () => {
    expect(createdOnFormBoard({ event: { boardId: AFFILIATE_INTAKE.boardId, pulseId: "7" } })).toMatchObject({ itemId: 7 });
    expect(createdOnFormBoard({ event: { boardId: 1, pulseId: "7" } })).toBeNull();
  });
});

describe("withSubmitter", () => {
  it("names the account that submitted, not what was typed, and notes a different typed name as who it is for", () => {
    expect(withSubmitter("**Area:** Web", "Thomas Corona", "thomas corona")).toBe("**Submitted by Thomas Corona through the request form.**\n\n**Area:** Web");
    expect(withSubmitter("**Area:** Web", "Federico Pereira", "Claudia Ruiz")).toBe(
      "**Submitted by Federico Pereira for Claudia Ruiz through the request form.**\n\n**Area:** Web",
    );
    expect(withSubmitter("**Area:** Web", undefined, "Claudia Ruiz")).toBe("**Area:** Web");
  });
});
