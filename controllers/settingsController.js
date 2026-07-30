const Settings = require("../models/Settings");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const { logActivity } = require("../utils/logger");

// @desc    Get current settings
// @route   GET /api/settings
// @access  Public
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Create default if not exists
      settings = await Settings.create({});
    }
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Upload Logo to Cloudinary if it's a new base64 string
    if (updateData.logo && updateData.logo.startsWith("data:image")) {
      const uploadedLogo = await uploadDocumentToCloudinary({
        file: { dataUrl: updateData.logo },
        documentType: "website-logo"
      });
      updateData.logo = uploadedLogo.url;
    }

    // Upload Footer BG to Cloudinary if it's a new base64 string
    if (updateData.footerBgImage && updateData.footerBgImage.startsWith("data:image")) {
      const uploadedFooterBg = await uploadDocumentToCloudinary({
        file: { dataUrl: updateData.footerBgImage },
        documentType: "footer-bg"
      });
      updateData.footerBgImage = uploadedFooterBg.url;
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(updateData);
    } else {
      settings = await Settings.findOneAndUpdate({}, updateData, {
        new: true,
        runValidators: true,
      });
    }

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Updated",
        module: "Settings",
        details: `Updated website settings`,
        req
    });

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
