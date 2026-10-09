const mongoose = require("mongoose");

const DEPARTMENTS = ["Management", "Sales", "Support", "Development", "Accounts", "Operations", "Other"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern"];
const STATUSES = ["Active", "On Leave", "Inactive"];

// HR record for YOUR company's own team (not customer staff, that's shared/models/Staff.js).
// adminUserId links to the portal login, if they have one.
const employeeSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    dateOfBirth: { type: Date },
    joiningDate: { type: Date, required: true, default: Date.now },
    department: { type: String, enum: DEPARTMENTS, default: "Other" },
    designation: { type: String, trim: true, default: "" },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: "Full-time" },
    salary: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: STATUSES, default: "Active", index: true },
    notes: { type: String, trim: true, default: "" },
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: true, collection: "employees" }
);

// Max+1 (not count+1) so deleting someone never causes an id collision.
employeeSchema.statics.nextCode = async function () {
  const rows = await this.find({ employeeCode: /^EMP\d+$/ }, "employeeCode").lean();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.employeeCode.slice(3), 10) || 0), 0);
  return `EMP${String(max + 1).padStart(3, "0")}`;
};

employeeSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
module.exports.DEPARTMENTS = DEPARTMENTS;
module.exports.EMPLOYMENT_TYPES = EMPLOYMENT_TYPES;
module.exports.STATUSES = STATUSES;