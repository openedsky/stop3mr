import fs from "fs";
import path from "path";

export type PdfFonts = {
  regular: string;
  bold: string;
};

function resolveFontFile(name: string): string | null {
  const roots = [
    process.cwd(),
    path.join(process.cwd(), ".."),
    path.join(process.cwd(), "..", ".."),
  ];

  for (const root of roots) {
    const candidate = path.join(root, "public", "fonts", name);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

export function registerPdfFonts(doc: PDFKit.PDFDocument): PdfFonts {
  const regularPath = resolveFontFile("Roboto-Regular.ttf");
  const boldPath = resolveFontFile("Roboto-Bold.ttf");

  if (regularPath && boldPath) {
    doc.registerFont("PdfRegular", regularPath);
    doc.registerFont("PdfBold", boldPath);
    return { regular: "PdfRegular", bold: "PdfBold" };
  }

  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}
