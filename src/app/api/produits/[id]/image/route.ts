import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { ROLES } from "@/lib/roles";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const { id } = await params;
  const produitId = Number(id);
  const produit = await prisma.produit.findUnique({ where: { id: produitId } });
  if (!produit) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Fichier image requis" }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Image trop lourde (max 4 Mo)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let webp: Buffer;
  try {
    webp = await sharp(buffer).rotate().resize(900, 900, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Fichier image illisible (PNG, JPG ou WEBP)" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "uploads", "produits");
  await mkdir(dir, { recursive: true });
  const filename = `${produit.code.toLowerCase().replace(/[^a-z0-9-]/g, "")}-${Date.now()}.webp`;
  await writeFile(path.join(dir, filename), webp);

  const imagePath = `/uploads/produits/${filename}`;
  const updated = await prisma.produit.update({
    where: { id: produitId },
    data: { imagePath },
  });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "PRODUIT_IMAGE_MODIFIEE",
    cible: produit.code,
    details: imagePath,
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ produit: updated });
}
