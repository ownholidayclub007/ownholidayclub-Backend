const requireCmsAdmin = require("./requireCmsAdmin");

const requireSuperAdmin = (req, res, next) => {
  requireCmsAdmin(req, res, () => {
    if (req.cmsAdmin && req.cmsAdmin.role === "super-admin") {
      return next();
    }
    return res.status(403).json({ message: "Action restricted to super-admin only." });
  });
};

module.exports = requireSuperAdmin;
