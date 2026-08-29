import PDFDocument from "pdfkit";
import { FACTURE_STATUT_LABELS, MODE_PAIEMENT_LABELS } from "./crm";
import { FNE_STATUT_LABELS } from "./clients";
import { registerPdfFonts, type PdfFonts } from "./pdf-fonts";

const COMPANY = {
  name: "Stop Réfléchissant 3M",
  brand: "Stop 3MR",
  address: "Abidjan, Côte d'Ivoire",
  phone: "+225 XX XX XX XX XX",
  email: "contact@stop3mr.ci",
  ncc: process.env.COMPTE_CONTRIBUABLE ?? "CI-XXXXX",
};

const PAGE = {
  left: 50,
  right: 545,
  width: 495,
};

type ClientPdf = {
  nom: string;
  typeClient?: string;
  raisonSociale?: string | null;
  telephone: string;
  email?: string | null;
  ncc?: string | null;
  rccm?: string | null;
  adresse?: string | null;
  commune?: string | null;
  ville?: string | null;
  immatriculation?: string;
  vehicules?: string[];
  fneStatut?: string;
  fneReference?: string | null;
};

function formatFcfaPdf(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR").format(amount).replace(/\u202f/g, " ").replace(/\u00a0/g, " ") +
    " F CFA"
  );
}

function textRight(doc: PDFKit.PDFDocument, text: string, y: number) {
  doc.text(text, PAGE.left, y, { width: PAGE.width, align: "right" });
}

function drawHeader(doc: PDFKit.PDFDocument, fonts: PdfFonts) {
  doc.rect(PAGE.left, 50, PAGE.width, 60).fill("#dc2626");
  doc.fillColor("#ffffff").fontSize(18).font(fonts.bold).text(COMPANY.name, 60, 65);
  doc.fontSize(10).font(fonts.regular).text(`${COMPANY.brand} — ${COMPANY.address}`, 60, 88);
  doc.fillColor("#000000");
}

function drawClientBlock(
  doc: PDFKit.PDFDocument,
  fonts: PdfFonts,
  client: ClientPdf,
  startY: number
): number {
  const lineHeight = 14;
  let y = startY;

  doc.fontSize(11).font(fonts.bold).text("Client", PAGE.left, y);
  y += 18;

  doc.font(fonts.regular).fontSize(10);
  const label =
    client.typeClient === "ENTREPRISE" && client.raisonSociale ? client.raisonSociale : client.nom;

  doc.text(label, PAGE.left, y, { width: 230 });
  doc.text(`Tél : ${client.telephone}`, 300, y, { width: 245 });
  y += lineHeight;

  if (client.ncc) {
    doc.text(`NCC : ${client.ncc}`, PAGE.left, y);
    y += lineHeight;
  }

  if (client.rccm) {
    doc.text(`RCCM : ${client.rccm}`, PAGE.left, y);
    y += lineHeight;
  }

  if (client.email) {
    doc.text(`E-mail : ${client.email}`, 300, y, { width: 245 });
    y += lineHeight;
  }

  if (client.immatriculation) {
    doc.text(`Immat. : ${client.immatriculation}`, 300, y, { width: 245 });
    y += lineHeight;
  }

  if (client.vehicules && client.vehicules.length > 1) {
    doc.text(`Véhicules : ${client.vehicules.join(", ")}`, PAGE.left, y, { width: PAGE.width });
    y += lineHeight;
  }

  if (client.adresse) {
    const adresse = [client.adresse, client.commune, client.ville].filter(Boolean).join(", ");
    doc.text(adresse, PAGE.left, y, { width: PAGE.width });
    y += lineHeight;
  }

  if (client.fneStatut && client.fneStatut !== "NON_APPLICABLE") {
    const fneLabel = FNE_STATUT_LABELS[client.fneStatut] ?? client.fneStatut;
    const fneRef = client.fneReference ? ` — Réf. ${client.fneReference}` : "";
    doc.text(`FNE : ${fneLabel}${fneRef}`, PAGE.left, y, { width: PAGE.width });
    y += lineHeight;
  }

  return y + 8;
}

function buildPdf(fn: (doc: PDFKit.PDFDocument, fonts: PdfFonts) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE.left, bufferPages: true });
    const chunks: Buffer[] = [];
    const fonts = registerPdfFonts(doc);

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, fonts);
    fn(doc, fonts);
    doc.end();
  });
}

export async function generateFacturePdf(facture: {
  numero: string;
  dateEmission: Date;
  dateEcheance?: Date | null;
  statut: string;
  montantHt: number;
  montantTtc: number;
  montantPaye: number;
  tva: number;
  description?: string | null;
  client: ClientPdf;
}) {
  return buildPdf((doc, fonts) => {
    doc.fontSize(20).font(fonts.bold).fillColor("#000").text("FACTURE", PAGE.left, 130);
    doc.fontSize(10).font(fonts.regular);
    textRight(doc, `N° ${facture.numero}`, 130);
    textRight(doc, `Date : ${facture.dateEmission.toLocaleDateString("fr-FR")}`, 145);
    textRight(doc, `Échéance : ${facture.dateEcheance?.toLocaleDateString("fr-FR") ?? "—"}`, 160);
    textRight(doc, `Statut : ${FACTURE_STATUT_LABELS[facture.statut] ?? facture.statut}`, 175);

    const contentY = drawClientBlock(doc, fonts, facture.client, 200);
    const y = contentY + 10;

    doc.font(fonts.bold).text("Montant HT", PAGE.left, y);
    doc.text(formatFcfaPdf(facture.montantHt), 200, y);
    doc.font(fonts.regular).text("TVA", PAGE.left, y + 20);
    doc.text(formatFcfaPdf(facture.tva), 200, y + 20);
    doc.font(fonts.bold).text("Total TTC", PAGE.left, y + 40);
    doc.text(formatFcfaPdf(facture.montantTtc), 200, y + 40);
    doc.font(fonts.regular).text("Montant payé", PAGE.left, y + 60);
    doc.text(formatFcfaPdf(facture.montantPaye), 200, y + 60);
    doc.font(fonts.bold).fillColor("#dc2626").text("Solde dû", PAGE.left, y + 80);
    doc.text(formatFcfaPdf(facture.montantTtc - facture.montantPaye), 200, y + 80);

    doc
      .fillColor("#666")
      .fontSize(8)
      .text("Facture éligible FNE — Conformité DGI Côte d'Ivoire", PAGE.left, 720, {
        width: PAGE.width,
        align: "center",
      })
      .text(`NCC : ${COMPANY.ncc}`, PAGE.left, 735, { width: PAGE.width, align: "center" });
  });
}

export async function generateRecuPdf(recu: {
  numero: string;
  datePaiement: Date;
  montant: number;
  modePaiement: string;
  reference?: string | null;
  factureNumero: string;
  client: ClientPdf;
}) {
  return buildPdf((doc, fonts) => {
    doc.fontSize(20).font(fonts.bold).text("REÇU DE PAIEMENT", PAGE.left, 130);
    doc.fontSize(10).font(fonts.regular);
    textRight(doc, `N° ${recu.numero}`, 130);
    textRight(doc, `Date : ${recu.datePaiement.toLocaleDateString("fr-FR")}`, 145);

    const contentY = drawClientBlock(doc, fonts, recu.client, 200);

    doc.fontSize(14).font(fonts.bold).text(`Montant reçu : ${formatFcfaPdf(recu.montant)}`, PAGE.left, contentY + 12);
    doc
      .fontSize(11)
      .font(fonts.regular)
      .text(`Mode : ${MODE_PAIEMENT_LABELS[recu.modePaiement] ?? recu.modePaiement}`, PAGE.left, contentY + 38)
      .text(`Facture : ${recu.factureNumero}`, PAGE.left, contentY + 55);

    if (recu.reference) {
      doc.text(`Référence : ${recu.reference}`, PAGE.left, contentY + 72);
    }

    doc
      .fontSize(8)
      .fillColor("#666")
      .text("Ce reçu atteste du paiement reçu. Document généré électroniquement.", PAGE.left, 750, {
        width: PAGE.width,
        align: "center",
      });
  });
}
