const nodemailer = require("nodemailer");

const getOptionalEnv = (name) => String(process.env[name] || "").trim();
const BRAND_LOGO_URL =
  "https://www.ownholidayclub.com/logo.png";


const requireEnv = (name) => {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`${name} is missing.`);
  }
  return value;
};

const getPositiveNumber = (value, fallback) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const getEmailProvider = () => {
  const configuredProvider = getOptionalEnv("EMAIL_PROVIDER").toLowerCase();

  if (configuredProvider === "brevo_api") {
    return "brevo";
  }

  if (configuredProvider) {
    return configuredProvider;
  }

  if (getOptionalEnv("BREVO_SMTP_USER") && getOptionalEnv("SMTP_PASS")) {
    return "brevo";
  }

  return "smtp";
};

const getProviderDefaults = () => {
  const provider = getEmailProvider();

  if (provider === "gmail") {
    return {
      host: getOptionalEnv("GMAIL_SMTP_HOST") || "smtp.gmail.com",
      port: getPositiveNumber(
        getOptionalEnv("GMAIL_SMTP_PORT") || process.env.SMTP_PORT,
        587,
      ),
      user: getOptionalEnv("GMAIL_SMTP_USER") || getOptionalEnv("SMTP_USER"),
      pass: getOptionalEnv("GMAIL_SMTP_PASS") || getOptionalEnv("SMTP_PASS"),
      fromName:
        getOptionalEnv("GMAIL_FROM_NAME") ||
        getOptionalEnv("SMTP_FROM_NAME") ||
        "OwnHolidayClub",
      fromEmail:
        getOptionalEnv("GMAIL_FROM_EMAIL") ||
        getOptionalEnv("SMTP_FROM_EMAIL") ||
        getOptionalEnv("GMAIL_SMTP_USER") ||
        getOptionalEnv("SMTP_USER"),
      replyTo: getOptionalEnv("GMAIL_REPLY_TO") || getOptionalEnv("SMTP_REPLY_TO"),
    };
  }

  if (provider === "brevo") {
    return {
      host: getOptionalEnv("BREVO_SMTP_HOST") || "smtp-relay.brevo.com",
      port: getPositiveNumber(
        getOptionalEnv("BREVO_SMTP_PORT") || process.env.SMTP_PORT,
        587,
      ),
      user: getOptionalEnv("BREVO_SMTP_USER") || getOptionalEnv("SMTP_USER"),
      pass: getOptionalEnv("BREVO_SMTP_PASS") || getOptionalEnv("SMTP_PASS"),
      fromName:
        getOptionalEnv("BREVO_FROM_NAME") ||
        getOptionalEnv("SMTP_FROM_NAME") ||
        "OwnHolidayClub",
      fromEmail:
        getOptionalEnv("BREVO_FROM_EMAIL") ||
        getOptionalEnv("SMTP_FROM_EMAIL") ||
        getOptionalEnv("BREVO_SMTP_USER") ||
        getOptionalEnv("SMTP_USER"),
      replyTo: getOptionalEnv("BREVO_REPLY_TO") || getOptionalEnv("SMTP_REPLY_TO"),
    };
  }

  return {
    host: requireEnv("SMTP_HOST"),
    port: getPositiveNumber(process.env.SMTP_PORT, 587),
    user: requireEnv("SMTP_USER"),
    pass: requireEnv("SMTP_PASS"),
    fromName: getOptionalEnv("SMTP_FROM_NAME") || "OwnHolidayClub",
    fromEmail: getOptionalEnv("SMTP_FROM_EMAIL") || getOptionalEnv("SMTP_USER"),
    replyTo: getOptionalEnv("SMTP_REPLY_TO"),
  };
};

const getSmtpConfig = () => {
  const providerDefaults = getProviderDefaults();
  const host = providerDefaults.host;
  const port = getPositiveNumber(providerDefaults.port, 587);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a valid number.");
  }

  return {
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 20000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
    auth: {
      user: providerDefaults.user || requireEnv("SMTP_USER"),
      pass: providerDefaults.pass || requireEnv("SMTP_PASS"),
    },
  };
};

const getTransporter = () => nodemailer.createTransport(getSmtpConfig());

const shouldLogEmailDebug = () =>
  process.env.EMAIL_DEBUG_LOGS === "true" || process.env.NODE_ENV !== "production";

const getFromAddress = () => {
  const providerDefaults = getProviderDefaults();
  const fromName = providerDefaults.fromName || "OwnHolidayClub";
  const fromEmail = providerDefaults.fromEmail || requireEnv("SMTP_USER");
  return `${fromName} <${fromEmail}>`;
};

const getReplyToAddress = () => getProviderDefaults().replyTo;

const sendMailWithLogging = async (mailOptions) => {
  const transporter = getTransporter();
  const info = await transporter.sendMail(mailOptions);

  if (shouldLogEmailDebug()) {
    console.log(
      "[email] sendMail accepted:",
      JSON.stringify(
        {
          to: mailOptions.to,
          subject: mailOptions.subject,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
          messageId: info.messageId,
        },
        null,
        2,
      ),
    );
  }

  return info;
};

const sendOtpEmail = async (to, otp, ttlMinutes = 15) => {
  const from = getFromAddress();
  const replyTo = getReplyToAddress();

  const subject = "Your OwnHolidayClub OTP";
  const text = `Your OwnHolidayClub OTP is ${otp}. It expires in ${ttlMinutes} minutes.`;
  const html = `
    <div style="margin:0;padding:8px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,0.10);">
        <div style="padding:18px 24px;background:#ffffff;text-align:center;border-bottom:1px solid #e2e8f0;">
          <img src="${BRAND_LOGO_URL}" alt="Own Holiday Club" style="width:148px;max-width:100%;height:auto;display:block;margin:0 auto;" />
        </div>

        <div style="padding:28px 32px 24px;background:#f8fafc;text-align:center;border-bottom:1px solid #e2e8f0;">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(245,158,11,0.14);color:#d97706;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">
            Verification Code
          </div>
          <h1 style="margin:18px 0 8px;font-size:24px;line-height:1.2;color:#0f172a;">Your OTP Is Ready</h1>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
            Use the code below to continue your Own Holiday Club verification.
          </p>
        </div>

        <div style="padding:32px;">
          <p style="margin:0 0 22px;font-size:15px;line-height:1.8;color:#475569;text-align:center;">
            Enter this one-time password in the verification screen. It will expire in
            <strong style="color:#0f172a;"> ${ttlMinutes} minutes</strong>.
          </p>

          <div style="margin:0 auto 24px;max-width:320px;padding:18px 20px;border-radius:20px;border:1px solid #fde68a;background:linear-gradient(180deg,#fffdf6 0%,#fffbeb 100%);text-align:center;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#d97706;margin-bottom:10px;">
              One-Time Password
            </div>
            <div style="font-size:34px;font-weight:800;letter-spacing:0.28em;color:#0f172a;text-indent:0.28em;">
              ${otp}
            </div>
          </div>

          <div style="padding:18px 20px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:22px;">
            <div style="font-size:14px;line-height:1.8;color:#475569;">
              If you did not request this code, you can safely ignore this email.
            </div>
          </div>

          <p style="margin:0;font-size:13px;line-height:1.8;color:#64748b;text-align:center;">
            Need help? Reply to this email and our team will assist you.
          </p>
        </div>
      </div>
    </div>
  `;

  return sendMailWithLogging({
    from,
    ...(replyTo ? { replyTo } : {}),
    to,
    subject,
    text,
    html,
  });
};

const sendWelcomePasswordEmail = async ({
  to,
  fullName,
  membershipId,
  password,
  invoiceAttachment,
}) => {
  const from = getFromAddress();
  const replyTo = getReplyToAddress();
  const safeName = String(fullName || "Member").trim() || "Member";
  const frontendBaseUrl =
    getOptionalEnv("FRONTEND_BASE_URL") || "https://www.ownholidayclub.com";
  const loginUrl = `${frontendBaseUrl.replace(/\/+$/, "")}/`;
  const baseAttachments = [];

  if (invoiceAttachment) {
    baseAttachments.push({
      filename: invoiceAttachment.filename,
      content: invoiceAttachment.content,
      contentType: invoiceAttachment.contentType || "application/pdf",
    });
  }

  return sendMailWithLogging({
    from,
    ...(replyTo ? { replyTo } : {}),
    to,
    subject: "Your OwnHolidayClub member account is ready",
    text: `Hello ${safeName}, your OwnHolidayClub member account is ready. Membership / Login ID: ${membershipId}. Password: ${password}. Please log in and change your password after signing in. Your membership invoice is attached with this email.`,
    html: `
      <div style="margin:0;padding:8px;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <div style="padding:18px 24px;background:#ffffff;text-align:center;border-bottom:1px solid #e2e8f0;">
            <img src="${BRAND_LOGO_URL}" alt="Own Holiday Club" style="width:148px;max-width:100%;height:auto;display:block;margin:0 auto;" />
          </div>

          <div style="padding:28px 32px 24px;background:#f8fafc;text-align:center;border-bottom:1px solid #e2e8f0;">
            <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(245,158,11,0.14);color:#d97706;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">
              Membership Activated
            </div>
            <h1 style="margin:18px 0 8px;font-size:24px;line-height:1.2;color:#0f172a;">Welcome to<br/>Own Holiday Club</h1>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
              Your membership purchase was successful and your account is now ready.
            </p>
          </div>

          <div style="padding:32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#334155;">
              Hello <strong style="color:#0f172a;">${safeName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#475569;">
              Thank you for joining<br/>Own Holiday Club. We have created your member account and attached your membership invoice with this email.
            </p>

            <div style="border:1px solid #fde68a;border-radius:20px;background:linear-gradient(180deg,#fffdf6 0%,#fffbeb 100%);padding:22px 20px;margin:0 0 24px;">
              <div style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#d97706;">
                Your Login Details
              </div>
              <div style="margin:0 0 14px;padding:14px 16px;border-radius:16px;background:#ffffff;border:1px solid #f8e7a7;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#92400e;margin-bottom:6px;">
                  Membership / Login ID
                </div>
                <div style="font-size:18px;font-weight:700;color:#0f172a;word-break:break-word;">
                  ${membershipId}
                </div>
              </div>
              <div style="padding:14px 16px;border-radius:16px;background:#ffffff;border:1px solid #f8e7a7;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#92400e;margin-bottom:6px;">
                  Password
                </div>
                <div style="font-size:18px;font-weight:700;color:#0f172a;word-break:break-word;">
                  ${password}
                </div>
              </div>
            </div>

            <div style="padding:18px 20px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:24px;">
              <div style="font-size:14px;line-height:1.8;color:#475569;">
                Please log in using your email or membership / login ID and change your password after signing in for security.
              </div>
            </div>

            <div style="text-align:center;margin-bottom:24px;">
              <a href="${loginUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#f59e0b;color:#0f172a;text-decoration:none;font-size:14px;font-weight:700;">
                Visit Own Holiday Club
              </a>
            </div>

            <p style="margin:0;font-size:13px;line-height:1.8;color:#64748b;text-align:center;">
              Need help? Reply to this email and our team will assist you.
            </p>
          </div>
        </div>
      </div>
    `,
    ...(baseAttachments.length > 0 ? { attachments: baseAttachments } : {}),
  });
};

const sendLeadNotificationEmail = async ({
  leadType,
  leadDetails,
  message,
}) => {
  const from = getFromAddress();
  const to = "info@ownholidayclub.com";
  // const to = "vanshchaudhary2k2@gmail.com";
  const subject = `New Lead: [${leadType}] - ${leadDetails.Name || leadDetails.fullName || 'User'}`;

  // Format details into HTML table rows
  let detailsHtml = "";
  for (const [key, value] of Object.entries(leadDetails)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      detailsHtml += `
        <tr>
          <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">${key}</td>
          <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${value}</td>
        </tr>
      `;
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;">
    <div style="margin:0;padding:10px;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;width:100%;box-sizing:border-box;">
      <div style="max-width:800px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);box-sizing:border-box;">
        <!-- Header Banner -->
        <div style="padding:20px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;text-align:center;">
          <img src="${BRAND_LOGO_URL}" alt="Own Holiday Club" style="width:175px;height:auto;margin-bottom:10px;" />
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(245,158,11,0.15);color:#d97706;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;">
            Sales &amp; Leads CRM
          </div>
          <h1 style="margin:10px 0 0;font-size:22px;color:#0f172a;font-weight:700;letter-spacing:-0.02em;">New Lead Received</h1>
        </div>

        <!-- Body Section -->
        <div style="padding:24px 28px;">
          <div style="margin-bottom:24px;padding:16px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;">
            <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;line-height:1.5;">
              ⚡ A new <strong>${leadType}</strong> has been successfully submitted from the website.
            </p>
          </div>

          <h2 style="font-size:16px;color:#0f172a;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.05em;">Lead Information</h2>
          
          <table width="100%" style="width:100%;border-collapse:collapse;margin-bottom:24px;table-layout:fixed;">
            <tbody>
              ${detailsHtml}
            </tbody>
          </table>

          ${message ? `
            <h2 style="font-size:16px;color:#0f172a;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.05em;">User Message / Remarks</h2>
            <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">
              "${message}"
            </div>
          ` : ""}

          <!-- Footer -->
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;">
            <div style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
              <span style="display:block;margin-bottom:2px;">This email was automatically generated by the</span>
              <span style="display:block;font-weight:600;">Own Holiday Club Lead Capture System.</span>
            </div>
        </div>
      </div>
    </div>
</body>
</html>
  `;

  return sendMailWithLogging({
    from,
    to,
    subject,
    text: `New Lead: ${leadType}\n\n${JSON.stringify(leadDetails, null, 2)}\n\nMessage: ${message || ''}`,
    html,
  });
};

const sendGenericThankYouEmail = async ({ to, name, type = "Holiday" }) => {
  const from = getFromAddress();
  const subject = "Thank you for contacting Own Holiday Club";
  const safeName = String(name || "Traveler").trim() || "Traveler";

  let subtext = "We've received your inquiry and our experts are already reviewing it.";
  let bodyText = "Thank you for choosing <strong style=\"color:#0c1a2e;\">us</strong>. We've successfully received your inquiry and our team will reach out to you <strong style=\"color:#0c1a2e;\">within 24 hours</strong> to assist you.";
  let step3Icon = "✅";
  let step3Title = "Resolved";
  let step3Desc = "Your query is resolved";
  let plainText = `Hello ${safeName}, thank you for contacting Own Holiday Club. We have received your inquiry and our team will reach out to you within 24 hours.`;

  if (type === "Holiday" || type === "Destination") {
    subtext = "We've received your inquiry and our luxury travel experts are already reviewing it.";
    bodyText = "Thank you for choosing <strong style=\"color:#0c1a2e;\">us</strong>. We've successfully received your inquiry and our dedicated luxury travel concierge team will reach out to you <strong style=\"color:#0c1a2e;\">within 24 hours</strong> to help craft your perfect holiday escape.";
    step3Icon = "✈️";
    step3Title = "Escape";
    step3Desc = "Your dream holiday is planned";
    plainText = `Hello ${safeName}, thank you for contacting Own Holiday Club. We have received your inquiry and our luxury travel concierge team will reach out to you within 24 hours.`;
  } else if (type === "Service") {
    bodyText = "Thank you for choosing <strong style=\"color:#0c1a2e;\">us</strong>. We've successfully received your service inquiry and our dedicated team will reach out to you <strong style=\"color:#0c1a2e;\">within 24 hours</strong>.";
    step3Title = "Service";
    step3Desc = "Your required service is delivered";
  } else if (type === "Contact") {
    bodyText = "Thank you for reaching out to <strong style=\"color:#0c1a2e;\">us</strong>. We've successfully received your message and our support team will get back to you <strong style=\"color:#0c1a2e;\">within 24 hours</strong>.";
    step3Title = "Support";
    step3Desc = "We assist you promptly";
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Own Holiday Club</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;">
  <tr>
    <td align="center" style="padding:16px 8px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

        <!-- Logo Header -->
        <tr>
          <td align="center" style="background:#ffffff;padding:18px 24px;border-bottom:1px solid #e2e8f0;border-radius:16px 16px 0 0;">
            <img src="${BRAND_LOGO_URL}" alt="Own Holiday Club" width="140" style="display:block;height:auto;border:0;max-width:140px;" />
          </td>
        </tr>

        <!-- Hero/Subtext Section -->
        <tr>
          <td align="center" style="background:#f8fafc;padding:24px 24px 20px;border-bottom:1px solid #e2e8f0;">
            <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:#fef3c7;color:#d97706;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:12px;">
              Inquiry Received
            </div>
            <p style="margin:0;font-size:18px;line-height:1.5;color:#0f172a;font-weight:600;font-family:Arial,sans-serif;">${subtext}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:28px 24px;border-radius:0 0 16px 16px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#334155;font-family:Arial,sans-serif;">
              Hello <strong style="color:#0f172a;">${safeName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:#475569;font-family:Arial,sans-serif;">
              ${bodyText}
            </p>

            <!-- 2-column steps -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <tr>
                <td width="48%" valign="top" style="padding-right:4%;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr><td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid #f59e0b;border-radius:12px;padding:16px 12px;">
                      <div style="font-size:22px;margin-bottom:8px;">📋</div>
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f172a;font-family:Arial,sans-serif;margin-bottom:4px;">Review</div>
                      <div style="font-size:11px;color:#64748b;line-height:1.5;font-family:Arial,sans-serif;">Our team reviews your inquiry</div>
                    </td></tr>
                  </table>
                </td>
                <td width="48%" valign="top">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr><td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid #f59e0b;border-radius:12px;padding:16px 12px;">
                      <div style="font-size:22px;margin-bottom:8px;">📞</div>
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f172a;font-family:Arial,sans-serif;margin-bottom:4px;">Connect</div>
                      <div style="font-size:11px;color:#64748b;line-height:1.5;font-family:Arial,sans-serif;">Expert contacts you within 24 hrs</div>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Help Box -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#d97706;font-family:Arial,sans-serif;margin-bottom:6px;">Need urgent help?</div>
                  <div style="font-size:13px;line-height:1.8;color:#475569;font-family:Arial,sans-serif;">Call us at <a href="tel:+919871984074" style="color:#0f172a;font-weight:600;text-decoration:none;">+91 98719 84074</a>. Our concierge team is available to assist you.</div>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="https://www.ownholidayclub.com" style="display:inline-block;padding:13px 28px;border-radius:999px;background:#f59e0b;color:#0f172a;text-decoration:none;font-size:13px;font-weight:700;font-family:Arial,sans-serif;letter-spacing:0.05em;">
                    EXPLORE OUR DESTINATIONS
                  </a>
                </td>
              </tr>
            </table>

            <!-- Footer -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="border-top:1px solid #e2e8f0;padding-top:20px;">
                  <p style="margin:0 0 6px;font-size:12px;color:#64748b;line-height:1.7;font-family:Arial,sans-serif;">
                    © 2026 Own Holiday Club. All rights reserved.<br />
                    <a href="mailto:info@ownholidayclub.com" style="color:#d97706;text-decoration:none;">info@ownholidayclub.com</a>
                    &nbsp;·&nbsp;
                    <a href="https://www.ownholidayclub.com" style="color:#d97706;text-decoration:none;">www.ownholidayclub.com</a>
                  </p>
                  <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;font-family:Arial,sans-serif;">
                    You're receiving this because you submitted an inquiry on our website.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
  `;

  return sendMailWithLogging({
    from,
    to,
    subject,
    text: plainText,
    html,
  });
};

const sendLeadThankYouEmail = async ({ to, name }) => {
  return sendGenericThankYouEmail({ to, name, type: "Holiday" });
};

const sendHolidayBookingAdminEmail = async ({
  user,
  booking,
  stayAllowance,
  validFrom,
  validTo
}) => {
  const from = getFromAddress();
  const to = "info@ownholidayclub.com";
  // const to = "vanshchaudhary2k2@gmail.com";
  const bookingName = booking.name || user.name || "Member";
  const bookingEmail = booking.email || user.email;
  const bookingMobile = booking.mobile || user.mobile;

  const subject = `New Holiday Booking Request - ${bookingName}`;

  const formatDate = (dateInput) => {
    if (!dateInput) return "N/A";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const formatDateTime = (dateInput) => {
    if (!dateInput) return "N/A";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;">
    <div style="margin:0;padding:10px;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;width:100%;box-sizing:border-box;">
      <div style="max-width:800px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);box-sizing:border-box;">
        <!-- Header Banner -->
        <div style="padding:20px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;text-align:center;">
          <img src="${BRAND_LOGO_URL}" alt="Own Holiday Club" style="width:175px;height:auto;margin-bottom:10px;" />
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(245,158,11,0.15);color:#d97706;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;">
            Holiday Request
          </div>
          <h1 style="margin:10px 0 0;font-size:22px;color:#0f172a;font-weight:700;letter-spacing:-0.02em;">New Booking Request</h1>
        </div>

        <!-- Body Section -->
        <div style="padding:24px 28px;">
          <div style="margin-bottom:24px;padding:16px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;">
            <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;line-height:1.5;">
              ⚡ A new <strong>Holiday Booking</strong> has been successfully submitted from the member portal.
            </p>
          </div>

          <h2 style="font-size:16px;color:#0f172a;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.05em;">Booking Details</h2>
          
          <table width="100%" style="width:100%;border-collapse:collapse;margin-bottom:24px;table-layout:fixed;">
            <tbody>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Full Name</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal; font-weight: 700;">${bookingName}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Email Address</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${bookingEmail}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Phone Number</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${bookingMobile}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Holiday No.</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">#${booking.slotNumber}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Length Of Stay</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${stayAllowance?.label || "N/A"}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Valid From</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${formatDate(validFrom)}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Valid To</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${formatDate(validTo)}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Destination</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal; font-weight: 700;">${booking.place}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Check-In</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${formatDateTime(booking.checkIn)}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Check-Out</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${formatDateTime(booking.checkOut)}</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Guests</td>
                <td width="72%" style="padding: 10px 0 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${booking.adults} Adults / ${booking.kids} Kids</td>
              </tr>
              <tr>
                <td width="28%" style="padding: 10px 10px 10px 0; font-size: 9px; font-weight: 700; color: #64748b; width: 28%; text-transform: uppercase; vertical-align: top;">Status</td>
                <td width="72%" style="padding: 10px 0 10px 0; font-size: 11px; color: #0f172a; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal; font-weight: 700;">Requested</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top:16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#334155;text-align:center;">
            Please log in to the admin panel to review and approve/reject this booking request.
          </div>

          <!-- Footer -->
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;">
            <div style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
              <span style="display:block;margin-bottom:2px;">This email was automatically generated by the</span>
              <span style="display:block;font-weight:600;">Own Holiday Club Lead Capture System.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
</body>
</html>
  `;

  return sendMailWithLogging({
    from,
    to,
    subject,
    text: `New Holiday Booking Request from ${user.name}. Destination: ${booking.place}. Check-In: ${formatDateTime(booking.checkIn)}.`,
    html,
  });
};

module.exports = {
  sendOtpEmail,
  sendWelcomePasswordEmail,
  sendLeadNotificationEmail,
  sendLeadThankYouEmail,
  sendGenericThankYouEmail,
  sendHolidayBookingAdminEmail,
};

