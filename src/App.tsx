import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { GuardianWardProvider } from "@/contexts/GuardianWardContext";
import { UserRoute, GuardianRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import GuardianDashboard from "./pages/GuardianDashboard";
import GuardianAlerts from "./pages/GuardianAlerts";
import GuardianReports from "./pages/GuardianReports";
import GuardianServices from "./pages/GuardianServices";
import MyHealth from "./pages/MyHealth";
import Services from "./pages/Services";
import MedicalVault from "./pages/MedicalVault";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import ResetPassword from "./pages/ResetPassword";
import Appointments from "./pages/Appointments";
import Help from "./pages/Help";
import Messages from "./pages/Messages";
import MyProfile from "./pages/MyProfile";
import EmergencyProfile from "./pages/EmergencyProfile";
import Install from "./pages/Install";
import GuardianMessages from "./pages/GuardianMessages";
import MapMyJourney from "./pages/MapMyJourney";
import Unsubscribe from "./pages/Unsubscribe";
import AdminCoupons from "./pages/AdminCoupons";
import AdminVerify from "./pages/AdminVerify";
import AdminLogin from "./pages/AdminLogin";
import AdminRoute from "./components/AdminRoute";

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
              <Route path="/messages" element={<UserRoute><Messages /></UserRoute>} />
              <Route path="/journey" element={<UserRoute><MapMyJourney /></UserRoute>} />
              <Route path="/services" element={<UserRoute><Services /></UserRoute>}/>
              {/* Guardian-only routes */}
              <Route path="/guardian" element={<GuardianRoute><GuardianWardProvider><GuardianDashboard /></GuardianWardProvider></GuardianRoute>} />
              <Route path="/guardian/alerts" element={<GuardianRoute><GuardianWardProvider><GuardianAlerts /></GuardianWardProvider></GuardianRoute>} />
              <Route path="/guardian/reports" element={<GuardianRoute><GuardianWardProvider><GuardianReports /></GuardianWardProvider></GuardianRoute>} />
              <Route path="/guardian/services" element={<GuardianRoute><GuardianWardProvider><GuardianServices /></GuardianWardProvider></GuardianRoute>} />
              <Route path="/guardian/messages" element={<GuardianRoute><GuardianWardProvider><GuardianMessages /></GuardianWardProvider></GuardianRoute>} />
              <Route path="/reports" element={<GuardianRoute><GuardianWardProvider><GuardianReports /></GuardianWardProvider></GuardianRoute>} />
              <Route path="/guardian-settings" element={<GuardianRoute><Settings /></GuardianRoute>} />
              {/* Shared routes (both roles) */}
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
              <Route path="/my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
              {/* Public routes */}
              <Route path="/e/:token" element={<EmergencyProfile />} />
              <Route path="/install" element={<Install />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/verify" element={<ProtectedRoute><AdminVerify /></ProtectedRoute>} />
              <Route path="/admin/coupons" element={<AdminRoute><AdminCoupons /></AdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
