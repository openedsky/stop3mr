import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { dateRange } from "@/lib/pagination";
import { agregatsCommissionsControle } from "@/lib/commission-stats";

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.COMMISSIONS_CT);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const range = dateRange(searchParams.get("from"), searchParams.get("to"));
  const role = session!.user.role;
  const userId = Number(session!.user.id);

  const payload = await agregatsCommissionsControle({
    agentId: role === "AGENT_CT" ? userId : undefined,
    from: range?.gte,
    to: range?.lte,
  });

  return NextResponse.json(payload);
}
