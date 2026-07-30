const User = require("../models/User");
const Blog = require("../models/Blog");
const DestinationEnquiry = require("../models/DestinationEnquiry");
const ServiceEnquiry = require("../models/ServiceEnquiry");
const HolidayLead = require("../models/HolidayLead");
const ContactEnquiry = require("../models/ContactEnquiry");
const CmsEntry = require("../models/CmsEntry");
const asyncHandler = require("../utils/asyncHandler");

// @desc    Get dashboard stats and analytics
// @route   GET /api/dashboard/stats
// @access  Private/Admin
exports.getStats = asyncHandler(async (req, res) => {
  const { filter, month, year, startDate: qStartDate, endDate: qEndDate } = req.query;
  let startDate, endDate;

  const now = new Date();
  
  if (filter === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  } else if (filter === "last_month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (filter === "this_year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (filter === "custom_range" && (qStartDate || qEndDate)) {
    startDate = qStartDate ? new Date(qStartDate) : new Date(0);
    if (qStartDate) startDate.setHours(0, 0, 0, 0);
    
    endDate = qEndDate ? new Date(qEndDate) : new Date();
    if (qEndDate) endDate.setHours(23, 59, 59, 999);
  } else if (filter === "custom_month" && month && year) {
    startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
  } else {
    // Default: This Month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // Queries with date filter
  const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
  const memberDateFilter = { "membership.purchasedAt": { $gte: startDate, $lte: endDate } };

  // 1. Total Members (New members in the period)
  const totalMembers = await User.countDocuments({ 
    "membership.status": "Active",
    ...memberDateFilter 
  });

  // 2. Total Revenue (Revenue in the period)
  const allPaidUsers = await User.find({ "payments.status": "captured" });
  let totalRevenue = 0;
  const revenueByMonth = {};

  allPaidUsers.forEach(user => {
    user.payments.forEach(payment => {
      if (payment.status === "captured" && payment.paidAt) {
        const paidDate = new Date(payment.paidAt);
        if (paidDate >= startDate && paidDate <= endDate) {
          totalRevenue += payment.amount || 0;
        }
        
        // For the graph (keep 12 months for context)
        const key = `${paidDate.getFullYear()}-${paidDate.getMonth() + 1}`;
        revenueByMonth[key] = (revenueByMonth[key] || 0) + (payment.amount || 0);
      }
    });
  });

  // 3. Destination Enquiries
  const destinationEnquiries = await DestinationEnquiry.countDocuments(dateFilter);

  // 4. Service Enquiries
  const serviceEnquiries = await ServiceEnquiry.countDocuments(dateFilter);

  // 5. Callback Requests (Holiday Leads)
  const callbackRequests = await HolidayLead.countDocuments(dateFilter);

  // 6. Contact Enquiries
  const contactEnquiries = await ContactEnquiry.countDocuments(dateFilter);

  // 7. Total Blogs (Blogs are usually cumulative, but we can filter if needed)
  const totalBlogs = await Blog.countDocuments(dateFilter);

  // 8. Membership Packages (Packages are usually static/cumulative)
  const membershipEntry = await CmsEntry.findOne({ collection: "membership", key: "tiers" });
  const totalMembershipPackages = membershipEntry?.data?.length || 0;

  // --- Analytics Data for Graphs ---
  // (We keep 12 months for trend graphs regardless of current filter)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);

  const bookingsTrend = await User.aggregate([
    { $match: { "membership.purchasedAt": { $gte: twelveMonthsAgo } } },
    {
      $group: {
        _id: { month: { $month: "$membership.purchasedAt" }, year: { $year: "$membership.purchasedAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  const enquiriesTrend = await HolidayLead.aggregate([
    { $match: { createdAt: { $gte: twelveMonthsAgo } } },
    {
      $group: {
        _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  const packageDistribution = await User.aggregate([
    { $match: { "membership.status": "Active" } },
    {
      $group: {
        _id: "$membership.name",
        count: { $sum: 1 }
      }
    }
  ]);

  const recentEnquiries = await HolidayLead.find(dateFilter).sort({ createdAt: -1 }).limit(5);

  res.status(200).json({
    success: true,
    stats: {
      totalMembers,
      totalRevenue,
      destinationEnquiries,
      serviceEnquiries,
      callbackRequests,
      contactEnquiries,
      totalBlogs,
      totalMembershipPackages
    },
    analytics: {
      bookingsTrend,
      enquiriesTrend,
      packageDistribution,
      revenueByMonth,
      recentEnquiries
    }
  });
});
