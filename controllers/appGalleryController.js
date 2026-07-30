const { AppGalleryHeading, AppGalleryImage } = require("../models/AppGallery");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");

// --- Headings ---

exports.getHeadings = async (req, res) => {
  try {
    let headings = await AppGalleryHeading.findOne();
    if (!headings) {
      headings = new AppGalleryHeading();
      await headings.save();
    }
    res.status(200).json({ success: true, data: headings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.updateHeadings = async (req, res) => {
  try {
    const { featuredTitle, fullGalleryTitle, fullGallerySubtitle } = req.body;
    let headings = await AppGalleryHeading.findOne();
    
    if (!headings) {
      headings = new AppGalleryHeading({
        featuredTitle,
        fullGalleryTitle,
        fullGallerySubtitle,
        updatedBy: req.cmsAdmin?.username || "Admin"
      });
      await headings.save();
    } else {
      headings.featuredTitle = featuredTitle || headings.featuredTitle;
      headings.fullGalleryTitle = fullGalleryTitle || headings.fullGalleryTitle;
      headings.fullGallerySubtitle = fullGallerySubtitle || headings.fullGallerySubtitle;
      headings.updatedBy = req.cmsAdmin?.username || "Admin";
      await headings.save();
    }

    res.status(200).json({ success: true, message: "Headings updated successfully", data: headings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// --- Images ---

exports.getImages = async (req, res) => {
  try {
    const { type } = req.query; // 'featured' or 'full'
    let query = {};
    if (type) {
      query.type = type;
    }
    const images = await AppGalleryImage.find(query).sort({ order: 1, createdAt: 1 });
    res.status(200).json({ success: true, data: images });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createImage = async (req, res) => {
  try {
    const { type, text, image, order } = req.body;

    if (!type || !["featured", "full"].includes(type)) {
      return res.status(400).json({ success: false, message: "Valid image type ('featured' or 'full') is required" });
    }

    if (!image) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    let imageUrl = "";
    let publicId = "";

    if (image.startsWith("data:image")) {
      const uploaded = await uploadDocumentToCloudinary({
        file: { dataUrl: image },
        folder: `appGallery/${type}`,
        documentType: "image"
      });
      imageUrl = uploaded.url;
      publicId = uploaded.publicId;
    } else {
      return res.status(400).json({ success: false, message: "Invalid image format. Expected base64." });
    }

    let assignedOrder = order;
    if (assignedOrder === undefined || assignedOrder === null || assignedOrder === "") {
      const lastImage = await AppGalleryImage.findOne({ type }).sort({ order: -1 });
      assignedOrder = lastImage ? lastImage.order + 1 : 0;
    }

    const newImage = new AppGalleryImage({
      type,
      image: { url: imageUrl, public_id: publicId },
      text: text || "",
      order: assignedOrder,
      updatedBy: req.cmsAdmin?.username || "Admin"
    });

    await newImage.save();
    res.status(201).json({ success: true, message: "Image added successfully", data: newImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.updateImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, order, image } = req.body;
    
    const existingImage = await AppGalleryImage.findById(id);
    if (!existingImage) {
      return res.status(404).json({ success: false, message: "Image not found" });
    }

    let imageUrl = existingImage.image.url;
    let publicId = existingImage.image.public_id;

    if (image && image.startsWith("data:image")) {
      const uploaded = await uploadDocumentToCloudinary({
        file: { dataUrl: image },
        folder: `appGallery/${existingImage.type}`,
        documentType: "image"
      });
      imageUrl = uploaded.url;
      publicId = uploaded.publicId;
    }

    existingImage.text = text !== undefined ? text : existingImage.text;
    if (order !== undefined && order !== null && order !== "") {
      existingImage.order = order;
    }
    existingImage.image = { url: imageUrl, public_id: publicId };
    existingImage.updatedBy = req.cmsAdmin?.username || "Admin";

    await existingImage.save();

    res.status(200).json({ success: true, message: "Image updated successfully", data: existingImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const image = await AppGalleryImage.findById(id);
    
    if (!image) {
      return res.status(404).json({ success: false, message: "Image not found" });
    }

    await AppGalleryImage.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.reorderImages = async (req, res) => {
  try {
    const { reorderedItems } = req.body; // Array of { _id, order }

    if (!reorderedItems || !Array.isArray(reorderedItems)) {
      return res.status(400).json({ success: false, message: "Invalid reorder data" });
    }

    for (const item of reorderedItems) {
      await AppGalleryImage.findByIdAndUpdate(item._id, { order: item.order });
    }

    res.status(200).json({ success: true, message: "Order updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// --- Aggregate API for App Developer ---
// This endpoint returns settings + featured images + full gallery images in one go

exports.getFullAppGalleryData = async (req, res) => {
  try {
    let headings = await AppGalleryHeading.findOne();
    if (!headings) {
       headings = new AppGalleryHeading();
    }

    const featuredImages = await AppGalleryImage.find({ type: "featured" }).sort({ order: 1, createdAt: 1 });
    const fullGalleryImages = await AppGalleryImage.find({ type: "full" }).sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: {
        settings: {
          featuredTitle: headings.featuredTitle,
          fullGalleryTitle: headings.fullGalleryTitle,
          fullGallerySubtitle: headings.fullGallerySubtitle
        },
        featuredImages,
        fullGalleryImages
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
