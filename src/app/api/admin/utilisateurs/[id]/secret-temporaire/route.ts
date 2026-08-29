import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { consommerMotDePasseTemporaire } from "@/lib/secret-temporaire";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const userId = Number((await params).id);
  if (!userId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const secretId = typeof body?.secretTemporaireId === "string" ? body.secretTemporaireId : "";
  const motDePasse = await consommerMotDePasseTemporaire(secretId, userId);
  if (!motDePasse) {
    return NextResponse.json({ error: "Secret déjà consommé ou expiré" }, { status: 410 });
  }

  return NextResponse.json(
    { motDePasseTemporaire: motDePasse },
    { headers: { "Cache-Control": "no-store, no-cache, private" } }
  );
}
