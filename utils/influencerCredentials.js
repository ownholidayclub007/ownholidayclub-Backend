const crypto = require("crypto");

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

const getEncryptionKey = () => {
  const configuredKey = String(
    process.env.INFLUENCER_CREDENTIALS_ENCRYPTION_KEY || "",
  ).trim();
  if (!/^[a-f0-9]{64}$/i.test(configuredKey)) {
    const error = new Error(
      "INFLUENCER_CREDENTIALS_ENCRYPTION_KEY must be configured as a 64-character hexadecimal key.",
    );
    error.statusCode = 503;
    throw error;
  }
  return Buffer.from(configuredKey, "hex");
};

const generatePassword = (referralCode) => {
  const prefix = String(referralCode || "")
    .trim()
    .toUpperCase();
  const safePrefix = prefix.replace(/[^A-Z0-9]/g, "") || "OHC";
  const suffixLength = Math.max(12 - safePrefix.length - 1, 7);
  const letters = Array.from({ length: suffixLength - 1 }, () =>
    PASSWORD_ALPHABET.charAt(crypto.randomInt(0, PASSWORD_ALPHABET.length)),
  ).join("");
  const digit = String(crypto.randomInt(0, 10));
  return `${safePrefix}@${letters}${digit}`;
};

const encryptPassword = (password) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(password), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

const decryptPassword = (value) => {
  if (!value) return null;
  const [version, ivHex, authTagHex, encryptedHex] = String(value).split(":");
  if (version !== "v1" || !ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Stored influencer credential has an invalid format.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
};

module.exports = { decryptPassword, encryptPassword, generatePassword };
