import nodemailer from "nodemailer";
import { prisma } from "./db";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user, pass },
  });
}

export async function notifySale(params: {
  numeroSerie: string;
  nomClient: string;
  dateVente: Date;
  venteId: number;
}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const transporter = createTransporter();

  const subject = `[Stop 3MR] Nouvelle vente — ${params.numeroSerie}`;
  const body = `
Nouvelle vente enregistrée sur la plateforme Stop 3MR.

Numéro de série : ${params.numeroSerie}
Client          : ${params.nomClient}
Date et heure   : ${params.dateVente.toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}

— Plateforme Stop Réfléchissant 3M
  `.trim();

  if (transporter && adminEmail) {
    try {
      await transporter.sendMail({
        from: `"Stop 3MR" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject,
        text: body,
      });
      await prisma.vente.update({
        where: { id: params.venteId },
        data: { notifieLe: new Date() },
      });
      return { sent: true, channel: "email" as const };
    } catch (error) {
      console.error("Email notification failed:", error);
    }
  }

  console.log("[NOTIFICATION VENTE]", `série ${params.numeroSerie} vente #${params.venteId}`);
  return { sent: false, channel: "console" as const };
}
