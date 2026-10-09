const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const { DEPARTMENTS, EMPLOYMENT_TYPES, STATUSES } = require("../models/Employee");
const AdminUser = require("../models/AdminUser");
const { ADMIN_ROLES, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS_BY_ADMIN_ROLE } = require("../models/AdminUser");
const { fail, send } = require("../../../shared/utils/httpError");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDITABLE = ["fullName", "phone", "email", "dateOfBirth", "joiningDate", "department", "designation", "employmentType", "salary", "status", "notes"];
const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const canSeeSalary = (req) => req.admin.hasPermission("MANAGE_EMPLOYEES");
// View-only admins never receive salary data at all.
const shape = (req, e) => {
  const o = e.toObject ? e.toObject() : e;
  return canSeeSalary(req) ? o : { ...o, salary: undefined };
};

function cleanInput(body) {
  const data = {};
  for (const f of EDITABLE) if (body[f] !== undefined) data[f] = body[f] === "" ? undefined : body[f];
  if (data.salary !== undefined) data.salary = Number(data.salary) || 0;
  return data;
}

// Creates the portal login and links it. Throws on any problem so callers can roll back.
async function makeLogin(req, emp, { role, password, permissions }) {
  if (!req.admin.hasPermission("MANAGE_ADMIN_USERS")) throw fail(403, "You need the Admin Users permission to create a login");
  if (!emp.email || !EMAIL_RE.test(emp.email)) throw fail(400, "A valid email is required to create a login");
  if (!password || password.length < 8) throw fail(400, "Password must be at least 8 characters");
  if (!ADMIN_ROLES.includes(role)) throw fail(400, "Choose a role for the login");
  if (role === "superadmin" && req.admin.role !== "superadmin") throw fail(403, "Only a superadmin can create a superadmin");

  const perms = permissions?.length ? permissions : DEFAULT_PERMISSIONS_BY_ADMIN_ROLE[role] || [];
  if (perms.some((p) => !ADMIN_PERMISSIONS.includes(p))) throw fail(400, "Unknown permission in list");
  const overreach = perms.filter((p) => !req.admin.hasPermission(p));
  if (overreach.length) throw fail(403, `You can't grant permissions you don't have: ${overreach.join(", ")}`);

  const admin = await AdminUser.create({
    name: emp.fullName, email: emp.email, phone: emp.phone, password, role,
    permissions: role === "superadmin" ? [] : perms, employeeId: emp._id,
  });
  emp.adminUserId = admin._id;
  await emp.save();
  return admin;
}

const dupe = (err) => (err.code === 11000 ? Object.assign(new Error("A login with this email already exists"), { status: 409 }) : err);

module.exports = {
  async getMeta(req, res) {
    res.json({
      departments: DEPARTMENTS,
      employmentTypes: EMPLOYMENT_TYPES,
      statuses: STATUSES,
      roles: ADMIN_ROLES.filter((r) => r !== "superadmin" || req.admin.role === "superadmin"),
    });
  },

  async getEmployees(req, res) {
    try {
      const { search, status, department, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (department) filter.department = department;
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        filter.$or = [{ fullName: re }, { employeeCode: re }, { phone: re }, { email: re }, { designation: re }];
      }
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      const [employees, total, byStatus, payroll] = await Promise.all([
        Employee.find(filter).populate("adminUserId", "role isActive").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
        Employee.countDocuments(filter),
        Employee.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        canSeeSalary(req) ? Employee.aggregate([{ $match: { status: "Active" } }, { $group: { _id: null, total: { $sum: "$salary" } } }]) : [],
      ]);

      const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
      for (const r of byStatus) counts[r._id] = r.count;

      res.json({
        employees: employees.map((e) => shape(req, e)),
        total, page: p, pages: Math.max(1, Math.ceil(total / l)),
        summary: { counts, all: Object.values(counts).reduce((a, b) => a + b, 0), monthlyPayroll: canSeeSalary(req) ? payroll[0]?.total || 0 : null },
      });
    } catch (err) { send(res, err, "Failed to fetch employees"); }
  },

  async createEmployee(req, res) {
    let emp;
    try {
      const data = cleanInput(req.body);
      if (!data.fullName || !data.phone) throw fail(400, "Name and phone are required");
      if (data.email && !EMAIL_RE.test(data.email)) throw fail(400, "Please enter a valid email address");
      const wantsLogin = !!req.body.createLogin;
      // Check login permission up front so a doomed request doesn't create anything.
      if (wantsLogin && !req.admin.hasPermission("MANAGE_ADMIN_USERS")) throw fail(403, "You need the Admin Users permission to create a login");

      for (let attempt = 0; attempt < 3 && !emp; attempt++) {
        try { emp = await Employee.create({ ...data, employeeCode: await Employee.nextCode() }); }
        catch (e) { if (e.code !== 11000) throw e; }
      }
      if (!emp) throw fail(409, "Couldn't allocate an employee ID, please retry");

      if (wantsLogin) {
        try { await makeLogin(req, emp, req.body.login || {}); }
        catch (e) { await Employee.deleteOne({ _id: emp._id }); throw dupe(e); } // never leave half-created records
      }
      await emp.populate("adminUserId", "role isActive");
      res.status(201).json({ message: "Employee added", employee: shape(req, emp) });
    } catch (err) { send(res, err, "Failed to add employee"); }
  },

  async updateEmployee(req, res) {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) throw fail(404, "Employee not found");
      const data = cleanInput(req.body);
      if ("salary" in data && !canSeeSalary(req)) delete data.salary;
      if (data.email && !EMAIL_RE.test(data.email)) throw fail(400, "Please enter a valid email address");
      if ("fullName" in data && !data.fullName) throw fail(400, "Name is required");
      for (const [k, v] of Object.entries(data)) emp[k] = v;
      await emp.save();
      await emp.populate("adminUserId", "role isActive");
      res.json({ message: "Employee updated", employee: shape(req, emp) });
    } catch (err) { send(res, err, "Failed to update employee"); }
  },

  // For an existing employee who doesn't have a login yet.
  async createLogin(req, res) {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) throw fail(404, "Employee not found");
      if (emp.adminUserId) throw fail(409, "This employee already has a login");
      await makeLogin(req, emp, req.body);
      res.status(201).json({ message: "Login created" });
    } catch (err) { send(res, dupe(err), "Failed to create login"); }
  },

  // Removing someone also switches off their portal login, so they lose access immediately.
  async deleteEmployee(req, res) {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) throw fail(404, "Employee not found");
      if (emp.adminUserId) {
        const admin = await AdminUser.findById(emp.adminUserId);
        if (admin) {
          if (String(admin._id) === String(req.admin._id)) throw fail(400, "You can't remove your own employee record");
          if (admin.role === "superadmin" && req.admin.role !== "superadmin") throw fail(403, "Only a superadmin can remove a superadmin");
          if (admin.role === "superadmin" && admin.isActive &&
              (await AdminUser.countDocuments({ role: "superadmin", isActive: true, _id: { $ne: admin._id } })) === 0) {
            throw fail(400, "Can't remove the last active superadmin");
          }
          admin.isActive = false;
          admin.employeeId = null;
          await admin.save();
        }
      }
      await emp.deleteOne();
      res.json({ message: "Employee removed" });
    } catch (err) { send(res, err, "Failed to remove employee"); }
  },
};