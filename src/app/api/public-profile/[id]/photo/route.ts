import { NextResponse } from "next/server";
import { getPublicDeaconPhoto } from "@/lib/repo/publicProfile";

// No auth check, on purpose -- serves a photo preview inside the public
// self-service profile form, scoped to Active deacons only (see
// getPublicDeaconPhoto). Never leaks anything beyond the photo bytes.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const photo = await getPublicDeaconPhoto(id);
  if (!photo) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(photo), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
