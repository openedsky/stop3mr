import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { agregatsCommissionsVente } from "@/lib/commission-stats";

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.VENTES);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const commercialIdParam = Number(searchParams.get("commercialId") ?? 0);

  const role = session!.user.role;
  const userId = Number(session!.user.id);
  const vendeurId =
    role === "COMMERCIAL" ? userId : commercialIdParam || undefined;

  const toDate = to ? new Date(to) : undefined;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const payload = await agregatsCommissionsVente({
    vendeurId,
    from: from ? new Date(from) : undefined,
    to: toDate,
  });

  return NextResponse.json(payload);
}
