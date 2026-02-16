import type { NextRequest } from "next/server";
import {
  readSessionFromCookieHeader,
  readSessionFromRequest,
  type SessionPayload,
} from "./_session";
import { validateAndTouchSession } from "./_session_devices";
import type { HeaderLike } from "./_device_identity";

export async function readActiveSessionFromRequest(
  req: NextRequest,
  opts?: { touchWindowMs?: number; seedIfMissing?: boolean },
) {
  const session = readSessionFromRequest(req);
  if (!session) return null;

  const validation = await validateAndTouchSession({
    session,
    headers: req.headers,
    touchWindowMs: opts?.touchWindowMs,
    seedIfMissing: opts?.seedIfMissing === true,
  });

  if (!validation.active) return null;
  return session;
}

export async function readActiveSessionFromCookie(params: {
  cookieHeader: string | null | undefined;
  headers: HeaderLike;
  touchWindowMs?: number;
  seedIfMissing?: boolean;
}) {
  const session = readSessionFromCookieHeader(
    params.cookieHeader,
    params.headers || null,
  );
  if (!session) return null;

  const validation = await validateAndTouchSession({
    session: session as SessionPayload,
    headers: params.headers || null,
    touchWindowMs: params.touchWindowMs,
    seedIfMissing: params.seedIfMissing === true,
  });

  if (!validation.active) return null;
  return session;
}
