const mongoose = require("mongoose");

const PROJECT_STATUSES = ["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];
const PROJECT_PRIORITIES = ["low", "medium", "high"];

const milestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    dueDate: { type: Date },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true }, // optional: internal projects have no client
    status: { type: String, enum: PROJECT_STATUSES, default: "PLANNING", index: true },
    priority: { type: String, enum: PROJECT_PRIORITIES, default: "medium" },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" }],
    startDate: { type: Date },
    dueDate: { type: Date },
    completedAt: { type: Date, default: null },
    budget: { type: Number, min: 0, default: 0 },
    progress: { type: Number, min: 0, max: 100, default: 0 }, // auto-calculated when milestones exist
    milestones: { type: [milestoneSchema], default: [] },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

projectSchema.pre("validate", function (next) {
  if (this.milestones.length) {
    const done = this.milestones.filter((m) => m.done).length;
    this.progress = Math.round((done / this.milestones.length) * 100);
  }
  next();
});

projectSchema.index({ status: 1, dueDate: 1 });
projectSchema.index({ manager: 1, status: 1 });

module.exports = mongoose.model("Project", projectSchema);
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
module.exports.PROJECT_PRIORITIES = PROJECT_PRIORITIES;