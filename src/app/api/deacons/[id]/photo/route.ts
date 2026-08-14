import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeaconPhoto } from "@/lib/repo/deacons";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const photo = await getDeaconPhoto(id);
  if (!photo) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(photo), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
