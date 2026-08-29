import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { clientForPdf } from "@/lib/client-pdf";
import { generateRecuPdf } from "@/lib/pdf";
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
  const recu = await prisma.recuPaiement.findUnique({
    where: { id: Number(id) },
    include: { client: true, facture: { select: { numero: true } } },
  });

  if (!recu) return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });

  const client = await clientForPdf(recu.clientId);
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  try {
    const pdf = await generateRecuPdf({
      ...recu,
      factureNumero: recu.facture.numero,
      client,
    });
    return pdfResponse(pdf, `recu-${recu.numero}.pdf`);
  } catch (err) {
    console.error("[PDF recu]", err);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
