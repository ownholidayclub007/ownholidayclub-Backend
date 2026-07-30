const axios = require("axios");

const { normaliseMobile } = require("./security");

const DEFAULT_SMS_TIMEOUT_MS = 20000;
const DEFAULT_SMS_API_URL = "http://3.110.17.247/V2/http-api-post.php";
const DEFAULT_SMS_MESSAGE_TEMPLATE =
  "OTP for inquiry with OWN HOLIDAY CLUB is {otp} OHCLUB";

const getOptionalEnv = (name) => String(process.env[name] || "").trim();

const requireEnv = (name) => {
  const value = getOptionalEnv(name);

  if (!value) {
    throw new Error(`${name} is missing.`);
  }

  return value;
};

const createHttpError = (statusCode, message, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
};

const getSmsConfig = () => ({
  url: getOptionalEnv("SMS_OTP_API_URL") || DEFAULT_SMS_API_URL,
  apiKey: requireEnv("SMS_OTP_API_KEY"),
  senderId: requireEnv("SMS_OTP_SENDER_ID"),
  messageTemplate:
    getOptionalEnv("SMS_OTP_MESSAGE_TEMPLATE") || DEFAULT_SMS_MESSAGE_TEMPLATE,
  timeoutMs: Number(process.env.SMS_OTP_TIMEOUT_MS || DEFAULT_SMS_TIMEOUT_MS),
});

const buildOtpMessage = (template, otp) => template.replace(/\{otp\}/gi, String(otp || "").trim());

const extractProviderMessage = (data) => {
  if (!data) {
    return "";
  }

  if (typeof data === "string") {
    return data.trim();
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error.trim();
  }

  return "";
};

const isProviderFailure = (data) => {
  if (!data) return true;
  // Check specific AZQ format (if applicable)
  if (typeof data?.status === "string" && /^AZQ\d+$/i.test(data.status)) return true;
  // Common failure flags from Fast2SMS/MSG91/Custom gateways
  if (data?.return === false) return true;
  if (data?.success === false) return true;
  if (String(data?.status).toLowerCase() === "error" || String(data?.status).toLowerCase() === "failure") return true;
  
  return false;
};

const sendOtpSms = async (mobile, otp) => {
  const normalizedMobile = normaliseMobile(mobile);

  if (normalizedMobile.length !== 10) {
    throw createHttpError(400, "A valid 10-digit mobile number is required.");
  }

  const indiaMobile = normalizedMobile.startsWith("91")
    ? normalizedMobile
    : `91${normalizedMobile}`;

  const config = getSmsConfig();
  const message = buildOtpMessage(config.messageTemplate, otp);

  // Trying JSON POST body as many modern gateways prefer this
  const payload = {
    apikey: config.apiKey,
    senderid: config.senderId,
    number: indiaMobile,
    message: message,
  };

  let response;

  try {
    response = await axios.post(config.url, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout:
        Number.isFinite(config.timeoutMs) && config.timeoutMs > 0
          ? config.timeoutMs
          : DEFAULT_SMS_TIMEOUT_MS,
    });
    
    // 🔥 YAHAN PE LOG ADD KIYA HAI TAQI ASLI ERROR DIKHE 🔥
    console.log(`[SMS Gateway Response for ${mobile}]:`, JSON.stringify(response.data));
    
  } catch (error) {
    console.error(`[SMS Gateway Crash for ${mobile}]:`, error.message);
    const providerMessage = extractProviderMessage(error?.response?.data);

    throw createHttpError(
      502,
      providerMessage || "Failed to send OTP SMS.",
      {
        provider: "custom-sms",
        providerStatus: error?.response?.status || null,
        providerData: error?.response?.data || null,
      },
    );
  }

  if (isProviderFailure(response?.data)) {
    const errorMsg = extractProviderMessage(response.data) || "SMS provider rejected the OTP request.";
    console.error(`[SMS Gateway Rejected for ${mobile}]:`, errorMsg);
    
    throw createHttpError(
      502,
      errorMsg,
      {
        provider: "custom-sms",
        providerStatus: response?.status || null,
        providerData: response?.data || null,
      },
    );
  }

  return response.data;
};

module.exports = {
  sendOtpSms,
};
