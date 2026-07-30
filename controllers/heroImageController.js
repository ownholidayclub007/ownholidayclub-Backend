const HeroImage = require("../models/HeroImage");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");

exports.createHeroImage = async (req, res) => {
  try {
    const { pageName, imageAltText, title, highlightedText, shortDescription, status, backgroundImage } = req.body;
    let backgroundImageUrl = "";

    if (backgroundImage) {
      if (backgroundImage.startsWith("data:image")) {
        const uploaded = await uploadDocumentToCloudinary({
          file: { dataUrl: backgroundImage },
          folder: "heroImages",
          documentType: "background"
        });
        backgroundImageUrl = uploaded.url;
      } else {
        backgroundImageUrl = backgroundImage;
      }
    } else {
      return res.status(400).json({ success: false, message: "Background image is required" });
    }

    const newImage = new HeroImage({
      pageName,
      backgroundImage: backgroundImageUrl,
      imageAltText,
      title,
      highlightedText,
      shortDescription,
      status,
      updatedBy: req.cmsAdmin?.username || "Admin"
    });

    await newImage.save();
    res.status(201).json({ success: true, message: "Hero Image created successfully", data: newImage });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Background image for this page already exists" });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.getAllHeroImages = async (req, res) => {
  try {
    const images = await HeroImage.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: images });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.getHeroImageById = async (req, res) => {
  try {
    const image = await HeroImage.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ success: false, message: "Hero Image not found" });
    }
    res.status(200).json({ success: true, data: image });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.getHeroImageByPageName = async (req, res) => {
  try {
    const image = await HeroImage.findOne({ pageName: req.params.pageName, status: "Active" });
    if (!image) {
      return res.status(404).json({ success: false, message: "Hero Image not found" });
    }
    res.status(200).json({ success: true, data: image });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.updateHeroImage = async (req, res) => {
  try {
    const { pageName, imageAltText, title, highlightedText, shortDescription, status, backgroundImage } = req.body;
    const image = await HeroImage.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ success: false, message: "Hero Image not found" });
    }

    let backgroundImageUrl = image.backgroundImage;

    if (backgroundImage) {
      if (backgroundImage.startsWith("data:image")) {
        const uploaded = await uploadDocumentToCloudinary({
          file: { dataUrl: backgroundImage },
          folder: "heroImages",
          documentType: "background"
        });
        backgroundImageUrl = uploaded.url;
      } else {
        backgroundImageUrl = backgroundImage;
      }
    }

    const updatedImage = await HeroImage.findByIdAndUpdate(
      req.params.id,
      { pageName, backgroundImage: backgroundImageUrl, imageAltText, title, highlightedText, shortDescription, status, updatedBy: req.cmsAdmin?.username || "Admin" },
      { new: true }
    );

    res.status(200).json({ success: true, message: "Hero Image updated successfully", data: updatedImage });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Background image for this page already exists" });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.deleteHeroImage = async (req, res) => {
  try {
    const image = await HeroImage.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ success: false, message: "Hero Image not found" });
    }

    await HeroImage.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Hero Image deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
