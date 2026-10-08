const mongoose = require("mongoose");

const ROLES = [
  "Manager", "Head Chef", "Chef", "Cook", "Kitchen Helper", "Waiter", "Cashier", "Cleaner", "Delivery Staff", "Security",
  "Sales Associate", "Stock Clerk", "Visual Merchandiser", "Warehouse Staff", "Other",
];
const DEPARTMENTS = ["Kitchen", "Service", "Sales Floor", "Stockroom", "Billing", "Management", "Delivery", "Housekeeping", "Security", "Other"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern"];
const STATUSES = ["Active", "Inactive", "On Leave"];

const staffSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    employeeId: { type: String, required: true, trim: true },
    fullName: { type: String, required: [true, "Full name is required"], trim: true },
    phone: { type: String, required: [true, "Phone number is required"], trim: true },
    email: { type: String, trim: true, lowercase: true },
    dateOfBirth: { type: Date, required: [true, "Date of birth is required"] },
    joiningDate: { type: Date, required: [true, "Joining date is required"] },
    department: { type: String, enum: DEPARTMENTS, required: [true, "Department is required"] },
    role: { type: String, enum: ROLES, required: [true, "Role is required"] },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: "Full-time" },
    salary: { type: Number, min: 0 },
    status: { type: String, enum: STATUSES, default: "Active" },
    photo: { type: String, default: "" },
    notes: { type: String, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

staffSchema.index({ businessId: 1, employeeId: 1 }, { unique: true });

// Max+1 (not count+1) so deleting a staff member can never cause an id collision.
staffSchema.statics.nextEmployeeId = async function (businessId) {
  const rows = await this.find({ businessId, employeeId: /^EMP\d+$/ }, "employeeId").lean();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.employeeId.slice(3), 10) || 0), 0);
  return `EMP${String(max + 1).padStart(3, "0")}`;
};

staffSchema.pre("validate", async function (next) {
  if (this.employeeId) return next();
  try {
    this.employeeId = await this.constructor.nextEmployeeId(this.businessId);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Staff", staffSchema);
module.exports.STAFF_ROLES = ROLES;
module.exports.STAFF_DEPARTMENTS = DEPARTMENTS;
module.exports.STAFF_EMPLOYMENT_TYPES = EMPLOYMENT_TYPES;
module.exports.STAFF_STATUSES = STATUSES;