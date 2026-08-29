import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth([...ROLES.VENTES, "AGENT_CT"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(80, Math.max(1, Number(searchParams.get("limit") ?? 40)));

  const where = {
    actif: true,
    ...(q
      ? {
          OR: [
            { code: { contains: q } },
            { libelle: { contains: q } },
            { ville: { contains: q } },
            { commune: { contains: q } },
            { quartier: { contains: q } },
          ],
        }
      : {}),
  };

  const [centres, total] = await Promise.all([
    prisma.centreControle.findMany({
      where,
      orderBy: [{ ville: "asc" }, { libelle: "asc" }],
      take: limit,
      select: {
        id: true,
        code: true,
        libelle: true,
        ville: true,
        commune: true,
        quartier: true,
      },
    }),
    prisma.centreControle.count({ where }),
  ]);

  return NextResponse.json({ centres, total });
}
