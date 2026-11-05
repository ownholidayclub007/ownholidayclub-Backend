const crypto = require("crypto");
const ReferralCode = require("../models/ReferralCode");
const InfluencerAccount = require("../models/InfluencerAccount");
const { decryptPassword } = require("../utils/influencerCredentials");

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
      ReferralCode.find({})
        .populate({
          path: "influencerAccountId",
          select: "username isActive +encryptedPassword",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReferralCode.countDocuments(),
    ]);

    const safeData = data.map((item) => {
      if (!item.influencerAccountId) return item;
      return {
        ...item,
        influencerAccountId: {
          ...item.influencerAccountId,
          password: decryptPassword(item.influencerAccountId.encryptedPassword),
          encryptedPassword: undefined,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: safeData,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      totalItems,
      pageSize: limit,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateReferralCode = async (req, res) => {
  try {
    const referralCode = await ReferralCode.findById(req.params.id);
    if (!referralCode) {
      return res.status(404).json({
        success: false,
        message: "Referral code not found.",
      });
    }

    const code = String(req.body?.code ?? referralCode.code).trim().toUpperCase();
    const referrerName = String(
      req.body?.referrerName ?? referralCode.referrerName,
    ).trim();
    if (!/^[A-Z0-9-]{3,30}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Referral code must be 3–30 letters, numbers, or hyphens.",
      });
    }
    if (!referrerName || referrerName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "VP name is required and must be 100 characters or fewer.",
      });
    }

    const duplicateCode = await ReferralCode.exists({
      _id: { $ne: referralCode._id },
      code,
    });
    if (duplicateCode) {
      return res.status(409).json({
        success: false,
        message: "This referral code already exists.",
      });
    }

    const customCodeMatch = /^([A-Z]+)(\d{2})$/.exec(code);
    const customNumber = customCodeMatch ? Number(customCodeMatch[2]) : undefined;
    if (customNumber !== undefined) {
      const duplicateNumber = await ReferralCode.exists({
        _id: { $ne: referralCode._id },
        customNumber,
      });
      if (duplicateNumber) {
        return res.status(409).json({
          success: false,
          message: `Referral number ${String(customNumber).padStart(2, "0")} is already in use.`,
        });
      }
    }

    let influencer = null;
    if (referralCode.influencerAccountId) {
      influencer = await InfluencerAccount.findById(
        referralCode.influencerAccountId,
      );
      if (influencer) {
        const duplicateUsername = await InfluencerAccount.exists({
          _id: { $ne: influencer._id },
          username: code.toLowerCase(),
        });
        if (duplicateUsername) {
          return res.status(409).json({
            success: false,
            message: "Another influencer account is already using this code as its username.",
          });
        }
      }
    }

    referralCode.code = code;
    referralCode.referrerName = referrerName;
    if (customNumber === undefined) {
      referralCode.customNumber = undefined;
    } else {
      referralCode.customNumber = customNumber;
    }
    if (typeof req.body?.isActive === "boolean") {
      referralCode.isActive = req.body.isActive;
    }
    await referralCode.save();

    if (influencer) {
      influencer.username = code.toLowerCase();
      influencer.name = referrerName;
      await influencer.save();
    }

    return res.status(200).json({
      success: true,
      message: "Referral code and VP details updated.",
      data: referralCode,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "The referral code or its number is already in use.",
      });
    }
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

exports.generateCustomReferralCode = async (req, res) => {
  try {
    const referrerName =
      typeof req.body?.referrerName === "string" ? req.body.referrerName.trim() : "";
    const code =
      typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";

    if (!referrerName || referrerName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "VP name is required and must be 100 characters or fewer.",
      });
    }

    if (!/^[A-Z]+(?:0[1-9]|[1-9]\d)$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Enter your chosen name or initials followed by exactly 2 digits (e.g. DS01).",
      });
    }

    const customNumber = Number(code.slice(-2));
    const existingNumberedCode = await ReferralCode.exists({
      $or: [
        { customNumber },
        { code: new RegExp(`^[A-Z]+${String(customNumber).padStart(2, "0")}$`) },
      ],
    });

    if (existingNumberedCode) {
      return res.status(409).json({
        success: false,
        message: `The number ${String(customNumber).padStart(2, "0")} is already used. Choose a different number.`,
      });
    }

    const data = await ReferralCode.create({
      code,
      customNumber,
      referrerName,
      createdBy: req.cmsAdmin?.username || "Admin",
      notes: "Custom referral code generated for a VP.",
    });

    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.customNumber) {
        return res.status(409).json({
          success: false,
          message: `The number ${String(error.keyValue?.customNumber).padStart(2, "0")} is already used. Choose a different number.`,
        });
      }

      return res.status(409).json({
        success: false,
        message: "This referral code already exists. Enter a different code.",
      });
    }

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

    if (deleted.influencerAccountId) {
      const remainingCodes = await ReferralCode.countDocuments({
        influencerAccountId: deleted.influencerAccountId,
      });
      if (remainingCodes === 0) {
        await InfluencerAccount.findByIdAndDelete(deleted.influencerAccountId);
      }
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
