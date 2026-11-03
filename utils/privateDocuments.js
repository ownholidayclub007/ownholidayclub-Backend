const crypto = require("crypto");

const getEncryptionKey = () => {
  const configuredKey = String(
    process.env.MEMBER_DOCUMENTS_ENCRYPTION_KEY || "",
  ).trim();

  if (!/^[\da-f]{64}$/i.test(configuredKey)) {
    throw Object.assign(
      new Error(
        "MEMBER_DOCUMENTS_ENCRYPTION_KEY must be configured as a 64-character hexadecimal key.",
      ),
      { statusCode: 503 },
    );
  }

  return Buffer.from(configuredKey, "hex");
};

const encryptDocument = (content) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encryptedData = Buffer.concat([cipher.update(content), cipher.final()]);

  return {
    encryptedData,
    encryptionIv: iv,
    encryptionAuthTag: cipher.getAuthTag(),
  };
};

const decryptDocument = ({ encryptedData, encryptionIv, encryptionAuthTag }) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    encryptionIv,
  );
  decipher.setAuthTag(encryptionAuthTag);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
};

module.exports = {
  decryptDocument,
  encryptDocument,
};
