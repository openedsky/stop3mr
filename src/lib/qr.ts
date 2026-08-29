import QRCode from "qrcode";
import sharp from "sharp";
import { getActiveBaseUrl, getQrSettings } from "./settings";

export async function buildVerifyUrl(numeroSerie: string): Promise<string> {
  const settings = await getQrSettings();
  const base = settings.environment === "production" ? settings.urlProduction : settings.urlLocalhost;
  const path = settings.verifyPath.replace(/\/$/, "");
  return `${base.replace(/\/$/, "")}${path}/${encodeURIComponent(numeroSerie)}`;
}

async function createLogoBuffer(size: number): Promise<Buffer> {
  const pad = Math.max(2, Math.round(size * 0.08));
  const inner = size - pad * 2;
  const outerRx = Math.round(size * 0.18);
  const innerRx = Math.round(inner * 0.16);
  const fontSize = Math.round(inner * 0.32);

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${outerRx}" fill="#ffffff"/>
    <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${innerRx}" fill="#dc2626"/>
    <text x="50%" y="54%" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">3MR</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function embedLogo(qrBuffer: Buffer, qrSize: number, logoRatio = 0.2): Promise<Buffer> {
  const logoSize = Math.round(qrSize * logoRatio);
  const logoBuffer = await createLogoBuffer(logoSize);
  return sharp(qrBuffer)
    .composite([
      {
        input: logoBuffer,
        top: Math.floor((qrSize - logoSize) / 2),
        left: Math.floor((qrSize - logoSize) / 2),
      },
    ])
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}

/** PNG haute résolution pour impression : QR 2 cm × 2 cm avec logo 3MR centré. */
export async function generatePrintQrPng(verifyUrl: string, pixelSize = 600): Promise<Buffer> {
  const raw = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: pixelSize,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return embedLogo(raw, pixelSize, 0.2);
}

export async function generateQrCodeDataUrl(verifyUrl: string): Promise<string> {
  const qrSize = 400;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: qrSize,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  const composited = await embedLogo(qrBuffer, qrSize, 0.2);
  return `data:image/png;base64,${composited.toString("base64")}`;
}

export async function generateQrCodeSvg(verifyUrl: string): Promise<string> {
  return QRCode.toString(verifyUrl, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
  });
}

/** Régénère le QR d'une plaque avec l'URL active (après changement de paramètres) */
export async function regeneratePlaqueQr(numeroSerie: string): Promise<string> {
  const url = await buildVerifyUrl(numeroSerie);
  return generateQrCodeDataUrl(url);
}
