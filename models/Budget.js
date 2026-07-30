const mongoose = require("mongoose");

const BudgetSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["service", "destination", "callback"],
      required: true,
    },
    referenceId: {
      // We can use String to store either an ObjectId or a unique slug/name, for flexibility.
      // Often, the frontend dropdown just has a string name, but storing ID is safer.
      type: String,
      required: true,
    },
    title: {
      // The human-readable name of the service or destination, for display in Admin panel.
      type: String,
      required: true,
    },
    budgets: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Budget", BudgetSchema);
