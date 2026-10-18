import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const MAX_TOKEN_BYTES = 16 * 1024;

function getEncryptionKey() {
  const encoded = process.env.PAYMENT_TOKEN_ENCRYPTION_KEY;

  if (typeof encoded !== "string") {
    throw new Error("Payment token encryption is not configured");
  }

  const key = Buffer.from(encoded, "base64");

  if (
    key.length !== 32 ||
    key.toString("base64") !== encoded
  ) {
    throw new Error("Invalid payment token encryption key");
  }

  return key;
}

// Bind each encrypted token to its clinic, merchant and purpose.
// Copying ciphertext to a different account must fail decryption.
function getContext({
  clinicId,
  merchantAccountId,
  mode,
  tokenType,
}) {
  const clinic = String(clinicId || "");
  const merchant = String(merchantAccountId || "");

  if (
    !/^[a-fA-F0-9]{24}$/.test(clinic) ||
    !merchant ||
    merchant.length > 200 ||
    !["test", "live"].includes(mode) ||
    !["access_token", "refresh_token"].includes(tokenType)
  ) {
    throw new Error("Invalid payment token context");
  }

  return Buffer.from(
    JSON.stringify([
      VERSION,
      clinic.toLowerCase(),
      "razorpay",
      merchant,
      mode,
      tokenType,
    ]),
    "utf8"
  );
}

function decodePart(value) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new Error("Invalid encrypted token");
  }

  const decoded = Buffer.from(value, "base64url");

  if (decoded.toString("base64url") !== value) {
    throw new Error("Invalid encrypted token");
  }

  return decoded;
}

export function encryptPaymentToken(token, context) {
  if (
    typeof token !== "string" ||
    !token.trim() ||
    Buffer.byteLength(token, "utf8") > MAX_TOKEN_BYTES
  ) {
    throw new Error("Invalid payment token");
  }

  const key = getEncryptionKey();
  const aad = getContext(context);
  const iv = randomBytes(12);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptPaymentToken(value, context) {
  const key = getEncryptionKey();
  const aad = getContext(context);

  try {
    if (
      typeof value !== "string" ||
      value.length > 32768
    ) {
      throw new Error("Invalid encrypted token");
    }

    const parts = value.split(".");

    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new Error("Unsupported encrypted token");
    }

    const iv = decodePart(parts[1]);
    const tag = decodePart(parts[2]);
    const encrypted = decodePart(parts[3]);

    if (
      iv.length !== 12 ||
      tag.length !== 16 ||
      encrypted.length > MAX_TOKEN_BYTES
    ) {
      throw new Error("Invalid encrypted token");
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      iv,
      { authTagLength: 16 }
    );

    decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt payment token");
  }
}