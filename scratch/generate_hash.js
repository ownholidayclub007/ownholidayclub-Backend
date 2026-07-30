const crypto = require("crypto");
const hashSecret = (value) => {
  const plainText = String(value || "");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plainText, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
};
console.log(hashSecret("admin123"));
