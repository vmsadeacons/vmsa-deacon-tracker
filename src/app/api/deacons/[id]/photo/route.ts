import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeaconPhoto } from "@/lib/repo/deacons";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const photo = await getDeaconPhoto(id);
  if (!photo) return new NextResponse(null, { status: 404 });

  // Every in-app photo URL carries a ?v= key that changes whenever the
  // photo does (see DeaconAvatar), so a versioned URL can be remembered by
  // the browser for a year -- it never needs to ask the server again. A
  // request without the key keeps the short cache. "private" keeps the photo
  // out of shared/CDN caches: it stays behind login.
  const versioned = new URL(req.url).searchParams.has("v");
  return new NextResponse(new Uint8Array(photo), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": versioned
        ? "private, max-age=31536000, immutable"
        : "private, max-age=3600",
    },
  });
}
