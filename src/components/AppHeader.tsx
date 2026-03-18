import { Globe, User, Bell } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useNavigate, useLocation } from "react-router-dom";

const AppHeader = () => {
  const { userName, role } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const getGreeting = () => {
    const hour = new Date().getHours();
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
          <button className="p-2 rounded-full hover:bg-primary-foreground/10 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-sos rounded-full" />
          </button>
          <Globe className="w-5 h-5 opacity-70" />
          <button
            onClick={() => navigate("/settings")}
            className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>

      {role === "user" && (
        <nav className="flex gap-1 bg-primary-foreground/10 rounded-lg p-1">
          {[
            { label: "Home", path: "/dashboard" },
            { label: "Appointments", path: "/appointments" },
            { label: "My Health", path: "/my-health" },
          ].map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
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

      {role === "guardian" && (
        <nav className="flex gap-1 bg-primary-foreground/10 rounded-lg p-1">
          {[
            { label: "Dashboard", path: "/guardian" },
            { label: "Zones", path: "/settings" },
            { label: "Reports", path: "/reports" },
          ].map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
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
