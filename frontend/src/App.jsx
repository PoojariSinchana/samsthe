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

      <Route path="/admin" element={<AdminRoot />}>
        <Route path="login" element={<AdminLogin />} />
        <Route index element={<AdminProtectedRoute><AdminApp /></AdminProtectedRoute>} />
      </Route>

      {/* Company site */}
      <Route path="/" element={<Home />} />
      <Route path="/products/restaurant" element={<Landing />} />
      <Route path="/products/retail" element={<RetailLanding />} />

      {/* Old marketing path — kept working for anyone with it bookmarked */}
      <Route path="/restaurant" element={<Navigate to="/products/restaurant" replace />} />
      <Route path="/choose-plan" element={<ProtectedRoute><ChoosePlan /></ProtectedRoute>} />
      
      <Route path="/restaurant/login" element={<RestaurantLogin />} />
      <Route path="/retail/login" element={<RetailLogin />} />
      <Route path="/restaurant/signup" element={<CreateRestaurantAccount />} />
      <Route path="/retail/signup" element={<CreateRetailAccount />} />

      {/* Canonical app paths */}
      <Route
        path="/app/restaurant"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      {/* Old dashboard path — redirect so nothing breaks */}
      <Route path="/dashboard" element={<Navigate to="/app/restaurant" replace />} />

      <Route
        path="/restaurant-setup"
        element={
          <ProtectedRoute>
            <RestaurantSetup />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/retail"
        element={
          <ProtectedRoute>
            <ShopDashboard />
          </ProtectedRoute>
        }
      />
      {/* Old shop path — redirect so nothing breaks */}
      <Route path="/shop" element={<Navigate to="/app/retail" replace />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
  );
}