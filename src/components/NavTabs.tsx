import { Home, Calendar, Heart, Settings, Shield } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";

const NavTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useApp();

  const userTabs = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Calendar, label: "Appointments", path: "/appointments" },
    { icon: Heart, label: "My Health", path: "/my-health" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const guardianTabs = [
    { icon: Shield, label: "Dashboard", path: "/guardian" },
    { icon: Home, label: "Zones", path: "/settings" },
    { icon: Calendar, label: "Reports", path: "/reports" },
    { icon: Settings, label: "Settings", path: "/guardian-settings" },
  ];

  const tabs = role === "guardian" ? guardianTabs : userTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
      <div className="max-w-md mx-auto flex">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className={`w-5 h-5 mb-1 ${isActive ? "text-primary" : ""}`} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default NavTabs;
