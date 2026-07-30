const crypto = require("crypto");
const axios = require("axios");

const CLOUDINARY_FOLDER = "ownholidayclub/members";

const getCloudinaryConfig = () => {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
  };
};

const buildSignature = (params, apiSecret) => {
  const serializedParams = Object.keys(params)
    .sort()
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${serializedParams}${apiSecret}`)
    .digest("hex");
};

const uploadDocumentToCloudinary = async ({
  file,
  folder = CLOUDINARY_FOLDER,
  documentType = "document",
}) => {
  if (!file?.dataUrl) {
    return {
      name: String(file?.name || "").trim(),
      type: String(file?.type || "").trim(),
      size: Number(file?.size || 0),
      proofType: String(file?.proofType || "").trim(),
      url: String(file?.url || "").trim(),
      publicId: String(file?.publicId || "").trim(),
      resourceType: String(file?.resourceType || "").trim(),
      format: String(file?.format || "").trim(),
      dataUrl: "",
    };
  }

  const config = getCloudinaryConfig();

  if (!config) {
    throw new Error(
      "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to the backend .env file.",
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const uploadParams = {
    folder: `${folder}/${documentType}`,
    timestamp,
  };
  const signature = buildSignature(uploadParams, config.apiSecret);
  const requestBody = new URLSearchParams({
    file: file.dataUrl,
    api_key: config.apiKey,
    timestamp: String(timestamp),
    folder: uploadParams.folder,
    signature,
  });

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
    requestBody.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    },
  );

  const data = response.data || {};

  return {
    name: String(file?.name || data.original_filename || "").trim(),
    type: String(file?.type || "").trim(),
    size: Number(file?.size || data.bytes || 0),
    proofType: String(file?.proofType || "").trim(),
    url: String(data.secure_url || "").trim(),
    publicId: String(data.public_id || "").trim(),
    resourceType: String(data.resource_type || "").trim(),
    format: String(data.format || "").trim(),
    dataUrl: "",
  };
};

const uploadMemberDocuments = async (documents = {}) => {
  const [profileImage, idProof, addressProof] = await Promise.all([
    uploadDocumentToCloudinary({
      file: documents.profileImage,
      documentType: "profile-image",
    }),
    uploadDocumentToCloudinary({
      file: documents.idProof,
      documentType: "id-proof",
    }),
    uploadDocumentToCloudinary({
      file: documents.addressProof,
      documentType: "address-proof",
    }),
  ]);

  return {
    profileImage,
    idProof,
    addressProof,
  };
};

module.exports = {
  getCloudinaryConfig,
  uploadDocumentToCloudinary,
  uploadMemberDocuments,
};
