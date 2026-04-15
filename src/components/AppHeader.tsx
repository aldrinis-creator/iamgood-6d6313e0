import { User, LogOut, Settings, UserCircle, ShieldCheck } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";
import AQIWidget from "@/components/AQIWidget";
import AccessibilityMenu from "@/components/AccessibilityMenu";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getISTHour } from "@/lib/istTime";

const AppHeader = () => {
  const { userName, role } = useApp();
  const { signOut } = useAuth();
  const navigate = useNavigate();

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
          <AQIWidget />
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
              <DropdownMenuItem asChild>
                <AccessibilityMenu renderAsMenuItem={true} />
              </DropdownMenuItem>
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

    </header>
  );
};

export default AppHeader;
