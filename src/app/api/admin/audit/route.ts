import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getAuditLabel } from "@/lib/clients";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(["ADMINISTRATEUR"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));
  const skip = (page - 1) * limit;
  const utilisateurId = searchParams.get("utilisateurId");
  const action = searchParams.get("action")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};
  if (utilisateurId) where.utilisateurId = Number(utilisateurId);
  if (action) where.action = action;
  if (from || to) {
    where.horodatage = {};
    if (from) (where.horodatage as Record<string, Date>).gte = new Date(from);
    if (to) (where.horodatage as Record<string, Date>).lte = new Date(to);
  }
  if (q) {
    where.OR = [
      { cible: { contains: q } },
      { details: { contains: q } },
      { action: { contains: q } },
    ];
  }

  const [entries, total, utilisateurs] = await Promise.all([
    prisma.journalAudit.findMany({
      where,
      include: {
        utilisateur: { select: { id: true, identifiant: true, nom: true, role: true } },
      },
      orderBy: { horodatage: "desc" },
      skip,
      take: limit,
    }),
    prisma.journalAudit.count({ where }),
    prisma.utilisateur.findMany({
      select: { id: true, identifiant: true, nom: true, role: true },
      orderBy: { identifiant: "asc" },
    }),
  ]);

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      actionLabel: getAuditLabel(e.action),
    })),
    utilisateurs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
