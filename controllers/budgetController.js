const Budget = require("../models/Budget");

// @desc    Get all budgets
// @route   GET /api/budgets
// @access  Public (or Admin, depending on usage, usually public for frontend dropdowns)
exports.getBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: budgets.length, data: budgets });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Get budget by referenceId
// @route   GET /api/budgets/:referenceId
// @access  Public
exports.getBudgetByReference = async (req, res) => {
  try {
    const budget = await Budget.findOne({ referenceId: req.params.referenceId });
    if (!budget) {
      return res.status(404).json({ success: false, error: "Budget not found for this reference" });
    }
    res.status(200).json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Get budgets by type (service or destination)
// @route   GET /api/budgets/type/:type
// @access  Public
exports.getBudgetsByType = async (req, res) => {
    try {
      const budgets = await Budget.find({ type: req.params.type });
      res.status(200).json({ success: true, count: budgets.length, data: budgets });
    } catch (error) {
      res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Create or update a budget
// @route   POST /api/budgets
// @access  Private/Admin
exports.createOrUpdateBudget = async (req, res) => {
  try {
    const { type, referenceId, title, budgets } = req.body;

    if (!type || !referenceId || !title || !budgets) {
      return res.status(400).json({ success: false, error: "Please provide all required fields" });
    }

    let budget = await Budget.findOne({ referenceId });

    if (budget) {
      // Update existing
      budget.budgets = budgets;
      budget.type = type;
      budget.title = title;
      await budget.save();
    } else {
      // Create new
      budget = await Budget.create({ type, referenceId, title, budgets });
    }

    res.status(200).json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// @desc    Delete a budget
// @route   DELETE /api/budgets/:id
// @access  Private/Admin
exports.deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) {
      return res.status(404).json({ success: false, error: "Budget not found" });
    }
    await budget.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
