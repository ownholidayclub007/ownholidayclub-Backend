const asyncHandler = require("../utils/asyncHandler");
const InfluencerAccount = require("../models/InfluencerAccount");
const { verifyInfluencerToken } = require("../utils/security");

module.exports = asyncHandler(async (req, res, next) => {
  const authorizationHeader = String(req.headers.authorization || "");
  const [, token] = authorizationHeader.split(" ");
  const tokenPayload = verifyInfluencerToken(token);

  if (!tokenPayload) {
    return res.status(401).json({ message: "Invalid or expired influencer session." });
  }

  const influencer = await InfluencerAccount.findById(tokenPayload.id);
  if (!influencer || !influencer.isActive) {
    return res.status(403).json({ message: "Influencer account is unavailable." });
  }

  req.influencer = influencer;
  next();
});
