import { type NextRequest } from "next/server";
import { GET as legacyGET } from "@/app/api/wz_AuthLogin/discord/callback/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  return legacyGET(req);
}
