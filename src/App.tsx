import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { UserRoute, GuardianRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import GuardianDashboard from "./pages/GuardianDashboard";
import MyHealth from "./pages/MyHealth";
import MedicalVault from "./pages/MedicalVault";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import ResetPassword from "./pages/ResetPassword";
import Appointments from "./pages/Appointments";
import Help from "./pages/Help";
import MyProfile from "./pages/MyProfile";
import EmergencyProfile from "./pages/EmergencyProfile";
import Install from "./pages/Install";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* User-only routes */}
              <Route path="/dashboard" element={<UserRoute><UserDashboard /></UserRoute>} />
              <Route path="/my-health" element={<UserRoute><MyHealth /></UserRoute>} />
              <Route path="/medical-vault" element={<UserRoute><MedicalVault /></UserRoute>} />
              <Route path="/subscription" element={<UserRoute><Subscription /></UserRoute>} />
              <Route path="/appointments" element={<UserRoute><Appointments /></UserRoute>} />
              {/* Guardian-only routes */}
              <Route path="/guardian" element={<GuardianRoute><GuardianDashboard /></GuardianRoute>} />
              <Route path="/reports" element={<GuardianRoute><GuardianDashboard /></GuardianRoute>} />
              <Route path="/guardian-settings" element={<GuardianRoute><Settings /></GuardianRoute>} />
              {/* Shared routes (both roles) */}
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
              <Route path="/my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
              {/* Public routes */}
              <Route path="/e/:token" element={<EmergencyProfile />} />
              <Route path="/install" element={<Install />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
