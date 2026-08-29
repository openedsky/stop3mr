import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { decryptClientRecord } from "@/lib/clients";
import { csvEscape, sanitizeSpreadsheetValue } from "@/lib/security";
import { rateLimitPersistent, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth(["ADMINISTRATEUR"]);
  if (error) return error;

  const ip = getClientIp(request) ?? "local";
  const rl = await rateLimitPersistent(`export:${session!.user.id}:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "xlsx";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.dateFabrication = {};
    if (from) (where.dateFabrication as Record<string, Date>).gte = new Date(from);
    if (to) (where.dateFabrication as Record<string, Date>).lte = new Date(to);
  }

  const EXPORT_MAX = 2000;
  const plaques = await prisma.plaque.findMany({
    where,
    omit: { tokenEnregistrement: true },
    include: {
      vente: {
        include: {
          client: true,
          vehicule: { select: { immatriculation: true, marqueVehicule: true, modeleVehicule: true } },
        },
      },
    },
    orderBy: { dateFabrication: "desc" },
    take: EXPORT_MAX,
  });

  const rows = plaques.map((p) => {
    const client = p.vente?.client ? decryptClientRecord(p.vente.client) : null;
    return {
      numeroSerie: sanitizeSpreadsheetValue(p.numeroSerie),
      typeProduit: sanitizeSpreadsheetValue(p.typeProduit),
      siteProduction: sanitizeSpreadsheetValue(p.siteProduction),
      dateFabrication: sanitizeSpreadsheetValue(p.dateFabrication.toISOString()),
      statut: sanitizeSpreadsheetValue(p.statut),
      nomClient: sanitizeSpreadsheetValue(client?.nom ?? ""),
      telephone: sanitizeSpreadsheetValue(client?.telephone ?? ""),
      email: sanitizeSpreadsheetValue(client?.email ?? ""),
      immatriculation: sanitizeSpreadsheetValue(p.vente?.vehicule?.immatriculation ?? ""),
      marqueVehicule: sanitizeSpreadsheetValue(p.vente?.vehicule?.marqueVehicule ?? ""),
      modeleVehicule: sanitizeSpreadsheetValue(p.vente?.vehicule?.modeleVehicule ?? ""),
      dateVente: sanitizeSpreadsheetValue(p.vente?.dateVente.toISOString() ?? ""),
      prixVente: p.vente?.prixVente ?? "",
      commissionMontant: p.vente?.commissionMontant ?? "",
      prixReference: p.vente ? p.vente.prixVente : p.prixReference,
    };
  });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "EXPORT_DONNEES",
    cible: format,
    details: `${rows.length} lignes`,
    adresseIp: getClientIp(request),
  });

  if (format === "csv") {
    const headers = Object.keys(rows[0] ?? {
      numeroSerie: "",
      typeProduit: "",
      siteProduction: "",
      dateFabrication: "",
      statut: "",
      nomClient: "",
      telephone: "",
      email: "",
      immatriculation: "",
      marqueVehicule: "",
      modeleVehicule: "",
      dateVente: "",
      prixVente: "",
      commissionMontant: "",
      prixReference: "",
    }).join(";");
    const csvRows = rows.map((r) => Object.values(r).map((v) => csvEscape(v as string | number)).join(";"));
    const csv = `\uFEFF${[headers, ...csvRows].join("\n")}`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="stop3mr-export-${Date.now()}.csv"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plaques Stop 3MR");
  sheet.columns = [
    { header: "Numéro de série", key: "numeroSerie", width: 28 },
    { header: "Type", key: "typeProduit", width: 20 },
    { header: "Site", key: "siteProduction", width: 10 },
    { header: "Date fabrication", key: "dateFabrication", width: 22 },
    { header: "Statut", key: "statut", width: 12 },
    { header: "Client", key: "nomClient", width: 25 },
    { header: "Téléphone", key: "telephone", width: 18 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Immatriculation", key: "immatriculation", width: 18 },
    { header: "Date vente", key: "dateVente", width: 22 },
    { header: "Prix de vente figé (FCFA)", key: "prixVente", width: 22 },
    { header: "Commission figée (FCFA)", key: "commissionMontant", width: 22 },
    { header: "Prix réf. stock (FCFA)", key: "prixReference", width: 18 },
  ];
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      if (typeof cell.value === "string") {
        cell.value = sanitizeSpreadsheetValue(cell.value);
        cell.numFmt = "@";
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stop3mr-export-${Date.now()}.xlsx"`,
    },
  });
}
