import PDFDocument from "pdfkit";
import { registerPdfFonts } from "./pdf-fonts";
import { buildVerifyUrl, generatePrintQrPng } from "./qr";

const CM = 28.346456692913385;
const QR_SIZE = 2 * CM;

export type QrPdfItem = {
  numeroSerie: string;
  qrCodeData?: string;
};

/** Un seul QR 2 cm × 2 cm, centré sur une page A4, sans titre. */
export async function buildQrA4Pdf(item: QrPdfItem): Promise<Buffer> {
  const verifyUrl = await buildVerifyUrl(item.numeroSerie);
  const png = await generatePrintQrPng(verifyUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    const fonts = registerPdfFonts(doc);

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const x = (pageW - QR_SIZE) / 2;
    const y = (pageH - QR_SIZE) / 2;

    try {
      doc.image(png, x, y, { width: QR_SIZE, height: QR_SIZE });
    } catch {
      doc.rect(x, y, QR_SIZE, QR_SIZE).stroke("#000000");
    }

    doc.font(fonts.regular).fontSize(8).fillColor("#0f172a");
    doc.text(item.numeroSerie, 40, y + QR_SIZE + 6, {
      width: pageW - 80,
      align: "center",
      lineBreak: false,
    });

    doc.end();
  });
}
