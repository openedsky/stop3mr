import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { getQrSettings, saveQrSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildVerifyUrl, generateQrCodeDataUrl } from "@/lib/qr";

export async function GET() {
  const { error, session } = await requireAuth(["OPERATEUR", "ADMINISTRATEUR"]);
  if (error) return error;

  const settings = await getQrSettings();
  const previewUrl = await buildVerifyUrl("R3M-PR-000000-000001");
  const previewQr = await generateQrCodeDataUrl(previewUrl);

  return NextResponse.json({
    settings,
    previewUrl,
    previewQr,
    canEdit: session!.user.role === "ADMINISTRATEUR",
  });
}

const schema = z.object({
  environment: z.enum(["localhost", "production"]),
  urlLocalhost: z.string().url(),
  urlProduction: z.string().url(),
  verifyPath: z.string().min(1),
  regenerateAll: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth(["ADMINISTRATEUR"]);
  if (error) return error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const settings = await saveQrSettings(parsed.data);

  let regenerated = 0;
  if (parsed.data.regenerateAll) {
    const cleared = await prisma.plaque.updateMany({
      where: { qrCodeData: { not: "" } },
      data: { qrCodeData: "" },
    });
    regenerated = cleared.count;
  }

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "PARAMETRES_MODIFIES",
    cible: "qr_settings",
    details: JSON.stringify({ environment: settings.environment, regenerated }),
    adresseIp: getClientIp(request),
  });

  const previewUrl = await buildVerifyUrl("R3M-PR-000000-000001");
  const previewQr = await generateQrCodeDataUrl(previewUrl);

  return NextResponse.json({ settings, previewUrl, previewQr, regenerated });
}
