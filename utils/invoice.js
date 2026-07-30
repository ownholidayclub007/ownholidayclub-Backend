const fs = require("fs");
const path = require("path");
const {
  PDFDocument,
  StandardFonts,
  rgb,
} = require("pdf-lib");
const { getTierBaseDurationYears } = require("./membership");

const TEMPLATE_PATH = path.join(__dirname, "..", "payment-slip-template-v2.pdf");
const FALLBACK_TEMPLATE_PATH = path.join(__dirname, "..", "payment-slip-template.pdf");

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
};

const formatRupees = (amountInPaise) => {
  const amount = Math.round((Number(amountInPaise || 0) || 0) / 100);
  return `Rs.${amount}`;
};

const sanitizeFileName = (value, fallback) =>
  String(value || fallback || "invoice")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const buildInvoiceNumber = ({ membershipId, paymentId }) => {
  const safeMembershipId = String(membershipId || "OHC").replace(/[^A-Z0-9]/gi, "");
  const safePaymentId = String(paymentId || "").replace(/[^A-Z0-9]/gi, "").slice(-6);
  return `INV-${safeMembershipId || "OHC"}-${safePaymentId || Date.now()}`;
};

const smallNumbers = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tensNumbers = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const numberToWordsUnderThousand = (value) => {
  const number = Number(value || 0);

  if (number < 20) {
    return smallNumbers[number];
  }

  if (number < 100) {
    const tens = Math.floor(number / 10);
    const remainder = number % 10;
    return `${tensNumbers[tens]}${remainder ? ` ${smallNumbers[remainder]}` : ""}`;
  }

  const hundreds = Math.floor(number / 100);
  const remainder = number % 100;
  return `${smallNumbers[hundreds]} Hundred${remainder ? ` ${numberToWordsUnderThousand(remainder)}` : ""}`;
};

const numberToIndianWords = (value) => {
  let number = Math.max(0, Math.floor(Number(value || 0)));

  if (number === 0) {
    return "Zero";
  }

  const parts = [];
  const crores = Math.floor(number / 10000000);
  if (crores) {
    parts.push(`${numberToWordsUnderThousand(crores)} Crore`);
    number %= 10000000;
  }

  const lakhs = Math.floor(number / 100000);
  if (lakhs) {
    parts.push(`${numberToWordsUnderThousand(lakhs)} Lakh`);
    number %= 100000;
  }

  const thousands = Math.floor(number / 1000);
  if (thousands) {
    parts.push(`${numberToWordsUnderThousand(thousands)} Thousand`);
    number %= 1000;
  }

  if (number) {
    parts.push(numberToWordsUnderThousand(number));
  }

  return parts.join(" ");
};

const buildTermsTitle = ({ membership, payment }) => {
  const title =
    membership?.name ||
    payment?.membershipTierName ||
    "OWN HOLIDAY CLUB MEMBERSHIP";
  return `Terms & Conditions (${String(title).toUpperCase()})`;
};

const getInvoiceTierIdentity = (membership = {}, payment = {}) => {
  const tierId = String(
    membership?.tierId || payment?.membershipTierId || "",
  )
    .trim()
    .toLowerCase();
  const tierName = String(
    membership?.name || payment?.membershipTierName || "",
  )
    .trim()
    .toLowerCase();

  return { tierId, tierName };
};

const getInvoiceBonusYears = (membership = {}, payment = {}) => {
  const explicitBonusYears = Math.max(0, Number(membership?.bonusYears || 0) || 0);

  if (explicitBonusYears > 0) {
    return explicitBonusYears;
  }

  const { tierId, tierName } = getInvoiceTierIdentity(membership, payment);

  if (tierId === "ohc-memorable" || tierName.includes("memorable")) {
    return 2;
  }

  if (tierId === "ohc-golden" || tierName.includes("golden")) {
    return 3;
  }

  if (tierId === "ohc-diamond" || tierName.includes("diamond")) {
    return 5;
  }

  return 0;
};

const getInvoiceBaseYears = (membership = {}, payment = {}) => {
  const explicitBaseYears = Math.max(0, Number(membership?.baseDurationYears || 0) || 0);

  if (explicitBaseYears > 0) {
    return explicitBaseYears;
  }

  const { tierId, tierName } = getInvoiceTierIdentity(membership, payment);
  const inferredBaseYears = getTierBaseDurationYears({
    id: tierId,
    name: membership?.name || payment?.membershipTierName || "",
    period: membership?.period || membership?.duration || payment?.period || "",
  });

  if (inferredBaseYears > 0) {
    return inferredBaseYears;
  }

  const totalYears = Number(
    String(
      membership?.totalDurationYears ||
        membership?.duration ||
        membership?.period ||
        payment?.period ||
        "",
    ).match(/(\d+)/)?.[1] || 0,
  );
  const bonusYears = getInvoiceBonusYears(membership, payment);

  if (totalYears > bonusYears) {
    return totalYears - bonusYears;
  }

  return totalYears;
};

const buildInvoiceDurationLabel = (membership = {}, payment = {}) => {
  const baseYears = getInvoiceBaseYears(membership, payment);
  const bonusYears = getInvoiceBonusYears(membership, payment);

  if (baseYears > 0 && bonusYears > 0) {
    return `${baseYears}+${bonusYears} years`;
  }

  if (baseYears > 0) {
    return `${baseYears} years`;
  }

  return "5 years";
};

const getEntitlementText = (membership = {}, payment = {}) => {
  const { tierId, tierName } = getInvoiceTierIdentity(membership, payment);
  
  if (tierId === "ohc-privilege" || tierName.includes("privilege")) {
    return "3 Nights / 4 Days for 3 Years and 4 Nights / 5 Days for 2 Years";
  }
  if (tierId === "ohc-memorable" || tierName.includes("memorable")) {
    return "6 Nights / 7 Days for 10 Years and Special Offer 2 Years Extra";
  }
  if (tierId === "ohc-golden" || tierName.includes("golden")) {
    return "6 Nights / 7 Days for 20 Years and Special Offer 3 Years Extra";
  }
  if (tierId === "ohc-diamond" || tierName.includes("diamond")) {
    return "6 Nights / 7 Days for 30 Years and Special Offer 5 Years Extra";
  }
  
  return String(membership?.nightsPerYear || "").trim() || "N/A";
};

const buildDynamicTerms = ({ membership, payment }) => {
  const durationLabel = buildInvoiceDurationLabel(membership, payment);
  const entitlementText = getEntitlementText(membership, payment);

  return [
    `1. This membership is valid for next ${durationLabel}.`,
    `2. This membership will start from next financial year.`,
    `3. Each financial year member will get one vacation (accommodation only), next ${durationLabel}.`,
    `4. Member is entitled for ${entitlementText}.`,
    "5. Member have to send the request for booking Minimum 15 days before of Vacation.",
    "6. Member have to pay the utilities charges at the time of booking.",
    "7. Member can choose the location for vacation from, Goa, Gokarna, Puri, Shimla,",
    "    Manali, Nanital, shillong. Munnar, ooty, lonavala, Mahabaleshwar, Coorg, kodaikanal,",
    "    Jimcorbett, Ranthambore, Sundarbans, Agra and Jaipur.",
    "8. Member have to send the booking request by mail on booking@ownholidayclub.com.",
  ];
};

const drawWhiteBox = (page, x, y, width, height) => {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
  });
};

const drawText = (page, text, options) => {
  page.drawText(String(text || ""), {
    color: rgb(0, 0, 0),
    ...options,
  });
};

const getFontSizeToFit = ({
  font,
  text,
  maxWidth,
  defaultSize = 12,
  minSize = 9,
}) => {
  const safeText = String(text || "");
  let size = defaultSize;

  while (size > minSize && font.widthOfTextAtSize(safeText, size) > maxWidth) {
    size -= 0.25;
  }

  return size;
};

const generateMembershipInvoicePdf = async ({
  user,
  membership,
  payment,
}) => {
  if (!fs.existsSync(TEMPLATE_PATH) && !fs.existsSync(FALLBACK_TEMPLATE_PATH)) {
    throw new Error("Invoice template PDF is missing.");
  }

  const resolvedTemplatePath = fs.existsSync(TEMPLATE_PATH)
    ? TEMPLATE_PATH
    : FALLBACK_TEMPLATE_PATH;
  const templateBytes = fs.readFileSync(resolvedTemplatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPage(0);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const invoiceNumber =
    payment.invoiceNumber ||
    buildInvoiceNumber({
      membershipId: user.membershipId,
      paymentId: payment.paymentId,
    });

  const fileName = `${sanitizeFileName(
    `${user.membershipId || invoiceNumber}-receipt`,
    "membership-receipt",
  )}.pdf`;

  const paymentDate = formatDate(payment.paidAt);
  const uppercaseName = String(user.name || "MEMBER").trim().toUpperCase();
  const adminFee = Number(payment?.notes?.adminFeeRupees ?? 3789);
  const totalPaidRupees = Math.round((Number(payment.amount || 0) || 0) / 100);
  const membershipFee = Math.max(0, totalPaidRupees - adminFee);
  const amountInWords = `${numberToIndianWords(totalPaidRupees)} Rupees Only`;
  const termsLines = buildDynamicTerms({ membership, payment });

  const orderText = payment.orderId || "";
  const orderFontSize = getFontSizeToFit({
    font: fontBold,
    text: orderText,
    maxWidth: 114,
    defaultSize: 10.75,
    minSize: 7.75,
  });
  const membershipIdText = user.membershipId || "";
  const membershipIdFontSize = getFontSizeToFit({
    font: fontRegular,
    text: membershipIdText,
    maxWidth: 101,
    defaultSize: 12,
    minSize: 9.5,
  });
  const amountWordsFontSize = getFontSizeToFit({
    font: fontRegular,
    text: amountInWords,
    maxWidth: 272,
    defaultSize: 12,
    minSize: 9.25,
  });

  drawWhiteBox(page, 448, 770, 100, 18);
  drawText(page, `Date: ${paymentDate}`, {
    x: 453.29,
    y: 775.47,
    size: 12,
    font: fontRegular,
  });

  drawWhiteBox(page, 48, 620, 185, 42);
  drawText(page, uppercaseName, {
    x: 55.02,
    y: 647.72,
    size: 12,
    font: fontBold,
  });
  drawText(page, `Mobile : ${user.mobile || ""}`, {
    x: 55.02,
    y: 629.72,
    size: 12,
    font: fontRegular,
  });

  drawWhiteBox(page, 163, 568, 134, 18);
  drawText(page, orderText, {
    x: 176.84,
    y: 573.85,
    size: orderFontSize,
    font: fontBold,
  });

  drawWhiteBox(page, 142, 538, 108, 14);
  drawText(page, membershipIdText, {
    x: 145,
    y: 542.69,
    size: membershipIdFontSize,
    font: fontRegular,
  });

  drawWhiteBox(page, 408, 516, 132, 14);
  drawText(page, `Receipt Date: ${paymentDate}`, {
    x: 407.64,
    y: 520.94,
    size: 11.25,
    font: fontBold,
  });

  drawWhiteBox(page, 52, 494, 220, 14);
  drawText(page, `Receipt From: ${uppercaseName}`, {
    x: 55.02,
    y: 498.18,
    size: 12,
    font: fontBold,
  });

  drawWhiteBox(page, 145, 476, 60, 14);
  drawText(page, formatRupees(membershipFee * 100), {
    x: 148.33,
    y: 480.17,
    size: 12,
    font: fontRegular,
  });

  drawWhiteBox(page, 116, 458, 70, 14);
  drawText(page, formatRupees(adminFee * 100), {
    x: 118.34,
    y: 462.17,
    size: 12,
    font: fontRegular,
  });

  drawWhiteBox(page, 128, 440, 70, 14);
  drawText(page, formatRupees(payment.amount), {
    x: 130.35,
    y: 444.16,
    size: 12,
    font: fontRegular,
  });

  drawWhiteBox(page, 145, 422, 330, 14);
  drawText(page, amountInWords, {
    x: 146.68,
    y: 426.16,
    size: amountWordsFontSize,
    font: fontRegular,
  });

  drawWhiteBox(page, 52, 323, 360, 14);
  drawText(page, buildTermsTitle({ membership, payment }), {
    x: 55.02,
    y: 327.14,
    size: 12,
    font: fontBold,
  });

  const termYPositions = [309.13, 291.13, 273.12, 255.11, 237.1, 219.09, 201.08, 186.08, 171.08, 156.08];
  const termsArea = {
    x: 44,
    y: 145,
    width: 495,
    height: 171,
  };

  drawWhiteBox(
    page,
    termsArea.x,
    termsArea.y,
    termsArea.width,
    termsArea.height,
  );

  termsLines.forEach((line, index) => {
    if (!line || typeof termYPositions[index] !== "number") {
      return;
    }

    const maxWidth = index === 2 ? 430 : 444;
    const fittedFontSize = getFontSizeToFit({
      font: fontRegular,
      text: line,
      maxWidth,
      defaultSize: 12,
      minSize: 8.5,
    });
    drawText(page, line, {
      x: 55.02,
      y: termYPositions[index],
      size: fittedFontSize,
      font: fontRegular,
    });
  });

  const buffer = Buffer.from(await pdfDoc.save());

  return {
    buffer,
    invoiceNumber,
    fileName,
    contentType: "application/pdf",
  };
};

module.exports = {
  buildInvoiceNumber,
  generateMembershipInvoicePdf,
};
