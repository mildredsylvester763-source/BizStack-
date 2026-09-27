import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.BIZSTACK_ENCRYPTION_KEY;
  if (!raw) throw new Error("BIZSTACK_ENCRYPTION_KEY is not configured");
  const decoded = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw new Error("BIZSTACK_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return decoded;
}

export function encryptSecret(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret<T = Record<string, unknown>>(payload: string): T {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (version !== VERSION || !ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted secret");
  const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}