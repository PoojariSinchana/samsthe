import { useState } from "react";
import AdminSidebar, { ADMIN_NAV } from "./components/AdminSidebar";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsersSection from "./pages/AdminUsersSection";
import AdminProfile from "./pages/AdminProfile";
import AdminLeadsSection from "./pages/AdminLeadsSection";
import AdminComingSoon from "./pages/AdminComingSoon";
import { useAdminAuth } from "./context/AdminAuthContext";
import AdminClientsSection from "./pages/AdminClientsSection";
import AdminPlansSection from "./pages/AdminPlansSection";
import AdminInvoicesSection from "./pages/AdminInvoicesSection";
import AdminPaymentsSection from "./pages/AdminPaymentsSection";
import AdminSubscriptionsSection from "./pages/AdminSubscriptionsSection";
import AdminTasksSection from "./pages/AdminTasksSection";
import AdminReportsSection from "./pages/AdminReportsSection";
import AdminProjectsSection from "./pages/AdminProjectsSection";
import AdminSupportSection from "./pages/AdminSupportSection";

// Same section-state pattern as RestaurantApp / RetailApp. As you build each
// module (leads, invoices, ...), add its page here and remove it from the
// fallback below.
export default function AdminApp() {
  const { hasPermission } = useAdminAuth();
  const [section, setSection] = useState("dashboard");

  const navItem = ADMIN_NAV.find((i) => i.key === section);
  const allowed = section === "profile" || (navItem && hasPermission(navItem.permission));

  return (
    <div className="flex min-h-screen flex-col bg-charcoal lg:flex-row">
      <AdminSidebar active={section} onNavigate={setSection} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {!allowed ? (
          <AdminComingSoon title="No access" note="You don't have permission to open this section." />
        ) : section === "dashboard" ? (
          <AdminDashboard onNavigate={setSection} />
        ) : section === "admins" ? (
          <AdminUsersSection />
        ) : section === "leads" ? (
          <AdminLeadsSection />
        ) : section === "clients" ? (
          <AdminClientsSection />
        ) : section === "plans" ? (
          <AdminPlansSection />
        ) : section === "subscriptions" ? (
         <AdminSubscriptionsSection />
        ) : section === "invoices" ? (
         <AdminInvoicesSection />
        ) : section === "payments" ? (
         <AdminPaymentsSection />
         ) : section === "tasks" ? (
          <AdminTasksSection />
        ) : section === "reports" ? (
          <AdminReportsSection />
        ) : section === "projects" ? (
          <AdminProjectsSection />
        ) : section === "support" ? (
          <AdminSupportSection />
        ) : section === "employees" ? (
         <AdminEmployeesSection />
        ) : section === "profile" ? (
         <AdminProfile />
        ) : (
          <AdminComingSoon title={navItem.label} />
        )}
      </main>
    </div>
  );
}