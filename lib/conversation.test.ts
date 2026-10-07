import { describe, expect, it } from "vitest";
import { commentHtml, toConversation, type RawUpdate } from "./conversation";

describe("commentHtml", () => {
  it("escapes what the person typed so it cannot inject markup into monday", () => {
    expect(commentHtml('hola <img src=x onerror="a">\nok')).toBe("<p>hola &lt;img src=x onerror=&quot;a&quot;&gt;<br>ok</p>");
  });
});

describe("toConversation", () => {
  it("reads oldest first and credits automations to monday", () => {
    const updates: RawUpdate[] = [
      { id: 2, text_body: "listo", created_at: "2026-10-07T10:00:00Z", creator: { id: "1", name: "Ana", photo_thumb_small: null }, replies: [] },
      { id: 1, text_body: "nueva", created_at: "2026-10-06T10:00:00Z", creator: null, replies: [] },
    ];
    const { brief, comments } = toConversation(" brief ", updates);
    expect(brief).toBe("brief");
    expect(comments.map((comment) => [comment.author.name, comment.body])).toEqual([["monday", "nueva"], ["Ana", "listo"]]);
  });
});
