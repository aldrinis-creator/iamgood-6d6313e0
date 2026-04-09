import { User, LogOut, Settings, UserCircle, ShieldCheck } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";
import AccessibilityMenu from "@/components/AccessibilityMenu";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useTodayAppointments } from "@/hooks/useTodayAppointments";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getISTHour } from "@/lib/istTime";

const AppHeader = () => {
  const { userName, role } = useApp();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const todayApptCount = useTodayAppointments();

  const getGreeting = () => {
    const hour = getISTHour();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <header className="bg-primary text-primary-foreground px-4 pt-6 pb-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-success flex items-center justify-center font-bold text-sm text-success-foreground">
            C-iN
          </div>
          <div>
            <p className="text-xs opacity-80">{getGreeting()}</p>
            <p className="font-semibold text-accessible">{userName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <AccessibilityMenu />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <User className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/my-profile")}>
                <UserCircle className="w-4 h-4 mr-2" /> My Profile
              </DropdownMenuItem>
              {role === "user" && (
                <DropdownMenuItem onClick={() => navigate("/medical-vault")}>
                  <ShieldCheck className="w-4 h-4 mr-2" /> Medical Vault
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate(role === "guardian" ? "/guardian-settings" : "/settings")}>
                <Settings className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { await signOut(); navigate("/login"); }}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {role === "user" && (
        <nav className="flex gap-1 bg-primary-foreground/10 rounded-lg p-1">
          {[
            { label: "Home", path: "/dashboard" },
            { label: "Appointments", path: "/appointments", glow: todayApptCount > 0 },
            { label: "My Health", path: "/my-health" },
            { label: "Help", path: "/help" },
          ].map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors relative ${
                location.pathname === tab.path
                  ? "bg-primary-foreground text-primary"
                  : "text-primary-foreground/70 hover:text-primary-foreground"
              } ${"glow" in tab && tab.glow ? "ring-2 ring-destructive shadow-[0_0_12px_hsl(var(--destructive))]" : ""}`}
            >
              {tab.label}
              {"glow" in tab && tab.glow && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </nav>
      )}

      {role === "guardian" && (
        <nav className="flex gap-1 bg-primary-foreground/10 rounded-lg p-1">
          {[
            { label: "My User", path: "/guardian" },
            { label: "Alerts", path: "/guardian/alerts" },
            { label: "Reports", path: "/guardian/reports" },
            { label: "Services", path: "/guardian/services" },
            { label: "Settings", path: "/guardian-settings" },
          ].map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                location.pathname === tab.path
                  ? "bg-primary-foreground text-primary"
                  : "text-primary-foreground/70 hover:text-primary-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
};

export default AppHeader;
