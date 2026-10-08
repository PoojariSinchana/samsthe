import { InstallProvider } from "./shared/context/InstallContext.jsx";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./shared/context/AuthContext.jsx";
import { ThemeProvider } from "./shared/context/ThemeContext.jsx"
import "./index.css";
import { PlanProvider } from "./shared/context/PlanContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* No basename — this app is served at the root now, one frontend total */}
    <BrowserRouter>
  <ThemeProvider>
    <InstallProvider>
      <AuthProvider>
        <PlanProvider>
          <App />
        </PlanProvider>
      </AuthProvider>
    </InstallProvider>
  </ThemeProvider>
</BrowserRouter>
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}