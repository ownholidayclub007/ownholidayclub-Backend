const express = require('express');
const router = express.Router();
const {
  getBudgets,
  getBudgetByReference,
  getBudgetsByType,
  createOrUpdateBudget,
  deleteBudget
} = require('../controllers/budgetController');

// IMPORTANT: Specific named routes MUST come before wildcard routes like /:id
// otherwise /:id will intercept /reference/... and /type/... requests

router.route('/')
  .get(getBudgets)
  .post(createOrUpdateBudget);

router.route('/reference/:referenceId')
  .get(getBudgetByReference);

router.route('/type/:type')
  .get(getBudgetsByType);

// Wildcard route must be LAST
router.route('/:id')
  .delete(deleteBudget);

module.exports = router;
