const crypto = require("crypto");
const ReferralCode = require("../models/ReferralCode");

const generateCodeValue = () => {
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `OHC-${randomPart}`;
};

const generateUniqueReferralCode = async () => {
  let code = generateCodeValue();
  let attempts = 0;

  while (attempts < 10) {
    const existing = await ReferralCode.findOne({ code });
    if (!existing) {
      return code;
    }
    code = generateCodeValue();
    attempts += 1;
  }

  throw new Error("Unable to generate a unique referral code. Please retry.");
};

exports.getReferralCodes = async (req, res) => {
  try {
    const rawPage = Number(req.query.page || 1);
    const rawLimit = Number(req.query.limit || 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 50) : 10;
    const skip = (page - 1) * limit;

    const [referralCodes, totalItems] = await Promise.all([
      ReferralCode.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ReferralCode.countDocuments(),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    res.status(200).json({
      success: true,
      data: referralCodes,
      currentPage: page,
      totalPages,
      totalItems,
      pageSize: limit,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.generateReferralCodes = async (req, res) => {
  try {
    const requestedCount = Number(req.body?.count ?? 10);
    const count = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : 10;

    const codesToCreate = [];

    for (let i = 0; i < count; i += 1) {
      const code = await generateUniqueReferralCode();

      codesToCreate.push({
        code,
        installationCount: 0,
        membershipCount: 0,
        createdBy: req.cmsAdmin?.username || "Admin",
        notes: "Generated from admin panel for membership referral tracking.",
      });
    }

    const createdCodes = await ReferralCode.insertMany(codesToCreate);

    res.status(200).json({
      success: true,
      count: createdCodes.length,
      data: createdCodes,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.validateReferralCode = async (req, res) => {
  try {
    const codeValue = String(req.body?.code || "").trim().toUpperCase();

    if (!codeValue) {
      return res.status(200).json({
        success: true,
        valid: true,
        message: "No referral code entered.",
      });
    }

    const referralCode = await ReferralCode.findOne({ code: codeValue, isActive: true });

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "Invalid referral code.",
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: "Referral code is valid.",
      data: referralCode,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      valid: false,
      message: error.message,
    });
  }
};

exports.trackReferralInstall = async (req, res) => {
  try {
    const codeValue = String(req.body?.code || "").trim().toUpperCase();

    if (!codeValue) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required.",
      });
    }

    const referralCode = await ReferralCode.findOne({ code: codeValue });

    if (!referralCode) {
      return res.status(404).json({
        success: false,
        message: "Referral code not found.",
      });
    }

    referralCode.installationCount = (referralCode.installationCount || 0) + 1;
    referralCode.membershipCount = referralCode.installationCount;
    referralCode.lastInstalledAt = new Date();
    referralCode.lastUsedAt = referralCode.lastInstalledAt;
    await referralCode.save();

    res.status(200).json({
      success: true,
      message: "Membership referral usage tracked successfully.",
      data: referralCode,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteReferralCode = async (req, res) => {
  try {
    const referralCode = await ReferralCode.findByIdAndDelete(req.params.id);

    if (!referralCode) {
      return res.status(404).json({
        success: false,
        message: "Referral code not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Referral code deleted successfully.",
      data: referralCode,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
