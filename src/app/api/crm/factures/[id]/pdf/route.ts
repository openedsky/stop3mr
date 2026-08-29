import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { clientForPdf } from "@/lib/client-pdf";
import { generateFacturePdf } from "@/lib/pdf";
import { pdfResponse } from "@/lib/pdf-response";
import { NextResponse } from "next/server";
import { ROLES } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(ROLES.CRM);
  if (error) return error;

  const { id } = await params;
  const facture = await prisma.facture.findUnique({
    where: { id: Number(id) },
    include: { client: true },
  });

  if (!facture) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  const client = await clientForPdf(facture.clientId);
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  try {
    const pdf = await generateFacturePdf({ ...facture, client });
    return pdfResponse(pdf, `facture-${facture.numero}.pdf`);
  } catch (err) {
    console.error("[PDF facture]", err);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
