const Staff = require("../models/Staff");
const User = require("../models/User");
const { DEFAULT_PERMISSIONS_BY_ROLE, MANAGER_ASSIGNABLE_ROLES } = require("../constants/permissions");

// System-access roles a staff login can be created with. "owner" is
// deliberately excluded — that's set once at registration only.
const SYSTEM_ROLES = ["manager", "investor", "partner", "cashier", "waiter", "kitchen"];

const getAllStaff = async (req, res) => {
  try {
    const { search, department, role, status } = req.query;

    const query = { businessId: req.user.businessId };

    if (department) query.department = department;
    if (role) query.role = role;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const staff = await Staff.find(query).sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch staff", error: err.message });
  }
};

const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      businessId: req.user.businessId,
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch staff member", error: err.message });
  }
};

// Creates the Staff (HR) record and, optionally, a linked User (system
// login) in one call. If createLogin is falsy, this behaves exactly as
// before — a plain HR record with no login.
const createStaff = async (req, res) => {
  try {
    const {
      fullName,
      employeeId,
      phone,
      email,
      dateOfBirth,
      joiningDate,
      department,
      role,
      employmentType,
      salary,
      status,
      photo,
      notes,
      // Access fields — only used when createLogin is true
      createLogin,
      systemRole,
      permissions,
      outletAccess,
    } = req.body;

    if (!dateOfBirth) {
      return res.status(400).json({ message: "Date of birth is required" });
    }

    let userId = null;
    // Resolved employeeId — shared between the User (login) and Staff (HR)
    // record so staff-login's lookup (businessId + employeeId) always
    // finds a match. If a login isn't created, Staff's own pre-validate
    // hook auto-generates the id as before.
    let finalEmployeeId = employeeId && employeeId.trim() ? employeeId.trim() : undefined;

    if (createLogin) {
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required to create a login" });
      }
      if (!systemRole || !SYSTEM_ROLES.includes(systemRole)) {
        return res.status(400).json({ message: `systemRole must be one of: ${SYSTEM_ROLES.join(", ")}` });
      }
      if (req.user.role !== "owner" && !MANAGER_ASSIGNABLE_ROLES.includes(systemRole)) {
        return res.status(403).json({ message: "Only the owner can grant manager, investor, or partner access" });
      }

      const existingUser = await User.findOne({ businessId: req.user.businessId, phone: phone.trim() });
      if (existingUser) {
        return res.status(409).json({ message: "A login already exists for this phone number" });
      }

      const dobYear = new Date(dateOfBirth).getFullYear();
      if (Number.isNaN(dobYear)) {
        return res.status(400).json({ message: "Invalid date of birth" });
      }

      // Resolve the employeeId up front (before creating either record) so
      // both the User and Staff documents end up with the exact same value.
      if (!finalEmployeeId) {
        const count = await Staff.countDocuments({ businessId: req.user.businessId });
        finalEmployeeId = await Staff.nextEmployeeId(req.user.businessId);
      }

      const grantedPermissions =
        permissions && permissions.length ? permissions : DEFAULT_PERMISSIONS_BY_ROLE[systemRole] || [];

      if (req.user.role !== "owner") {
        const disallowed = grantedPermissions.filter((p) => !req.user.hasPermission(p));
        if (disallowed.length) {
          return res.status(403).json({ message: `You can't grant permissions you don't have: ${disallowed.join(", ")}` });
        }
        const requesterOutletIds = (req.user.outletAccess || []).map(String);
        const invalidOutlets = (outletAccess || []).filter((o) => !requesterOutletIds.includes(String(o)));
        if (invalidOutlets.length) {
          return res.status(403).json({ message: "You can only assign outlets you yourself have access to" });
        }
      }

      const user = await User.create({
        name: fullName,
        email: email || undefined,
        phone: phone.trim(),
        password: String(dobYear), // hashed automatically by User's pre-save hook
        employeeId: finalEmployeeId,
        role: systemRole,
        permissions: grantedPermissions,
        outletAccess: outletAccess || [],
        businessId: req.user.businessId,
        mustChangePassword: true,
      });
      userId = user._id;
    }

    let staff;
    try {
      staff = await Staff.create({
        fullName,
        employeeId: finalEmployeeId, // same id as the User record (or undefined, letting Staff's hook generate one, if no login was created)
        phone,
        email,
        dateOfBirth,
        joiningDate,
        department,
        role,
        employmentType,
        salary,
        status,
        photo,
        notes,
        businessId: req.user.businessId,
        userId,
      });
    } catch (staffErr) {
      // Roll back the login if the HR record failed to save, so we never
      // end up with an orphaned User no Staff record points to.
      if (userId) await User.findByIdAndDelete(userId);
      throw staffErr;
    }

    res.status(201).json(staff);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Employee ID already exists" });
    }
    res.status(400).json({ message: "Failed to create staff member", error: err.message });
  }
};

const EDITABLE = ["fullName","phone","email","dateOfBirth","joiningDate","department","role","employmentType","salary","status","photo","notes"];
const updateStaff = async (req, res) => {
  try {
    const update = Object.fromEntries(EDITABLE.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]]));
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, businessId: req.user.businessId }, update, { new: true, runValidators: true }
    );

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    res.json(staff);
  } catch (err) {
    res.status(400).json({ message: "Failed to update staff member", error: err.message });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndDelete({
      _id: req.params.id,
      businessId: req.user.businessId,
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    // Clean up the linked login too, so removing a staff member actually
    // revokes their access rather than leaving a dangling User account.
    if (staff.userId) {
      await User.findByIdAndDelete(staff.userId);
    }

    res.json({ message: "Staff member deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete staff member", error: err.message });
  }
};

// @route POST /api/staff/upload-photo
// @desc  Uploads the file only — does NOT attach it to any staff record.
const uploadStaffPhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ message: "Photo uploaded", url });
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  uploadStaffPhoto,
};