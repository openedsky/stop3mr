import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { getAuditLabel } from "@/lib/clients";

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.ALL);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 30)));
  const skip = (page - 1) * limit;
  const action = searchParams.get("action")?.trim();
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {
    utilisateurId: Number(session!.user.id),
  };
  if (action) where.action = action;
  if (q) {
    where.OR = [
      { cible: { contains: q } },
      { details: { contains: q } },
      { action: { contains: q } },
    ];
  }

  const [entries, total] = await Promise.all([
    prisma.journalAudit.findMany({
      where,
      orderBy: { horodatage: "desc" },
      skip,
      take: limit,
    }),
    prisma.journalAudit.count({ where }),
  ]);

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      actionLabel: getAuditLabel(e.action),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
