const ContactEnquiry = require("../models/ContactEnquiry");
const { sendLeadNotificationEmail } = require("../utils/email");

// @desc    Submit a contact enquiry
// @route   POST /api/contact-enquiries
// @access  Public
exports.submitEnquiry = async (req, res) => {
  try {
    const enquiry = await ContactEnquiry.create(req.body);

    try {
      await sendLeadNotificationEmail({
        leadType: "Contact Enquiry",
        leadDetails: {
          "Name": enquiry.name,
          "Email": enquiry.email,
          "Phone": enquiry.phone,
          "Subject": enquiry.subject || "Contact Us Inquiry",
        },
        message: enquiry.message,
      });
    } catch (mailErr) {
      console.error("Failed to send contact enquiry lead email:", mailErr);
    }

    res.status(201).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all contact enquiries (Admin)
// @route   GET /api/contact-enquiries/admin
// @access  Private/Admin
exports.getEnquiries = async (req, res) => {
  try {
    const enquiries = await ContactEnquiry.find().sort("-createdAt");
    
    // Calculate stats
    const stats = {
      total: enquiries.length,
      new: enquiries.filter(e => e.status === 'new').length,
      pending: enquiries.filter(e => e.status === 'pending').length,
      contacted: enquiries.filter(e => e.status === 'contacted').length,
      resolved: enquiries.filter(e => e.status === 'resolved').length
    };

    res.status(200).json({
      success: true,
      data: enquiries,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update enquiry status
// @route   PUT /api/contact-enquiries/:id/status
// @access  Private/Admin
exports.updateStatus = async (req, res) => {
  try {
    const enquiry = await ContactEnquiry.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete enquiry
// @route   DELETE /api/contact-enquiries/:id
// @access  Private/Admin
exports.deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await ContactEnquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    res.status(200).json({
      success: true,
      message: "Enquiry deleted",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
