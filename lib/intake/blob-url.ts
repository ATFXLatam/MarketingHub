import { UPLOAD_PREFIX } from "./uploads";

/**
 * Host of our own Blob store, from the read-write token (vercel_blob_rw_<storeId>_<secret>). Every Vercel customer shares
 * the public.blob.vercel-storage.com suffix, so only the exact store host proves a file came through our upload route.
 */
export function blobStoreHost(token: string | undefined): string | null {
  const storeId = token?.match(/^vercel_blob_rw_([a-z0-9]+)_/i)?.[1];
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

/** Normalized href of an attachment, or null when it is not a file our upload route signed. */
export function ownBlobHref(value: string, storeHost: string | null): string | null {
  if (!storeHost) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== storeHost || url.search || url.hash) return null;
  if (!url.pathname.startsWith(`/${UPLOAD_PREFIX}`)) return null;
  return url.href;
}

/** Pathname check for the signing route: our prefix, and no segment that could walk out of it. */
export function isUploadPathname(pathname: string): boolean {
  return pathname.startsWith(UPLOAD_PREFIX) && !pathname.split("/").some((segment) => segment === ".." || segment === ".");
}
