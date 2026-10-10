import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./marketing/Home";
import Landing from "./apps/restaurant/pages/marketing/Landing";
import RetailLanding from "./apps/retail/marketing/RetailLanding";
import RestaurantLogin from "./marketing/RestaurantLogin";
import RetailLogin from "./marketing/RetailLogin";
import CreateRestaurantAccount from "./marketing/CreateRestaurantAccount";
import CreateRetailAccount from "./marketing/CreateRetailAccount";
import Dashboard from "./apps/restaurant/RestaurantApp";
import RestaurantSetup from "./marketing/RestaurantSetup";
import NotFound from "./marketing/NotFound";
import ProtectedRoute from "./shared/components/ProtectedRoute";
import ShopDashboard from "./apps/retail/RetailApp";
import AdminRoot from "./admin/AdminRoot";
import AdminLogin from "./admin/pages/AdminLogin";
import AdminApp from "./admin/AdminApp";
import AdminProtectedRoute from "./admin/components/AdminProtectedRoute";
import ChoosePlan from "./marketing/ChoosePlan";
import ManifestSwitcher from "./shared/components/ManifestSwitcher";

export default function App() {
  return (
    <>
      <ManifestSwitcher />
      <Routes>
        {/* Admin portal */}
        <Route path="/admin" element={<AdminRoot />}>
          <Route path="login" element={<AdminLogin />} />
          <Route index element={<AdminProtectedRoute><AdminApp /></AdminProtectedRoute>} />
        </Route>

        {/* Company site: NOT part of the installable apps */}
        <Route path="/" element={<Home />} />
        <Route path="/products/restaurant" element={<Landing />} />
        <Route path="/products/retail" element={<RetailLanding />} />

        {/* Bare /restaurant and /retail go to the marketing pages */}
        <Route path="/restaurant" element={<Navigate to="/products/restaurant" replace />} />
        <Route path="/retail" element={<Navigate to="/products/retail" replace />} />

        {/* ===== Restaurant app (installable, scope: /restaurant/) ===== */}
        <Route path="/restaurant/login" element={<RestaurantLogin />} />
        <Route path="/restaurant/signup" element={<CreateRestaurantAccount />} />
        <Route path="/restaurant/setup" element={<ProtectedRoute><RestaurantSetup /></ProtectedRoute>} />
        <Route path="/restaurant/plan" element={<ProtectedRoute><ChoosePlan /></ProtectedRoute>} />
        <Route path="/restaurant/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        {/* ===== Retail app (installable, scope: /retail/) ===== */}
        <Route path="/retail/login" element={<RetailLogin />} />
        <Route path="/retail/signup" element={<CreateRetailAccount />} />
        <Route path="/retail/setup" element={<ProtectedRoute><RestaurantSetup /></ProtectedRoute>} />
        <Route path="/retail/plan" element={<ProtectedRoute><ChoosePlan /></ProtectedRoute>} />
        <Route path="/retail/app" element={<ProtectedRoute><ShopDashboard /></ProtectedRoute>} />

        {/* Old URLs: redirect so bookmarks and old links don't break */}
        <Route path="/app/restaurant" element={<Navigate to="/restaurant/app" replace />} />
        <Route path="/app/retail" element={<Navigate to="/retail/app" replace />} />
        <Route path="/dashboard" element={<Navigate to="/restaurant/app" replace />} />
        <Route path="/shop" element={<Navigate to="/retail/app" replace />} />
        <Route path="/restaurant-setup" element={<Navigate to="/restaurant/setup" replace />} />
        <Route path="/choose-plan" element={<Navigate to="/restaurant/plan" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}