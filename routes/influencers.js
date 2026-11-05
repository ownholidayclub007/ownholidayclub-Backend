const express = require("express");
const mongoose = require("mongoose");
const InfluencerAccount = require("../models/InfluencerAccount");
const ReferralCode = require("../models/ReferralCode");
const asyncHandler = require("../utils/asyncHandler");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const requireInfluencer = require("../middleware/requireInfluencer");
const {
  decryptPassword,
  encryptPassword,
  generatePassword,
} = require("../utils/influencerCredentials");
const {
  hashSecret,
  normaliseUsername,
  signInfluencerToken,
  verifySecret,
} = require("../utils/security");

const router = express.Router();

const normalizeCodeIds = (ids) =>
  Array.isArray(ids) ? [...new Set(ids.map((id) => String(id)))] : [];

const getCodesForAccount = async (accountId) =>
  ReferralCode.find({ influencerAccountId: accountId })
    .select("code referrerName membershipCount isActive lastUsedAt createdAt")
    .sort({ createdAt: 1 })
    .lean();

const getAccountResponse = async (account) => {
  const [referralCodes, credentialRecord] = await Promise.all([
    getCodesForAccount(account._id),
    InfluencerAccount.findById(account._id).select("+encryptedPassword").lean(),
  ]);
  return {
    _id: account._id,
    name: account.name,
    username: account.username,
    password: decryptPassword(credentialRecord?.encryptedPassword),
    isActive: account.isActive,
    createdAt: account.createdAt,
    referralCodes,
  };
};

const validateCredentials = ({ name, username, password }) => {
  if (!name || name.length > 100) {
    return "Influencer name is required and must be 100 characters or fewer.";
  }
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    return "Username must be 3–50 characters and use only letters, numbers, dots, underscores, or hyphens.";
  }
  if (password !== undefined && String(password).length < 10) {
    return "Password must be at least 10 characters.";
  }
  return "";
};

const validateCustomCode = async (value) => {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]+(?:0[1-9]|[1-9]\d)$/.test(code)) {
    return { error: "Code must contain a name or initials followed by two digits, e.g. DS17." };
  }

  const customNumber = Number(code.slice(-2));
  const duplicate = await ReferralCode.exists({
    $or: [
      { customNumber },
      { code: new RegExp(`^[A-Z]+${String(customNumber).padStart(2, "0")}$`) },
    ],
  });
  if (duplicate) {
    return {
      error: `Referral number ${String(customNumber).padStart(2, "0")} is already in use.`,
    };
  }
  return { code, customNumber };
};

const validateAssignableCodes = async (ids, currentAccountId = null) => {
  if (!ids.length) return { codes: [] };
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return { error: "One or more selected referral codes are invalid." };
  }

  const codes = await ReferralCode.find({ _id: { $in: ids } });
  if (codes.length !== ids.length) {
    return { error: "One or more selected referral codes were not found." };
  }

  const belongsElsewhere = codes.some(
    (code) =>
      code.influencerAccountId &&
      String(code.influencerAccountId) !== String(currentAccountId || ""),
  );
  if (belongsElsewhere) {
    return { error: "A referral code is already assigned to another influencer." };
  }
  return { codes };
};

const generateUniquePassword = async (referralCode, excludedAccountId = null) => {
  const accounts = await InfluencerAccount.find(
    excludedAccountId ? { _id: { $ne: excludedAccountId } } : {},
  )
    .select("+encryptedPassword")
    .lean();
  const existingPasswords = new Set(
    accounts
      .map((account) => decryptPassword(account.encryptedPassword))
      .filter(Boolean),
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const password = generatePassword(referralCode);
    if (!existingPasswords.has(password)) return password;
  }
  throw new Error("Unable to generate a unique influencer password.");
};

router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const username = normaliseUsername(req.body?.username);
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const influencer = await InfluencerAccount.findOne({ username }).select("+passwordHash");
    if (!influencer || !verifySecret(password, influencer.passwordHash)) {
      return res.status(401).json({ message: "Invalid username or password." });
    }
    if (!influencer.isActive) {
      return res.status(403).json({ message: "This influencer account is disabled." });
    }

    return res.status(200).json({
      success: true,
      token: signInfluencerToken(influencer),
      influencer: {
        id: influencer._id,
        name: influencer.name,
        username: influencer.username,
      },
    });
  }),
);

router.get(
  "/dashboard",
  requireInfluencer,
  asyncHandler(async (req, res) => {
    const referralCodes = await getCodesForAccount(req.influencer._id);
    return res.status(200).json({
      success: true,
      influencer: {
        name: req.influencer.name,
        username: req.influencer.username,
      },
      referralCodes,
      totalMemberships: referralCodes.reduce(
        (total, code) => total + Number(code.membershipCount || 0),
        0,
      ),
    });
  }),
);

router.get(
  "/accounts",
  requireCmsAdmin,
  asyncHandler(async (_req, res) => {
    const accounts = await InfluencerAccount.find({})
      .select("+encryptedPassword")
      .sort({ createdAt: -1 })
      .lean();
    const accountIds = accounts.map((account) => account._id);
    const codes = await ReferralCode.find({ influencerAccountId: { $in: accountIds } })
      .select("code referrerName membershipCount isActive lastUsedAt createdAt influencerAccountId")
      .sort({ createdAt: 1 })
      .lean();
    const codesByAccountId = new Map();
    for (const code of codes) {
      const key = String(code.influencerAccountId);
      const { influencerAccountId, ...safeCode } = code;
      const accountCodes = codesByAccountId.get(key) || [];
      accountCodes.push(safeCode);
      codesByAccountId.set(key, accountCodes);
    }

    return res.status(200).json({
      success: true,
      data: accounts.map((account) => ({
        _id: account._id,
        name: account.name,
        username: account.username,
        password: decryptPassword(account.encryptedPassword),
        isActive: account.isActive,
        createdAt: account.createdAt,
        referralCodes: codesByAccountId.get(String(account._id)) || [],
      })),
    });
  }),
);

router.get(
  "/unassigned-codes",
  requireCmsAdmin,
  asyncHandler(async (_req, res) => {
    const codes = await ReferralCode.find({ influencerAccountId: null })
      .select("code referrerName membershipCount isActive createdAt")
      .sort({ createdAt: 1 })
      .lean();
    return res.status(200).json({ success: true, data: codes });
  }),
);

router.post(
  "/accounts",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || req.body?.referrerName || "").trim();
    const code = String(req.body?.code || "").trim();
    const codeIds = normalizeCodeIds(req.body?.referralCodeIds);
    if (!name || name.length > 100) {
      return res.status(400).json({ message: "Influencer/VP name is required and must be 100 characters or fewer." });
    }
    if (code && codeIds.length) {
      return res.status(400).json({ message: "Create a new code or link existing codes, not both in one request." });
    }
    if ((!code && codeIds.length !== 1) || (code && codeIds.length)) {
      return res.status(400).json({ message: "Link exactly one existing referral code or create one new code for this influencer." });
    }

    let newCode = null;
    if (code) {
      const codeValidation = await validateCustomCode(code);
      if (codeValidation.error) {
        return res.status(409).json({ message: codeValidation.error });
      }
      newCode = codeValidation;
    }

    const assignable = await validateAssignableCodes(codeIds);
    if (assignable.error) return res.status(409).json({ message: assignable.error });
    const username = normaliseUsername(newCode?.code || assignable.codes[0]?.code);
    const validationError = validateCredentials({ name, username });
    if (validationError) return res.status(400).json({ message: validationError });
    const existingAccount = await InfluencerAccount.exists({ username });
    if (existingAccount) {
      return res.status(409).json({ message: "An influencer login already exists for this referral code." });
    }

    const initialPassword = await generateUniquePassword(
      newCode?.code || assignable.codes[0]?.code,
    );
    const influencer = await InfluencerAccount.create({
      name,
      username,
      passwordHash: hashSecret(initialPassword),
      encryptedPassword: encryptPassword(initialPassword),
      createdBy: req.cmsAdmin.username,
    });
    try {
      if (newCode) {
        await ReferralCode.create({
          code: newCode.code,
          customNumber: newCode.customNumber,
          referrerName: name,
          createdBy: req.cmsAdmin.username,
          influencerAccountId: influencer._id,
          notes: "Referral code created with an influencer login account.",
        });
      } else {
        await ReferralCode.updateOne(
          { _id: { $in: codeIds }, influencerAccountId: null },
          {
            $set: {
              influencerAccountId: influencer._id,
              referrerName: name,
            },
          },
        );
      }
    } catch (error) {
      await InfluencerAccount.findByIdAndDelete(influencer._id);
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Influencer account created and referral code(s) linked.",
      data: await getAccountResponse(influencer),
    });
  }),
);

router.put(
  "/accounts/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid influencer account ID." });
    }
    const influencer = await InfluencerAccount.findById(req.params.id);
    if (!influencer) return res.status(404).json({ message: "Influencer account not found." });

    const name = String(req.body?.name ?? influencer.name).trim();
    const requestedCodeIds = req.body?.referralCodeIds;
    let linkedCode;
    if (requestedCodeIds !== undefined) {
      const codeIds = normalizeCodeIds(requestedCodeIds);
      if (codeIds.length !== 1) {
        return res.status(400).json({ message: "Each influencer account must be linked to exactly one referral code." });
      }
      const assignable = await validateAssignableCodes(codeIds, influencer._id);
      if (assignable.error) return res.status(409).json({ message: assignable.error });
      linkedCode = assignable.codes[0];
    } else {
      linkedCode = await ReferralCode.findOne({ influencerAccountId: influencer._id });
    }
    if (!linkedCode) {
      return res.status(400).json({ message: "An influencer account must have one linked referral code." });
    }
    const username = normaliseUsername(linkedCode.code);
    const validationError = validateCredentials({ name, username });
    if (validationError) return res.status(400).json({ message: validationError });
    const duplicateUsername = await InfluencerAccount.exists({
      _id: { $ne: influencer._id },
      username,
    });
    if (duplicateUsername) return res.status(409).json({ message: "This username is already in use." });

    influencer.name = name;
    influencer.username = username;
    if (typeof req.body?.isActive === "boolean") influencer.isActive = req.body.isActive;
    await influencer.save();

    await ReferralCode.updateOne(
      { _id: linkedCode._id },
      { $set: { influencerAccountId: influencer._id, referrerName: name } },
    );

    return res.status(200).json({
      success: true,
      message: "Influencer account updated.",
      data: await getAccountResponse(influencer),
    });
  }),
);

router.patch(
  "/accounts/:id/password",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid influencer account ID." });
    }
    const influencer = await InfluencerAccount.findById(req.params.id);
    if (!influencer) return res.status(404).json({ message: "Influencer account not found." });
    const linkedCode = await ReferralCode.findOne({
      influencerAccountId: influencer._id,
    }).select("code");
    if (!linkedCode) {
      return res.status(409).json({ message: "This account has no linked referral code." });
    }
    const password = await generateUniquePassword(linkedCode.code, influencer._id);
    influencer.passwordHash = hashSecret(password);
    influencer.encryptedPassword = encryptPassword(password);
    await influencer.save();
    return res.status(200).json({
      success: true,
      message: "Influencer password reset.",
      username: influencer.username,
      password,
    });
  }),
);

router.delete(
  "/accounts/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid influencer account ID." });
    }
    const influencer = await InfluencerAccount.findById(req.params.id);
    if (!influencer) return res.status(404).json({ message: "Influencer account not found." });

    await ReferralCode.updateMany(
      { influencerAccountId: influencer._id },
      { $unset: { influencerAccountId: "" } },
    );
    await InfluencerAccount.findByIdAndDelete(influencer._id);
    return res.status(200).json({
      success: true,
      message: "Influencer login deleted; referral codes and membership counts were preserved.",
    });
  }),
);

module.exports = router;
