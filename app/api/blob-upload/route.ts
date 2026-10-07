import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/current";
import { createRateLimiter } from "@/lib/intake/rate-limit";
import { isUploadPathname } from "@/lib/intake/blob-url";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "@/lib/intake/uploads";

// Files go from the browser straight to Blob (a function body tops out at 4.5 MB); this route only signs a one-time
// token, so type and size are enforced here, not in the client.
const isUploadRateLimited = createRateLimiter(30, 60 * 60 * 1000);

export async function POST(request: Request): Promise<NextResponse> {
  const user = await currentSession();
  if (!user?.canRequest) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isUploadRateLimited(user.userId)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!isUploadPathname(pathname)) throw new Error("pathname fuera del prefijo permitido");
        return { allowedContentTypes: ACCEPTED_TYPES, maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("falló la firma de subida", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 400 });
  }
}
