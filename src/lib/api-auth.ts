import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { getTrustedClientIp } from "./security";
import { AppRole } from "./roles";

export async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (session.expires && new Date(session.expires) < new Date()) return null;
  return session;
}

export async function requireAuth(roles?: readonly AppRole[]) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }), session: null };
  }
  if (roles && !roles.includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export function getClientIp(request: Request): string | undefined {
  const ip = getTrustedClientIp(request);
  if (ip === "local" || ip === "direct") return undefined;
  return ip;
}
