/** Shared by the client (accept attribute, early errors) and the signing route (the check that actually holds). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 10;
// A prefix keeps our files listable apart from anything else in the store, so orphan cleanup stays possible.
export const UPLOAD_PREFIX = "requests/";

export const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
];
