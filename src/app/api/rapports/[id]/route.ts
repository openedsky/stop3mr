import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const id = Number((await params).id);
  const body = await request.json();
  const statut = body.statut === "LU" || body.statut === "SOUMIS" ? body.statut : null;
  if (!statut) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });

  const rapport = await prisma.rapport.update({
    where: { id },
    data: { statut },
  });

  return NextResponse.json({ rapport });
}
