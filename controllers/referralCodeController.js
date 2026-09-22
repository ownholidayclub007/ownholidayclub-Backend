const crypto = require("crypto");
const ReferralCode = require("../models/ReferralCode");

const generateCodeValue = () =>
  `OHC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const generateUniqueReferralCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCodeValue();
    if (!(await ReferralCode.exists({ code }))) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique referral code. Please retry.");
};

exports.getReferralCodes = async (req, res) => {
  try {
    const requestedPage = Number(req.query.page || 1);
    const requestedLimit = Number(req.query.limit || 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), 50)
      : 10;
    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      ReferralCode.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ReferralCode.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      totalItems,
      pageSize: limit,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateReferralCodes = async (req, res) => {
  try {
    const requestedCount = Number(req.body?.count ?? 10);
    const count = Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.floor(requestedCount)
      : 10;
    const codesToCreate = [];

    for (let index = 0; index < count; index += 1) {
      codesToCreate.push({
        code: await generateUniqueReferralCode(),
        createdBy: req.cmsAdmin?.username || "Admin",
        notes: "Generated from admin panel for membership referral tracking.",
      });
    }

    const data = await ReferralCode.insertMany(codesToCreate);
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.validateReferralCode = async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();

    if (!code) {
      return res.status(200).json({ success: true, valid: true });
    }

    const referralCode = await ReferralCode.findOne({
      code,
      isActive: true,
    }).lean();

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

exports.deleteReferralCode = async (req, res) => {
  try {
    const deleted = await ReferralCode.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Referral code not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Referral code deleted successfully.",
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
