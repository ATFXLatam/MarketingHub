import { describe, expect, it } from "vitest";
import { commentHtml, toConversation, type RawUpdate } from "./conversation";

const hub = { id: "9", name: "Karen Ortiz", photo_thumb_small: null };
const ana = { id: "1", name: "Ana", photo_thumb_small: null };

describe("commentHtml", () => {
  it("escapes what the person typed so it cannot inject markup into monday", () => {
    expect(commentHtml("Leo <b>", 'hola <img src=x onerror="a">\nok')).toBe(
      '<p><strong>Leo &lt;b&gt;</strong> · desde el hub</p><p>hola &lt;img src=x onerror=&quot;a&quot;&gt;<br>ok</p>',
    );
  });
});

describe("toConversation", () => {
  it("credits hub posts to the signed name only when the hub account wrote them", () => {
    const updates: RawUpdate[] = [
      { id: 2, text_body: "Ana · desde el hub listo", created_at: "2026-10-07T10:00:00Z", creator: ana, replies: [] },
      { id: 1, text_body: "Leo · desde el hub ¿y el copy?", created_at: "2026-10-06T10:00:00Z", creator: hub, replies: [{ id: 3, text_body: "va", created_at: "2026-10-06T11:00:00Z", creator: null }] },
    ];
    const { comments } = toConversation(" brief ", updates, "9");
    expect(comments.map((comment) => [comment.author.name, comment.body])).toEqual([["Leo", "¿y el copy?"], ["Ana", "Ana · desde el hub listo"]]);
    expect(comments[0].replies[0].author.name).toBe("monday");
  });
});
