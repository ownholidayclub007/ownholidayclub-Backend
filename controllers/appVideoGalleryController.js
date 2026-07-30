const { AppVideoHeading, AppVideoItem } = require("../models/AppVideoGallery");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");

// --- Headings ---

exports.getHeadings = async (req, res) => {
  try {
    let headings = await AppVideoHeading.findOne();
    if (!headings) {
      headings = new AppVideoHeading();
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
    const { heading, subHeading, iconWord } = req.body;
    let headingsObj = await AppVideoHeading.findOne();
    
    if (!headingsObj) {
      headingsObj = new AppVideoHeading({
        heading,
        subHeading,
        iconWord,
        updatedBy: req.cmsAdmin?.username || "Admin"
      });
      await headingsObj.save();
    } else {
      headingsObj.heading = heading !== undefined ? heading : headingsObj.heading;
      headingsObj.subHeading = subHeading !== undefined ? subHeading : headingsObj.subHeading;
      headingsObj.iconWord = iconWord !== undefined ? iconWord : headingsObj.iconWord;
      headingsObj.updatedBy = req.cmsAdmin?.username || "Admin";
      await headingsObj.save();
    }

    res.status(200).json({ success: true, message: "Headings updated successfully", data: headingsObj });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// --- Videos ---

exports.getVideos = async (req, res) => {
  try {
    const videos = await AppVideoItem.find().sort({ order: 1, createdAt: 1 });
    res.status(200).json({ success: true, data: videos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.addVideo = async (req, res) => {
  try {
    const { title, image, videoUrl, views, uploaderName, order } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ success: false, message: "Video URL is required" });
    }

    let assignedOrder = order;
    if (assignedOrder === undefined || assignedOrder === null || assignedOrder === "") {
      const lastVideo = await AppVideoItem.findOne().sort({ order: -1 });
      assignedOrder = lastVideo ? lastVideo.order + 1 : 1;
    }

    const newVideo = new AppVideoItem({
      title: title || "",
      image: image || "",
      videoUrl,
      views: views || "",
      uploaderName: uploaderName || "",
      order: assignedOrder,
      updatedBy: req.cmsAdmin?.username || "Admin"
    });

    await newVideo.save();
    res.status(201).json({ success: true, message: "Video added successfully", data: newVideo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image, videoUrl, views, uploaderName, order } = req.body;
    
    const existingVideo = await AppVideoItem.findById(id);
    if (!existingVideo) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    if (title !== undefined) existingVideo.title = title;
    if (image !== undefined) existingVideo.image = image;
    if (videoUrl !== undefined) existingVideo.videoUrl = videoUrl;
    if (views !== undefined) existingVideo.views = views;
    if (uploaderName !== undefined) existingVideo.uploaderName = uploaderName;
    if (order !== undefined && order !== null && order !== "") existingVideo.order = order;
    
    existingVideo.updatedBy = req.cmsAdmin?.username || "Admin";

    await existingVideo.save();

    res.status(200).json({ success: true, message: "Video updated successfully", data: existingVideo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await AppVideoItem.findById(id);
    
    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    await AppVideoItem.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Video deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.reorderVideos = async (req, res) => {
  try {
    const { reorderedItems } = req.body; // Array of { _id, order }

    if (!reorderedItems || !Array.isArray(reorderedItems)) {
      return res.status(400).json({ success: false, message: "Invalid reorder data" });
    }

    for (const item of reorderedItems) {
      await AppVideoItem.findByIdAndUpdate(item._id, { order: item.order });
    }

    res.status(200).json({ success: true, message: "Order updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.uploadVideo = async (req, res) => {
  try {
    const { file } = req.body;

    if (!file || !file.dataUrl) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const uploaded = await uploadDocumentToCloudinary({
      file,
      folder: "ownholidayclub/app-video-gallery",
      documentType: "video",
    });

    return res.status(200).json({
      success: true,
      data: {
        url: uploaded.url,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// --- Aggregate API for App Developer ---

exports.getFullVideoGalleryData = async (req, res) => {
  try {
    let headings = await AppVideoHeading.findOne();
    if (!headings) {
       headings = new AppVideoHeading();
    }

    const videos = await AppVideoItem.find().sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: {
        settings: {
          heading: headings.heading,
          subHeading: headings.subHeading,
          iconWord: headings.iconWord
        },
        videos
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
