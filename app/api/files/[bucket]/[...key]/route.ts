import { NextResponse, type NextRequest } from "next/server";
import { getSession, hasAnyRole } from "@/server/auth/session";
import { storage, type Bucket } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Serves locally stored uploads. Payment proofs are private to owners/managers. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ bucket: string; key: string[] }> }) {
  const { bucket, key } = await params;
  if (bucket !== "menu-images" && bucket !== "payment-proofs") return new NextResponse("not found", { status: 404 });
  if (bucket === "payment-proofs" && !hasAnyRole(await getSession(), ["owner", "manager"])) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const file = await storage().read(bucket as Bucket, key.join("/")).catch(() => null);
  if (!file) return new NextResponse("not found", { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": bucket === "menu-images" ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
