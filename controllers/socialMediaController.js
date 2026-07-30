const SocialMedia = require("../models/SocialMedia");
const asyncHandler = require("../utils/asyncHandler");
const { logActivity } = require("../utils/logger");

// Get Social Media Links
exports.getSocialMedia = asyncHandler(async (req, res) => {
  let social = await SocialMedia.findOne();
  if (!social) {
    social = await SocialMedia.create({});
  }
  res.status(200).json({
    success: true,
    data: social,
  });
});

// Update Social Media Links
exports.updateSocialMedia = asyncHandler(async (req, res) => {
  let social = await SocialMedia.findOne();
  if (!social) {
    social = await SocialMedia.create(req.body);
  } else {
    social = await SocialMedia.findByIdAndUpdate(social._id, req.body, {
      new: true,
      runValidators: true,
    });
  }

  await logActivity({
    user: req.cmsAdmin?.username || 'Admin',
    action: "Updated",
    module: "Settings",
    details: `Updated social media links`,
    req
  });

  res.status(200).json({
    success: true,
    data: social,
  });
});
