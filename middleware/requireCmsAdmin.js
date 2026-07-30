const asyncHandler = require("../utils/asyncHandler");
const Admin = require("../models/Admin");
const { verifyCmsToken } = require("../utils/security");

module.exports = asyncHandler(async (req, res, next) => {
  const authorizationHeader = String(req.headers.authorization || "");
  const [, token] = authorizationHeader.split(" ");

  if (!token) {
    return res.status(401).json({ message: "CMS authentication is required." });
  }

  const tokenPayload = verifyCmsToken(token);

  if (!tokenPayload?.id) {
    return res.status(401).json({ message: "Invalid or expired CMS session." });
  }

  const admin = await Admin.findById(tokenPayload.id);

  if (!admin || !admin.isActive) {
    return res.status(403).json({ message: "Admin account is unavailable." });
  }

  if (!admin.role) {
    return res.status(403).json({ message: "You do not have a valid admin role." });
  }

  req.cmsAdmin = admin;
  next();
});
