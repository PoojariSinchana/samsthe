const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");


// ===== ADMIN =====
const adminAuthRoutes = require("./modules/admin/routes/adminAuthRoutes");
const leadRoutes = require("./modules/admin/routes/leadRoutes");
const clientRoutes = require("./modules/admin/routes/clientRoutes");
const planRoutes = require("./modules/admin/routes/planRoutes");
const planController = require("./modules/admin/controllers/planController");
const adminDashboardRoutes = require("./modules/admin/routes/dashboardRoutes");
const invoiceRoutes = require("./modules/admin/routes/invoiceRoutes");
const paymentRoutes = require("./modules/admin/routes/paymentRoutes");
const subscriptionRoutes = require("./modules/admin/routes/subscriptionRoutes");
const razorpayController = require("./shared/controllers/razorpayController");
const adminTaskRoutes = require("./modules/admin/routes/adminTaskRoutes");
const adminReportRoutes = require("./modules/admin/routes/adminReportRoutes");
const projectRoutes = require("./modules/admin/routes/projectRoutes");
const ticketRoutes = require("./modules/admin/routes/ticketRoutes");


// ===== SHARED (restaurant + retail use the same routes) =====
const authRoutes = require("./shared/routes/authRoutes");
const appsRoutes = require("./shared/routes/appsRoutes");
const businessRoutes = require("./shared/routes/businessroutes");
const outletRoutes = require("./shared/routes/outletRoutes");
const staffRoutes = require("./shared/routes/Staffroutes");
const partnerRoutes = require("./shared/routes/partnerRoutes");
const supplierRoutes = require("./shared/routes/supplierRoutes");
const entriesRoutes = require("./shared/routes/entriesRoutes");
const accountingRoutes = require("./shared/routes/accountingRoutes");
const catalogRoutes = require("./shared/routes/catalogroutes");     // items, categories, brands
const orderRoutes = require("./shared/routes/orderRoutes");         // restaurant orders + shop sales
const purchaseRoutes = require("./shared/routes/purchaseRoutes");
const stockRoutes = require("./shared/routes/stockRoutes");
const customerRoutes = require("./shared/routes/customerroutes");
const dashboardRoutes = require("./shared/routes/dashboardroutes");
const reportsRoutes = require("./shared/routes/reportsroutes");
const analyticsRoutes = require("./shared/routes/analyticsroutes");
const taskRoutes = require("./shared/routes/taskRoutes");
const notificationRoutes = require("./shared/routes/notificationRoutes");

const { protect } = require("./shared/middleware/authMiddleware");
const { requireActiveSubscription } = require("./shared/middleware/planLimits");
const gated = [protect, requireActiveSubscription];

// ===== RESTAURANT-ONLY =====
const tableRoutes = require("./modules/restaurant/routes/tableRoutes");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// ===== CORS =====
const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:5173", "http://localhost:5173", "http://localhost:4173"];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:"],
      "script-src": ["'self'", "https://checkout.razorpay.com"],
      "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      "connect-src": ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com", "https://checkout.razorpay.com"],
    },
  },
}));


app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // Postman, server-to-server
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.post("/api/razorpay/webhook", express.raw({ type: "application/json" }), razorpayController.webhook);
app.use(express.json());
// ===== UPLOADS =====
app.use(
  "/uploads",
  (req, res, next) => { res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); next(); },
  express.static(path.join(__dirname, "shared", "uploads"))
);

// ===== RATE LIMITING =====
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, message: { message: "Too many attempts, please try again later" } });
app.set("trust proxy", 1); // only if deployed behind a proxy like Nginx, Render, Railway
app.use("/api/admin/auth/login", authLimiter);
app.use("/api/auth/login", authLimiter);        // also covers /login/continue
app.use("/api/auth/staff-login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.get("/health", (req, res) => res.json({ status: "ok" }));

// ===== PORTAL =====
app.use("/api/apps", appsRoutes);

// ===== AUTH =====
app.use("/api/auth", authRoutes);

// ===== ADMIN =====
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/leads", leadRoutes);
app.use("/api/admin/clients", clientRoutes);
app.use("/api/admin/plans", planRoutes);
app.get("/api/plans", planController.publicPlans);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/invoices", invoiceRoutes);
app.use("/api/admin/payments", paymentRoutes);
app.use("/api/admin/subscriptions", subscriptionRoutes);
app.use("/api/admin/tasks", adminTaskRoutes);
app.use("/api/admin/reports", adminReportRoutes);
app.use("/api/admin/projects", projectRoutes);
pp.use("/api/admin/support", ticketRoutes);

// ===== BUSINESS APIs (same endpoints for restaurant and retail) =====
app.use("/api/business", businessRoutes);
app.use("/api/restaurants", businessRoutes);   // TEMPORARY alias: remove once the frontend calls /api/business
app.use("/api/outlets", ...gated,  outletRoutes);
app.use("/api/staff",...gated,  staffRoutes);
app.use("/api/partners", ...gated,  partnerRoutes);
app.use("/api/suppliers",...gated,  supplierRoutes);
app.use("/api/entries",...gated,  entriesRoutes);
app.use("/api/accounting",...gated,  accountingRoutes);
app.use("/api/catalog",...gated,  catalogRoutes);
app.use("/api/orders",...gated,  orderRoutes);
app.use("/api/purchases", ...gated, purchaseRoutes);
app.use("/api/stock", ...gated, stockRoutes);
app.use("/api/customers", ...gated, customerRoutes);
app.use("/api/dashboard", ...gated, dashboardRoutes);
app.use("/api/reports",...gated, reportsRoutes);
app.use("/api/analytics",...gated, analyticsRoutes);
app.use("/api/tables",...gated, tableRoutes);           // restaurant only
app.use("/api/tasks",...gated, taskRoutes);
app.use("/api/notifications",notificationRoutes);

// ===== FRONTEND (production) =====
if (isProduction) {
  const clientDist = path.join(__dirname, "..", "frontend", "dist");
  app.use(
    express.static(clientDist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    })
  );
  app.get("*", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
}


// ===== 404 + ERRORS =====
app.use((req, res) => res.status(404).json({ message: "Route not found", path: req.originalUrl }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /images are allowed/.test(err.message || "")) {
    return res.status(400).json({ message: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong on the server" });
});

module.exports = app;