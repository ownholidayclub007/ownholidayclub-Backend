const ServiceEnquiry = require("../models/ServiceEnquiry");
const asyncHandler = require("../utils/asyncHandler");
const { sendLeadNotificationEmail, sendGenericThankYouEmail } = require("../utils/email");

// @desc    Create new service enquiry
// @route   POST /api/service-enquiries
// @access  Public
exports.createEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await ServiceEnquiry.create(req.body);

  try {
    await sendLeadNotificationEmail({
      leadType: "Service Enquiry",
      leadDetails: {
        "Name": enquiry.name,
        "Email": enquiry.email,
        "Phone": enquiry.phone,
        "Service": enquiry.serviceName,
        ...(enquiry.serviceName && enquiry.serviceName.toUpperCase().includes("WEDDING") 
             ? { "Type of Wedding": enquiry.subEvent || "Not specified" } 
             : { "Sub-Category": enquiry.subEvent || "Not specified" }),
        "From Location": enquiry.fromLocation || "Not specified",
        "To Location": enquiry.toLocation || "Not specified",
        "Check-In": enquiry.checkIn ? new Date(enquiry.checkIn).toLocaleDateString() : "Not specified",
        "Check-Out": enquiry.checkOut ? new Date(enquiry.checkOut).toLocaleDateString() : "Not specified",
        ...(enquiry.serviceName && enquiry.serviceName.toUpperCase().includes("OUTING") 
             ? { "Adults": enquiry.adults || 0, "Kids": enquiry.kids || 0 } 
             : { "No of Guests": enquiry.adults || 0 }),
        ...(enquiry.marriageDate ? { "Date of Marriage": new Date(enquiry.marriageDate).toLocaleDateString() } : {}),
        "Budget": enquiry.budget || "Not specified",
      },
      message: enquiry.message,
    });
  } catch (mailErr) {
    console.error("Failed to send service enquiry lead email:", mailErr);
  }

  try {
    await sendGenericThankYouEmail({
      to: enquiry.email,
      name: enquiry.name,
      type: "Service"
    });
  } catch (thankYouErr) {
    console.error("Failed to send thank you email:", thankYouErr);
  }

  res.status(201).json({
    success: true,
    data: enquiry,
  });
});

// @desc    Get all service enquiries (Admin)
// @route   GET /api/service-enquiries/admin
// @access  Private/Admin
exports.getAllEnquiries = asyncHandler(async (req, res) => {
  const enquiries = await ServiceEnquiry.find().sort({ createdAt: -1 });
  
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
});

// @desc    Update enquiry status
// @route   PUT /api/service-enquiries/:id/status
// @access  Private/Admin
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const enquiry = await ServiceEnquiry.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!enquiry) {
    res.status(404);
    throw new Error("Enquiry not found");
  }

  res.status(200).json({
    success: true,
    data: enquiry,
  });
});

// @desc    Delete enquiry
// @route   DELETE /api/service-enquiries/:id
// @access  Private/Admin
exports.deleteEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await ServiceEnquiry.findByIdAndDelete(req.params.id);

  if (!enquiry) {
    res.status(404);
    throw new Error("Enquiry not found");
  }

  res.status(200).json({
    success: true,
    message: "Enquiry removed",
  });
});
