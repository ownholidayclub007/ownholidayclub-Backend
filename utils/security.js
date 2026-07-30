const crypto = require("crypto");

const DEFAULT_OTP_TTL_MINUTES = 15;
const DEFAULT_OTP_LENGTH = 6;

const normaliseUsername = (value) => String(value || "").trim().toLowerCase();

const normaliseMobile = (value) => String(value || "").replace(/\D/g, "");

const normaliseEmail = (value) => String(value || "").trim().toLowerCase();

const hashSecret = (value) => {
  const plainText = String(value || "");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plainText, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
};

const verifySecret = (value, storedHash) => {
  if (!value || !storedHash) {
    return false;
  }

  const [salt, originalHash] = String(storedHash).split(":");

  if (!salt || !originalHash) {
    return false;
  }

  const derivedHash = crypto.scryptSync(String(value), salt, 64);
  const originalHashBuffer = Buffer.from(originalHash, "hex");

  if (derivedHash.length !== originalHashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedHash, originalHashBuffer);
};

const generateOtp = (length = DEFAULT_OTP_LENGTH) => {
  const safeLength =
    Number.isInteger(length) && length >= 4 && length <= 10
      ? length
      : DEFAULT_OTP_LENGTH;
  const min = safeLength === 1 ? 0 : 10 ** (safeLength - 1);
  const max = 10 ** safeLength;

  return crypto.randomInt(min, max).toString().padStart(safeLength, "0");
};

const generateRandomPassword = (length = 10) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length }, () =>
    alphabet.charAt(crypto.randomInt(0, alphabet.length)),
  ).join("");
};

const getOtpExpiry = (ttlMinutesValue = process.env.OTP_TTL_MINUTES) => {
  const ttlMinutes = Number(ttlMinutesValue || DEFAULT_OTP_TTL_MINUTES);
  const safeTtlMinutes =
    Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : DEFAULT_OTP_TTL_MINUTES;

  return new Date(Date.now() + safeTtlMinutes * 60 * 1000);
};

const hasOtpExpired = (expiresAt) => !expiresAt || expiresAt.getTime() < Date.now();

const buildOtpDebugPayload = (otp) =>
  process.env.NODE_ENV === "production" ? {} : { otp };

const CMS_TOKEN_TTL_HOURS = 12;
const CMS_TOKEN_SECRET =
  process.env.CMS_TOKEN_SECRET || "ownholidayclub-cms-secret";

const encodeToken = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString("base64url");

const decodeToken = (value) => {
  try {
    return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
  } catch (error) {
    return null;
  }
};

const signCmsToken = (admin) => {
  const safeAdmin = {
    id: String(admin?._id || ""),
    username: normaliseUsername(admin?.username),
    isActive: Boolean(admin?.isActive),
    exp:
      Date.now() +
      Number(process.env.CMS_TOKEN_TTL_HOURS || CMS_TOKEN_TTL_HOURS) *
        60 *
        60 *
        1000,
  };

  const payload = encodeToken(safeAdmin);
  const signature = crypto
    .createHmac("sha256", CMS_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
};

const verifyCmsToken = (token) => {
  const [payload, signature] = String(token || "").split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", CMS_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const decodedPayload = decodeToken(payload);

  if (!decodedPayload?.exp || decodedPayload.exp < Date.now()) {
    return null;
  }

  return decodedPayload;
};

module.exports = {
  buildOtpDebugPayload,
  generateOtp,
  generateRandomPassword,
  getOtpExpiry,
  hasOtpExpired,
  hashSecret,
  normaliseEmail,
  normaliseMobile,
  normaliseUsername,
  signCmsToken,
  verifyCmsToken,
  verifySecret,
};
