import { describe, expect, it } from "vitest";
import { blobStoreHost, isUploadPathname, ownBlobHref } from "./blob-url";

const host = blobStoreHost("vercel_blob_rw_AbC123_secretpart");

describe("ownBlobHref", () => {
  it("accepts a file from our store under the upload prefix", () => {
    expect(host).toBe("abc123.public.blob.vercel-storage.com");
    expect(ownBlobHref(`https://${host}/requests/brief-x1.pdf`, host)).toBe(`https://${host}/requests/brief-x1.pdf`);
  });

  it("rejects another customer's store, paths outside the prefix and quote injection", () => {
    expect(ownBlobHref("https://evil.public.blob.vercel-storage.com/requests/x.html", host)).toBeNull();
    expect(ownBlobHref(`https://${host}/other/x.pdf`, host)).toBeNull();
    const injected = ownBlobHref(`https://${host}/requests/x".pdf`, host);
    expect(injected === null || !injected.includes('"')).toBe(true);
  });

  it("rejects everything when the store is not configured", () => {
    expect(ownBlobHref(`https://${host}/requests/x.pdf`, null)).toBeNull();
  });
});

describe("isUploadPathname", () => {
  it("rejects traversal segments", () => {
    expect(isUploadPathname("requests/brief.pdf")).toBe(true);
    expect(isUploadPathname("requests/../x.pdf")).toBe(false);
    expect(isUploadPathname("other/x.pdf")).toBe(false);
  });
});
