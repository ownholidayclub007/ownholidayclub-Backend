const DEFAULT_MEMBERSHIP_TIERS = [
  {
    id: "ohc-privilege",
    name: "OHC Privilege",
    price: "Rs50,000",
    adminFee: "Rs3,789",
    bonusYears: 0,
    period: "5 YEARS ACCESS",
    description: "Special 5-year introductory offer for your luxury journey.",
    features: [
      "6 Nights / 7 Days Annual Stay",
      "Access to Premium Resorts",
      "Standard Concierge",
      "Transferable to Family",
    ],
    icon: "star",
    buttonText: "BUY PRIVILEGE",
    popular: false,
  },
  {
    id: "ohc-memorable",
    name: "OHC Memorable",
    price: "Rs2,00,000",
    adminFee: "Rs3,789",
    bonusYears: 0,
    period: "10 YEARS ACCESS",
    description: "Create memorable vacations for a full decade.",
    features: [
      "6 Nights / 7 Days Annual Stay",
      "Access to 4 & 5-Star Resorts",
      "Priority Booking",
      "Transferable to Family",
    ],
    icon: "crown",
    buttonText: "BUY MEMORABLE",
    popular: true,
  },
  {
    id: "ohc-golden",
    name: "OHC Golden",
    price: "Rs5,00,000",
    adminFee: "Rs3,789",
    bonusYears: 3,
    period: "20 YEARS ACCESS",
    description: "Two decades of elevated luxury experiences.",
    features: [
      "6 Nights / 7 Days Annual Stay",
      "All Premium Luxury Resorts",
      "Dedicated VIP Concierge",
      "Complimentary Breakfast",
    ],
    icon: "sparkles",
    buttonText: "BUY GOLDEN",
    popular: false,
  },
  {
    id: "ohc-diamond",
    name: "OHC Diamond",
    price: "Rs10,00,000",
    adminFee: "Rs3,789",
    bonusYears: 0,
    period: "30 YEARS ACCESS",
    description: "Three decades of ultimate luxury and exclusive global access.",
    features: [
      "6 Nights / 7 Days Annual Stay",
      "Access to Elite Global Resorts",
      "Personalized Travel Planning",
      "All Golden Benefits Included",
    ],
    icon: "gem",
    buttonText: "BUY DIAMOND",
    popular: false,
  },
];

const TIER_CARD_CODES = {
  "ohc-privilege": "PV",
  "ohc-golden": "G",
  "ohc-diamond": "D",
  "ohc-memorable": "M",
};

const INDIA_STATE_CODE_MAP = {
  ANDAMANANDNICOBARISLANDS: "AN",
  ANDAMANNICOBARISLANDS: "AN",
  ANDHRAPRADESH: "AP",
  ARUNACHALPRADESH: "AR",
  ASSAM: "AS",
  BIHAR: "BR",
  CHANDIGARH: "CH",
  CHHATTISGARH: "CG",
  DADRAANDNAGARHAVELIANDDAMANANDDIU: "DD",
  DADRAANDNAGARHAVELI: "DD",
  DAMANANDDIU: "DD",
  DELHI: "DL",
  DELHINCR: "DL",
  NCTDELHI: "DL",
  NATIONALCAPITALTERRITORYOFDELHI: "DL",
  GOA: "GA",
  GUJARAT: "GJ",
  HARYANA: "HR",
  HIMACHALPRADESH: "HP",
  JAMMUANDKASHMIR: "JK",
  JAMMUKASHMIR: "JK",
  JHARKHAND: "JH",
  KARNATAKA: "KA",
  KERALA: "KL",
  LADAKH: "LA",
  LAKSHADWEEP: "LD",
  LAKSHADWEEPISLANDS: "LD",
  MADHYAPRADESH: "MP",
  MAHARASHTRA: "MH",
  MANIPUR: "MN",
  MEGHALAYA: "ML",
  MIZORAM: "MZ",
  NAGALAND: "NL",
  ODISHA: "OD",
  ORISSA: "OD",
  PUDUCHERRY: "PY",
  PONDICHERRY: "PY",
  PUNJAB: "PB",
  RAJASTHAN: "RJ",
  SIKKIM: "SK",
  TAMILNADU: "TN",
  TELANGANA: "TS",
  TRIPURA: "TR",
  UTTARPRADESH: "UP",
  UTTARAKHAND: "UK",
  UTTARANCHAL: "UK",
  WESTBENGAL: "WB",
};

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeTier = (tier = {}, index = 0) => ({
  id: slugifyValue(tier.id || tier.name) || `tier-${index + 1}`,
  name: String(tier.name || "").trim(),
  price: String(tier.price || "").trim(),
  priceType: String(tier.priceType || "regular").trim().toLowerCase(),
  actuallyPrice: String(tier.actuallyPrice || "").trim(),
  adminFee: String(tier.adminFee || "").trim(),
  bonusYears: Math.max(0, Number(tier.bonusYears || 0) || 0),
  period: String(tier.period || "").trim(),
  description: String(tier.description || "").trim(),
  features: Array.isArray(tier.features)
    ? tier.features
        .map((feature) => String(feature || "").trim())
        .filter(Boolean)
    : [],
  icon: String(tier.icon || "star")
    .trim()
    .toLowerCase(),
  buttonText: String(tier.buttonText || "").trim(),
  popular: Boolean(tier.popular),
  invoiceTerms: Array.isArray(tier.invoiceTerms)
    ? tier.invoiceTerms.map((line) => String(line || "").trim()).filter(Boolean)
    : [],
});

const getDefaultMembershipTiers = () => DEFAULT_MEMBERSHIP_TIERS.map(normalizeTier);

const parseTierPriceToPaise = (priceLabel) => {
  const numericPrice = Number(String(priceLabel || "").replace(/[^\d]/g, ""));
  return Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice * 100 : 0;
};

const getTierDurationYears = (period) => {
  const match = String(period || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

const getTierBaseDurationYears = (tier = {}) => {
  const explicitYears = getTierDurationYears(tier?.period);

  if (explicitYears > 0) {
    return explicitYears;
  }

  const tierId = String(tier?.id || "").trim().toLowerCase();
  const tierName = String(tier?.name || "").trim().toLowerCase();
  const matchingDefaultTier = DEFAULT_MEMBERSHIP_TIERS.find((defaultTier) => {
    const defaultId = String(defaultTier?.id || "").trim().toLowerCase();
    const defaultName = String(defaultTier?.name || "").trim().toLowerCase();

    return (tierId && defaultId === tierId) || (tierName && defaultName === tierName);
  });

  return matchingDefaultTier ? getTierDurationYears(matchingDefaultTier.period) : 0;
};

const getTierBonusYears = (tier = {}) => {
  const explicitBonusYears = Math.max(0, Number(tier?.bonusYears || 0) || 0);

  if (explicitBonusYears > 0) {
    return explicitBonusYears;
  }

  const tierName = String(tier?.name || "").toLowerCase();
  const tierId = String(tier?.id || "").toLowerCase();

  if (tierName.includes("golden") || tierId === "ohc-golden") {
    return 3;
  }

  return 0;
};

const getTierDurationCode = (period) => {
  const years = getTierDurationYears(period);
  return years > 0 ? String(years).padStart(2, "0") : "00";
};

const getTierCardCode = (tier) =>
  TIER_CARD_CODES[String(tier?.id || "").trim().toLowerCase()] || "M";

const getCityLetter = (city) => {
  const normalizedCity = String(city || "").trim().toUpperCase();
  return normalizedCity ? normalizedCity.charAt(0) : "X";
};

const getStateCode = (state) => {
  const normalizedStateKey = String(state || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (!normalizedStateKey) {
    return "NA";
  }

  if (INDIA_STATE_CODE_MAP[normalizedStateKey]) {
    return INDIA_STATE_CODE_MAP[normalizedStateKey];
  }

  return "NA";
};

const buildMembershipId = ({
  tier,
  city,
  state,
  sequenceNumber,
}) => {
  const stateCode = getStateCode(state);
  return `OHC${getTierCardCode(tier)}${getTierDurationCode(
    tier?.period,
  )}${getCityLetter(city)}${stateCode}${sequenceNumber}`;
};

const buildMembershipFromTier = (tier) => {
  const years = getTierBaseDurationYears(tier);
  const bonusYears = getTierBonusYears(tier);
  const totalYears = years + bonusYears;
  const purchasedAt = new Date();
  const validUntilDate = new Date(purchasedAt);
  const membershipFeePaise = parseTierPriceToPaise(tier?.price);
  const adminFeePaise = parseTierPriceToPaise(tier?.adminFee);
  const totalPurchasePricePaise = membershipFeePaise + adminFeePaise;

  if (totalYears > 0) {
    validUntilDate.setFullYear(validUntilDate.getFullYear() + totalYears);
  }

  return {
    tierId: tier?.id || "",
    name: tier?.name || "",
    status: "Active",
    duration: totalYears > 0 ? `${totalYears} Years` : String(tier?.period || "").trim(),
    baseDurationYears: years,
    bonusYears,
    totalDurationYears: totalYears,
    validUntil:
      totalYears > 0
        ? validUntilDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })
        : "",
    nightsPerYear: "6 Nights / 7 Days",
    nightsRemaining: 6,
    purchasedAt,
    purchasePrice: totalPurchasePricePaise
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(totalPurchasePricePaise / 100)
      : String(tier?.price || "").trim(),
    cardCode: getTierCardCode(tier),
    invoiceTerms: Array.isArray(tier?.invoiceTerms) ? tier.invoiceTerms : [],
  };
};

module.exports = {
  buildMembershipId,
  buildMembershipFromTier,
  getDefaultMembershipTiers,
  getStateCode,
  getTierCardCode,
  getTierBaseDurationYears,
  getTierBonusYears,
  getTierDurationCode,
  normalizeTier,
  parseTierPriceToPaise,
};
