import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";

export async function GET() {
  const { error } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Indisponible en production" }, { status: 404 });
  }

  try {
    const csv = await readFile(path.join(process.cwd(), "prisma", "data", "comptes-test.csv"), "utf8");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="comptes-test-stop3mr.csv"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Fichier des comptes test absent. Lancez npm run db:seed:territoire." },
      { status: 404 }
    );
  }
}
