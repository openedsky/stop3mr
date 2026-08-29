import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

export function requireEncryptionKey(): string {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return keyHex;
}

function getKey(): Buffer {
  return Buffer.from(requireEncryptionKey(), "hex");
}

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(payload: string): string {
  if (!payload) return payload;

  const parts = payload.split(":");
  if (parts.length !== 3) {
    return payload;
  }

  const [ivHex, authTagHex, encrypted] = parts;
  if (ivHex.length !== 32 || authTagHex.length !== 32) {
    return payload;
  }

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    throw new Error("Échec du déchiffrement des données");
  }
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, 2) + "****" + phone.slice(-2);
}
